DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id FROM platform_admin_permissions
  WHERE key IN (
    'platform.qa.scenarios.read',
    'platform.qa.scenarios.write',
    'platform.qa.runs.read',
    'platform.qa.runs.write',
    'platform.qa.issues.manage'
  )
);

DELETE FROM platform_admin_permissions
WHERE key IN (
  'platform.qa.scenarios.read',
  'platform.qa.scenarios.write',
  'platform.qa.runs.read',
  'platform.qa.runs.write',
  'platform.qa.issues.manage'
);

DROP TABLE IF EXISTS qa_run_events;
DROP TABLE IF EXISTS qa_run_summaries;
DROP TABLE IF EXISTS qa_attachments;
DROP TABLE IF EXISTS qa_issues;
DROP TABLE IF EXISTS qa_answers;
DROP TABLE IF EXISTS qa_runs;
DROP TABLE IF EXISTS qa_questions;
DROP TABLE IF EXISTS qa_checks;
DROP TABLE IF EXISTS qa_phases;
DROP TABLE IF EXISTS qa_scenarios;
