-- Migration 0006: Business spec alignment — staff, zones, DC numbers, pricing

-- Client zone (EGL/BTP/BTM/PV/FW) and contact phone
ALTER TABLE clients ADD COLUMN zone TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN contact_phone TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN map_pin TEXT DEFAULT '';

-- Delivery challan: actual DC number, assigned staff, scheduled time
ALTER TABLE delivery_challans ADD COLUMN dc_number TEXT;
ALTER TABLE delivery_challans ADD COLUMN staff_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN scheduled_time TEXT;

-- Inventory: MRP, cost excl GST, margin, expiry, location, product links
ALTER TABLE inventory ADD COLUMN mrp REAL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN cost_excl_gst REAL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN margin_pct REAL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN expiry_date TEXT;
ALTER TABLE inventory ADD COLUMN inv_location TEXT DEFAULT 'instock';
ALTER TABLE inventory ADD COLUMN amazon_url TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN flipkart_url TEXT DEFAULT '';

-- Order items: unit of measure, MRP at time of order
ALTER TABLE order_items ADD COLUMN uom TEXT DEFAULT 'unit';
ALTER TABLE order_items ADD COLUMN mrp REAL DEFAULT 0;

-- Staff master (delivery staff, order entry, viewers)
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'delivery_staff',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed the 5 named delivery staff
INSERT OR IGNORE INTO staff VALUES ('staff-bimal',  'Bimal',  NULL, 'delivery_staff', 1, datetime('now'));
INSERT OR IGNORE INTO staff VALUES ('staff-manju',  'Manju',  NULL, 'delivery_staff', 1, datetime('now'));
INSERT OR IGNORE INTO staff VALUES ('staff-mahesh', 'Mahesh', NULL, 'delivery_staff', 1, datetime('now'));
INSERT OR IGNORE INTO staff VALUES ('staff-kirthy', 'Kirthy', NULL, 'delivery_staff', 1, datetime('now'));
INSERT OR IGNORE INTO staff VALUES ('staff-krish',  'Krish',  NULL, 'delivery_staff', 1, datetime('now'));

-- Porter expense log
CREATE TABLE IF NOT EXISTS porter_expenses (
  id TEXT PRIMARY KEY,
  trip_date TEXT NOT NULL,
  route TEXT,
  amount REAL NOT NULL,
  client_id TEXT,
  staff_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Return / rejection log
CREATE TABLE IF NOT EXISTS delivery_returns (
  id TEXT PRIMARY KEY,
  dc_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  item_name TEXT,
  qty_returned INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  staff_id TEXT,
  returned_at TEXT DEFAULT (datetime('now'))
);

-- Update delivery_challans driver_name with staff names where match exists
UPDATE delivery_challans SET staff_id = (
  SELECT id FROM staff WHERE name = delivery_challans.driver_name LIMIT 1
) WHERE driver_name IS NOT NULL;
