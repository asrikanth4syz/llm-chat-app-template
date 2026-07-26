-- PR (G11): raise a debit note to a vendor for rejected / short / damaged goods.
CREATE TABLE IF NOT EXISTS vendor_debit_notes (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  sku TEXT,
  name TEXT,
  qty REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'OPEN',        -- OPEN | SETTLED
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_debit_notes_po ON vendor_debit_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_vendor ON vendor_debit_notes(vendor_id);
