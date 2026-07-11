CREATE TABLE IF NOT EXISTS platform_automation_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  created_by_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  updated_by_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_automation_rules_active
  ON platform_automation_rules (is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_automation_runs (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES platform_automation_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  triggered_by_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  logs TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_automation_runs_rule_created
  ON platform_automation_runs (rule_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_support_cases (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'escalated', 'resolved', 'closed')),
  queue TEXT NOT NULL DEFAULT 'general',
  assignee_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  impact_score INTEGER NOT NULL DEFAULT 0,
  created_by_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_support_cases_status_priority
  ON platform_support_cases (status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_support_case_events (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES platform_support_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_support_case_events_case_created
  ON platform_support_case_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_risk_violations (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'mitigated', 'accepted', 'resolved')),
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  owner_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_risk_violations_status_severity
  ON platform_risk_violations (status, severity, updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_compliance_tasks (
  id UUID PRIMARY KEY,
  violation_id UUID REFERENCES platform_risk_violations(id) ON DELETE SET NULL,
  policy_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
  due_at TIMESTAMPTZ,
  assignee_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_compliance_tasks_status_due
  ON platform_compliance_tasks (status, due_at ASC);

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
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
  ('b98a0de5-f799-41ad-b323-cdfbdb7f0011', 'platform.finance.write', 'Manage finance operations actions'),
  ('0f5f7f7c-b751-40d5-a4dc-c947d79a4f01', 'platform.health.write', 'Manage platform incidents')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
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
WHERE LOWER(r.code) = 'ops_manager'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
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
    'platform.finance.read',
    'platform.finance.write',
    'platform.risk.read',
    'platform.compliance.read',
    'platform.support.read',
    'platform.automation.read'
  )
WHERE LOWER(r.code) = 'finance_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.automation.read',
    'platform.support.read',
    'platform.risk.read',
    'platform.compliance.read',
    'platform.finance.read'
  )
WHERE LOWER(r.code) = 'auditor'
ON CONFLICT DO NOTHING;
