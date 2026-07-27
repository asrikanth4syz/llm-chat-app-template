-- ============================================================================
-- Remove Emerald's orphaned "…REGISTER" store trail (leftover from a deleted
-- test order). Self-guarding: only deletes client_inventory / client_consumption
-- rows whose SKU is NOT referenced by any surviving order for this client, so it
-- can never touch a legitimately-held/ordered item even with the loose name match.
--
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan_preview.sql   # preview first
--   npx wrangler d1 export  smart-pantry-db --remote --output backup_before_emerald_cleanup.sql
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan.sql
-- Not a migration — never auto-runs. The client row itself is KEPT.
-- ============================================================================

DELETE FROM client_consumption
WHERE client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND item_name LIKE '%REGISTER%'
  AND sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                  WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'));

DELETE FROM client_inventory
WHERE client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND item_name LIKE '%REGISTER%'
  AND sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                  WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'));
