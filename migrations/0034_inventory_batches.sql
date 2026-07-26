-- PR-1 (G3): batch/expiry dimension for received stock (FEFO foundation).
CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  batch_no TEXT,
  mfg_date TEXT,
  expiry_date TEXT,
  qty REAL NOT NULL DEFAULT 0,        -- remaining in this batch
  grn_line_id TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_batches_sku_exp ON inventory_batches(sku, expiry_date);

ALTER TABLE inventory ADD COLUMN track_batch INTEGER DEFAULT 0;   -- 1 = food/perishable
