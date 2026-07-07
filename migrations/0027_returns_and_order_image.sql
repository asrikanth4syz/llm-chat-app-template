-- Migration 0027: Returns approval workflow + order photo attachment
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  dc_id TEXT NOT NULL,
  order_id TEXT,
  client_id TEXT,
  reason TEXT,
  items TEXT NOT NULL,             -- JSON [{sku,name,qty}]
  prev_dc_status TEXT,
  status TEXT DEFAULT 'PENDING',   -- PENDING / APPROVED / REJECTED
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT
);
ALTER TABLE orders ADD COLUMN order_image TEXT;
