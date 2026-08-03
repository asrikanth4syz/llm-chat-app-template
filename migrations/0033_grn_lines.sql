-- PR-1 (G1/G2/G3): line-level goods receipt with batch + QC, and per-line
-- running receipt so PO status derives from the lines rather than a single flag.
CREATE TABLE IF NOT EXISTS grn_lines (
  id TEXT PRIMARY KEY,
  grn_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty_received INTEGER NOT NULL DEFAULT 0,
  qty_rejected INTEGER NOT NULL DEFAULT 0,   -- QC fail, only accepted qty hits stock
  batch_no TEXT,
  mfg_date TEXT,
  expiry_date TEXT,
  qc_status TEXT DEFAULT 'ACCEPTED',         -- ACCEPTED | REJECTED | HOLD
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON grn_lines(grn_id);

ALTER TABLE po_items    ADD COLUMN qty_received INTEGER NOT NULL DEFAULT 0;
ALTER TABLE grn_records ADD COLUMN status TEXT DEFAULT 'POSTED';   -- DRAFT | POSTED
ALTER TABLE grn_records ADD COLUMN received_by_name TEXT;
