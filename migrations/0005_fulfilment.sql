-- Migration 0005: Fulfilment & Reconciliation module

-- Add brand to inventory (default = category until proper data is set)
ALTER TABLE inventory ADD COLUMN brand TEXT DEFAULT '';
UPDATE inventory SET brand = category WHERE brand = '' OR brand IS NULL;

-- Add location to clients
ALTER TABLE clients ADD COLUMN location TEXT DEFAULT '';
UPDATE clients SET location =
  CASE id
    WHEN 'c1' THEN 'Bangalore'
    WHEN 'c2' THEN 'Bangalore'
    WHEN 'c3' THEN 'Hyderabad'
    WHEN 'c4' THEN 'Mumbai'
    ELSE 'Delhi'
  END;

-- Add POD/DC scan tracking + expected delivery to delivery_challans
ALTER TABLE delivery_challans ADD COLUMN pod_uploaded INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN dc_scan_uploaded INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN expected_delivery_date TEXT;

-- Add brand to order_items (denormalised for easy reporting)
ALTER TABLE order_items ADD COLUMN brand TEXT DEFAULT '';
UPDATE order_items SET brand = (SELECT COALESCE(i.brand, i.category) FROM inventory i WHERE i.sku = order_items.sku);

-- Standing orders table (for recurring orders)
CREATE TABLE IF NOT EXISTS standing_orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'MONTHLY',
  next_run_date TEXT,
  last_run_date TEXT,
  items TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed a sample standing order
INSERT OR IGNORE INTO standing_orders VALUES (
  'so1', 'c1', 'Meta Monthly Essentials', 'MONTHLY',
  date('now', '+30 days'), date('now', '-30 days'),
  '[{"sku":"SKU001","name":"Premium Coffee Beans","qty":12},{"sku":"SKU005","name":"Tissue Box","qty":50}]',
  1, datetime('now', '-60 days')
);
