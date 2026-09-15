-- Order amendments: changing line items on an approved (pre-dispatch) order.
-- Each amendment bumps orders.revision, resets the order to PENDING_APPROVAL,
-- and records the before/after here for audit.
ALTER TABLE orders ADD COLUMN revision INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS order_amendments (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  revision     INTEGER NOT NULL,
  actor_id     TEXT,
  actor_name   TEXT,
  reason       TEXT NOT NULL,
  before_items TEXT,
  after_items  TEXT,
  before_total REAL DEFAULT 0,
  after_total  REAL DEFAULT 0,
  from_status  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
