DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id
  FROM platform_admin_permissions
  WHERE key IN (
    'platform.automation.read',
    'platform.automation.write',
    'platform.automation.run',
    'platform.support.read',
    'platform.support.write',
    'platform.risk.read',
    'platform.risk.write',
    'platform.compliance.read',
    'platform.compliance.write',
    'platform.health.write',
    'platform.finance.read',
    'platform.finance.write'
  )
);

DELETE FROM platform_admin_permissions
WHERE key IN (
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
);

DROP TABLE IF EXISTS platform_compliance_tasks;
DROP TABLE IF EXISTS platform_risk_violations;
DROP TABLE IF EXISTS platform_support_case_events;
DROP TABLE IF EXISTS platform_support_cases;
DROP TABLE IF EXISTS platform_automation_runs;
DROP TABLE IF EXISTS platform_automation_rules;
