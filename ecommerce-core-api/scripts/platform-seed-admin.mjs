import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import argon2 from 'argon2';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store';

const email = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';
const fullName = (process.env.PLATFORM_ADMIN_NAME ?? 'Platform Super Admin').trim();
const roleCode = (process.env.PLATFORM_ADMIN_ROLE_CODE ?? 'super_admin').trim().toLowerCase();

if (!email) {
  throw new Error('PLATFORM_ADMIN_EMAIL is required');
}

if (password.length < 8) {
  throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 8 characters');
}

const client = new pg.Client({ connectionString });

async function ensureRole(roleCodeInput) {
  const roleRes = await client.query(
    `
      SELECT id
      FROM platform_admin_roles
      WHERE LOWER(code) = LOWER($1)
      LIMIT 1
    `,
    [roleCodeInput],
  );

  if (roleRes.rows[0]) {
    return roleRes.rows[0].id;
  }

  const id = randomUUID();
  await client.query(
    `
      INSERT INTO platform_admin_roles (id, name, code, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
    `,
    [id, 'Super Admin', roleCodeInput, 'Auto-created role by platform seed script'],
  );

  const permissionsRes = await client.query('SELECT id FROM platform_admin_permissions');
  for (const row of permissionsRes.rows) {
    await client.query(
      `
        INSERT INTO platform_admin_role_permissions (role_id, permission_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `,
      [id, row.id],
    );
  }

  return id;
}

async function run() {
  await client.connect();

  const hashedPassword = await argon2.hash(password);
  const roleId = await ensureRole(roleCode);

  await client.query('BEGIN');
  try {
    const userRes = await client.query(
      `
        SELECT id
        FROM platform_admin_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email],
    );

    let userId;
    if (userRes.rows[0]) {
      userId = userRes.rows[0].id;
      await client.query(
        `
          UPDATE platform_admin_users
          SET full_name = $2,
              password_hash = $3,
              status = 'active',
              updated_at = NOW()
          WHERE id = $1
        `,
        [userId, fullName, hashedPassword],
      );
    } else {
      userId = randomUUID();
      await client.query(
        `
          INSERT INTO platform_admin_users (
            id,
            full_name,
            email,
            password_hash,
            status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
        `,
        [userId, fullName, email, hashedPassword],
      );
    }

    await client.query(
      `
        INSERT INTO platform_admin_user_roles (user_id, role_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `,
      [userId, roleId],
    );

    await client.query('COMMIT');
    console.log(`Platform admin ready: ${email} (role=${roleCode})`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

await run();
