-- Payroll core — P6c: payslips. On approve+lock, each payroll line generates a payslip,
-- published to the employee through the Documents module (category 'payslip'); this table
-- links the line → its Documents record for traceability. Maker-checker state columns
-- already exist on payroll_runs (migration 0015).
CREATE TABLE IF NOT EXISTS payslips (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL,
  line_id      TEXT NOT NULL,
  employee_id  TEXT NOT NULL,
  ym           TEXT NOT NULL,
  document_id  TEXT NOT NULL,           -- FK → documents (category 'payslip', published)
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payslip_emp ON payslips(employee_id, ym);
CREATE INDEX IF NOT EXISTS idx_payslip_run ON payslips(run_id);
