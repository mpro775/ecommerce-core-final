INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('9761fce2-58e3-4b46-bcf1-c8bd3ec06a01', 'platform.dashboard.read', 'Read platform dashboard'),
  ('05be9cae-4d12-4c4c-9da8-cb02e18dcf02', 'platform.stores.read', 'Read stores list and details'),
  ('9e4a81b2-34b7-44d5-bec5-b59f8ec1cb03', 'platform.stores.write', 'Manage stores'),
  ('595157fd-9365-45c5-aa7d-c8dfa5f87d04', 'platform.stores.suspend', 'Suspend stores'),
  ('99a8cf80-25de-4926-bf4c-89b8f0105105', 'platform.stores.resume', 'Resume stores'),
  ('ee2642de-b714-4ab4-922b-b7f453130006', 'platform.plans.read', 'Read plans'),
  ('8f4531e7-07f1-4b56-9de0-7fbc5b477007', 'platform.plans.write', 'Manage plans'),
  ('0d5c47f2-9d5a-43e3-9a0f-8f640fd8ea08', 'platform.subscriptions.read', 'Read subscriptions'),
  ('f769236d-2e97-46dc-ac99-a71ec5597809', 'platform.subscriptions.write', 'Manage subscriptions'),
  ('3924dac8-e09e-4f44-b403-cd4777134510', 'platform.domains.read', 'Read domains'),
  ('43f785df-eb53-4750-b436-2e1ebca9d111', 'platform.domains.write', 'Manage domains'),
  ('40a799bc-fde2-4f43-a7af-6082bbf2c401', 'platform.analytics.read', 'Read platform advanced analytics'),
  ('35226de5-46d9-4817-88e4-f68fcd0e8d12', 'platform.audit.read', 'Read platform audit logs'),
  ('8248cbc9-4b98-45e0-88b2-cf29f15f15a1', 'platform.health.read', 'Read platform health and incidents'),
  ('0f5f7f7c-b751-40d5-a4dc-c947d79a4f01', 'platform.health.write', 'Manage platform incidents'),
  ('0fed5f79-2c6c-4c46-8574-ffef903ebea2', 'platform.notes.read', 'Read platform store notes'),
  ('76f3a5c6-c8df-4e06-a037-c15c3cbc2f41', 'platform.notes.write', 'Manage platform store notes'),
  ('9e7af734-1f3b-49ec-b968-1d9f6ee9d341', 'platform.notes.delete', 'Delete platform store notes'),
  ('d6fdb6e6-373f-4f65-8368-6402f92c6d13', 'platform.admins.read', 'Read platform admins'),
  ('1ef6cf13-7af9-48f4-857f-ff537737f614', 'platform.admins.write', 'Manage platform admins'),
  ('17d0d1e0-0b5a-4f90-82ca-98ee2dc2c215', 'platform.roles.read', 'Read platform roles'),
  ('fc86230c-0b26-4507-a47b-cbc11fa39d16', 'platform.roles.write', 'Manage platform roles'),
  ('ebea3650-83df-4b3e-984a-db722925f617', 'platform.settings.read', 'Read platform settings'),
  ('e3de30a3-c0d6-4f20-ab65-fb86df24dd18', 'platform.settings.write', 'Manage platform settings'),
  ('8a5298b1-8896-4b0d-a9ea-f4cc39926619', 'platform.onboarding.read', 'Read onboarding pipeline'),
  ('00df5009-7c3f-4e3d-ae2c-1e8c346d0d20', 'platform.onboarding.write', 'Manage onboarding pipeline'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0001', 'platform.automation.read', 'Read automation rules and runs'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0002', 'platform.automation.write', 'Manage automation rules'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0003', 'platform.automation.run', 'Trigger automation runs'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0004', 'platform.support.read', 'Read support cases'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0005', 'platform.support.write', 'Manage support cases'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0006', 'platform.risk.read', 'Read risk violations'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0007', 'platform.risk.write', 'Manage risk violations'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0008', 'platform.compliance.read', 'Read compliance tasks'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0009', 'platform.compliance.write', 'Manage compliance tasks'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0010', 'platform.finance.read', 'Read finance operations insights'),
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0011', 'platform.finance.write', 'Manage finance operations actions')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_roles (id, name, code, description)
VALUES
  ('69afb7b5-f2e6-47ce-b780-085ed8239b41', 'Super Admin', 'super_admin', 'Full platform access'),
  ('fe552e6f-c25e-4907-9d35-e8d7af05d542', 'Operations Manager', 'ops_manager', 'Daily platform operations'),
  ('a053f377-ec95-4cfb-af6b-1762acf9f543', 'Support Agent', 'support_agent', 'Support operations access'),
  ('2d74a496-2e98-4214-8e3a-6623f2c16a44', 'Finance Admin', 'finance_admin', 'Billing and plan operations'),
  ('e43af5af-cd5b-4707-8c4e-6b927d571a45', 'Auditor', 'auditor', 'Read-only platform audit access')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
CROSS JOIN platform_admin_permissions p
WHERE LOWER(r.code) = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.stores.read',
    'platform.stores.write',
    'platform.stores.suspend',
    'platform.stores.resume',
    'platform.subscriptions.read',
    'platform.subscriptions.write',
    'platform.domains.read',
    'platform.domains.write',
    'platform.analytics.read',
    'platform.health.read',
    'platform.health.write',
    'platform.notes.read',
    'platform.notes.write',
    'platform.audit.read',
    'platform.onboarding.read',
    'platform.onboarding.write',
    'platform.automation.read',
    'platform.automation.write',
    'platform.automation.run',
    'platform.support.read',
    'platform.support.write',
    'platform.risk.read',
    'platform.risk.write',
    'platform.compliance.read',
    'platform.compliance.write',
    'platform.finance.read',
    'platform.finance.write'
  )
WHERE LOWER(r.code) = 'ops_manager'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.stores.read',
    'platform.subscriptions.read',
    'platform.subscriptions.write',
    'platform.domains.read',
    'platform.domains.write',
    'platform.analytics.read',
    'platform.health.read',
    'platform.notes.read',
    'platform.notes.write',
    'platform.onboarding.read',
    'platform.onboarding.write',
    'platform.automation.read',
    'platform.automation.run',
    'platform.support.read',
    'platform.support.write',
    'platform.risk.read',
    'platform.compliance.read',
    'platform.finance.read'
  )
WHERE LOWER(r.code) = 'support_agent'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.plans.read',
    'platform.plans.write',
    'platform.analytics.read',
    'platform.subscriptions.read',
    'platform.subscriptions.write',
    'platform.health.read',
    'platform.audit.read',
    'platform.automation.read',
    'platform.support.read',
    'platform.risk.read',
    'platform.compliance.read',
    'platform.finance.read',
    'platform.finance.write'
  )
WHERE LOWER(r.code) = 'finance_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.stores.read',
    'platform.subscriptions.read',
    'platform.domains.read',
    'platform.analytics.read',
    'platform.health.read',
    'platform.notes.read',
    'platform.audit.read',
    'platform.plans.read',
    'platform.automation.read',
    'platform.support.read',
    'platform.risk.read',
    'platform.compliance.read',
    'platform.finance.read'
  )
WHERE LOWER(r.code) = 'auditor'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d001', 'platform.payment_methods.read', 'Read platform payment methods'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d002', 'platform.payment_methods.write', 'Manage platform payment methods'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d003', 'platform.theme_templates.read', 'Read theme templates'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d004', 'platform.theme_templates.write', 'Manage theme templates'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d005', 'platform.theme_templates.publish', 'Publish theme templates'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d006', 'platform.theme_templates.archive', 'Archive theme templates'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d007', 'platform.qa.scenarios.read', 'Read QA scenarios'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d008', 'platform.qa.scenarios.write', 'Manage QA scenarios'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d009', 'platform.qa.runs.read', 'Read QA runs'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d00a', 'platform.qa.runs.write', 'Manage QA runs'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d00b', 'platform.qa.issues.manage', 'Manage QA issues')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_roles (id, name, code, description)
VALUES
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d101', 'QA Tester', 'qa_tester', 'QA scenario and run operations'),
  ('3bc24ed7-660e-4cb9-8e0d-43b34f71d102', 'Template Manager', 'template_manager', 'Theme template publishing operations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.payment_methods.read',
    'platform.theme_templates.read',
    'platform.qa.scenarios.read',
    'platform.qa.runs.read',
    'platform.qa.runs.write',
    'platform.stores.read',
    'platform.dashboard.read',
    'platform.support.read',
    'platform.risk.read',
    'platform.compliance.read'
  )
WHERE LOWER(r.code) = 'ops_manager'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.payment_methods.read',
    'platform.finance.read',
    'platform.finance.write',
    'platform.plans.read',
    'platform.plans.write',
    'platform.subscriptions.read',
    'platform.subscriptions.write',
    'platform.audit.read'
  )
WHERE LOWER(r.code) = 'finance_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.stores.read',
    'platform.domains.read',
    'platform.subscriptions.read',
    'platform.support.read',
    'platform.support.write',
    'platform.notes.read',
    'platform.notes.write',
    'platform.qa.runs.read'
  )
WHERE LOWER(r.code) = 'support_agent'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.qa.scenarios.read',
    'platform.qa.runs.read',
    'platform.qa.runs.write',
    'platform.qa.issues.manage',
    'platform.stores.read',
    'platform.dashboard.read'
  )
WHERE LOWER(r.code) = 'qa_tester'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.theme_templates.read',
    'platform.theme_templates.write',
    'platform.theme_templates.publish',
    'platform.theme_templates.archive'
  )
WHERE LOWER(r.code) = 'template_manager'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.dashboard.read',
    'platform.stores.read',
    'platform.plans.read',
    'platform.subscriptions.read',
    'platform.finance.read',
    'platform.domains.read',
    'platform.audit.read',
    'platform.qa.runs.read',
    'platform.risk.read',
    'platform.compliance.read'
  )
WHERE LOWER(r.code) = 'auditor'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
CROSS JOIN platform_admin_permissions p
WHERE LOWER(r.code) = 'super_admin'
ON CONFLICT DO NOTHING;
