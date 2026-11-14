-- FR-03 Leave — balances, requests, and the approval workflow.
-- Balances change only after approval (FR-03). Per-location holiday calendars and
-- working-day-aware counting are a follow-up; days here are inclusive calendar days.

CREATE TABLE IF NOT EXISTS leave_types (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL,          -- CL | SL | EL
  name          TEXT NOT NULL,
  default_quota REAL NOT NULL DEFAULT 0 -- annual entitlement in days
);

-- Per employee, per type, per year. used counts APPROVED days only.
CREATE TABLE IF NOT EXISTS leave_balances (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT NOT NULL,
  leave_type_id TEXT NOT NULL,
  year          INTEGER NOT NULL,
  entitled      REAL NOT NULL DEFAULT 0,
  used          REAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_bal ON leave_balances(employee_id, leave_type_id, year);

CREATE TABLE IF NOT EXISTS leave_requests (
  id               TEXT PRIMARY KEY,
  employee_id      TEXT NOT NULL,
  leave_type_id    TEXT NOT NULL,
  start_date       TEXT NOT NULL,       -- YYYY-MM-DD
  end_date         TEXT NOT NULL,
  days             REAL NOT NULL,
  half_day         INTEGER NOT NULL DEFAULT 0,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | cancelled
  approver_id      TEXT,
  decision_comment TEXT,
  decided_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_status ON leave_requests(status);

-- Seed leave types (quotas are a config decision; these are sensible defaults).
INSERT OR IGNORE INTO leave_types (id, code, name, default_quota) VALUES
  ('lt_cl', 'CL', 'Casual Leave', 12),
  ('lt_sl', 'SL', 'Sick Leave', 12),
  ('lt_el', 'EL', 'Earned Leave', 15);
