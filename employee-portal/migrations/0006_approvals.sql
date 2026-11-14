-- FR-04 Approvals — approval delegation. An approver may delegate their authority to
-- a colleague for a period; the delegate then sees and can decide the delegator's
-- team's pending requests (leave + attendance). The unified approvals inbox itself
-- reads existing leave/attendance/profile tables, so it needs no new storage.
CREATE TABLE IF NOT EXISTS approval_delegations (
  id                    TEXT PRIMARY KEY,
  delegator_employee_id TEXT NOT NULL,   -- whose approval authority is delegated
  delegate_employee_id  TEXT NOT NULL,   -- who receives it
  starts_on             TEXT,            -- YYYY-MM-DD or NULL (open start)
  ends_on               TEXT,            -- YYYY-MM-DD or NULL (open end)
  active                INTEGER NOT NULL DEFAULT 1,
  created_by            TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deleg_delegate ON approval_delegations(delegate_employee_id);
CREATE INDEX IF NOT EXISTS idx_deleg_delegator ON approval_delegations(delegator_employee_id);
