UPDATE theme_templates
SET
  settings_schema = '{
    "hero.eyebrow": { "type": "text", "label": "عبارة أعلى الواجهة", "maxLength": 60 },
    "hero.headline": { "type": "text", "label": "عنوان الواجهة", "maxLength": 90 },
    "hero.subheadline": { "type": "textarea", "label": "وصف الواجهة", "maxLength": 220 },
    "hero.imageUrl": { "type": "image", "label": "صورة الواجهة" },
    "offer.label": { "type": "text", "label": "تسمية العرض", "maxLength": 50 },
    "offer.title": { "type": "text", "label": "عنوان العرض", "maxLength": 100 },
    "products.limit": { "type": "number", "label": "عدد المنتجات", "min": 4, "max": 16 }
  }'::jsonb,
  default_config = '{
    "schemaVersion": 3,
    "template": {
      "id": "electronics-pro",
      "renderer": "component",
      "componentKey": "electronics-pro",
      "version": 2
    },
    "settings": {
      "hero": {
        "eyebrow": "أجهزة وتقنية",
        "headline": "كل ما يحتاجه عميل التقنية في واجهة واحدة",
        "subheadline": "اعرض الأجهزة، العروض، والمواصفات بطريقة واضحة تساعد العميل على المقارنة والشراء بسرعة.",
        "primaryCtaLabel": "تسوق الأجهزة",
        "primaryCtaHref": "/categories",
        "imageUrl": ""
      },
      "offer": {
        "label": "عرض الأسبوع",
        "title": "خصومات على المنتجات المختارة",
        "href": "/categories"
      },
      "badges": ["ضمان موثق", "دفع آمن", "شحن سريع", "دعم فني"],
      "products": {
        "source": "featured",
        "limit": 10
      }
    }
  }'::jsonb,
  draft_config = '{
    "schemaVersion": 3,
    "template": {
      "id": "electronics-pro",
      "renderer": "component",
      "componentKey": "electronics-pro",
      "version": 2
    },
    "settings": {
      "hero": {
        "eyebrow": "أجهزة وتقنية",
        "headline": "كل ما يحتاجه عميل التقنية في واجهة واحدة",
        "subheadline": "اعرض الأجهزة، العروض، والمواصفات بطريقة واضحة تساعد العميل على المقارنة والشراء بسرعة.",
        "primaryCtaLabel": "تسوق الأجهزة",
        "primaryCtaHref": "/categories",
        "imageUrl": ""
      },
      "offer": {
        "label": "عرض الأسبوع",
        "title": "خصومات على المنتجات المختارة",
        "href": "/categories"
      },
      "badges": ["ضمان موثق", "دفع آمن", "شحن سريع", "دعم فني"],
      "products": {
        "source": "featured",
        "limit": 10
      }
    }
  }'::jsonb,
  published_config = '{
    "schemaVersion": 3,
    "template": {
      "id": "electronics-pro",
      "renderer": "component",
      "componentKey": "electronics-pro",
      "version": 2
    },
    "settings": {
      "hero": {
        "eyebrow": "أجهزة وتقنية",
        "headline": "كل ما يحتاجه عميل التقنية في واجهة واحدة",
        "subheadline": "اعرض الأجهزة، العروض، والمواصفات بطريقة واضحة تساعد العميل على المقارنة والشراء بسرعة.",
        "primaryCtaLabel": "تسوق الأجهزة",
        "primaryCtaHref": "/categories",
        "imageUrl": ""
      },
      "offer": {
        "label": "عرض الأسبوع",
        "title": "خصومات على المنتجات المختارة",
        "href": "/categories"
      },
      "badges": ["ضمان موثق", "دفع آمن", "شحن سريع", "دعم فني"],
      "products": {
        "source": "featured",
        "limit": 10
      }
    }
  }'::jsonb,
  updated_at = NOW()
WHERE template_key = 'electronics-pro';
