-- Billing & Invoice Tracker (core). Records externally-issued invoices against
-- unbilled delivery challans and tracks preparation then submission. Reuses
-- delivery_challans as the DC source of truth. No statutory invoice generation.

-- Per-client billing setup: cycle, target offsets, default owner, required channels.
CREATE TABLE IF NOT EXISTS billing_configs (
  client_id TEXT PRIMARY KEY,
  frequency TEXT NOT NULL DEFAULT 'Monthly',        -- Monthly | Fortnightly | Weekly
  invoice_target_days INTEGER NOT NULL DEFAULT 2,   -- days after period end
  submission_target_days INTEGER NOT NULL DEFAULT 5,
  default_owner TEXT,
  req_email INTEGER NOT NULL DEFAULT 1,
  req_portal INTEGER NOT NULL DEFAULT 0,
  req_hardcopy INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Generated billing periods. period_key is the stable, idempotent key from billing.ts
-- so repeated generation never duplicates a period for the same client.
CREATE TABLE IF NOT EXISTS billing_periods (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  frequency TEXT NOT NULL,
  period_key TEXT NOT NULL,
  label TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  invoice_target_date TEXT,
  submission_target_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',               -- open | no_billing | complete
  no_billing_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (client_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_billperiod_client ON billing_periods (client_id, period_start);

-- One invoice batch (several whole DCs). Invoice identity is captured from the
-- external accounting system, submission is tracked per required channel.
CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  period_id TEXT,
  owner TEXT,
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',              -- Draft | Recorded | Cancelled
  submission_status TEXT NOT NULL DEFAULT 'Not Ready',
  invoice_no TEXT,
  invoice_date TEXT,
  taxable_amount REAL,
  gst_amount REAL,
  total_amount REAL,
  allocated_value REAL NOT NULL DEFAULT 0,           -- sum of DC values at draft time
  invoice_target_date TEXT,
  submission_target_date TEXT,
  submitted_date TEXT,
  email_date TEXT,
  portal_date TEXT,
  hardcopy_date TEXT,
  req_email INTEGER NOT NULL DEFAULT 0,
  req_portal INTEGER NOT NULL DEFAULT 0,
  req_hardcopy INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  recorded_at TEXT,
  cancelled_at TEXT,
  updated_by TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_billinv_client ON billing_invoices (client_id, status);
CREATE INDEX IF NOT EXISTS idx_billinv_period ON billing_invoices (period_id);

-- Whole-DC allocation. UNIQUE(dc_id) is the reservation: a DC can be in only one
-- live invoice. Cancelling an invoice deletes its rows, releasing the DCs.
CREATE TABLE IF NOT EXISTS billing_invoice_dcs (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  dc_id TEXT NOT NULL,
  dc_number TEXT,
  dc_value REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (dc_id)
);
CREATE INDEX IF NOT EXISTS idx_billinvdc_inv ON billing_invoice_dcs (invoice_id);
