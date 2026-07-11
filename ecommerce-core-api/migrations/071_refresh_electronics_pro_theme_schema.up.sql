WITH electronics_pro_theme AS (
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
              "default": "marketplace",
              "options": [
                { "label": "سوق إلكتروني", "value": "marketplace" },
                { "label": "بسيط", "value": "compact" }
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
          "label": "قسم الواجهة الرئيسية",
          "fields": [
            { "key": "settings.hero.eyebrow", "type": "text", "label": "النص العلوي", "default": "Electronics Pro", "maxLength": 60 },
            { "key": "settings.hero.headline", "type": "text", "label": "عنوان الهيرو", "default": "كل أجهزتك الذكية في متجر واحد", "maxLength": 90 },
            { "key": "settings.hero.subheadline", "type": "textarea", "label": "وصف الهيرو", "default": "تجربة تسوق إلكترونيات احترافية، سريعة، وواضحة لعملائك.", "maxLength": 220 },
            { "key": "settings.hero.imageUrl", "type": "image", "label": "صورة الهيرو" },
            {
              "key": "settings.hero.variant",
              "type": "select",
              "label": "شكل الهيرو",
              "default": "split",
              "options": [
                { "label": "تقسيم مع صورة", "value": "split" },
                { "label": "بانر كامل", "value": "banner" }
              ]
            },
            { "key": "settings.hero.showStats", "type": "boolean", "label": "إظهار الإحصائيات", "default": true }
          ]
        },
        {
          "key": "sections",
          "label": "أقسام الصفحة الرئيسية",
          "fields": [
            { "key": "settings.sections.showCategories", "type": "boolean", "label": "إظهار التصنيفات", "default": true },
            { "key": "settings.sections.showFeaturedProducts", "type": "boolean", "label": "إظهار المنتجات المميزة", "default": true },
            { "key": "settings.sections.showPromoBanners", "type": "boolean", "label": "إظهار بانرات العروض", "default": true },
            { "key": "settings.sections.showBrands", "type": "boolean", "label": "إظهار البراندات", "default": true },
            { "key": "settings.products.limit", "type": "number", "label": "عدد المنتجات المعروضة", "default": 12, "min": 4, "max": 24 }
          ]
        }
      ]
    }'::jsonb AS settings_schema,
    '{
      "schemaVersion": 3,
      "template": {
        "id": "electronics-pro",
        "key": "electronics-pro",
        "type": "component",
        "renderer": "component",
        "componentKey": "electronics-pro",
        "name": "Electronics Pro",
        "version": 2
      },
      "globals": {
        "color": {
          "primary": "#0f766e",
          "primaryStrong": "#115e59",
          "primaryContrast": "#ffffff",
          "accent": "#f97316",
          "bg": "#f6f8fb",
          "surface": "#ffffff",
          "text": "#0f172a",
          "textMuted": "#64748b",
          "line": "#e2e8f0"
        },
        "typography": {
          "headingFont": "inherit",
          "bodyFont": "inherit"
        },
        "radius": {
          "card": "24px",
          "button": "999px"
        },
        "spacing": {
          "sectionY": "64px"
        }
      },
      "settings": {
        "appearance": {
          "headerStyle": "marketplace",
          "cardRadius": "soft"
        },
        "hero": {
          "eyebrow": "Electronics Pro",
          "headline": "كل أجهزتك الذكية في متجر واحد",
          "subheadline": "تجربة تسوق إلكترونيات احترافية، سريعة، وواضحة لعملائك.",
          "primaryCtaLabel": "تسوق الأجهزة",
          "primaryCtaHref": "/categories",
          "imageUrl": "",
          "variant": "split",
          "showStats": true
        },
        "sections": {
          "showCategories": true,
          "showFeaturedProducts": true,
          "showPromoBanners": true,
          "showBrands": true
        },
        "offer": {
          "label": "عرض الأسبوع",
          "title": "خصومات على المنتجات المختارة",
          "href": "/categories"
        },
        "badges": ["ضمان موثق", "دفع آمن", "شحن سريع", "دعم فني"],
        "products": {
          "source": "featured",
          "limit": 12
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
  settings_schema = electronics_pro_theme.settings_schema,
  default_config = electronics_pro_theme.default_config,
  draft_config = electronics_pro_theme.default_config,
  published_config = electronics_pro_theme.default_config,
  version = GREATEST(version, 2),
  updated_at = NOW()
FROM electronics_pro_theme
WHERE template_key = 'electronics-pro';
