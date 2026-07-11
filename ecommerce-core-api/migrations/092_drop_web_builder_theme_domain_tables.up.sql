BEGIN;

DROP TABLE IF EXISTS platform_theme_template_preview_tokens CASCADE;
DROP TABLE IF EXISTS theme_template_versions CASCADE;
DROP TABLE IF EXISTS theme_templates CASCADE;
DROP TABLE IF EXISTS theme_versions CASCADE;
DROP TABLE IF EXISTS theme_preview_tokens CASCADE;
DROP TABLE IF EXISTS store_themes CASCADE;
DROP TABLE IF EXISTS store_domains CASCADE;

DROP TABLE IF EXISTS seo_audit_runs CASCADE;
DROP TABLE IF EXISTS seo_fix_logs CASCADE;

COMMIT;
