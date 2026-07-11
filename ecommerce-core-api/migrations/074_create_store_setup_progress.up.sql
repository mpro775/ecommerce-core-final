CREATE TABLE IF NOT EXISTS store_setup_progress (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  step_key VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL,
  skipped_reason VARCHAR(255),
  skipped_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, step_key),
  CONSTRAINT chk_store_setup_progress_status
    CHECK (status IN ('skipped', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_store_setup_progress_store
  ON store_setup_progress (store_id);
