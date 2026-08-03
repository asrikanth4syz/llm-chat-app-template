-- ============================================================================
-- DRY-RUN PREVIEW — every orphaned store item for Emerald. Read-only.
-- Orphan = a client_inventory / client_consumption row whose SKU is NOT
-- referenced by any surviving order for the client (leftover from deleted
-- test orders — e.g. "…REGISTER", "3 Sister Super Cola", etc.).
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan_preview.sql
-- ============================================================================

-- 0) Confirm the client resolves.
SELECT id, name FROM clients WHERE name LIKE '%Emerald%';

-- 1) Exactly the store rows the cleanup will delete (orphans only).
SELECT ci.sku, ci.item_name, ci.qty_on_hand
FROM client_inventory ci
WHERE ci.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND ci.sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                     WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'))
ORDER BY ci.item_name;

-- 2) Totals — orphans that go vs. legitimate items (tied to a surviving order) that stay.
SELECT
  (SELECT COUNT(*) FROM client_inventory ci WHERE ci.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
     AND ci.sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'))) AS orphans_to_delete,
  (SELECT COUNT(*) FROM client_inventory ci WHERE ci.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
     AND ci.sku IN     (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'))) AS legit_kept;
