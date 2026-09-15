-- Contact / "Book a demo" lead capture from the marketing landing page.
-- Public POST /api/contact writes here; super-admin & ops-admin read it back.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  company    TEXT,
  email      TEXT NOT NULL,
  phone      TEXT,
  scale      TEXT,
  message    TEXT,
  source     TEXT DEFAULT 'landing',
  status     TEXT NOT NULL DEFAULT 'NEW',
  created_at TEXT DEFAULT (datetime('now'))
);
