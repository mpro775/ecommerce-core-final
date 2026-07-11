import { Pool, type PoolClient } from 'pg';

const batchSize = Number(process.env.STORE_DELETION_PURGE_BATCH_SIZE ?? '10');
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store';

interface PurgeJob {
  id: string;
  store_id: string;
}

async function claimJobs(client: PoolClient): Promise<PurgeJob[]> {
  const result = await client.query<PurgeJob>(
    `
      UPDATE store_deletion_purge_jobs job
      SET status = 'processing',
          attempts = attempts + 1,
          started_at = NOW(),
          last_error = NULL
      WHERE job.id IN (
        SELECT id
        FROM store_deletion_purge_jobs
        WHERE status = 'pending'
        ORDER BY requested_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, store_id
    `,
    [batchSize],
  );
  return result.rows;
}

async function processJob(pool: Pool, job: PurgeJob): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        UPDATE stores
        SET purge_status = 'processing',
            purge_started_at = COALESCE(purge_started_at, NOW()),
            purge_error = NULL,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'deleted'
      `,
      [job.store_id],
    );

    await purgeOperationalData(client, job.store_id);

    await client.query(
      `
        UPDATE store_deletion_purge_jobs
        SET status = 'completed',
            completed_at = NOW(),
            last_error = NULL
        WHERE id = $1
      `,
      [job.id],
    );
    await client.query(
      `
        UPDATE stores
        SET purge_status = 'completed',
            purge_completed_at = NOW(),
            purge_error = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [job.store_id],
    );
    await insertAudit(client, job.store_id, 'platform.store_purge_completed', {
      purgeJobId: job.id,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(pool, job, message);
  } finally {
    client.release();
  }
}

async function purgeOperationalData(client: PoolClient, storeId: string): Promise<void> {
  if (await tableExists(client, 'products')) {
    await client.query(
      `
        UPDATE products
        SET status = 'archived',
            updated_at = NOW()
        WHERE store_id = $1
          AND status <> 'archived'
      `,
      [storeId],
    );
  }

  for (const table of [
    'categories',
    'brands',
    'coupons',
    'offers',
    'advanced_offers',
    'webhook_endpoints',
    'warehouses',
    'filters',
    'attribute_values',
    'attributes',
  ]) {
    if (await tableExists(client, table)) {
      await client.query(
        `
          UPDATE ${table}
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE store_id = $1
        `,
        [storeId],
      );
    }
  }
}

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

async function markFailed(pool: Pool, job: PurgeJob, message: string): Promise<void> {
  await pool.query(
    `
      UPDATE store_deletion_purge_jobs
      SET status = 'failed',
          completed_at = NOW(),
          last_error = $2
      WHERE id = $1
    `,
    [job.id, message],
  );
  await pool.query(
    `
      UPDATE stores
      SET purge_status = 'failed',
          purge_error = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [job.store_id, message],
  );
  await pool.query(
    `
      INSERT INTO audit_logs (
        id,
        actor_type,
        actor_id,
        store_id,
        store_user_id,
        platform_admin_id,
        customer_id,
        action,
        category,
        severity,
        target_type,
        target_id,
        before_snapshot,
        after_snapshot,
        ip_address,
        user_agent,
        request_id,
        metadata
      ) VALUES (gen_random_uuid(), 'system', NULL, $1, NULL, NULL, NULL, 'platform.store_purge_failed', 'platform_store_deletion', 'critical', 'store_deletion_purge_job', $2, NULL, NULL, NULL, NULL, NULL, $3::jsonb)
    `,
    [job.store_id, job.id, JSON.stringify({ purgeJobId: job.id, error: message })],
  );
}

async function insertAudit(
  client: PoolClient,
  storeId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_logs (
        id,
        actor_type,
        actor_id,
        store_id,
        store_user_id,
        platform_admin_id,
        customer_id,
        action,
        category,
        severity,
        target_type,
        target_id,
        before_snapshot,
        after_snapshot,
        ip_address,
        user_agent,
        request_id,
        metadata
      ) VALUES (gen_random_uuid(), 'system', NULL, $1, NULL, NULL, NULL, $2, 'platform_store_deletion', 'info', 'store', $1, NULL, NULL, NULL, NULL, NULL, $3::jsonb)
    `,
    [storeId, action, JSON.stringify(metadata)],
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jobs = await claimJobs(client);
    await client.query('COMMIT');
    for (const job of jobs) {
      await processJob(pool, job);
    }
    console.log(`Processed ${jobs.length} store deletion purge job(s)`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
