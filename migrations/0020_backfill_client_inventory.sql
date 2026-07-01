-- Migration 0020: Backfill client_inventory from all existing delivered DCs
INSERT INTO client_inventory (client_id, sku, item_name, category, uom, qty_on_hand, last_received_qty, last_received_at, updated_at)
SELECT
  o.client_id,
  dci.sku,
  dci.name,
  COALESCE(i.category, ''),
  COALESCE(i.uom, 'unit'),
  SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
  SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
  MAX(dc.delivered_at),
  datetime('now')
FROM dc_items dci
JOIN delivery_challans dc ON dci.dc_id = dc.id
JOIN orders o ON dc.order_id = o.id
LEFT JOIN inventory i ON i.sku = dci.sku
WHERE dc.status = 'DELIVERED'
GROUP BY o.client_id, dci.sku
ON CONFLICT(client_id, sku) DO UPDATE SET
  qty_on_hand      = excluded.qty_on_hand,
  last_received_qty= excluded.last_received_qty,
  last_received_at = excluded.last_received_at,
  updated_at       = datetime('now');
