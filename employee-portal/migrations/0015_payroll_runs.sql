-- Payroll core — P6b: the payroll run. A run computes one line per employee for a locked
-- attendance month from their effective-dated salary + the locked attendance input. Money
-- is INTEGER PAISE. Maker-checker transitions, lock, versioned revisions and payslips are
-- wired in P6c; this phase builds the run, its lines, the component breakdown, exceptions
-- and the register. A run starts in 'draft'.

CREATE TABLE IF NOT EXISTS payroll_runs (
  id          TEXT PRIMARY KEY,
  ym          TEXT NOT NULL,                 -- YYYY-MM
  version     INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft | in_review | approved | locked | cancelled
  divisor     TEXT NOT NULL DEFAULT 'calendar', -- divisor mode used (snapshot for reproducibility)
  employees   INTEGER NOT NULL DEFAULT 0,
  gross_paise INTEGER NOT NULL DEFAULT 0,
  net_paise   INTEGER NOT NULL DEFAULT 0,
  exceptions  INTEGER NOT NULL DEFAULT 0,
  prepared_by TEXT, prepared_at TEXT,
  reviewed_by TEXT, reviewed_at TEXT,
  approved_by TEXT, approved_at TEXT,
  locked_at   TEXT, note TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payrun_ym ON payroll_runs(ym);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  employee_id   TEXT NOT NULL,
  employee_name TEXT,
  salary_ids    TEXT,                 -- JSON array of the employee_salaries rows used (traceability)
  calendar_days INTEGER NOT NULL DEFAULT 0,
  employed_days INTEGER NOT NULL DEFAULT 0,
  lop_days      INTEGER NOT NULL DEFAULT 0,
  ot_minutes    INTEGER NOT NULL DEFAULT 0,
  gross_paise   INTEGER NOT NULL DEFAULT 0, -- earned gross (after proration)
  deductions_paise INTEGER NOT NULL DEFAULT 0,
  lop_paise     INTEGER NOT NULL DEFAULT 0,
  net_paise     INTEGER NOT NULL DEFAULT 0,
  exception     TEXT,                 -- NULL | negative_net | zero_pay | no_salary | missing_bank
  note          TEXT
);
CREATE INDEX IF NOT EXISTS idx_payline_run ON payroll_lines(run_id);

CREATE TABLE IF NOT EXISTS payroll_line_components (
  id           TEXT PRIMARY KEY,
  line_id      TEXT NOT NULL,
  code         TEXT NOT NULL,
  name         TEXT,
  kind         TEXT NOT NULL,         -- earning | deduction | info (LOP)
  amount_paise INTEGER NOT NULL DEFAULT 0,
  sequence     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_paylinecomp_line ON payroll_line_components(line_id);
