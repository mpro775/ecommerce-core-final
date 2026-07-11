CREATE TABLE IF NOT EXISTS platform_store_notes (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  author_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_store_notes_store_created
  ON platform_store_notes (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_store_notes_author
  ON platform_store_notes (author_admin_id);

CREATE TABLE IF NOT EXISTS platform_incidents (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  service TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  related_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  created_by_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_status_created
  ON platform_incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_service_created
  ON platform_incidents (service, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('8248cbc9-4b98-45e0-88b2-cf29f15f15a1', 'platform.health.read', 'Read platform health and incidents'),
  ('0fed5f79-2c6c-4c46-8574-ffef903ebea2', 'platform.notes.read', 'Read platform store notes'),
  ('76f3a5c6-c8df-4e06-a037-c15c3cbc2f41', 'platform.notes.write', 'Manage platform store notes'),
  ('9e7af734-1f3b-49ec-b968-1d9f6ee9d341', 'platform.notes.delete', 'Delete platform store notes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN ('platform.health.read', 'platform.notes.read', 'platform.notes.write')
WHERE LOWER(r.code) IN ('super_admin', 'ops_manager', 'support_agent')
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN ('platform.health.read')
WHERE LOWER(r.code) IN ('finance_admin')
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN ('platform.health.read', 'platform.notes.read')
WHERE LOWER(r.code) IN ('auditor')
ON CONFLICT DO NOTHING;
