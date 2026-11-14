-- FR-06 Documents. HR publishes documents (payslips, letters, policies) to a specific
-- employee. An employee sees only their OWN published documents — drafts (e.g. a
-- payslip being prepared) are never visible to them.
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL,                 -- the owner the document is for
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other', -- payslip | letter | policy | other
  file         TEXT,                          -- data URL (PDF/image) or NULL
  body         TEXT,                          -- optional text content (e.g. a letter)
  status       TEXT NOT NULL DEFAULT 'draft', -- draft | published
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_emp ON documents(employee_id, status);
