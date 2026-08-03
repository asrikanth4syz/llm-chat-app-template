-- PR-1 (G1): invoicing as its own step, with a 3-way match record
-- (ordered vs received vs invoiced).
CREATE TABLE IF NOT EXISTS po_invoices (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  vendor_invoice_no TEXT,
  invoice_amount REAL DEFAULT 0,
  invoice_date TEXT,
  match_status TEXT DEFAULT 'PENDING',   -- MATCHED | FLAGGED | PENDING
  qty_variance REAL DEFAULT 0,           -- invoiced - received
  amount_variance REAL DEFAULT 0,        -- invoice_amount - PO grand_total
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_po_invoices_po ON po_invoices(po_id);
