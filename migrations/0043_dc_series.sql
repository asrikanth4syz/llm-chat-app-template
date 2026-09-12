-- Phase 0: DC Number Series — FY-aware, per-category-class DC numbering.
-- class: CONSUMABLE (7xxxxx, Consumables + Non-Returnable)
--        GIFTING    (8xxxxx, Gifting + Returnable-Sample)
-- One ACTIVE row per (fy, class); allocation atomically increments last_no.
CREATE TABLE IF NOT EXISTS dc_series (
  fy         TEXT NOT NULL,
  class      TEXT NOT NULL,
  prefix     INTEGER NOT NULL,
  start_no   INTEGER NOT NULL,
  last_no    INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | CLOSED
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (fy, class)
);
