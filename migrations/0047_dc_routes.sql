-- Phase 4: DC route planner — an ordered stop sequence for ad-hoc DCs on a
-- given day, with a delivery person. stops is a JSON array of enriched stops
-- (seq, dc_id, dc_number, client, items, maps link).
CREATE TABLE IF NOT EXISTS dc_routes (
  id              TEXT PRIMARY KEY,
  route_date      TEXT NOT NULL,
  delivery_person TEXT,
  stops           TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'PLANNED',   -- PLANNED | DISPATCHED | DONE
  created_by      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
