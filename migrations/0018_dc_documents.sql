-- Migration 0018: Delivery challan POD & scan document uploads
CREATE TABLE IF NOT EXISTS dc_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dc_id       TEXT NOT NULL,
  doc_type    TEXT NOT NULL,       -- 'pod' or 'scan'
  filename    TEXT,
  mime_type   TEXT,
  content_b64 TEXT NOT NULL,
  file_size   INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now')),
  uploaded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dc_documents_dc_id ON dc_documents(dc_id);
