# Product Specification: Smart Paste Order V2 — Alias Learning & Smarter Matching

> Builds on the shipped V1 (milestone `004-smart-paste-order`). V1 = deterministic
> unit-aware parser + bare token-Jaccard match + forgiving substring search, all
> operator-reviewed. V2 adds a **learning layer** and an **ops-curated synonym
> layer** so matching improves over time and bridges brand synonyms the bare
> matcher cannot, **without weakening any V1 guardrail** (human review, honest
> confidence, no auto-commit).

## 🎯 Executive Summary
- **Goal:** Make Smart Paste matching get smarter the more it is used — remember the SKU an operator chose for a given pasted phrase, and let ops curate brand synonyms — so repeat pastes and known brand nicknames match on the first try.
- **Target User:** Ops/admin placing orders for clients (primary); `client_admin` for their own client (secondary); `super_admin`/`ops_admin` curating synonyms and reading match-quality metrics.
- **Business Value:** Fewer manual searches and unmatched lines over time → faster order entry and higher first-pass match rate. The `paste_match_log` already captures every confirmation; V2 turns that exhaust into an asset. Also surfaces, for the first time, *how well* Smart Paste is performing (metrics), so the matcher can be tuned with evidence.

## 🧩 Scope (and non-scope)
**In scope (V2):**
1. **Client-scoped learned aliases** — `norm(product_text) → sku`, created/strengthened on Confirm.
2. **Ops-curated synonym layer** — phrase rewrites (e.g. `coke → coca cola`), global or client-scoped, applied before matching.
3. **Matcher integration** — alias + synonym signals feed the existing parse-paste ranking with new tiers and honest "why".
4. **Synonym admin UI** — CRUD for `super_admin`/`ops_admin`.
5. **Match-quality metrics** — a read-only view over `paste_match_log` (match rate, unresolved %, top unmatched terms, alias-hit rate).

**Explicitly deferred to V3 (NON-scope):** embeddings / vector search, any LLM/AI parser, a full product knowledge graph, cross-client alias sharing, auto-commit of any match.

## 🛠️ User Stories & Workflows
- **As an ops user**, when I paste a phrase I have mapped before for this client, I want it **pre-selected with high confidence and a reason** ("learned from 3 past orders"), so I don't search again.
- **As an ops user**, when I manually search and pick a SKU for an unmatched line, I want that choice **remembered for this client** so the same phrase matches next time.
- **As a super-admin / ops-admin**, I want to add brand **synonyms** (`coke → coca cola`, `maggi → maggi noodles`) so common nicknames match even the first time, for all clients or one client.
- **As a super-admin / ops-admin**, I want a **match-quality view** (what % of pasted lines matched, which phrases keep coming up unmatched) so I know where to add synonyms or catalogue items.
- **As a client-admin**, my learned aliases and metrics are **scoped to my own client only** — I never see or benefit from another client's data.

## 🗄️ Data Model (new; additive, self-healed like V1)
```
paste_alias
  client_id    TEXT NOT NULL
  alias_norm   TEXT NOT NULL      -- normNameForMatch(product_text)
  sku          TEXT NOT NULL
  hits         INTEGER NOT NULL DEFAULT 1
  last_used_at TEXT DEFAULT (datetime('now'))
  created_at   TEXT DEFAULT (datetime('now'))
  created_by   TEXT
  PRIMARY KEY (client_id, alias_norm, sku)        -- a phrase may map to >1 sku (conflict)
  INDEX idx_alias_lookup (client_id, alias_norm)

paste_synonym
  id           TEXT PRIMARY KEY
  phrase_norm  TEXT NOT NULL      -- normNameForMatch(phrase); matched as a whole token-run
  replacement  TEXT NOT NULL      -- free text, re-normalised + re-tokenised before matching
  client_id    TEXT               -- NULL = global; else scoped to one client
  active        INTEGER NOT NULL DEFAULT 1
  created_at   TEXT DEFAULT (datetime('now'))
  created_by   TEXT
  INDEX idx_syn_scope (active, client_id)
```
Config keys (via existing `getConfig`): `smartpaste_learn_enabled` (default `"1"`), `smartpaste_alias_min_hits` (default `"1"` — min hits before an alias is *suggested as selected*; it is always shown as a candidate).

## 📋 Acceptance Criteria

### A. Learning on Confirm
- **Scenario: a manual pick is learned**
  - **Given** an operator confirms a from-paste draft for client `C` with a line whose `product_text` normalises to `"good day biscuit"`, `action` ∈ {`accepted`,`changed`,`searched`,`merged`}, and `chosen_sku = "BISC-GD"`
  - **When** the order is created (first time for that `idempotency_key`)
  - **Then** a `paste_alias(C, "good day biscuit", "BISC-GD")` row exists with `hits = 1`; confirming the same phrase→sku again for `C` sets `hits = 2` and updates `last_used_at` (never a second row).
- **Scenario: removed and empty lines are not learned**
  - **Given** a confirmed line with `action = "removed"`, or an empty `product_text`
  - **Then** no `paste_alias` row is written for it.
- **Scenario: replay does not double-learn**
  - **Given** a from-paste call is replayed with the same `idempotency_key` (V1 idempotency)
  - **Then** it returns the existing order and writes **no** alias changes (hits unchanged).
- **Scenario: tenancy isolation**
  - **Given** `paste_alias` rows for client `A`
  - **When** parse-paste runs for client `B`
  - **Then** none of `A`'s aliases are considered for `B`.
- **Scenario: learning can be disabled**
  - **Given** `smartpaste_learn_enabled = "0"`
  - **When** a draft is confirmed
  - **Then** no `paste_alias` rows are written; matching still works (no alias boost).

### B. Alias + synonym applied in parse-paste
- **Scenario: a learned alias surfaces as a high-confidence candidate**
  - **Given** `paste_alias(C, "good day biscuit", "BISC-GD", hits=3)` and `BISC-GD` is in `C`'s **current** active catalogue
  - **When** parse-paste for `C` parses a line with `product_text` normalising to `"good day biscuit"`
  - **Then** the response lists `BISC-GD` as the top candidate with `tier = "learned"`, a `why` entry like `"learned from 3 past orders"`, `status = "matched"`, `selected_sku = "BISC-GD"`, and confidence in `[85,99]` rising with hits — **and the line is still returned for review, never auto-committed**.
- **Scenario: a dead aliased SKU is not suggested**
  - **Given** a `paste_alias` row whose `sku` is no longer in `C`'s active catalogue
  - **Then** it is **not** offered as a candidate (alias lookup is joined to the current pool).
- **Scenario: exact catalogue match still wins**
  - **Given** a pasted phrase that is an exact normalised catalogue name AND also has a learned alias to a different sku
  - **Then** the exact catalogue match ranks first (confidence 100, `tier = "exact"`); the alias appears as a lower candidate.
- **Scenario: a global synonym bridges a brand nickname**
  - **Given** an active global `paste_synonym(phrase_norm="coke", replacement="coca cola")` and a catalogue item `"Coca-Cola 330ml"`
  - **When** parse-paste parses `"coke 330ml - 4"`
  - **Then** matching is performed on the rewritten text `"coca cola 330ml"`, `"Coca-Cola 330ml"` is a candidate, and a `why` entry notes the synonym was applied (`"via synonym: coke → coca cola"`).
  - **And** a client-scoped synonym for `C` is applied only when the client is `C`; a global synonym applies to every client.
- **Scenario: conflicting alias → both candidates shown**
  - **Given** `paste_alias(C, "mix", "SKU-A", hits=5)` and `paste_alias(C, "mix", "SKU-B", hits=2)`, both in catalogue
  - **When** a line normalises to `"mix"`
  - **Then** both are returned as candidates ranked by `hits` desc then `last_used_at` desc; `SKU-A` is `selected_sku`; the operator can switch.
- **Scenario: ranking precedence**
  - **Then** candidates rank by tier: `exact` (100) > `learned`/`synonym`-assisted > `history` fuzzy > `fuzzy`; within a tier by confidence, then order_count, then name — deterministic.

### C. Synonym admin
- **Scenario: ops curates synonyms**
  - **Given** a `super_admin` or `ops_admin`
  - **When** they POST a synonym `{phrase:"maggi", replacement:"maggi noodles", client_id:null}`
  - **Then** it is stored active and applied on the next parse-paste; a `client_admin` or any non-ops role gets **403** on create/update/delete.
- **Scenario: toggle / delete**
  - **Then** setting `active=0` (or deleting) stops the synonym being applied, without affecting learned aliases.
- **Validation:** `phrase` and `replacement` required, each ≤ 120 chars; a phrase that normalises to empty is rejected (400); duplicate (phrase_norm, client_id) updates in place rather than duplicating.

### D. Match-quality metrics
- **Scenario: ops reads match quality**
  - **Given** confirm-phase and parse-phase rows in `paste_match_log`
  - **When** an ops/admin opens the metrics view (optionally filtered by client and a day window, default 30 days)
  - **Then** it shows: total pasted lines, % matched, % unmatched, % needs-qty, alias-hit rate, and the **top unmatched `product_text` phrases** with counts (the backlog of synonyms/catalogue gaps to fix).
  - **And** a `client_admin` sees only their own client's metrics; vendor roles get 403.
- **Performance:** the metrics query uses `idx_pml_metrics (phase, client_id, created_at)`; p95 ≤ 100 ms CPU for a 90-day window on a typical tenant.

### E. Regression / guardrails (unchanged from V1)
- Every matched line is still operator-reviewed; Confirm stays disabled until every non-removed line is resolved; from-paste stays atomic + idempotent; the ordinary `POST /api/orders` flow is untouched; CSP-safe delegated UI only.
- Confidence stays **honest**: a learned/synonym candidate is labelled as such; nothing is presented as a certain match that isn't.

## 🚨 Constraints & Edge Cases
- **Additive, self-healed schema** — new tables/indexes created via the scoped `ensureSmartPasteSchema` guard pattern (once per isolate; also mirrored to a migration). No change to the per-request hot path cost added in #133.
- **Learning writes ride the existing from-paste batch** where possible, or run immediately after the order commit; they must **never** block or fail order creation (best-effort, errors swallowed and logged).
- **Alias normalisation** reuses `normNameForMatch` (shared with the matcher) so a learned alias keys identically to how lines are matched.
- **Synonym application** is a bounded, deterministic pre-pass: longest `phrase_norm` first, applied to the normalised token run, single pass (no recursive expansion), capped at (say) 25 active synonyms considered per line to keep parse p95 within the V1 target.
- **No cross-tenant leakage:** learned aliases are strictly client-scoped; only NULL-client synonyms are global and only ops can create those.
- **Catalogue drift:** alias/synonym candidates are always intersected with the client's **current** active catalogue at parse time.
- **Idempotency:** learning is tied to first successful order creation only.
- **Privacy:** `product_text` is operator-pasted business text (item names); no PII expected, treated as ordinary tenant data under existing access control.

## 🎨 UI/UX
- **Review table (existing):** a learned/synonym candidate shows its tier via the existing confidence chip + a "why" chip (`learned ×3`, `via synonym`). No new columns.
- **Synonyms admin:** a simple table (phrase → replacement, scope, active) with add/edit/deactivate, reachable by ops/admin (a tab under Smart Paste or Settings). CSP-safe delegated handlers.
- **Metrics:** a compact KPI row (match rate, unresolved %, alias-hit rate) + a "Top unmatched phrases" list, using the canonical `tileHtml`/`.tile-grid`. Reachable from the Smart Paste surface for ops/admin.

## 🔗 Dependencies / reuse
- `paste_match_log` (V1) — the learning + metrics source of truth.
- `normNameForMatch`, `rankCandidates`, `searchCandidates`, `confidenceOf` (`src/smart_paste.ts`) — extend, don't replace.
- `ensureSmartPasteSchema` guard, `smartPastePool`, `denyClientCrossAccess`, `getConfig`/`setConfig`, `tileHtml`/delegation helpers.

## ✅ Definition of Done
- All A–E scenarios covered by tests (pure unit tests for alias/synonym ranking; integration tests for learn-on-confirm, tenancy, replay, synonym admin RBAC, metrics scoping).
- `tsc`, `node test/smoke.mjs`, `npx vitest run` all green.
- No regression to V1 behaviour or the #133 latency fix.
- Honest-confidence and no-auto-commit invariants demonstrably intact.

---

## 🔧 Revisions from spec-validation r1 (AUTHORITATIVE — overrides the body above on conflict)

> Source: `adversarial-reviews/spec-validation.md` (3 skeptics read the shipped V1 **code**, 2-of-3 gate). 14 confirmed + 10 adopted single-votes. The central discovery: **V1's `handleFromPaste` writes confirm-phase `paste_match_log` rows with `product_text=null`, `raw_text=""`, `needs_qty=0`, `status∈{ordered,removed}`, `confidence=null`, no tier, and DELETEs the parse rows** (the only place `product_text`/parse-status live); the from-paste request body carries no `product_text`; and no 30-day purge job exists. So learning and all metrics must change how confirm-time data is sourced/persisted. These revisions are authoritative.

### V2-D. Data-source & persistence (the first domino)
- **V2-D1 `learn-from-parse-rows`:** On Confirm, learning derives each alias key from the **server-side parse rows**, not from caller input. `handleFromPaste` SELECTs the parse rows for `parse_session_id` (by `line_no`) **before** the batch's `DELETE … WHERE phase='parse'`, and computes `alias_norm = normNameForMatch(parse_row.product_text)`. The from-paste request is **not** trusted for product text. `parse_session_id` becomes **required** when `smartpaste_learn_enabled="1"` (400 if absent).
- **V2-D2 `persist-on-confirm`:** The confirm-phase write changes to persist, per line: the real `product_text` (from the parse row), the **parse-time** `status` and `needs_qty`, and the **winning `tier` + `confidence`** (the candidate the operator kept). These columns already exist on `paste_match_log`; V2 stops writing them null/zero. This is the single source for metrics.
- **V2-D3 `empty-norm-skip`:** A line whose `normNameForMatch(product_text)` yields an **empty token set** (e.g. "MRP 95", "- 5", "!!!") is **not** learned (mirrors R2-C13). Removed lines and `action="removed"` are not learned.
- **V2-D4 `hits-per-order`:** `hits` counts **distinct confirmed orders**, not lines. Dedupe alias upserts within a single Confirm so a repeated phrase in one order increments `hits` by exactly 1. "learned from N" = distinct orders.

### V2-L. Learning write (atomicity)
- **V2-L1 `learning-in-batch`:** Learning is **part of the same `env.DB.batch`** as the order. `alias_norm` is computed in JS from the pre-loaded parse rows, then an alias UPSERT is appended per learned line: `INSERT INTO paste_alias(client_id,alias_norm,sku,hits,last_used_at,created_by) VALUES(?,?,?,1,datetime('now'),?) ON CONFLICT(client_id,alias_norm,sku) DO UPDATE SET hits=hits+1, last_used_at=datetime('now')`. It is atomic + idempotent (the V1 replay short-circuit writes nothing new). **Delete** the body's "best-effort / errors swallowed / ride where possible" — learning is not best-effort; it commits with the order or not at all.
- **V2-L2 `learn-kill-switch`:** `smartpaste_learn_enabled` is read as `getConfig(...)==="1"` (default `"1"`). When `"0"` it disables **both** alias writes **and** the alias read-boost in parse-paste (one clean kill switch). `smartpaste_alias_min_hits` default is **`"2"`**.

### V2-M. Matching pipeline (deterministic, honest)
- **V2-M1 `pipeline-order`:** parse-paste per line runs, in order: (1) parse (V1); (2) **alias lookup** on `norm(product_text)` — the *raw* normalised text, **before** any synonym rewrite, so a learned alias on a nickname still hits; (3) **synonym rewrite** of the normalised token run → candidates via the V1 matcher; (4) V1 Jaccard/exact over the pool; (5) merge all candidates, dedupe by sku keeping the highest, rank, truncate to 3.
- **V2-M2 `tiers`:** add `"learned"` and `"synonym"` to `MatchTier`. `tier_rank`: exact=4, learned=3, synonym=3, history-fuzzy=2, fuzzy=1. Rank by `tier_rank` desc, then confidence desc, then order_count desc, then **`sku` asc** (guaranteed-unique total order → deterministic).
- **V2-M3 `learned-confidence`:** `learned_confidence = min(99, 85 + min(14, round(5·ln(1+hits))))`. A **1-hit** alias (below `alias_min_hits`) is advisory: capped **≤ 70**, shown as a candidate but **never** pre-selected over a higher-confidence history/exact candidate. `selected_sku` = top-ranked candidate once a learned candidate qualifies (hits ≥ min_hits); if only a sub-threshold alias exists, `selected_sku` falls through to the best qualifying non-alias candidate, else is left `null` with `status="unmatched"`. Learned candidates are **additive** to the pool, then the whole list is re-ranked and truncated to 3.
- **V2-M4 `synonym-confidence`:** a candidate reached **via a synonym rewrite** is `tier="synonym"`, confidence = the underlying matcher's confidence **capped ≤ 90**, **never** `tier="exact"`/100 even when the rewritten text equals a catalogue name. A `"via synonym: X → Y"` why-chip is mandatory and never replaced by "exact name match".
- **V2-M5 `exact-still-wins`:** a genuine exact catalogue-name match (no rewrite) stays tier `exact`, confidence 100, ranked first.
- **V2-M6 `alias-conflict-order`:** conflicting aliases (same `alias_norm`, different `sku`, both in the active pool) are ordered `hits` desc, `last_used_at` desc, `sku` asc; top is `selected_sku`.
- **V2-M7 `parse-perf`:** parse-paste p95 ≤ **50 ms CPU** for 100 lines × 2,000-SKU pool **including** alias lookup + up to 50 applicable synonyms, measured over 200 sampled runs (R2-C12 method).

### V2-S. Synonyms (deterministic rewrite + storage)
- **V2-S1 `synonym-cap`:** consider at most **50** applicable active synonyms per line, ordered by `phrase_norm` **token-length desc, then `phrase_norm` asc, then `id` asc**; the 51st by that order is dropped.
- **V2-S2 `synonym-apply`:** "longest" = token count then char length; match **contiguous** token runs; apply **left-to-right longest-match at each position with span consumption** (a rewritten span is never re-rewritten), over the original normalised token run; single pass.
- **V2-S3 `synonym-precedence`:** for a given `phrase_norm`, a client-scoped synonym for the active client **suppresses** any global synonym with the same `phrase_norm`; exactly one replacement fires per token run.
- **V2-S4 `synonym-unique`:** `paste_synonym` gets `UNIQUE(phrase_norm, client_scope)` where `client_scope = COALESCE(client_id,'*')` (stored column); create = UPSERT on that key (no duplicate actives).
- **V2-S5 `synonym-validation`:** `phrase` and `replacement` required, each ≤ 120 chars; **both** rejected (400) if they normalise to an empty token set; a replacement may contribute **≤ 8** tokens. A non-null `client_id` must reference an existing client (404 otherwise).

### V2-A. API contracts & RBAC (enumerated like V1)
- **V2-A1:** New endpoints, each with explicit request/response (to be detailed in api-contracts.md by the architect):
  `POST /api/orders/paste-synonyms` (create/upsert), `GET /api/orders/paste-synonyms` (list), `PATCH /api/orders/paste-synonyms/:id` (edit/toggle), `DELETE /api/orders/paste-synonyms/:id`, and `GET /api/orders/paste-metrics`.
- **V2-A2 `rbac`:** synonym create/update/delete = `{super_admin, ops_admin}` only (else 403). Synonym **list** + **metrics** read = `{super_admin, ops_admin}` (all clients, or filtered by a `client_id` param) and `{client_admin}` (own client only). Every client-side role is confined via `denyClientCrossAccess`; all other roles default-deny. Check order on every endpoint: `401 → 403 role → 404 tenancy` (consistent with R2-C1; cross-tenant is 404, not 403).

### V2-X. Metrics (defined sources)
- **V2-X1 `metrics-sources`:** over confirm-phase rows (now carrying parse-time `status`/`needs_qty`, `product_text`, winning `tier`/`confidence`) within the window: `total` = confirm lines; `% matched` = status≠'unmatched'; `% unmatched` = status='unmatched'; `% needs-qty` = needs_qty=1; `alias-hit rate` = tier='learned' ÷ total. `top unmatched phrases` = `GROUP BY product_text` where parse-time status='unmatched', ordered by count desc (∪ surviving abandoned parse rows).
- **V2-X2 `retention`:** confirm rows retained ≥ the max metrics window; **parse rows retained 30 days and V2 ships the 30-day purge job** (absent today). Metrics window default 30 days, **max 90 days**; window-spanning metrics read confirm rows (retained), never relying on purged parse rows.
- **V2-X3 `metrics-index`:** add an index supporting the `GROUP BY product_text` aggregation, e.g. `(phase, client_id, created_at, product_text)`. "Typical tenant" fixture for the perf assertion = 50k `paste_match_log` rows over 90 days; metrics p95 ≤ 100 ms CPU.

### V2 schema deltas (additive; via `ensureSmartPasteSchema` + a new migration)
- `paste_alias (client_id, alias_norm, sku, hits, last_used_at, created_at, created_by, PRIMARY KEY(client_id, alias_norm, sku))` + `INDEX idx_alias_lookup (client_id, alias_norm)`.
- `paste_synonym (id PK, phrase_norm, replacement, client_id, client_scope GENERATED/stored = COALESCE(client_id,'*'), active, created_at, created_by)` + `UNIQUE(phrase_norm, client_scope)` + `INDEX idx_syn_scope (active, client_id)`.
- `paste_match_log`: no new columns needed — V2 **starts persisting** the existing `product_text`, `status`, `needs_qty`, (new) `tier`, `confidence` on confirm rows. If `tier` is not already a column, add `ALTER TABLE paste_match_log ADD COLUMN tier TEXT` (self-healed).
- new `INDEX idx_pml_phrase (phase, client_id, created_at, product_text)` for the metrics aggregation.
- Config keys: `smartpaste_learn_enabled` (`"1"`), `smartpaste_alias_min_hits` (`"2"`).
