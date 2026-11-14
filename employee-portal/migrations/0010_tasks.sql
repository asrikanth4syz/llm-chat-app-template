-- FR-05 Tasks. Owner (assignee), due date, priority, status and evidence. Managers
-- assign within their scope; employees can self-assign and update their own tasks.
CREATE TABLE IF NOT EXISTS tasks (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  description          TEXT,
  assignee_employee_id TEXT NOT NULL,
  assigned_by_user_id  TEXT NOT NULL,
  due_date             TEXT,                        -- YYYY-MM-DD or NULL
  priority             TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  status               TEXT NOT NULL DEFAULT 'open',   -- open | in_progress | done | cancelled
  evidence             TEXT,                        -- note/link the assignee adds on completion
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
