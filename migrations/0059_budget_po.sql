-- Budget & Purchase Orders per client-location.
-- Mirrors the runtime self-heal in ensureBudgetPoSchema (the deploy pipeline does not
-- apply migrations/*.sql, so that path is authoritative. This keeps a fresh DB in sync).
-- NOTE: these are the CLIENT budget POs — distinct from the vendor-facing
-- purchase_orders table used elsewhere.

CREATE TABLE IF NOT EXISTS location_budgets (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'Monthly',   -- Monthly | Quarterly | Yearly (calendar FY, Jan–Dec)
  period_label TEXT,
  period_start TEXT,
  period_end TEXT,
  amount REAL NOT NULL DEFAULT 0,
  created_by_type TEXT NOT NULL DEFAULT 'client', -- client | internal (on behalf)
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_locbudget_loc ON location_budgets (location_id, active);

CREATE TABLE IF NOT EXISTS budget_revisions (
  id TEXT PRIMARY KEY,
  budget_id TEXT,
  location_id TEXT NOT NULL,
  old_amount REAL,
  new_amount REAL,
  period_type TEXT,
  period_label TEXT,
  effective_kind TEXT,          -- now | next
  effective_from TEXT,
  po_ref TEXT,
  reason TEXT,
  note TEXT,
  attachment_name TEXT,
  changed_by TEXT,
  changed_by_name TEXT,
  changed_role TEXT,
  source TEXT,                  -- direct | behalf
  status TEXT NOT NULL DEFAULT 'applied',   -- applied | pending | rejected
  approver TEXT,
  decided_by TEXT,              -- user id of the approver who applied or rejected
  decided_by_name TEXT,
  decided_at TEXT,
  reject_reason TEXT,           -- required note when a pending revision is rejected
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_budgetrev_loc ON budget_revisions (location_id, created_at);

CREATE TABLE IF NOT EXISTS budget_settings (
  client_id TEXT PRIMARY KEY,
  approval_required INTEGER NOT NULL DEFAULT 0,
  threshold_pct INTEGER NOT NULL DEFAULT 20,
  approver_user_id TEXT,
  po_mandatory INTEGER NOT NULL DEFAULT 0,    -- optional by default
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_pos (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL,
  client_location_id TEXT NOT NULL,
  budget_id TEXT,
  type TEXT NOT NULL DEFAULT 'Blanket',        -- Blanket | Standard
  valid_from TEXT,
  valid_to TEXT,
  amount REAL NOT NULL DEFAULT 0,
  category_scope TEXT,                          -- comma-separated categories ('' = all)
  document_name TEXT,
  status TEXT NOT NULL DEFAULT 'Active',        -- Active | Draft | Fully Consumed | Expired | Closed | Cancelled
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clientpos_loc ON client_pos (client_location_id, status);

-- Source of truth for PO balances. committed = Σcommit − Σrelease − Σactual, actual = Σactual
CREATE TABLE IF NOT EXISTS client_po_ledger (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  order_id TEXT,
  type TEXT NOT NULL,                           -- commit | release | actual
  amount REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_poledger_po ON client_po_ledger (po_id);

CREATE TABLE IF NOT EXISTS client_po_amendments (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  old_amount REAL,
  new_amount REAL,
  reason TEXT,
  changed_by TEXT,
  changed_by_name TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
);

-- Orders reference a client budget PO (nullable, required only when the client opts in).
ALTER TABLE orders ADD COLUMN po_id TEXT;
ALTER TABLE orders ADD COLUMN po_override_reason TEXT;
