CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_platform_admin_id UUID NULL REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS purge_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS purge_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS purge_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS purge_error TEXT NULL;

UPDATE stores
SET status = CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END
WHERE status IS NULL OR status = '';

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_status_check,
  DROP CONSTRAINT IF EXISTS stores_purge_status_check;

ALTER TABLE stores
  ADD CONSTRAINT stores_status_check
    CHECK (status IN ('active', 'suspended', 'deleted')),
  ADD CONSTRAINT stores_purge_status_check
    CHECK (purge_status IN ('not_started', 'pending', 'processing', 'completed', 'failed'));

ALTER TABLE store_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS original_email_hash TEXT NULL;

DROP INDEX IF EXISTS idx_store_users_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_users_active_email
  ON store_users (LOWER(email))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stores_status
  ON stores (status);

CREATE INDEX IF NOT EXISTS idx_stores_deleted_at
  ON stores (deleted_at);

CREATE INDEX IF NOT EXISTS idx_stores_purge_status
  ON stores (purge_status);

CREATE INDEX IF NOT EXISTS idx_store_users_deleted_at
  ON store_users (deleted_at);

ALTER TABLE store_domains
  DROP CONSTRAINT IF EXISTS store_domains_status_check;

ALTER TABLE store_domains
  ADD CONSTRAINT store_domains_status_check
    CHECK (status IN ('pending', 'verified', 'active', 'disabled'));

CREATE TABLE IF NOT EXISTS store_deletion_purge_jobs (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  requested_by_platform_admin_id UUID NULL REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_store_deletion_purge_jobs_status
  ON store_deletion_purge_jobs (status, requested_at);

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('4e028ec7-d4b2-45ce-aa90-35d7f43d8701', 'platform.stores.delete.preview', 'Preview permanent operational store deletion impact'),
  ('4e028ec7-d4b2-45ce-aa90-35d7f43d8702', 'platform.stores.delete.confirm', 'Confirm permanent operational store deletion'),
  ('4e028ec7-d4b2-45ce-aa90-35d7f43d8703', 'platform.stores.delete.status', 'Read permanent store deletion and purge status'),
  ('4e028ec7-d4b2-45ce-aa90-35d7f43d8704', 'platform.stores.purge.retry', 'Retry failed store operational data purge')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.stores.delete.preview',
    'platform.stores.delete.confirm',
    'platform.stores.delete.status',
    'platform.stores.purge.retry'
  )
WHERE LOWER(r.code) IN ('super_admin')
ON CONFLICT DO NOTHING;
