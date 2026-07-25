-- Dry-run preview: run this FIRST to confirm the 8 orders exist and see the
-- workflow rows that the cleanup will remove. Read-only — deletes nothing.
--   npx wrangler d1 execute smart-pantry-db --remote --file scripts/cleanup_orders_preview.sql

SELECT o.id, o.client_id, o.status, o.grand_total, o.created_at,
  (SELECT COUNT(*) FROM order_items       WHERE order_id=o.id) AS items,
  (SELECT COUNT(*) FROM order_history     WHERE order_id=o.id) AS history,
  (SELECT COUNT(*) FROM order_comments    WHERE order_id=o.id) AS comments,
  (SELECT COUNT(*) FROM order_allocations WHERE order_id=o.id) AS allocations,
  (SELECT COUNT(*) FROM delivery_challans WHERE order_id=o.id) AS challans,
  (SELECT COUNT(*) FROM purchase_orders   WHERE order_id=o.id) AS linked_pos,
  (SELECT COUNT(*) FROM po_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE order_id=o.id)) AS po_items
FROM orders o
WHERE o.id IN
  ('SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888')
ORDER BY o.id;
