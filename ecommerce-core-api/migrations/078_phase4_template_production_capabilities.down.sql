UPDATE theme_templates
SET capabilities = capabilities - 'production' - 'supportedPages' - 'homeSections' - 'design' - 'commerce' - 'layout' - 'requirements',
    updated_at = NOW()
WHERE template_key IN ('general-starter', 'electronics-pro', 'beauty-luxe', 'fashion-editorial', 'market-modern');
