-- Payroll-ready attendance (first "extend the live portal" milestone):
--   1. Holiday calendars (per-location, '*' = all locations) — the denominator for
--      working-day / payable-day counting.
--   2. A single configurable attendance policy (weekly-off days, weekly target) so
--      day counting is rule-driven, not hardcoded.
--   3. Month cutoff/lock — once a month is locked for payroll, attendance for that
--      month is frozen (no imports, no new corrections, no correction write-backs).
-- OT is already captured per day (attendance_days.ot_minutes, migration 0005); this
-- milestone surfaces it in the payroll-input summary.

CREATE TABLE IF NOT EXISTS holidays (
  id           TEXT PRIMARY KEY,
  location     TEXT NOT NULL DEFAULT '*',   -- '*' = applies to every location
  holiday_date TEXT NOT NULL,               -- YYYY-MM-DD
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_loc_date ON holidays(location, holiday_date);

-- One org-level policy row. Weekly-off is a CSV of day-of-week integers (0=Sun … 6=Sat);
-- the 4SYZ default is Monday–Saturday working, Sunday off, 48h/week target.
CREATE TABLE IF NOT EXISTS attendance_policy (
  id                    TEXT PRIMARY KEY,
  weekly_off_days       TEXT    NOT NULL DEFAULT '0',
  weekly_target_minutes INTEGER NOT NULL DEFAULT 2880,
  full_day_minutes      INTEGER NOT NULL DEFAULT 240,
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO attendance_policy (id) VALUES ('default');

-- Month cutoff/lock. A row with status='locked' means that month (YYYY-MM) is frozen
-- for payroll; unlocking sets status='open' but keeps the audit trail of who/when.
CREATE TABLE IF NOT EXISTS attendance_periods (
  ym         TEXT PRIMARY KEY,                       -- YYYY-MM
  status     TEXT NOT NULL DEFAULT 'locked',         -- locked | open
  locked_by  TEXT,
  locked_at  TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  note       TEXT
);

-- A couple of demo holidays so the register has something to count against; HR
-- maintains the real calendar in the Attendance tab.
INSERT OR IGNORE INTO holidays (id, location, holiday_date, name) VALUES
  ('h_demo_rajyotsava', '*', '2026-11-01', 'Kannada Rajyotsava'),
  ('h_demo_christmas',  '*', '2026-12-25', 'Christmas');
