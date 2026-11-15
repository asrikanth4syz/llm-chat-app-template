-- Statutory payroll — S7a: Professional Tax (PT) only. At 4SYZ's current headcount EPF and
-- ESI are not applicable (confirmed 2026-11-15); TDS is S7b. This builds the statutory config
-- model + per-employee statutory profile and seeds ILLUSTRATIVE Karnataka PT slabs with PT
-- DISABLED — Finance enters the CA-confirmed slabs and flips `enabled` after sign-off.
-- All money in paise. No rate is hardcoded in code; everything lives in params here.

CREATE TABLE IF NOT EXISTS statutory_config (
  id             TEXT PRIMARY KEY,       -- e.g. 'pt_KA'
  statute        TEXT NOT NULL,          -- pt (epf|esi|tds added later)
  state          TEXT NOT NULL DEFAULT '*',
  fy             TEXT,
  effective_from TEXT,
  effective_to   TEXT,
  params         TEXT NOT NULL DEFAULT '{}', -- JSON: slabs/thresholds/rounding/etc.
  enabled        INTEGER NOT NULL DEFAULT 0, -- off until CA-confirmed
  updated_by     TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_statconf ON statutory_config(statute, state);

-- Per-employee statutory profile (identifiers are sensitive; only pt_state is used in S7a).
CREATE TABLE IF NOT EXISTS employee_statutory (
  employee_id   TEXT PRIMARY KEY,
  pf_applicable INTEGER NOT NULL DEFAULT 0,
  uan           TEXT,
  esi_applicable INTEGER NOT NULL DEFAULT 0,
  esic_number   TEXT,
  pt_state      TEXT,
  pan           TEXT,
  tax_regime    TEXT DEFAULT 'new',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Illustrative Karnataka PT (CA MUST confirm the current-FY slabs): nil up to ₹24,999,
-- ₹200/month at ₹25,000+. Seeded DISABLED (enabled=0) — no payslip impact until enabled.
INSERT OR IGNORE INTO statutory_config (id, statute, state, fy, effective_from, params, enabled) VALUES
  ('pt_KA', 'pt', 'KA', '2026-27', '2026-04-01',
   '{"slabs":[{"upTo":2499900,"amount":0},{"upTo":null,"amount":20000}],"februarySpecial":null,"annualCap":240000,"rounding":"rupee"}', 0);

-- Seed PT state for the demo employees (Karnataka). HR maintains per-employee state.
INSERT OR IGNORE INTO employee_statutory (employee_id, pt_state) VALUES
  ('e_hr', 'KA'), ('e_meera', 'KA'), ('e_asha', 'KA'), ('e_bala', 'KA');
