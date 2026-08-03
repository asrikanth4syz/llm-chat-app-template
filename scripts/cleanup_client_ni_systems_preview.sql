-- ============================================================================
-- DRY-RUN PREVIEW — NI Systems (India) Pvt Ltd order cleanup. Read-only.
-- Run FIRST to confirm the client resolves and see exactly what will be removed.
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_client_ni_systems_preview.sql
-- ============================================================================

-- 0) Confirm the client resolves to exactly one row (name must match exactly).
SELECT id, name, contact_email, active FROM clients
WHERE name = 'NI Systems (India) Pvt Ltd';

-- 1) The orders that will be deleted, with per-order child-row counts.
SELECT o.id, o.status, o.grand_total, o.created_at,
  (SELECT COUNT(*) FROM order_items       WHERE order_id=o.id) AS items,
  (SELECT COUNT(*) FROM order_comments    WHERE order_id=o.id) AS comments,
  (SELECT COUNT(*) FROM order_allocations WHERE order_id=o.id) AS allocations,
  (SELECT COUNT(*) FROM delivery_challans WHERE order_id=o.id) AS challans,
  (SELECT COUNT(*) FROM purchase_orders   WHERE order_id=o.id) AS linked_pos
FROM orders o
WHERE o.client_id IN (SELECT id FROM clients WHERE name = 'NI Systems (India) Pvt Ltd')
ORDER BY o.created_at DESC;

-- 2) Totals — a one-line summary of the blast radius (incl. the store trail
--    that step 5 of the cleanup removes).
SELECT
  (SELECT COUNT(*) FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')) AS orders,
  (SELECT COUNT(*) FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'))) AS order_items,
  (SELECT COUNT(*) FROM delivery_challans WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'))) AS challans,
  (SELECT COUNT(*) FROM purchase_orders WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd'))) AS linked_pos,
  (SELECT COUNT(*) FROM client_inventory WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')) AS store_rows,
  (SELECT COUNT(*) FROM client_consumption WHERE client_id IN (SELECT id FROM clients WHERE name='NI Systems (India) Pvt Ltd')) AS consumption_rows;
