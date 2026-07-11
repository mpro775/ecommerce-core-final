import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const MIGRATIONS_DIR = path.resolve('migrations');
const command = process.argv[2];

if (!['up', 'down'].includes(command)) {
  throw new Error('Usage: node scripts/migrate.mjs <up|down>');
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store';

const client = new pg.Client({ connectionString });

function normalizeSql(sql) {
  if (!sql) {
    return sql;
  }

  // Some editors save UTF-8 BOM at file start; PostgreSQL may reject it as syntax noise.
  return sql.replace(/^\uFEFF/, '');
}

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function readMigrationPairs() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const upFiles = entries.filter((entry) => entry.endsWith('.up.sql')).sort();
  return upFiles.map((upFile) => {
    const downFile = upFile.replace('.up.sql', '.down.sql');
    return {
      name: upFile.replace('.up.sql', ''),
      upFile,
      downFile,
    };
  });
}

async function migrateUp() {
  const pairs = await readMigrationPairs();
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
  const applied = new Set(rows.map((row) => row.name));

  for (const pair of pairs) {
    if (applied.has(pair.name)) {
      continue;
    }

    const upSql = normalizeSql(await fs.readFile(path.join(MIGRATIONS_DIR, pair.upFile), 'utf8'));
    await client.query('BEGIN');
    try {
      await client.query(upSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [pair.name]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${pair.name}`);
    } catch (error) {
      console.error(`Failed to apply migration: ${pair.name}`);
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

async function migrateDown() {
  const { rows } = await client.query(
    'SELECT id, name FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );
  if (rows.length === 0) {
    console.log('No migration to rollback.');
    return;
  }

  const last = rows[0];
  const downPath = path.join(MIGRATIONS_DIR, `${last.name}.down.sql`);
  const downSql = normalizeSql(await fs.readFile(downPath, 'utf8'));

  await client.query('BEGIN');
  try {
    await client.query(downSql);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [last.id]);
    await client.query('COMMIT');
    console.log(`Rolled back migration: ${last.name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

try {
  await client.connect();
  await ensureMigrationsTable();

  if (command === 'up') {
    await migrateUp();
  } else {
    await migrateDown();
  }
} finally {
  await client.end();
}
