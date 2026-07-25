-- Migration 0020: Backfill client_inventory from all existing delivered DCs
INSERT INTO client_inventory (client_id, sku, item_name, category, uom, qty_on_hand, last_received_qty, last_received_at, updated_at)
SELECT
  o.client_id,
  dci.sku,
  COALESCE(NULLIF(dci.name,''), NULLIF(i.name,''), MAX(NULLIF(oi.name,'')), dci.sku),
  COALESCE(NULLIF(i.category,''), MAX(oi.category), ''),
  COALESCE(NULLIF(i.uom,''), MAX(oi.uom), 'unit'),
  SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
  SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
  MAX(dc.delivered_at),
  datetime('now')
FROM dc_items dci
JOIN delivery_challans dc ON dci.dc_id = dc.id
JOIN orders o ON dc.order_id = o.id
LEFT JOIN inventory i ON i.sku = dci.sku
LEFT JOIN order_items oi ON oi.order_id = dc.order_id AND oi.sku = dci.sku
WHERE dc.status = 'DELIVERED'
GROUP BY o.client_id, dci.sku
ON CONFLICT(client_id, sku) DO UPDATE SET
  qty_on_hand      = excluded.qty_on_hand,
  last_received_qty= excluded.last_received_qty,
  last_received_at = excluded.last_received_at,
  item_name        = CASE WHEN excluded.item_name = excluded.sku THEN COALESCE(NULLIF(client_inventory.item_name, client_inventory.sku), excluded.item_name) ELSE excluded.item_name END,
  updated_at       = datetime('now');
