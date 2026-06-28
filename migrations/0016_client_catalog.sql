-- Migration 0016: Per-client product catalog assignments
CREATE TABLE IF NOT EXISTS client_catalog (
  client_id TEXT NOT NULL,
  sku       TEXT NOT NULL,
  added_by  TEXT,
  added_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, sku)
);
