import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const through = process.env.MIGRATION_THROUGH ?? '097';
if (!connectionString) throw new Error('DATABASE_URL is required');

const parsed = new URL(connectionString);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.slice(1).startsWith('nojoom_phase12_')) {
  throw new Error('Fixture preparation is restricted to local nojoom_phase12_* databases');
}

const client = new pg.Client({ connectionString });
const migrationsDir = path.resolve('migrations');

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.up.sql') && file.slice(0, 3) <= through)
    .sort();

  for (const file of files) {
    const name = file.replace('.up.sql', '');
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount) continue;

    const sql = (await fs.readFile(path.join(migrationsDir, file), 'utf8')).replace(/^\uFEFF/u, '');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied fixture migration: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed fixture migration: ${name}`);
      throw error;
    }
  }
} finally {
  await client.end();
}

