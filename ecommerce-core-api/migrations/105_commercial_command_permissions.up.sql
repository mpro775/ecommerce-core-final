-- Broad legacy permissions remain for non-command compatibility. New command endpoints
-- authorize only the fine-grained permissions below. Override permissions are never backfilled.

UPDATE store_users
SET permissions = (
      SELECT jsonb_agg(DISTINCT permission ORDER BY permission)
      FROM (
        SELECT jsonb_array_elements_text(store_users.permissions) AS permission
        UNION ALL SELECT 'orders:create-manual' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'orders:edit-manual' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'orders:confirm' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'orders:cancel' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'orders:complete' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:read' WHERE permissions ? 'orders:read'
        UNION ALL SELECT 'fulfillment:start-preparing' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:mark-ready' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:dispatch' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:fulfill' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:fail' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:retry' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'fulfillment:cancel' WHERE permissions ? 'orders:write'
        UNION ALL SELECT 'payments:start-review' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'payments:approve' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'payments:reject' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'payments:collect-cod' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'payments:expire' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'payments:cancel' WHERE permissions ? 'payments:write'
        UNION ALL SELECT 'inventory:reserve' WHERE permissions ? 'inventory:write'
        UNION ALL SELECT 'inventory:consume-reservation' WHERE permissions ? 'inventory:write'
        UNION ALL SELECT 'inventory:release-reservation' WHERE permissions ? 'inventory:write'
        UNION ALL SELECT 'inventory:adjust' WHERE permissions ? 'inventory:write'
        UNION ALL SELECT 'commercial:audit-read' WHERE permissions ? 'orders:read'
      ) expanded
    ),
    updated_at = NOW()
WHERE permissions ?| ARRAY['orders:write', 'orders:read', 'payments:write', 'inventory:write'];

