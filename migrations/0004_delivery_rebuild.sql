-- Migration 0004: Delivery & Inventory Rebuild

-- Per-SKU delivery tracking on each DC
CREATE TABLE IF NOT EXISTS dc_items (
  id TEXT PRIMARY KEY,
  dc_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty_ordered INTEGER NOT NULL DEFAULT 0,
  qty_delivered INTEGER NOT NULL DEFAULT 0
);

-- Stock movement audit log
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  type TEXT NOT NULL,
  qty_change INTEGER NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  note TEXT,
  actor TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Backfill dc_items from existing DCs
INSERT OR IGNORE INTO dc_items (id, dc_id, sku, name, qty_ordered, qty_delivered)
SELECT 'dci-' || dc.id || '-' || oi.sku, dc.id, oi.sku, oi.name, oi.qty, 0
FROM delivery_challans dc
JOIN order_items oi ON oi.order_id = dc.order_id;

-- Backfill total_qty on existing DCs from order_items
UPDATE delivery_challans SET total_qty = (
  SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi WHERE oi.order_id = delivery_challans.order_id
) WHERE total_qty = 0 OR total_qty IS NULL;
