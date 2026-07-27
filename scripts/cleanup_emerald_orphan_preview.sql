-- ============================================================================
-- DRY-RUN PREVIEW — Emerald orphaned "…REGISTER" store row. Read-only.
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan_preview.sql
-- ============================================================================

-- 0) Confirm the client resolves.
SELECT id, name FROM clients WHERE name LIKE '%Emerald%';

-- 1) Exactly the rows the cleanup will delete — orphans only (SKU not referenced
--    by any surviving order for this client). If this returns your stray item and
--    nothing legitimate, you're good to run the delete.
SELECT ci.client_id, ci.sku, ci.item_name, ci.qty_on_hand
FROM client_inventory ci
WHERE ci.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND ci.item_name LIKE '%REGISTER%'
  AND ci.sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                     WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'));
