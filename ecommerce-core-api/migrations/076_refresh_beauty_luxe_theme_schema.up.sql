WITH beauty_luxe_theme AS (
  SELECT
    '{
      "groups": [
        {
          "key": "appearance",
          "label": "Appearance",
          "fields": [
            { "key": "globals.color.primary", "type": "color", "label": "Primary color", "default": "#8a3d56" },
            { "key": "globals.color.primaryStrong", "type": "color", "label": "Strong primary color", "default": "#6f2e45" },
            { "key": "globals.color.accent", "type": "color", "label": "Accent color", "default": "#c99058" },
            { "key": "globals.color.bg", "type": "color", "label": "Background color", "default": "#fbf7f4" },
            { "key": "globals.color.text", "type": "color", "label": "Text color", "default": "#2b1816" },
            {
              "key": "settings.appearance.headerStyle",
              "type": "select",
              "label": "Header style",
              "default": "boutique",
              "options": [
                { "label": "Boutique", "value": "boutique" },
                { "label": "Luxe", "value": "marketplace" },
                { "label": "Minimal", "value": "compact" }
              ]
            },
            {
              "key": "settings.appearance.cardRadius",
              "type": "select",
              "label": "Card style",
              "default": "soft",
              "options": [
                { "label": "Soft", "value": "soft" },
                { "label": "Rounded", "value": "rounded" },
                { "label": "Editorial", "value": "medium" }
              ]
            }
          ]
        },
        {
          "key": "hero",
          "label": "Hero",
          "fields": [
            { "key": "settings.hero.eyebrow", "type": "text", "label": "Eyebrow", "default": "Beauty Luxe", "maxLength": 60 },
            { "key": "settings.hero.headline", "type": "text", "label": "Headline", "default": "Discover beauty in softer detail", "maxLength": 90 },
            { "key": "settings.hero.subheadline", "type": "textarea", "label": "Description", "default": "Curated care, makeup, fragrance, and gift picks presented with a calm premium shopping flow.", "maxLength": 220 },
            { "key": "settings.hero.imageUrl", "type": "image", "label": "Hero image" },
            { "key": "settings.hero.primaryCtaLabel", "type": "text", "label": "Button label", "default": "Shop the collection", "maxLength": 40 },
            { "key": "settings.hero.primaryCtaHref", "type": "url", "label": "Button link", "default": "/categories" },
            {
              "key": "settings.hero.variant",
              "type": "select",
              "label": "Hero style",
              "default": "split",
              "options": [
                { "label": "Split", "value": "split" },
                { "label": "Editorial", "value": "banner" },
                { "label": "Full image", "value": "full-image" }
              ]
            },
            { "key": "settings.hero.showStats", "type": "boolean", "label": "Show store stats", "default": true }
          ]
        },
        {
          "key": "sections",
          "label": "Home sections",
          "fields": [
            { "key": "settings.sections.showCategories", "type": "boolean", "label": "Show collections", "default": true },
            { "key": "settings.sections.showFeaturedProducts", "type": "boolean", "label": "Show featured products", "default": true },
            { "key": "settings.sections.showNewArrivals", "type": "boolean", "label": "Show new arrivals", "default": true },
            { "key": "settings.sections.showBestSellers", "type": "boolean", "label": "Show best sellers", "default": true },
            { "key": "settings.sections.showStory", "type": "boolean", "label": "Show brand story", "default": true },
            { "key": "settings.sections.showPromoBanners", "type": "boolean", "label": "Show promo banner", "default": true },
            { "key": "settings.products.limit", "type": "number", "label": "Displayed products", "default": 12, "min": 4, "max": 24 }
          ]
        },
        {
          "key": "story",
          "label": "Brand story",
          "fields": [
            { "key": "settings.story.title", "type": "text", "label": "Story title", "default": "Small rituals, carefully chosen", "maxLength": 90 },
            { "key": "settings.story.body", "type": "textarea", "label": "Story text", "default": "Use this space for the brand promise, care philosophy, gift experience, or the feel of your beauty collection.", "maxLength": 420 },
            { "key": "settings.story.imageUrl", "type": "image", "label": "Story image" }
          ]
        },
        {
          "key": "trust",
          "label": "Trust strip",
          "fields": [
            { "key": "settings.sections.showTrustStrip", "type": "boolean", "label": "Show trust strip", "default": true },
            { "key": "settings.badges", "type": "list", "label": "Trust texts", "default": ["Authentic products", "Elegant packaging", "Secure payment", "Clear delivery"] }
          ]
        }
      ]
    }'::jsonb AS settings_schema,
    '{
      "schemaVersion": 3,
      "template": {
        "id": "beauty-luxe",
        "key": "beauty-luxe",
        "type": "component",
        "renderer": "component",
        "componentKey": "beauty-luxe",
        "name": "Beauty Luxe",
        "version": 2
      },
      "globals": {
        "color": {
          "primary": "#8a3d56",
          "primaryStrong": "#6f2e45",
          "primaryContrast": "#ffffff",
          "accent": "#c99058",
          "bg": "#fbf7f4",
          "surface": "#ffffff",
          "text": "#2b1816",
          "textMuted": "#7a625b",
          "line": "#ead6d2"
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
          "headerStyle": "boutique",
          "cardRadius": "soft"
        },
        "hero": {
          "eyebrow": "Beauty Luxe",
          "headline": "Discover beauty in softer detail",
          "subheadline": "Curated care, makeup, fragrance, and gift picks presented with a calm premium shopping flow.",
          "primaryCtaLabel": "Shop the collection",
          "primaryCtaHref": "/categories",
          "imageUrl": "",
          "variant": "split",
          "showStats": true
        },
        "sections": {
          "showCategories": true,
          "showFeaturedProducts": true,
          "showNewArrivals": true,
          "showBestSellers": true,
          "showStory": true,
          "showPromoBanners": true,
          "showTrustStrip": true
        },
        "story": {
          "title": "Small rituals, carefully chosen",
          "body": "Use this space for the brand promise, care philosophy, gift experience, or the feel of your beauty collection.",
          "imageUrl": ""
        },
        "offer": {
          "label": "Seasonal edit",
          "title": "Beauty picks ready for gifting",
          "href": "/categories"
        },
        "badges": ["Authentic products", "Elegant packaging", "Secure payment", "Clear delivery"],
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
  settings_schema = beauty_luxe_theme.settings_schema,
  default_config = beauty_luxe_theme.default_config,
  draft_config = COALESCE(draft_config, beauty_luxe_theme.default_config),
  published_config = COALESCE(published_config, beauty_luxe_theme.default_config),
  component_key = 'beauty-luxe',
  thumbnail_url = COALESCE(thumbnail_url, 'https://cdn.your-domain.com/templates/beauty-luxe/thumb.webp'),
  preview_image_url = COALESCE(preview_image_url, 'https://cdn.your-domain.com/templates/beauty-luxe/home.webp'),
  preview_images = COALESCE(
    preview_images,
    '["https://cdn.your-domain.com/templates/beauty-luxe/home.webp","https://cdn.your-domain.com/templates/beauty-luxe/product.webp","https://cdn.your-domain.com/templates/beauty-luxe/mobile.webp","https://cdn.your-domain.com/templates/beauty-luxe/categories.webp"]'::jsonb
  ),
  version = GREATEST(version, 2),
  updated_at = NOW()
FROM beauty_luxe_theme
WHERE template_key = 'beauty-luxe';
