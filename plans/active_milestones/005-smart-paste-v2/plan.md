# Technical Plan: 005-smart-paste-v2 — SLICE 1 (Alias Learning Core)

> Scope: the learning core only. Synonym layer, synonyms admin UI, metrics view, and
> the 30-day parse-row purge are **later slices** (own plans). Authority: `spec.md`
> §"🔧 Revisions from spec-validation r1" (V2-D/L/M + schema deltas). This slice does
> NOT touch synonyms (V2-S), metrics (V2-X), or the admin/metrics endpoints (V2-A).

## 🔍 Analysis & Context
- **Objective:** When an operator confirms a from-paste draft, remember `norm(product_text) → chosen_sku` per client; next time that phrase is pasted for that client, surface the SKU as a reviewed, honestly-labelled `learned` candidate.
- **Affected files:**
  - `migrations/0054_paste_alias.sql` — **NEW**: `paste_alias` table + `idx_alias_lookup`; `ALTER TABLE paste_match_log ADD COLUMN tier TEXT`.
  - `src/index.ts` — extend `ensureSmartPasteSchema` (add the 3 statements); `handleFromPaste` (load parse rows before delete, persist `product_text`/`status`/`needs_qty`/`tier` on confirm rows, append alias UPSERTs to the batch); `handleParsePaste` (load alias hits, feed the matcher, emit `learned` tier); config reads.
  - `src/smart_paste.ts` — add `"learned"` to `MatchTier`; `learnedConfidence(hits)`; `rankLine(productText, pool, aliasHits, opts)` (merges catalogue + learned candidates with the V2-M2 total order). Keep V1 `rankCandidates`/`searchCandidates` unchanged (still used by paste-search).
  - `test/smart_paste.test.ts` — unit tests for `learnedConfidence` + `rankLine`.
  - `test/index.test.ts` — integration tests for learn-on-confirm + parse-boost.
- **Reuse:** `normNameForMatch`, `scoreCandidate`, `confidenceOf`, `smartPastePool`, `ensureSmartPasteSchema` guard, `SMART_PASTE_HISTORY_STATUSES`, `denyClientCrossAccess`, `getConfig`, the from-paste `env.DB.batch`.
- **Key risks:** this modifies the **in-prod** `handleFromPaste` confirm write — the atomic batch + idempotency + existing confirm-log behaviour must stay intact (regression tests). Learning must be inside the batch (V2-L1), deduped per order (V2-D4), gated by the kill switch (V2-L2), and never learn empty-norm/removed lines (V2-D3).

## 📋 Task Execution (Groups)

### Group 1 — schema + pure logic (parallel; different files)
- [x] **1.A Schema:** `migrations/0054_paste_alias.sql` (paste_alias + idx_alias_lookup + `ALTER … ADD COLUMN tier TEXT`), mirrored into `ensureSmartPasteSchema.ddl[]` (3 statements appended; all `IF NOT EXISTS` / swallowed ALTER).
- [x] **1.B Pure logic + unit tests:** in `src/smart_paste.ts`:
  - `MatchTier` += `"learned"` (add `"synonym"` too, reserved for the next slice, but unused here).
  - `learnedConfidence(hits: number): number = min(99, 85 + min(14, round(5·ln(1+hits))))`.
  - `rankLine(productText, pool: Candidate[], aliasHits: Map<sku,hits>, {matchMin,matchMargin,limit=3,minHits=2}): RankedCandidate[]`:
    1. exact + fuzzy candidates from `pool` (same scoring as `rankCandidates`, but do not early-return — build the full scored list).
    2. for each `sku` in `aliasHits` that is present in `pool`: add a `learned` candidate, `confidence = hits>=minHits ? learnedConfidence(hits) : min(70, learnedConfidence(hits))`, `why=["learned from N past orders"]`.
    3. merge by `sku` keeping the highest `tier_rank` then confidence; rank by `tier_rank` (exact=4, learned=3, fuzzy/history=2/1) desc, confidence desc, order_count desc, `sku` asc; truncate to `limit`.
    4. selection rule (returned list only; the handler picks `selected_sku`): a `learned` candidate with `hits<minHits` is never ranked above a higher-confidence exact/history candidate (enforced by confidence cap ≤70).
  - Unit tests: `learnedConfidence` at hits 1/3/10; `rankLine` — learned surfaces with why; exact still wins over a learned alias; a 1-hit alias (≤70) ranks below an `ordered 8×` history fuzzy of higher confidence; a learned sku absent from pool is dropped; deterministic tie order (sku asc).

### Group 2 — backend (sequential; edits `src/index.ts`; depends on G1)
- [x] **2.A from-paste learning + confirm persistence:** in `handleFromPaste`, when `smartpaste_learn_enabled==="1"`: require `parse_session_id` (400 if missing); `SELECT line_no, product_text, status, needs_qty, candidates_json FROM paste_match_log WHERE parse_session_id=? AND phase='parse'` **before** the batch's parse-delete; build a per-line map. Change the confirm-row INSERTs to persist the real `product_text`, parse-time `status`, `needs_qty`, and `tier` (derived: the tier of `chosen_sku` within the parse row's `candidates_json`, else `'manual'` for searched/changed). Append, per learned line (non-removed, `action∈{accepted,changed,searched,merged}`, non-empty `normNameForMatch(product_text)`), an alias UPSERT to the **same batch**, deduped per `(alias_norm,sku)` within the confirm (so hits += 1 per order): `INSERT INTO paste_alias(client_id,alias_norm,sku,hits,last_used_at,created_by) VALUES(?,?,?,1,datetime('now'),?) ON CONFLICT(client_id,alias_norm,sku) DO UPDATE SET hits=hits+1, last_used_at=datetime('now')`. Keep the existing idempotency short-circuit (replay writes nothing new).
- [x] **2.B parse-paste alias boost:** when learning reads are enabled, after parsing, run ONE query `SELECT alias_norm, sku, hits FROM paste_alias WHERE client_id=? AND alias_norm IN (…distinct non-empty line norms…)`; build `norm → Map<sku,hits>`. For each line, call `rankLine(product_text, pool, aliasHitsForThatNorm, {matchMin,matchMargin,minHits})`; set `selected_sku`/`status` per the merged ranking (a qualifying learned or exact candidate selects; sub-threshold-only → unmatched). Candidates carry `tier`/`why`.
- [x] **2.C config + schema wiring:** read `smartpaste_learn_enabled` (`===\"1\"`, default on) and `smartpaste_alias_min_hits` (default 2, clamp ≥1); ensure `ensureSmartPasteSchema` includes the paste_alias DDL + tier alter.
- [x] **2.D integration tests** (`test/index.test.ts`): learn-on-confirm writes `paste_alias(hits=1)`; second confirm → `hits=2`; same phrase twice in ONE order → `hits` +1 only; removed/empty-norm not learned; tenancy (client A's alias not used for B); replay same idempotency_key → no hits change + no 400; parse-paste surfaces a learned candidate with "learned from N" and selects it; a learned sku removed from catalogue is not suggested; `smartpaste_learn_enabled=0` writes no alias and gives no boost; confirm rows now carry non-null `product_text`.

### Group 3 — verification
- [x] **3.A** `npx tsc --noEmit`, `node test/smoke.mjs`, `npx vitest run` green; walk spec scenarios A + B (learning subset); confirm V1 from-paste regression (ordinary confirm still atomic/idempotent, order unchanged).

## 🎯 Success Criteria
- A confirmed phrase→sku is learned (client-scoped), deduped per order, gated by the kill switch, never for empty-norm/removed lines.
- A subsequent paste of that phrase for that client surfaces the sku as a reviewed `learned` candidate with honest confidence (≤70 at 1 hit; rising, capped 99) and a "learned from N" why — never auto-committed, never ranked above a stronger exact/history match when sub-threshold.
- `handleFromPaste` stays atomic + idempotent; confirm rows now persist `product_text`/`status`/`needs_qty`/`tier` (sets up the metrics slice).
- All three test suites green; no V1 regression; no change to paste-search or the #133 latency fix.

## Deferred to later slices (NOT in this plan)
- Synonym layer + synonyms admin endpoints/UI (V2-S, V2-A1 synonyms).
- Match-quality metrics endpoint + UI (V2-X, V2-A1 metrics).
- 30-day parse-row purge job (V2-X2) — until then parse rows persist (unchanged from today); metrics slice will add the purge.
