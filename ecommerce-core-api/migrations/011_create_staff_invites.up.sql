CREATE TABLE IF NOT EXISTS staff_invites (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  invited_by_user_id UUID NOT NULL REFERENCES store_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_store_id
  ON staff_invites (store_id);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token_hash
  ON staff_invites (token_hash);

CREATE INDEX IF NOT EXISTS idx_staff_invites_email
  ON staff_invites (LOWER(email));

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY,
  store_user_id UUID NOT NULL REFERENCES store_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
  ON password_resets (store_user_id);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash
  ON password_resets (token_hash);
