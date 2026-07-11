CREATE TABLE IF NOT EXISTS qa_scenarios (
  id UUID PRIMARY KEY,
  scenario_key TEXT NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_file TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_scenarios_key_unique
  ON qa_scenarios (scenario_key);

CREATE INDEX IF NOT EXISTS idx_qa_scenarios_active
  ON qa_scenarios (is_active);

CREATE TABLE IF NOT EXISTS qa_phases (
  id UUID PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  order_index INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_result TEXT,
  weight NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_phases_order_positive_check CHECK (order_index > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_phases_scenario_phase_key_unique
  ON qa_phases (scenario_id, phase_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_phases_scenario_order_unique
  ON qa_phases (scenario_id, order_index);

CREATE TABLE IF NOT EXISTS qa_checks (
  id UUID PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES qa_phases(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL,
  order_index INT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'status',
  required BOOLEAN NOT NULL DEFAULT TRUE,
  weight NUMERIC,
  expected_result TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_checks_order_positive_check CHECK (order_index > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_checks_phase_key_unique
  ON qa_checks (phase_id, check_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_checks_phase_order_unique
  ON qa_checks (phase_id, order_index);

CREATE INDEX IF NOT EXISTS idx_qa_checks_scenario
  ON qa_checks (scenario_id);

CREATE TABLE IF NOT EXISTS qa_questions (
  id UUID PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES qa_phases(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  order_index INT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_questions_order_positive_check CHECK (order_index > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_questions_phase_key_unique
  ON qa_questions (phase_id, question_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_questions_phase_order_unique
  ON qa_questions (phase_id, order_index);

CREATE INDEX IF NOT EXISTS idx_qa_questions_scenario
  ON qa_questions (scenario_id);

CREATE TABLE IF NOT EXISTS qa_runs (
  id UUID PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE RESTRICT,
  scenario_key TEXT NOT NULL,
  scenario_version TEXT NOT NULL,
  scenario_checksum TEXT NOT NULL,
  scenario_snapshot JSONB,
  tester_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  tester_name TEXT,
  status TEXT NOT NULL,
  current_phase_id UUID REFERENCES qa_phases(id) ON DELETE SET NULL,
  current_phase_key TEXT,
  current_check_id UUID REFERENCES qa_checks(id) ON DELETE SET NULL,
  current_check_key TEXT,
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  environment TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_size TEXT,
  build_version TEXT,
  test_round TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_runs_status_check CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'blocked', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_qa_runs_scenario
  ON qa_runs (scenario_id);

CREATE INDEX IF NOT EXISTS idx_qa_runs_tester_status
  ON qa_runs (tester_id, status);

CREATE TABLE IF NOT EXISTS qa_answers (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE RESTRICT,
  phase_id UUID REFERENCES qa_phases(id) ON DELETE SET NULL,
  check_id UUID REFERENCES qa_checks(id) ON DELETE SET NULL,
  question_id UUID REFERENCES qa_questions(id) ON DELETE SET NULL,
  answer_target_key TEXT NOT NULL,
  status TEXT,
  value JSONB,
  note TEXT,
  rating NUMERIC,
  answered_by UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_answers_status_check CHECK (status IS NULL OR status IN ('pass', 'fail', 'blocked', 'not_applicable')),
  CONSTRAINT qa_answers_single_target_check CHECK (
    (check_id IS NOT NULL AND question_id IS NULL) OR
    (check_id IS NULL AND question_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_answers_run_target_unique
  ON qa_answers (run_id, answer_target_key);

CREATE INDEX IF NOT EXISTS idx_qa_answers_run
  ON qa_answers (run_id);

CREATE TABLE IF NOT EXISTS qa_issues (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE RESTRICT,
  phase_id UUID REFERENCES qa_phases(id) ON DELETE SET NULL,
  check_id UUID REFERENCES qa_checks(id) ON DELETE SET NULL,
  question_id UUID REFERENCES qa_questions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  steps_to_reproduce TEXT,
  expected_result TEXT,
  actual_result TEXT,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT qa_issues_status_check CHECK (status IN ('open', 'triaged', 'fixed', 'wont_fix', 'verified'))
);

CREATE INDEX IF NOT EXISTS idx_qa_issues_run
  ON qa_issues (run_id);

CREATE INDEX IF NOT EXISTS idx_qa_issues_severity
  ON qa_issues (severity);

CREATE TABLE IF NOT EXISTS qa_attachments (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES qa_scenarios(id) ON DELETE RESTRICT,
  issue_id UUID REFERENCES qa_issues(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES qa_phases(id) ON DELETE SET NULL,
  check_id UUID REFERENCES qa_checks(id) ON DELETE SET NULL,
  question_id UUID REFERENCES qa_questions(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  etag TEXT,
  file_name TEXT,
  uploaded_by UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_attachments_size_positive_check CHECK (file_size_bytes > 0),
  CONSTRAINT qa_attachments_target_type_check CHECK (target_type IN ('run', 'phase', 'check', 'question', 'issue'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_attachments_object_key_unique
  ON qa_attachments (object_key);

CREATE INDEX IF NOT EXISTS idx_qa_attachments_run
  ON qa_attachments (run_id);

CREATE TABLE IF NOT EXISTS qa_run_summaries (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  total_checks INT NOT NULL DEFAULT 0,
  passed_checks INT NOT NULL DEFAULT 0,
  failed_checks INT NOT NULL DEFAULT 0,
  blocked_checks INT NOT NULL DEFAULT 0,
  not_applicable_checks INT NOT NULL DEFAULT 0,
  success_percent NUMERIC,
  readiness_status TEXT NOT NULL,
  issues_count INT NOT NULL DEFAULT 0,
  critical_issues_count INT NOT NULL DEFAULT 0,
  high_issues_count INT NOT NULL DEFAULT 0,
  most_problematic_phase_id UUID REFERENCES qa_phases(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_run_summaries_readiness_check CHECK (readiness_status IN ('ready', 'ready_with_fixes', 'not_ready', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_run_summaries_run_unique
  ON qa_run_summaries (run_id);

CREATE TABLE IF NOT EXISTS qa_run_events (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_run_events_run
  ON qa_run_events (run_id);

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('a7a01922-89be-4392-a6a4-000000000001', 'platform.qa.scenarios.read', 'Read QA runner scenarios'),
  ('a7a01922-89be-4392-a6a4-000000000002', 'platform.qa.scenarios.write', 'Import and publish QA runner scenarios'),
  ('a7a01922-89be-4392-a6a4-000000000003', 'platform.qa.runs.read', 'Read QA runner runs'),
  ('a7a01922-89be-4392-a6a4-000000000004', 'platform.qa.runs.write', 'Create and update QA runner runs'),
  ('a7a01922-89be-4392-a6a4-000000000005', 'platform.qa.issues.manage', 'Manage QA runner issues')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.qa.scenarios.read',
    'platform.qa.scenarios.write',
    'platform.qa.runs.read',
    'platform.qa.runs.write',
    'platform.qa.issues.manage'
  )
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;
