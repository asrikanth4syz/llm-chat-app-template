-- Resignation & exit workflow (extends the 0023 lifecycle resignations table — no duplicate
-- structures). Adds the multi-step state machine's decision/waiver/F&F/exception columns, a
-- department clearance-task table, and an IMMUTABLE event log for the audit trail.

-- Decision milestones (separate from the latest decided_by/decided_at already present).
ALTER TABLE resignations ADD COLUMN manager_decision  TEXT;   -- approve | reject
ALTER TABLE resignations ADD COLUMN manager_decided_by TEXT;
ALTER TABLE resignations ADD COLUMN manager_decided_at TEXT;
ALTER TABLE resignations ADD COLUMN manager_remarks   TEXT;
ALTER TABLE resignations ADD COLUMN hr_decision       TEXT;   -- approve | reject
ALTER TABLE resignations ADD COLUMN hr_decided_by     TEXT;
ALTER TABLE resignations ADD COLUMN hr_decided_at     TEXT;
ALTER TABLE resignations ADD COLUMN hr_remarks        TEXT;
ALTER TABLE resignations ADD COLUMN reason_code       TEXT;   -- dropdown value (remarks stay in `reason`)
-- Notice-period waiver and any authorised LWD change.
ALTER TABLE resignations ADD COLUMN waived            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resignations ADD COLUMN waive_reason      TEXT;
ALTER TABLE resignations ADD COLUMN waived_at         TEXT;
ALTER TABLE resignations ADD COLUMN lwd_change_reason TEXT;   -- last authorised notice/LWD change reason
ALTER TABLE resignations ADD COLUMN clearance_started_at TEXT;
-- Full & final settlement record (the estimate is computed live; this stores the settled values).
ALTER TABLE resignations ADD COLUMN fnf_amount_paise  INTEGER;
ALTER TABLE resignations ADD COLUMN fnf_date          TEXT;
ALTER TABLE resignations ADD COLUMN fnf_remarks       TEXT;
ALTER TABLE resignations ADD COLUMN fnf_at            TEXT;
-- Relieving (with authorised-exception override).
ALTER TABLE resignations ADD COLUMN relieved_at       TEXT;
ALTER TABLE resignations ADD COLUMN relieve_exception INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resignations ADD COLUMN relieve_reason    TEXT;
-- Withdrawal request (when raised after HR approval, it needs HR approval).
ALTER TABLE resignations ADD COLUMN withdraw_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resignations ADD COLUMN withdraw_reason    TEXT;
ALTER TABLE resignations ADD COLUMN withdraw_requested_at TEXT;

-- Department clearance tasks tied to a resignation. Overall clearance status is derived from
-- these rows. Clearance owners (Finance/IT/Admin) see ONLY these rows — never the resignation
-- reason or approval remarks.
CREATE TABLE IF NOT EXISTS resignation_clearance_tasks (
  id             TEXT PRIMARY KEY,
  resignation_id TEXT NOT NULL,
  employee_id    TEXT NOT NULL,
  department     TEXT NOT NULL,            -- Finance | IT | Admin | HR | <existing department>
  owner_role     TEXT,                     -- role expected to action it
  required       INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
  remarks        TEXT,
  due_date       TEXT,
  completed_at   TEXT,
  updated_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rct_resignation ON resignation_clearance_tasks(resignation_id);
CREATE INDEX IF NOT EXISTS idx_rct_dept ON resignation_clearance_tasks(department, status);

-- Immutable audit trail: one row per status change (prev → new), actor, timestamp, remarks.
-- Triggers block UPDATE/DELETE so the history can never be altered.
CREATE TABLE IF NOT EXISTS resignation_events (
  id             TEXT PRIMARY KEY,
  resignation_id TEXT NOT NULL,
  employee_id    TEXT NOT NULL,
  prev_status    TEXT,
  new_status     TEXT,
  action         TEXT,
  actor_user_id  TEXT,
  remarks        TEXT,
  at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_revt_resignation ON resignation_events(resignation_id, at);
CREATE TRIGGER IF NOT EXISTS revt_no_update BEFORE UPDATE ON resignation_events
  BEGIN SELECT RAISE(ABORT, 'resignation_events is immutable'); END;
CREATE TRIGGER IF NOT EXISTS revt_no_delete BEFORE DELETE ON resignation_events
  BEGIN SELECT RAISE(ABORT, 'resignation_events is immutable'); END;

-- Configurable defaults (IST, calendar-day notice). All overridable in portal_config.
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_notice_default_days', '60');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_clearance_auto_days', '3');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_remind_approval_days', '2');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_escalate_days', '5');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_lwd_reminders', '15,7,3,1');
INSERT OR IGNORE INTO portal_config (key, value) VALUES ('resign_clearance_departments', 'Finance,IT,Admin,HR');

-- Map any existing (0023) resignations onto the new state machine.
UPDATE resignations SET status = 'pending_manager' WHERE status = 'submitted';
UPDATE resignations SET status = 'notice_period', hr_decision = 'approve', hr_decided_at = COALESCE(decided_at, created_at) WHERE status = 'accepted';
UPDATE resignations SET status = 'relieved', relieved_at = COALESCE(decided_at, created_at) WHERE status = 'completed';
-- rejected / withdrawn keep their status.
