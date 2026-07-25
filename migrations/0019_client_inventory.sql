-- Migration 0019: Client store / warehouse inventory tracking
CREATE TABLE IF NOT EXISTS client_inventory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       TEXT NOT NULL,
  sku             TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  category        TEXT DEFAULT '',
  uom             TEXT DEFAULT 'unit',
  qty_on_hand     REAL DEFAULT 0,
  reorder_level   REAL DEFAULT 0,
  last_received_qty REAL DEFAULT 0,
  last_received_at  TEXT,
  last_consumed_at  TEXT,
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(client_id, sku)
);

CREATE TABLE IF NOT EXISTS client_consumption (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   TEXT NOT NULL,
  sku         TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  qty         REAL NOT NULL,
  consumed_at TEXT DEFAULT (datetime('now')),
  notes       TEXT,
  recorded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_ci_client ON client_inventory(client_id);
CREATE INDEX IF NOT EXISTS idx_cc_client ON client_consumption(client_id, consumed_at);
