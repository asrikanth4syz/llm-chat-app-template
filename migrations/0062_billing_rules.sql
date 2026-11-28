-- Billing & Invoice Tracker — phase 2 backbone. Named billing rules (per
-- client/location/category), auto-generated cycles, and rule/cycle/lifecycle
-- columns on the invoice "task". Reuses the existing billing_invoices row as the
-- task, so the core tracker keeps working.

CREATE TABLE IF NOT EXISTS billing_rules (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  location_id TEXT,
  category TEXT,
  rule_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Monthly',    -- Weekly|Fortnightly|Monthly|TwoMonthly|Quarterly|AdHoc
  closing_weekday INTEGER,                        -- Weekly: 0=Sun..6=Sat
  cutoff_day INTEGER,                             -- Monthly: closing day of month
  anchor_month INTEGER,                           -- TwoMonthly/Quarterly: 1..12 window-start month
  use_working_days INTEGER NOT NULL DEFAULT 0,
  prep_target_days INTEGER NOT NULL DEFAULT 2,
  submission_target_days INTEGER NOT NULL DEFAULT 5,
  primary_owner TEXT,
  backup_owner TEXT,
  po_default TEXT,
  req_email INTEGER NOT NULL DEFAULT 1,
  req_hardcopy INTEGER NOT NULL DEFAULT 0,
  req_signed_dc INTEGER NOT NULL DEFAULT 0,
  instructions TEXT,
  effective_start TEXT,
  effective_end TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_billrule_client ON billing_rules (client_id, active);

CREATE TABLE IF NOT EXISTS billing_cycles (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  label TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  prep_target_date TEXT,
  submission_target_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',            -- open | no_dcs | complete
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (rule_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_billcycle_rule ON billing_cycles (rule_id, period_start);

-- The invoice row doubles as the billing "task": link it to its rule + cycle,
-- carry the finer lifecycle, and snapshot category / PO / auto-generation.
ALTER TABLE billing_invoices ADD COLUMN rule_id TEXT;
ALTER TABLE billing_invoices ADD COLUMN cycle_id TEXT;
ALTER TABLE billing_invoices ADD COLUMN lifecycle TEXT;
ALTER TABLE billing_invoices ADD COLUMN category TEXT;
ALTER TABLE billing_invoices ADD COLUMN po_number TEXT;
ALTER TABLE billing_invoices ADD COLUMN auto_generated INTEGER DEFAULT 0;
ALTER TABLE billing_invoices ADD COLUMN exception TEXT;
