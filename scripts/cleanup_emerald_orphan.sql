-- ============================================================================
-- Remove ALL of Emerald's orphaned store rows (items not tied to any surviving
-- order — leftovers from deleted test orders). Self-guarding: only deletes rows
-- whose SKU is NOT referenced by a surviving order for this client, so items the
-- client legitimately ordered (order still present) are always kept.
--
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan_preview.sql   # preview first
--   npx wrangler d1 export  smart-pantry-db --remote --output backup_before_emerald_cleanup.sql
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_emerald_orphan.sql
-- Not a migration — never auto-runs. The client row itself is KEPT.
-- ============================================================================

DELETE FROM client_consumption
WHERE client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                  WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'));

DELETE FROM client_inventory
WHERE client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%')
  AND sku NOT IN (SELECT DISTINCT oi.sku FROM order_items oi JOIN orders o ON oi.order_id=o.id
                  WHERE o.client_id IN (SELECT id FROM clients WHERE name LIKE '%Emerald%'));
