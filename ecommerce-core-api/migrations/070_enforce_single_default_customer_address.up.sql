WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id, store_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS default_rank
  FROM customer_addresses
  WHERE is_default = TRUE
)
UPDATE customer_addresses address
SET is_default = FALSE,
    updated_at = NOW()
FROM ranked_defaults ranked
WHERE address.id = ranked.id
  AND ranked.default_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_addresses_one_default
  ON customer_addresses (customer_id, store_id)
  WHERE is_default = TRUE;
