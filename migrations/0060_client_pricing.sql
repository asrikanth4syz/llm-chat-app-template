-- Effective-dated client pricing, resolved by a single rule everywhere a line is priced.
-- Mirrors ensurePricingSchema (runtime self-heal is authoritative, this keeps a fresh DB in sync).
-- The resolver reads this history first (latest effective_from on or before the order or
-- amendment date), then client_catalog.client_price, then inventory.unit_price.

CREATE TABLE IF NOT EXISTS client_price_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  price REAL NOT NULL,
  effective_from TEXT NOT NULL,   -- YYYY-MM-DD the agreed price takes effect
  created_by TEXT,
  created_by_name TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_client_price_history ON client_price_history (client_id, sku, effective_from);

-- How each order line was priced (client, standard, or a flagged manual override).
ALTER TABLE order_items ADD COLUMN price_source TEXT;
