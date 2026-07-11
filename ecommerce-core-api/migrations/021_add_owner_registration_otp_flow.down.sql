DROP INDEX IF EXISTS idx_owner_registration_challenges_otp_expires_at;
DROP INDEX IF EXISTS idx_owner_registration_challenges_store_slug;
DROP INDEX IF EXISTS idx_owner_registration_challenges_email;
DROP TABLE IF EXISTS owner_registration_challenges;

ALTER TABLE store_users
  DROP COLUMN IF EXISTS phone;
