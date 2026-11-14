-- FR-09 Helpdesk + FR-21 POSH. Tickets with categories, status, assignment and a
-- comment thread. POSH complaints are a special category visible only to the
-- complainant and the Internal Committee (configured per employee below).
CREATE TABLE IF NOT EXISTS tickets (
  id               TEXT PRIMARY KEY,
  employee_id      TEXT NOT NULL,       -- the person who raised it
  category         TEXT NOT NULL,       -- hr | it | general | posh
  subject          TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open', -- open | in_progress | resolved | closed
  assignee_user_id TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_emp ON tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_cat_status ON tickets(category, status);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id             TEXT PRIMARY KEY,
  ticket_id      TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  body           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tcomments_ticket ON ticket_comments(ticket_id);

-- POSH Internal Committee (FR-21): the configurable set of employees who alone can
-- see POSH complaints. Managed by super_admin. Empty by default.
CREATE TABLE IF NOT EXISTS posh_committee (
  employee_id TEXT PRIMARY KEY,
  added_by    TEXT,
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
