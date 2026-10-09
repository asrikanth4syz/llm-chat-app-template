# Data Model — Smart Paste Order (V1)

> Additive only. No column is dropped or retyped; no existing row changes meaning.
> Mirrors the r2 spec (R2-C9, R2-D4, R2-C10). Applied **twice** so runtime is self-sufficient:
> (1) a migration file, (2) the runtime `ensureFeatureTables` block in `src/index.ts`.

## 1. New table: `paste_match_log`

```sql
CREATE TABLE IF NOT EXISTS paste_match_log (
  id               TEXT PRIMARY KEY,
  parse_session_id TEXT NOT NULL,              -- groups all rows of one parse call; UPSERT key with line_no
  phase            TEXT NOT NULL DEFAULT 'parse', -- 'parse' | 'confirm'
  client_id        TEXT NOT NULL,
  order_id         TEXT,                        -- NULL until Confirm; set on the confirm UPDATE
  line_no          INTEGER NOT NULL,            -- 1-based index into the ORIGINAL newline-split text
  raw_text         TEXT NOT NULL,
  product_text     TEXT,
  parsed_qty       INTEGER,                     -- integer (R2-D2); NULL when needs_qty
  status           TEXT,                        -- 'matched' | 'unmatched'
  needs_qty        INTEGER NOT NULL DEFAULT 0,  -- 0/1
  parse_flags      TEXT,                        -- JSON array, e.g. ["coerced_decimal"]
  candidates_json  TEXT,                        -- ranked candidates returned at parse
  top_sku          TEXT,                        -- system rank #1
  chosen_sku       TEXT,                        -- operator's confirmed SKU (confirm phase)
  confidence       REAL,
  action           TEXT,                        -- confirm phase only; see CHECK below
  actor_id         TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pml_session ON paste_match_log (parse_session_id, line_no);
CREATE INDEX IF NOT EXISTS idx_pml_metrics ON paste_match_log (phase, client_id, created_at);
```

- **`action` allowed values (confirm phase):** `accepted | changed | searched | removed | unmatched | merged`. SQLite has no cheap enum; enforce in the handler (reject others with 400) rather than a CHECK constraint, to match the codebase's existing "validate in handler" style (e.g. `order_type`).
- **Lifecycle (R2-C9/C10):** parse writes one `phase='parse'` row per surviving line (`order_id` NULL). Confirm **UPDATEs** the matching `(parse_session_id, line_no)` row → sets `phase='confirm'`, `order_id`, `chosen_sku`, `action`, `updated_at`. Exactly one final row per original line.
- **Retention:** a scheduled purge deletes `phase='parse' AND order_id IS NULL AND created_at < now-30d`. V1 ships the DELETE as a reusable statement; wiring it to the existing cron is a follow-up task (3.C) — acceptable because orphan rows are harmless and excluded from metrics (which read `phase='confirm'`).

## 2. New column: `orders.source`

```sql
ALTER TABLE orders ADD COLUMN source TEXT;   -- NULL for all existing/other-flow orders; 'smart_paste' for this flow
```
- Nullable, no default → every existing row and every other caller is unaffected (closes the r1 `source-tag-vs-no-orders-change` finding). Backfill not required.

## 3. Read dependencies (unchanged tables)
- `client_catalog (client_id, sku, client_price)` — the **canonical candidate pool** (R2-C2). `client_price` from migration 0017.
- `inventory (sku, name, unit_price, stock, active)` — candidate display + price fallback: `price = COALESCE(cc.client_price, inv.unit_price)`.
- `orders (status, created_at) + order_items (order_id, sku, qty)` — history for `order_count` and `qty_suggested`, scoped to the R2-C3 status whitelist within 365 days.

## 4. Migration file
`migrations/0053_smart_paste.sql` contains §1 + §2 verbatim. The same statements are appended to `ensureFeatureTables` in `src/index.ts` (`paste_match_log`/indexes → `stmts[]`; `ALTER TABLE orders ADD COLUMN source TEXT` → `alters[]`, where ALTER errors are already swallowed if the column exists).
