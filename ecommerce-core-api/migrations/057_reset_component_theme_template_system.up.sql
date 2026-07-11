ALTER TABLE theme_templates
  ADD COLUMN IF NOT EXISTS renderer_type TEXT NOT NULL DEFAULT 'component',
  ADD COLUMN IF NOT EXISTS component_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allowed_plans TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS min_storefront_version TEXT;

ALTER TABLE theme_templates
  DROP CONSTRAINT IF EXISTS theme_templates_renderer_type_check,
  ADD CONSTRAINT theme_templates_renderer_type_check CHECK (renderer_type = 'component');

DELETE FROM theme_template_versions;
DELETE FROM theme_templates;
DELETE FROM theme_versions WHERE config ? 'sections';
DELETE FROM store_themes WHERE draft_config ? 'sections' OR published_config ? 'sections';

ALTER TABLE theme_template_versions
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS config_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS settings_schema_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS assets_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS capabilities_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS changelog TEXT;

INSERT INTO theme_templates (
  template_key,
  name,
  description,
  category,
  renderer_type,
  component_key,
  status,
  version,
  is_premium,
  allowed_plans,
  thumbnail_url,
  preview_image_url,
  preview_images,
  assets,
  settings_schema,
  default_config,
  draft_config,
  published_config,
  capabilities,
  published_at
) VALUES
(
  'general-starter',
  'General Starter',
  'قالب عام واحترافي مناسب لمعظم المتاجر كبداية قوية.',
  'general',
  'component',
  'general-starter',
  'published',
  1,
  false,
  ARRAY[]::TEXT[],
  'https://cdn.your-domain.com/templates/general-starter/thumb.webp',
  'https://cdn.your-domain.com/templates/general-starter/home.webp',
  '["https://cdn.your-domain.com/templates/general-starter/home.webp","https://cdn.your-domain.com/templates/general-starter/products.webp","https://cdn.your-domain.com/templates/general-starter/mobile.webp"]'::jsonb,
  '{}'::jsonb,
  '{"hero.headline":{"type":"text","label":"عنوان الواجهة","maxLength":80},"hero.subheadline":{"type":"textarea","label":"وصف الواجهة","maxLength":180},"hero.imageUrl":{"type":"image","label":"صورة الواجهة"},"products.limit":{"type":"number","label":"عدد المنتجات","min":4,"max":16}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"general-starter","renderer":"component","componentKey":"general-starter","version":1},"settings":{"hero":{"headline":"مرحباً بك في متجرنا","subheadline":"تجربة تسوق سهلة وسريعة مع منتجات مختارة بعناية.","primaryCtaLabel":"تصفح المنتجات","primaryCtaHref":"/categories","imageUrl":""},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"general-starter","renderer":"component","componentKey":"general-starter","version":1},"settings":{"hero":{"headline":"مرحباً بك في متجرنا","subheadline":"تجربة تسوق سهلة وسريعة مع منتجات مختارة بعناية.","primaryCtaLabel":"تصفح المنتجات","primaryCtaHref":"/categories","imageUrl":""},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"general-starter","renderer":"component","componentKey":"general-starter","version":1},"settings":{"hero":{"headline":"مرحباً بك في متجرنا","subheadline":"تجربة تسوق سهلة وسريعة مع منتجات مختارة بعناية.","primaryCtaLabel":"تصفح المنتجات","primaryCtaHref":"/categories","imageUrl":""},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"rtl":true,"responsive":true,"supportsOffers":true,"supportsDarkMode":false}'::jsonb,
  NOW()
),
(
  'fashion-editorial',
  'Fashion Editorial',
  'قالب تحريري فاخر للموضة والعلامات التي تعتمد على الصورة والقصة.',
  'fashion',
  'component',
  'fashion-editorial',
  'published',
  1,
  false,
  ARRAY[]::TEXT[],
  'https://cdn.your-domain.com/templates/fashion-editorial/thumb.webp',
  'https://cdn.your-domain.com/templates/fashion-editorial/home.webp',
  '["https://cdn.your-domain.com/templates/fashion-editorial/home.webp","https://cdn.your-domain.com/templates/fashion-editorial/products.webp","https://cdn.your-domain.com/templates/fashion-editorial/mobile.webp"]'::jsonb,
  '{}'::jsonb,
  '{"hero.headline":{"type":"text","label":"عنوان الهيرو","maxLength":80},"hero.subheadline":{"type":"textarea","label":"وصف الهيرو","maxLength":180},"hero.imageUrl":{"type":"image","label":"صورة الهيرو"},"story.title":{"type":"text","label":"عنوان قصة العلامة","maxLength":80},"story.body":{"type":"textarea","label":"نص قصة العلامة","maxLength":400},"products.limit":{"type":"number","label":"عدد المنتجات","min":4,"max":12}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"fashion-editorial","renderer":"component","componentKey":"fashion-editorial","version":1},"settings":{"hero":{"headline":"إطلالة موسمية بتفاصيل لا تنسى","subheadline":"اعرض منتجاتك بأسلوب تحريري فاخر يجعل الزائر يرى القيمة من أول لحظة.","primaryCtaLabel":"تسوق المجموعة","primaryCtaHref":"/categories","imageUrl":""},"story":{"title":"اختيارات منتقاة بعناية","body":"واجهة تضع القصة البصرية والمنتج في مركز التجربة مع رحلة تسوق واضحة وسريعة."},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"fashion-editorial","renderer":"component","componentKey":"fashion-editorial","version":1},"settings":{"hero":{"headline":"إطلالة موسمية بتفاصيل لا تنسى","subheadline":"اعرض منتجاتك بأسلوب تحريري فاخر يجعل الزائر يرى القيمة من أول لحظة.","primaryCtaLabel":"تسوق المجموعة","primaryCtaHref":"/categories","imageUrl":""},"story":{"title":"اختيارات منتقاة بعناية","body":"واجهة تضع القصة البصرية والمنتج في مركز التجربة مع رحلة تسوق واضحة وسريعة."},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"schemaVersion":3,"template":{"id":"fashion-editorial","renderer":"component","componentKey":"fashion-editorial","version":1},"settings":{"hero":{"headline":"إطلالة موسمية بتفاصيل لا تنسى","subheadline":"اعرض منتجاتك بأسلوب تحريري فاخر يجعل الزائر يرى القيمة من أول لحظة.","primaryCtaLabel":"تسوق المجموعة","primaryCtaHref":"/categories","imageUrl":""},"story":{"title":"اختيارات منتقاة بعناية","body":"واجهة تضع القصة البصرية والمنتج في مركز التجربة مع رحلة تسوق واضحة وسريعة."},"products":{"source":"featured","limit":8}}}'::jsonb,
  '{"rtl":true,"responsive":true,"supportsOffers":true,"supportsDarkMode":false}'::jsonb,
  NOW()
);
