UPDATE store_users
SET permissions = (
      SELECT COALESCE(jsonb_agg(permission ORDER BY permission), '[]'::jsonb)
      FROM jsonb_array_elements_text(store_users.permissions) permission
      WHERE permission NOT IN (
        'orders:create-manual', 'orders:edit-manual', 'orders:confirm', 'orders:cancel',
        'orders:complete', 'orders:manual-price-override', 'orders:override-payment-gate',
        'fulfillment:read', 'fulfillment:start-preparing', 'fulfillment:mark-ready',
        'fulfillment:dispatch', 'fulfillment:fulfill', 'fulfillment:fail',
        'fulfillment:retry', 'fulfillment:cancel', 'payments:submit-proof',
        'payments:start-review', 'payments:approve', 'payments:reject',
        'payments:collect-cod', 'payments:expire', 'payments:cancel',
        'inventory:reserve', 'inventory:consume-reservation',
        'inventory:release-reservation', 'inventory:adjust', 'commercial:audit-read'
      )
    ),
    updated_at = NOW();

