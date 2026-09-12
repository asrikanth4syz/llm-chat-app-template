-- Phase 3: returnable-sample lifecycle + recurring DC schedules.
ALTER TABLE delivery_challans ADD COLUMN sample_returned_at TEXT;

CREATE TABLE IF NOT EXISTS dc_recurring (
  id                TEXT PRIMARY KEY,
  client_name       TEXT NOT NULL,
  category          TEXT NOT NULL,          -- Consumables | Gifting | Returnable-Sample | Non-Returnable
  frequency         TEXT NOT NULL,          -- Weekly | Biweekly | Monthly
  delivery_person   TEXT,
  items_text        TEXT,
  active            INTEGER DEFAULT 1,      -- 1 active | 0 paused
  last_generated_at TEXT,
  created_by        TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);
