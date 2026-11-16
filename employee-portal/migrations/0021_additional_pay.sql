-- Per-employee additional pay (variable / retention / performance bonus, incentives,
-- ad-hoc) applied to a specific month — the HRMS "additional salary" pattern, so bonuses
-- are NOT baked into the recurring monthly structure. Plus a second emergency contact and
-- the notice-period term on the employee record.

ALTER TABLE employees ADD COLUMN emergency_contact_2 TEXT;      -- optional additional emergency contact
ALTER TABLE employees ADD COLUMN notice_period_days INTEGER;    -- employment term; drives LWD at resignation

CREATE TABLE IF NOT EXISTS employee_additional_pay (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL,
  ym           TEXT NOT NULL,                    -- YYYY-MM the amount applies to
  code         TEXT NOT NULL,                    -- RETENTION | PERF_BONUS | VARIABLE | INCENTIVE | ADHOC
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'earning',  -- earning | deduction
  amount_paise INTEGER NOT NULL DEFAULT 0,
  taxable      INTEGER NOT NULL DEFAULT 1,
  note         TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_addpay_emp_ym ON employee_additional_pay(employee_id, ym);

-- Sensible default notice period (30 days) for existing records; HR sets the real term.
UPDATE employees SET notice_period_days = 30 WHERE notice_period_days IS NULL;
