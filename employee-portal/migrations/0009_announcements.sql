-- FR-07 Announcements. Publishers target an audience; critical ones can require a
-- versioned acknowledgement. Editing an announcement bumps its version, so prior
-- acknowledgements no longer count and people must acknowledge the new version.
CREATE TABLE IF NOT EXISTS announcements (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT,
  audience     TEXT NOT NULL DEFAULT 'all',  -- all | office | client_site
  requires_ack INTEGER NOT NULL DEFAULT 0,
  version      INTEGER NOT NULL DEFAULT 1,
  active       INTEGER NOT NULL DEFAULT 1,
  published_by TEXT,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ann_active ON announcements(active);

CREATE TABLE IF NOT EXISTS announcement_acks (
  id              TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  employee_id     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  acked_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ann_ack ON announcement_acks(announcement_id, employee_id, version);
