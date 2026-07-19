-- Migration 0031: vendor onboarding — status, bank details, documents, products.
ALTER TABLE vendors ADD COLUMN onboarding_status TEXT DEFAULT 'active'; -- draft|pending|active|rejected
ALTER TABLE vendors ADD COLUMN bank_account_name TEXT;
ALTER TABLE vendors ADD COLUMN bank_account_no TEXT;
ALTER TABLE vendors ADD COLUMN bank_ifsc TEXT;
ALTER TABLE vendors ADD COLUMN bank_name TEXT;
ALTER TABLE vendors ADD COLUMN bank_branch TEXT;
ALTER TABLE vendors ADD COLUMN upi_id TEXT;
ALTER TABLE vendors ADD COLUMN payment_terms TEXT;

CREATE TABLE IF NOT EXISTS vendor_documents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- cancelled_cheque | fssai | gst_cert | pan | agreement
  filename TEXT, mime TEXT, size INTEGER,
  data TEXT,                     -- base64 data URL (MVP, move to R2 later)
  expiry_date TEXT,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendor_products (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  sku TEXT, name TEXT NOT NULL,
  pack TEXT, moq REAL DEFAULT 1, rate REAL DEFAULT 0, lead_days INTEGER DEFAULT 3,
  status TEXT DEFAULT 'new_sku'  -- linked | new_sku
);
