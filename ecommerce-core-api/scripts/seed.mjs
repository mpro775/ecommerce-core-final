import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const SEEDS_DIR = path.resolve('seeds');
const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store';

const client = new pg.Client({ connectionString });

async function runSeeds() {
  const files = (await fs.readdir(SEEDS_DIR)).filter((name) => name.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(SEEDS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`Executed seed: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

try {
  await client.connect();
  await runSeeds();
} finally {
  await client.end();
}
