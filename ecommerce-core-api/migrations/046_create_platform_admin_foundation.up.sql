CREATE TABLE IF NOT EXISTS platform_admin_users (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_users_email_unique
  ON platform_admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS platform_admin_roles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_roles_code_unique
  ON platform_admin_roles (LOWER(code));

CREATE TABLE IF NOT EXISTS platform_admin_permissions (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_permissions_key_unique
  ON platform_admin_permissions (key);

CREATE TABLE IF NOT EXISTS platform_admin_role_permissions (
  role_id UUID NOT NULL REFERENCES platform_admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES platform_admin_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS platform_admin_user_roles (
  user_id UUID NOT NULL REFERENCES platform_admin_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES platform_admin_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS platform_admin_sessions (
  id UUID PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES platform_admin_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_user
  ON platform_admin_sessions (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_expires
  ON platform_admin_sessions (expires_at);
