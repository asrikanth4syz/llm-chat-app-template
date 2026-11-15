-- Payroll core — P6a: employee master dates (needed for correct proration), the salary
-- component catalog, and effective-dated per-employee salary with revision history.
-- Money is stored as INTEGER PAISE everywhere. Percent values are basis points (bps).
-- The run engine, payslips and maker-checker controls land in P6b/P6c.

-- Proration prerequisite: bound pay to the employment window (§2 of the spec).
ALTER TABLE employees ADD COLUMN date_of_joining TEXT; -- YYYY-MM-DD
ALTER TABLE employees ADD COLUMN date_of_exit TEXT;    -- YYYY-MM-DD (NULL = active)

-- Configurable proration divisor (Finance-selectable): calendar (default) | fixed_30 | fixed_26.
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('payroll_divisor', 'calendar');

-- Component catalog — the reusable definitions the UI offers; a per-employee salary
-- copies concrete rows from these so historical salaries stay immutable if the catalog changes.
CREATE TABLE IF NOT EXISTS salary_components (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,                 -- earning | deduction
  calc_method TEXT NOT NULL DEFAULT 'fixed',-- fixed | percent_of_base
  base_code  TEXT,                          -- for percent_of_base (e.g. HRA % of BASIC)
  taxable    INTEGER NOT NULL DEFAULT 1,
  statutory  INTEGER NOT NULL DEFAULT 0,    -- PF/ESI/PT/TDS — rules arrive in the statutory phase
  prorates   INTEGER NOT NULL DEFAULT 1,    -- does this component reduce for loss-of-pay days?
  sequence   INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

-- Effective-dated employee salary (one row = one revision). No two active rows overlap
-- for an employee (enforced in code; D1 has no exclusion constraints).
CREATE TABLE IF NOT EXISTS employee_salaries (
  id                  TEXT PRIMARY KEY,
  employee_id         TEXT NOT NULL,
  effective_from      TEXT NOT NULL,         -- YYYY-MM-DD
  effective_to        TEXT,                  -- NULL = open-ended
  revision_no         INTEGER NOT NULL DEFAULT 1,
  monthly_gross_paise INTEGER NOT NULL DEFAULT 0, -- Σ earnings, stored for traceability
  status              TEXT NOT NULL DEFAULT 'active', -- active | superseded
  created_by          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_empsal_emp ON employee_salaries(employee_id, effective_from);

-- Concrete component rows for a salary revision (denormalised from the catalog so the
-- engine is self-contained and the revision is immutable).
CREATE TABLE IF NOT EXISTS employee_salary_components (
  id                 TEXT PRIMARY KEY,
  employee_salary_id TEXT NOT NULL,
  component_code     TEXT NOT NULL,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL,          -- earning | deduction
  calc_method        TEXT NOT NULL DEFAULT 'fixed', -- fixed | percent_of_base
  value              INTEGER NOT NULL DEFAULT 0,     -- paise (fixed) | basis points (percent)
  base_code          TEXT,
  prorates           INTEGER NOT NULL DEFAULT 1,
  taxable            INTEGER NOT NULL DEFAULT 1,
  statutory          INTEGER NOT NULL DEFAULT 0,
  sequence           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_empsalcomp_sal ON employee_salary_components(employee_salary_id);

-- Seed a sensible default catalog (refine to 4SYZ's real CTC structure when supplied).
-- BASIC fixed; HRA 40% of BASIC; SPECIAL = balancing earning; PF/PT statutory placeholders (0).
INSERT OR IGNORE INTO salary_components (code, name, kind, calc_method, base_code, taxable, statutory, prorates, sequence) VALUES
  ('BASIC',   'Basic',             'earning',   'fixed',           NULL,    1, 0, 1, 10),
  ('HRA',     'House Rent Allowance','earning', 'percent_of_base', 'BASIC', 1, 0, 1, 20),
  ('SPECIAL', 'Special Allowance',  'earning',  'fixed',           NULL,    1, 0, 1, 30),
  ('CONVEY',  'Conveyance',         'earning',  'fixed',           NULL,    1, 0, 0, 40),
  ('PF_EE',   'Provident Fund (EE)','deduction','fixed',           NULL,    0, 1, 0, 100),
  ('PT',      'Professional Tax',   'deduction','fixed',           NULL,    0, 1, 0, 110),
  ('TDS',     'TDS',                'deduction','fixed',           NULL,    0, 1, 0, 120);

-- Seed joining dates for the demo employees so proration has a window to work with.
UPDATE employees SET date_of_joining = '2024-04-01' WHERE date_of_joining IS NULL AND id IN ('e_hr','e_meera','e_asha');
UPDATE employees SET date_of_joining = '2025-01-15' WHERE date_of_joining IS NULL AND id = 'e_bala';
