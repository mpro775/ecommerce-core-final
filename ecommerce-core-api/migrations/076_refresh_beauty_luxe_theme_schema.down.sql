UPDATE theme_templates
SET
  settings_schema = '{
    "hero.eyebrow": { "type": "text", "label": "Hero eyebrow", "maxLength": 60 },
    "hero.headline": { "type": "text", "label": "Hero headline", "maxLength": 90 },
    "hero.subheadline": { "type": "textarea", "label": "Hero description", "maxLength": 220 },
    "hero.imageUrl": { "type": "image", "label": "Hero image" },
    "story.title": { "type": "text", "label": "Story title", "maxLength": 90 },
    "story.body": { "type": "textarea", "label": "Story text", "maxLength": 420 },
    "products.limit": { "type": "number", "label": "Product count", "min": 4, "max": 12 }
  }'::jsonb,
  default_config = '{
    "hero": {
      "eyebrow": "Beauty and gifts",
      "headline": "A premium experience for beauty and fragrance",
      "subheadline": "A template that highlights texture, details, and gift value with a clear shopping path.",
      "primaryCtaLabel": "Shop the collection",
      "primaryCtaHref": "/categories",
      "imageUrl": ""
    },
    "story": {
      "title": "Small details make a lasting impression",
      "body": "Show the story, scent, feel, and packaging before the customer reaches the product page."
    },
    "badges": ["Carefully selected", "Premium packaging", "Gift ready"],
    "products": {
      "source": "featured",
      "limit": 8
    }
  }'::jsonb,
  version = 1,
  updated_at = NOW()
WHERE template_key = 'beauty-luxe';
