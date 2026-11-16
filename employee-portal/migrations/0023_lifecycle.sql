-- Employee lifecycle / tenure: resignation → notice → last working day → Full & Final,
-- plus onboarding / offboarding checklists. The F&F settlement itself is computed on demand
-- (review-only estimate) and never stored as a payout.

CREATE TABLE IF NOT EXISTS resignations (
  id                TEXT PRIMARY KEY,
  employee_id       TEXT NOT NULL,
  submitted_by      TEXT,                          -- user id (employee self, or HR on behalf)
  resignation_date  TEXT NOT NULL,                 -- date tendered
  reason            TEXT,
  notice_days       INTEGER,                       -- snapshot of the employee's notice term at tender
  requested_lwd     TEXT,                          -- employee's requested last working day (optional)
  accepted_lwd      TEXT,                          -- HR-set last working day
  status            TEXT NOT NULL DEFAULT 'submitted', -- submitted | accepted | withdrawn | rejected | completed
  hr_notes          TEXT,
  decided_by        TEXT,
  decided_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resignations_emp ON resignations(employee_id);
CREATE INDEX IF NOT EXISTS idx_resignations_status ON resignations(status);

CREATE TABLE IF NOT EXISTS lifecycle_tasks (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,                      -- onboarding | offboarding
  item_code    TEXT NOT NULL,                      -- stable code (e.g. return_assets)
  label        TEXT NOT NULL,                      -- seeded English label
  status       TEXT NOT NULL DEFAULT 'pending',    -- pending | done | na
  note         TEXT,
  done_by      TEXT,
  done_at      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_emp_kind ON lifecycle_tasks(employee_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lifecycle_item ON lifecycle_tasks(employee_id, kind, item_code);

-- Leave-encashment policy inputs for the F&F estimate (overridable in Settings later). The
-- encashable leave type code and the per-day divisor live in portal_config.
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('fnf_encash_leave_code', 'EL');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('fnf_encash_divisor', '30');
