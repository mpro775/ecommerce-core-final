WITH phase4_capabilities(template_key, phase4) AS (
  VALUES
    ('general-starter', '{
      "production": { "status": "production_ready", "qualityScore": 92, "lastReviewedAt": "2026-05-15T00:00:00.000Z", "reviewedBy": "platform-team" },
      "supportedPages": { "home": true, "categories": true, "category": true, "search": true, "product": true, "cart": true, "checkout": true, "orderTracking": true, "staticPage": true, "contact": true, "notFound": true },
      "homeSections": { "hero": ["split", "centered", "banner"], "categories": ["cards", "icons", "grid"], "products": ["grid", "carousel", "compact"], "promoBanners": ["single", "twoColumns"], "brands": ["logos", "grid"], "storeStory": ["textImage", "centered"], "trustBadges": ["icons", "strip"], "contactStrip": ["simple", "cta"] },
      "design": { "customColors": true, "customTypography": true, "customRadius": true, "customButtons": true, "customCards": true, "customLayoutDensity": true, "supportsDarkMode": false },
      "commerce": { "quickAdd": true, "productBadges": true, "compareAtPrice": true, "stockStatus": true, "variants": true, "productQuestions": true, "wishlist": false },
      "layout": { "rtl": true, "responsive": true, "mobileFirst": true, "maxWidth": "wide" },
      "requirements": { "needsBrands": false, "needsBanners": false, "recommendedMinProducts": 6, "recommendedMinCategories": 3 }
    }'::jsonb),
    ('electronics-pro', '{
      "production": { "status": "production_ready", "qualityScore": 90, "lastReviewedAt": "2026-05-15T00:00:00.000Z", "reviewedBy": "platform-team" },
      "supportedPages": { "home": true, "categories": true, "category": true, "search": true, "product": true, "cart": true, "checkout": true, "orderTracking": true, "staticPage": true, "contact": true, "notFound": true },
      "homeSections": { "hero": ["split", "banner"], "categories": ["cards", "icons", "grid"], "products": ["grid", "carousel", "compact", "featured"], "promoBanners": ["single", "twoColumns", "wide"], "brands": ["logos", "carousel", "grid"], "storeStory": ["stats"], "trustBadges": ["icons", "cards", "strip"], "contactStrip": ["simple", "cta"] },
      "design": { "customColors": true, "customTypography": true, "customRadius": true, "customButtons": true, "customCards": true, "customLayoutDensity": true, "supportsDarkMode": false },
      "commerce": { "quickAdd": true, "productBadges": true, "compareAtPrice": true, "stockStatus": true, "variants": true, "productQuestions": true, "wishlist": false },
      "layout": { "rtl": true, "responsive": true, "mobileFirst": true, "maxWidth": "wide" },
      "requirements": { "needsBrands": false, "needsBanners": true, "recommendedMinProducts": 8, "recommendedMinCategories": 4 }
    }'::jsonb),
    ('beauty-luxe', '{
      "production": { "status": "production_ready", "qualityScore": 90, "lastReviewedAt": "2026-05-15T00:00:00.000Z", "reviewedBy": "platform-team" },
      "supportedPages": { "home": true, "categories": true, "category": true, "search": true, "product": true, "cart": true, "checkout": true, "orderTracking": true, "staticPage": true, "contact": true, "notFound": true },
      "homeSections": { "hero": ["split", "banner", "full-image"], "categories": ["cards", "carousel", "grid"], "products": ["grid", "carousel", "featured"], "promoBanners": ["single", "wide"], "brands": ["logos", "grid"], "storeStory": ["textImage", "centered", "stats"], "trustBadges": ["icons", "cards"], "contactStrip": ["simple", "cta"] },
      "design": { "customColors": true, "customTypography": true, "customRadius": true, "customButtons": true, "customCards": true, "customLayoutDensity": true, "supportsDarkMode": false },
      "commerce": { "quickAdd": true, "productBadges": true, "compareAtPrice": true, "stockStatus": true, "variants": true, "productQuestions": true, "wishlist": false },
      "layout": { "rtl": true, "responsive": true, "mobileFirst": true, "maxWidth": "wide" },
      "requirements": { "needsBrands": false, "needsBanners": true, "recommendedMinProducts": 8, "recommendedMinCategories": 3 }
    }'::jsonb),
    ('fashion-editorial', '{
      "production": { "status": "beta", "qualityScore": 72, "lastReviewedAt": "2026-05-15T00:00:00.000Z", "reviewedBy": "platform-team" },
      "supportedPages": { "home": true, "categories": false, "category": false, "search": false, "product": false, "cart": false, "checkout": false, "orderTracking": false, "staticPage": false, "contact": false, "notFound": false },
      "layout": { "rtl": true, "responsive": true, "mobileFirst": true }
    }'::jsonb),
    ('market-modern', '{
      "production": { "status": "hidden", "qualityScore": 60, "lastReviewedAt": "2026-05-15T00:00:00.000Z", "reviewedBy": "platform-team" },
      "supportedPages": { "home": true, "categories": false, "category": false, "search": false, "product": false, "cart": false, "checkout": false, "orderTracking": false, "staticPage": false, "contact": false, "notFound": false },
      "layout": { "rtl": true, "responsive": true, "mobileFirst": true }
    }'::jsonb)
)
UPDATE theme_templates t
SET capabilities = COALESCE(t.capabilities, '{}'::jsonb) || p.phase4,
    updated_at = NOW()
FROM phase4_capabilities p
WHERE t.template_key = p.template_key;
