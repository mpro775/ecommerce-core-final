ALTER TABLE stores
ADD CONSTRAINT stores_slug_subdomain_format_check
CHECK (
  slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'
) NOT VALID;
