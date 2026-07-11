ALTER TABLE store_users
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE IF NOT EXISTS owner_registration_challenges (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  store_name TEXT NOT NULL,
  store_slug TEXT NOT NULL,
  store_phone TEXT,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  verify_attempts INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_registration_challenges_email
  ON owner_registration_challenges (email_normalized);

CREATE INDEX IF NOT EXISTS idx_owner_registration_challenges_store_slug
  ON owner_registration_challenges (store_slug);

CREATE INDEX IF NOT EXISTS idx_owner_registration_challenges_otp_expires_at
  ON owner_registration_challenges (otp_expires_at);
