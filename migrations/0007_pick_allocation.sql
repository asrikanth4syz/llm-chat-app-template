-- Migration 0007: Order pick/allocation workflow

-- Track which bin each item was picked from, and by whom
CREATE TABLE IF NOT EXISTS order_allocations (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL,
  sku         TEXT NOT NULL,
  item_name   TEXT,
  qty         INTEGER NOT NULL,
  bin_code    TEXT,
  picked_by   TEXT,
  picked_at   TEXT DEFAULT (datetime('now'))
);

-- Add picker info to orders
ALTER TABLE orders ADD COLUMN picker_id   TEXT;
ALTER TABLE orders ADD COLUMN picker_name TEXT;
ALTER TABLE orders ADD COLUMN picked_at   TEXT;
