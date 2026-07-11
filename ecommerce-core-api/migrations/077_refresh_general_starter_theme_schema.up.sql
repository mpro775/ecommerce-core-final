WITH general_starter_theme AS (
  SELECT
    '{
      "groups": [
        {
          "key": "appearance",
          "label": "المظهر",
          "fields": [
            { "key": "globals.color.primary", "type": "color", "label": "اللون الرئيسي", "default": "#0f766e" },
            { "key": "globals.color.primaryStrong", "type": "color", "label": "اللون الرئيسي الداكن", "default": "#115e59" },
            { "key": "globals.color.accent", "type": "color", "label": "لون التمييز", "default": "#f97316" },
            {
              "key": "settings.appearance.headerStyle",
              "type": "select",
              "label": "شكل الهيدر",
              "default": "clean",
              "options": [
                { "label": "نظيف", "value": "clean" },
                { "label": "مضغوط", "value": "compact" }
              ]
            },
            {
              "key": "settings.appearance.cardRadius",
              "type": "select",
              "label": "استدارة البطاقات",
              "default": "soft",
              "options": [
                { "label": "خفيفة", "value": "soft" },
                { "label": "متوسطة", "value": "medium" },
                { "label": "دائرية", "value": "rounded" }
              ]
            }
          ]
        },
        {
          "key": "hero",
          "label": "الواجهة الرئيسية",
          "fields": [
            { "key": "settings.hero.eyebrow", "type": "text", "label": "عبارة أعلى الواجهة", "default": "متجر جاهز للبيع بثقة", "maxLength": 60 },
            { "key": "settings.hero.headline", "type": "text", "label": "عنوان الواجهة", "default": "اكتشف أفضل اختيارات متجرنا", "maxLength": 90 },
            { "key": "settings.hero.subheadline", "type": "textarea", "label": "وصف الواجهة", "default": "واجهة متجر حديثة تضع المنتجات المهمة، التصنيفات، والثقة الشرائية أمام العميل من أول زيارة.", "maxLength": 220 },
            { "key": "settings.hero.imageUrl", "type": "image", "label": "صورة الواجهة" },
            { "key": "settings.hero.primaryCtaLabel", "type": "text", "label": "نص الزر الرئيسي", "default": "تسوق المنتجات", "maxLength": 40 },
            { "key": "settings.hero.primaryCtaHref", "type": "url", "label": "رابط الزر الرئيسي", "default": "/categories" }
          ]
        },
        {
          "key": "sections",
          "label": "أقسام الصفحة الرئيسية",
          "fields": [
            { "key": "settings.sections.showTrustStrip", "type": "boolean", "label": "إظهار شريط الثقة", "default": true },
            { "key": "settings.sections.showOfferBand", "type": "boolean", "label": "إظهار شريط العرض", "default": true },
            { "key": "settings.sections.showCategories", "type": "boolean", "label": "إظهار التصنيفات", "default": true },
            { "key": "settings.sections.showFeaturedProducts", "type": "boolean", "label": "إظهار المنتجات المختارة", "default": true }
          ]
        },
        {
          "key": "commerce",
          "label": "العرض والمنتجات",
          "fields": [
            { "key": "settings.offer.label", "type": "text", "label": "تسمية العرض", "default": "عرض المتجر", "maxLength": 50 },
            { "key": "settings.offer.title", "type": "text", "label": "عنوان العرض", "default": "ابدأ رحلة الشراء من التصنيفات الأكثر طلباً", "maxLength": 100 },
            { "key": "settings.offer.href", "type": "url", "label": "رابط العرض", "default": "/categories" },
            { "key": "settings.products.limit", "type": "number", "label": "عدد المنتجات المعروضة", "default": 8, "min": 4, "max": 16 }
          ]
        }
      ]
    }'::jsonb AS settings_schema,
    '{
      "schemaVersion": 3,
      "template": {
        "id": "general-starter",
        "key": "general-starter",
        "type": "component",
        "renderer": "component",
        "componentKey": "general-starter",
        "name": "General Starter",
        "version": 3
      },
      "globals": {
        "color": {
          "primary": "#0f766e",
          "primaryStrong": "#115e59",
          "primaryContrast": "#ffffff",
          "accent": "#f97316",
          "bg": "#f8fafc",
          "surface": "#ffffff",
          "text": "#0f172a",
          "textMuted": "#64748b",
          "line": "#e2e8f0",
          "success": "#16a34a",
          "warning": "#f59e0b"
        },
        "typography": {
          "headingFont": "inherit",
          "bodyFont": "inherit"
        },
        "radius": {
          "card": "18px",
          "button": "12px"
        },
        "spacing": {
          "sectionY": "56px"
        }
      },
      "settings": {
        "appearance": {
          "headerStyle": "clean",
          "cardRadius": "soft"
        },
        "hero": {
          "eyebrow": "متجر جاهز للبيع بثقة",
          "headline": "اكتشف أفضل اختيارات متجرنا",
          "subheadline": "واجهة متجر حديثة تضع المنتجات المهمة، التصنيفات، والثقة الشرائية أمام العميل من أول زيارة.",
          "primaryCtaLabel": "تسوق المنتجات",
          "primaryCtaHref": "/categories",
          "imageUrl": ""
        },
        "sections": {
          "showTrustStrip": true,
          "showOfferBand": true,
          "showCategories": true,
          "showFeaturedProducts": true
        },
        "offer": {
          "label": "عرض المتجر",
          "title": "ابدأ رحلة الشراء من التصنيفات الأكثر طلباً",
          "href": "/categories"
        },
        "badges": ["دفع آمن", "توصيل واضح", "استبدال مرن", "دعم سريع"],
        "products": {
          "source": "featured",
          "limit": 8
        }
      },
      "layout": {},
      "accessibility": {
        "reducedMotion": false
      }
    }'::jsonb AS default_config
)
UPDATE theme_templates
SET
  settings_schema = general_starter_theme.settings_schema,
  default_config = general_starter_theme.default_config,
  draft_config = general_starter_theme.default_config,
  published_config = general_starter_theme.default_config,
  component_key = 'general-starter',
  capabilities = jsonb_build_object(
    'rtl', true,
    'responsive', true,
    'supportsOffers', true,
    'supportsImages', true,
    'supportsFullPageMap', true,
    'supportsStaticPages', true,
    'supportsCheckout', true
  ),
  version = GREATEST(version, 3),
  updated_at = NOW()
FROM general_starter_theme
WHERE template_key = 'general-starter';
