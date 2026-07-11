CREATE INDEX IF NOT EXISTS idx_qa_runs_status
  ON qa_runs (status);

CREATE INDEX IF NOT EXISTS idx_qa_runs_environment
  ON qa_runs (environment);

CREATE INDEX IF NOT EXISTS idx_qa_runs_started_at
  ON qa_runs (started_at);

CREATE INDEX IF NOT EXISTS idx_qa_runs_test_round
  ON qa_runs (test_round);

CREATE INDEX IF NOT EXISTS idx_qa_runs_build_version
  ON qa_runs (build_version);

CREATE INDEX IF NOT EXISTS idx_qa_answers_check
  ON qa_answers (check_id);

CREATE INDEX IF NOT EXISTS idx_qa_answers_phase
  ON qa_answers (phase_id);

CREATE INDEX IF NOT EXISTS idx_qa_issues_scenario
  ON qa_issues (scenario_id);

CREATE INDEX IF NOT EXISTS idx_qa_issues_phase
  ON qa_issues (phase_id);

CREATE INDEX IF NOT EXISTS idx_qa_issues_category
  ON qa_issues (category);

CREATE INDEX IF NOT EXISTS idx_qa_issues_status
  ON qa_issues (status);

CREATE INDEX IF NOT EXISTS idx_qa_issues_blocking
  ON qa_issues (is_blocking);

CREATE INDEX IF NOT EXISTS idx_qa_attachments_issue
  ON qa_attachments (issue_id);
