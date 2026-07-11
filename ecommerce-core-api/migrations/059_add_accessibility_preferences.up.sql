ALTER TABLE store_users
  ADD COLUMN IF NOT EXISTS accessibility_preferences JSONB NOT NULL DEFAULT '{
    "highContrast": false,
    "reducedMotion": false,
    "fontScale": "100",
    "underlineLinks": false,
    "strongFocusRing": true
  }'::jsonb;
