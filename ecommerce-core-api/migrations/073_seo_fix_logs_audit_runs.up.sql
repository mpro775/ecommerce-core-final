CREATE TABLE IF NOT EXISTS seo_fix_logs (
  id uuid PRIMARY KEY,
  merchant_id uuid NULL,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  actor_id text NULL,
  actor_type text NOT NULL DEFAULT 'merchant',
  scope text NOT NULL,
  target_id uuid NULL,
  target_name text NULL,
  fix_type text NOT NULL,
  fields_changed jsonb NOT NULL DEFAULT '[]'::jsonb,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'template',
  status text NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_fix_logs_store_created_at
  ON seo_fix_logs(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seo_audit_runs (
  id uuid PRIMARY KEY,
  merchant_id uuid NULL,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  score integer NOT NULL,
  critical_count integer NOT NULL DEFAULT 0,
  high_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  low_count integer NOT NULL DEFAULT 0,
  fixable_count integer NOT NULL DEFAULT 0,
  manual_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_audit_runs_store_created_at
  ON seo_audit_runs(store_id, created_at DESC);
