-- Migration 0054 Smart Paste Order V2 Slice 1 (milestone 005) alias learning
-- Additive only. Mirrors the V2 schema deltas. The same statements also live in
-- ensureSmartPasteSchema (src/index.ts) so a self-healed production DB is enough.

-- Client-scoped learned aliases: an operator-confirmed phrase to SKU mapping.
-- A phrase may map to more than one SKU (conflict), so the SKU is part of the PK.
CREATE TABLE IF NOT EXISTS paste_alias (
  client_id    TEXT NOT NULL,
  alias_norm   TEXT NOT NULL,
  sku          TEXT NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT DEFAULT (datetime('now')),
  created_at   TEXT DEFAULT (datetime('now')),
  created_by   TEXT,
  PRIMARY KEY (client_id, alias_norm, sku)
);
CREATE INDEX IF NOT EXISTS idx_alias_lookup ON paste_alias (client_id, alias_norm);

-- Winning tier persisted on confirm-phase paste_match_log rows (sets up the
-- later metrics slice). V2 also starts persisting the real product_text, parse
-- time status and needs_qty on confirm rows (no schema change needed for those).
ALTER TABLE paste_match_log ADD COLUMN tier TEXT;
