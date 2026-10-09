-- Migration 0053 Smart Paste Order (milestone 004)
-- Additive only. Mirrors data-model.md. The same statements also live in
-- ensureFeatureTables (src/index.ts) so a self-healed production DB is enough.

-- Per-line confirmation log. Parse-phase rows (order_id NULL) are upserted to
-- confirm-phase on Confirm. One final row per original pasted line.
CREATE TABLE IF NOT EXISTS paste_match_log (
  id               TEXT PRIMARY KEY,
  parse_session_id TEXT NOT NULL,
  phase            TEXT NOT NULL DEFAULT 'parse',
  client_id        TEXT NOT NULL,
  order_id         TEXT,
  line_no          INTEGER NOT NULL,
  raw_text         TEXT NOT NULL,
  product_text     TEXT,
  parsed_qty       INTEGER,
  status           TEXT,
  needs_qty        INTEGER NOT NULL DEFAULT 0,
  parse_flags      TEXT,
  candidates_json  TEXT,
  top_sku          TEXT,
  chosen_sku       TEXT,
  confidence       REAL,
  action           TEXT,
  actor_id         TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pml_session ON paste_match_log (parse_session_id, line_no);
CREATE INDEX IF NOT EXISTS idx_pml_metrics ON paste_match_log (phase, client_id, created_at);

-- Idempotency store for Confirm (from-paste). A replayed idempotency_key
-- returns the existing order_id and writes nothing new.
CREATE TABLE IF NOT EXISTS paste_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL,
  client_id       TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Provenance tag on orders for smart-paste-originated drafts.
ALTER TABLE orders ADD COLUMN source TEXT;
