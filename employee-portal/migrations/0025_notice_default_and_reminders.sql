-- Standard notice period is 60 calendar days (migration 0021 had seeded 30). Bump the seeded
-- default to 60 for everyone still on the old blanket default; leave any deliberately-different
-- value untouched is not possible to distinguish from the seed, so this sets the 30/NULL rows.
UPDATE employees SET notice_period_days = 60 WHERE notice_period_days IS NULL OR notice_period_days = 30;

-- Reminder outbox populated by the daily cron (scheduled handler). Idempotent per
-- (resignation, kind, for_date) so a day's run never duplicates a reminder.
CREATE TABLE IF NOT EXISTS resignation_reminders (
  id             TEXT PRIMARY KEY,
  resignation_id TEXT NOT NULL,
  employee_id    TEXT NOT NULL,
  kind           TEXT NOT NULL,          -- manager_approval | hr_approval | escalation | lwd
  message        TEXT NOT NULL,
  for_date       TEXT NOT NULL,          -- the IST date the reminder was generated for
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resign_reminder ON resignation_reminders(resignation_id, kind, for_date);
CREATE INDEX IF NOT EXISTS idx_resign_reminder_created ON resignation_reminders(created_at);
