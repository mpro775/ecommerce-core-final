ALTER TABLE store_users
  DROP CONSTRAINT IF EXISTS store_users_role_check;

ALTER TABLE staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_role_check;

UPDATE store_users
SET role = 'operations',
    updated_at = NOW()
WHERE role = 'staff';

UPDATE staff_invites
SET role = CASE
    WHEN role = 'owner' THEN 'manager'
    ELSE 'operations'
  END
WHERE role IN ('owner', 'staff');

ALTER TABLE store_users
  ADD CONSTRAINT store_users_role_check
  CHECK (
    role IN (
      'owner',
      'manager',
      'operations',
      'catalog',
      'support',
      'finance',
      'internal_marketing'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_users_single_owner_per_store
  ON store_users (store_id)
  WHERE role = 'owner';

ALTER TABLE staff_invites
  ADD CONSTRAINT staff_invites_role_check
  CHECK (
    role IN (
      'manager',
      'operations',
      'catalog',
      'support',
      'finance',
      'internal_marketing'
    )
  );
