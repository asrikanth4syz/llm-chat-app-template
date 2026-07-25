-- Migration 0026: Chat-style comment thread on service desk tickets
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL,
  author_id   TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tc_ticket ON ticket_comments(ticket_id, created_at);
