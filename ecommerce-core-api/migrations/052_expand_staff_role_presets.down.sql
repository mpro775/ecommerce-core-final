ALTER TABLE store_users
  DROP CONSTRAINT IF EXISTS store_users_role_check;

DROP INDEX IF EXISTS idx_store_users_single_owner_per_store;

ALTER TABLE staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_role_check;

UPDATE store_users
SET role = 'staff',
    updated_at = NOW()
WHERE role <> 'owner';

UPDATE staff_invites
SET role = 'staff'
WHERE role NOT IN ('owner', 'staff');

ALTER TABLE store_users
  ADD CONSTRAINT store_users_role_check
  CHECK (role IN ('owner', 'staff'));

ALTER TABLE staff_invites
  ADD CONSTRAINT staff_invites_role_check
  CHECK (role IN ('owner', 'staff'));
