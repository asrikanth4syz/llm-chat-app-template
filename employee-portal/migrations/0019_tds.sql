-- Statutory payroll — S7b: TDS on salary. Investment/exemption declarations + proof
-- workflow, and the national TDS config (regime slabs, std deduction, rebate 87A, cess,
-- 206AA). Parameterised + CA-validated; NO rate is hardcoded in code. Seeded DISABLED —
-- Finance enters the CA-confirmed current-FY parameters and enables after sign-off.
-- All money in paise; rates in basis points.

-- Investment / exemption declarations for TDS (old regime) + proof verification.
CREATE TABLE IF NOT EXISTS tax_declarations (
  id                TEXT PRIMARY KEY,
  employee_id       TEXT NOT NULL,
  fy                TEXT NOT NULL,            -- '2026-27'
  section           TEXT NOT NULL,            -- 80C | 80D | HRA | HOME_LOAN | OTHER
  amount_paise      INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'declared', -- declared | verified | rejected
  proof_document_id TEXT,                     -- → documents
  verified_by       TEXT, note TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxdecl_emp ON tax_declarations(employee_id, fy);
CREATE INDEX IF NOT EXISTS idx_taxdecl_status ON tax_declarations(status);

-- National TDS config (ILLUSTRATIVE current-FY-style slabs — CA MUST confirm). DISABLED.
-- Stored in statutory_config (statute='tds', state='*'). params is JSON.
INSERT OR IGNORE INTO statutory_config (id, statute, state, fy, effective_from, params, enabled) VALUES
  ('tds_ALL', 'tds', '*', '2026-27', '2026-04-01',
   '{"cessRate":400,"noPanMinRate":2000,"honourProvisional":false,"regimes":{'
   || '"new":{"stdDeduction":7500000,"rebate87A":{"limit":70000000,"maxRebate":2500000},"slabs":['
   || '{"upTo":30000000,"rate":0},{"upTo":70000000,"rate":500},{"upTo":100000000,"rate":1000},'
   || '{"upTo":120000000,"rate":1500},{"upTo":150000000,"rate":2000},{"upTo":null,"rate":3000}]},'
   || '"old":{"stdDeduction":5000000,"deductionCap":15000000,"rebate87A":{"limit":50000000,"maxRebate":1250000},"slabs":['
   || '{"upTo":25000000,"rate":0},{"upTo":50000000,"rate":500},{"upTo":100000000,"rate":2000},{"upTo":null,"rate":3000}]}}}',
   0);
