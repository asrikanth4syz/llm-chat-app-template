# Spec Adversarial Review — Smart Paste Order V2 (Alias Learning & Smarter Matching)

> `spec-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `005-smart-paste-v2` |
| Artifact | `plans/active_milestones/005-smart-paste-v2/spec.md` |
| Date | 2026-10-10 |
| Gate | 2-of-3 |
| Result | **14 confirmed · 10 adopted single-votes** — highest severity **🔴 high** |

## Verdict
**Not ready to plan as written.** The spec assumes a data model the shipped V1 **code** does not provide: `handleFromPaste` writes confirm-phase `paste_match_log` rows with `product_text=null`, `raw_text=""`, `needs_qty=0`, `status∈{ordered,removed}`, `confidence=null`, no tier — and **deletes** the parse rows that *do* carry `product_text`/status. The from-paste request body carries no `product_text`, and no 30-day purge job exists. Therefore the alias-learning key **and all five metrics** depend on data that is never persisted. The fix is foundational and in-scope: V2 must (a) derive the alias key from the server-side parse rows **inside the atomic batch** before they are deleted, and (b) persist `product_text`, parse-time `status`/`needs_qty`, winning `tier`/`confidence` on the confirm row. With those plus the formula/ordering/RBAC tightenings below folded in, the spec is buildable.

## Confirmed Findings (≥ 2 votes)
> Folded into spec.md §"🔧 Revisions from spec-validation r1" (authoritative).

### 🔴 `product-text-source-missing` — learning key has no valid source · 3/3
- **Clause:** "`alias_norm TEXT NOT NULL -- normNameForMatch(product_text)`" / "a `paste_alias(C, "good day biscuit", "BISC-GD")` row exists"
- **Malicious reading:** read `product_text` from the request (undefined) or confirm row (null) → `normNameForMatch("")=""` → write `paste_alias(C,"",sku)`; the empty key never matches (R2-C13), so every "no alias written" scenario passes while learning does nothing.
- **Harm:** the entire learning layer silently no-ops (or poisons an empty key), yet passes its negative scenarios.
- **Tightening:** on Confirm, **SELECT the parse-phase rows by `(parse_session_id, line_no)` and derive `alias_norm = normNameForMatch(parse_row.product_text)` before the batch deletes them**; require `parse_session_id` when `learn_enabled=1`; derive the key **only** from server-parsed text (never caller free text → closes alias-poisoning); skip any line whose norm yields an empty token set.

### 🔴 `learning-vs-atomic-batch` — "ride the batch" ⊻ "never fail order creation" · 3/3
- **Clause:** "Learning writes ride the existing from-paste batch where possible, or run immediately after the order commit; they must **never** block or fail order creation (best-effort, errors swallowed and logged)."
- **Malicious reading:** put the alias UPSERT in the atomic batch → a constraint error rolls back a legitimate order; OR move it post-commit → loses idempotency coupling, and a first-call swallow + replay short-circuit drops the alias forever.
- **Harm:** either order creation becomes fragile, or learning is silently unreliable under error/retry.
- **Tightening:** learning is **part of the same `env.DB.batch`** — `alias_norm` is computed in JS from the pre-loaded parse rows, then alias UPSERT statements are appended to the batch (atomic + idempotent, tied to the single order commit; replay short-circuit naturally writes nothing new). Delete "best-effort / errors swallowed / ride where possible". Use `INSERT … ON CONFLICT(client_id,alias_norm,sku) DO UPDATE SET hits=hits+excluded.hits, last_used_at=…`.

### 🔴 `metrics-source-structurally-empty` — confirm rows lack the fields every metric needs · 3/3
- **Clause:** "it shows: total pasted lines, % matched, % unmatched, % needs-qty, alias-hit rate" / "the top unmatched `product_text` phrases"
- **Malicious reading:** read confirm rows (per V1 R2-C10): `status∈{ordered,removed}` (never "unmatched"), `needs_qty=0` always, `product_text=null`, no tier → report 100% matched / 0% needs-qty / empty backlog; passes any un-pinned test.
- **Harm:** all five KPIs are uncomputable or constant; the metrics view is cosmetic.
- **Tightening:** persist on each **confirm** row: the **parse-time** `status` and `needs_qty`, the `product_text`, and the **winning tier + confidence**. Define each metric's exact source/numerator/denominator over named columns. `top-unmatched` = `GROUP BY product_text` over confirm rows where parse-time status was `unmatched` (∪ surviving abandoned parse rows). `alias-hit rate` = confirm lines whose winning tier ∈ {learned} ÷ total confirm lines.

### 🔴 `learned-synonym-confidence-formula-unspecified` — new-tier confidence is hand-wavy · 3/3
- **Clause:** "confidence in `[85,99]` rising with hits"
- **Malicious reading:** return a flat `85` for every alias (monotonic-non-decreasing trivially holds); `confidenceOf` has no learned branch; `MatchTier` has no `learned`/`synonym`.
- **Harm:** confidence is arbitrary/unreproducible; the honest-confidence invariant can't be tested.
- **Tightening:** closed form `learned_confidence = min(99, 85 + min(14, round(5·ln(1+hits))))`; **synonym-assisted** confidence = the underlying matcher's confidence, never elevated (see next). Add `"learned"` and `"synonym"` to `MatchTier` and a `confidenceOf` branch that leaves `exact`/`fuzzy` outputs unchanged. Fixtures assert exact integers at hits = 1, 3, 10.

### 🔴 `synonym-assisted-dishonest-exact-100` — nickname bridge shown as a certain exact match · 3/3
- **Clause:** "matching is performed on the rewritten text `"coca cola 330ml"`" + "Confidence stays **honest** … nothing is presented as a certain match that isn't."
- **Malicious reading:** after rewrite, `norm("coca cola 330ml") == norm("Coca-Cola 330ml")` → `rankCandidates` marks it `tier="exact"`, confidence 100, why "exact name match" — a machine-inferred nickname dressed as certain.
- **Harm:** violates the honest-confidence guardrail (exactly what V1 refused for "Goodday 100").
- **Tightening:** a candidate reached via a synonym rewrite is **tier `"synonym"`, never `"exact"`/100**; confidence capped (≤ 90); a `"via synonym: X → Y"` why-chip is **mandatory** and never replaced by "exact name match".

### 🔴 `synonym-cap-nondeterministic` — "(say) 25" is non-binding + undefined selection · 3/3
- **Clause:** "capped at (say) 25 active synonyms considered per line"
- **Malicious reading:** cap at 1, or take an arbitrary DB-order 25; a curated synonym silently never applies once the active set grows.
- **Harm:** non-reproducible "sometimes matches"; synonyms ops added stop firing with no error.
- **Tightening:** fixed normative cap **= 50 active synonyms per line**, selected deterministically: order active applicable synonyms by **token-length of `phrase_norm` desc, then `phrase_norm` asc, then `id` asc**; apply the first N under that total order. Test: the (cap+1)-th by that order is the one dropped.

### 🔴 `synonym-no-unique-constraint` — duplicates race; NULL client_id defeats UNIQUE · 3/3
- **Clause:** "duplicate (phrase_norm, client_id) updates in place rather than duplicating."
- **Malicious reading:** only `id` is PK; read-then-write races insert two rows; SQLite treats `NULL` client_id as distinct so two globals coexist.
- **Harm:** duplicate active synonyms apply simultaneously (re-triggering non-determinism); `active=0` on one leaves the other live, so ops can't reliably disable a synonym.
- **Tightening:** add `UNIQUE(phrase_norm, client_scope)` where `client_scope = COALESCE(client_id,'*')` (a stored/generated column); create = UPSERT on that key.

### 🔴 `synonym-global-client-precedence` — global vs client-scoped winner undefined · 3/3
- **Clause:** "a client-scoped synonym for `C` is applied only when the client is `C`; a global synonym applies to every client."
- **Malicious reading:** both a global and a client-`C` synonym share `phrase_norm`; apply both (double rewrite) or pick by rowid.
- **Harm:** a client override can't reliably beat the global default; order-dependent rewriting.
- **Tightening:** for a given `phrase_norm`, a matching **client-scoped synonym for the active client suppresses** any global synonym with the same `phrase_norm`; exactly one replacement fires per token run.

### 🔴 `alias-min-hits-selection-semantics` — 1 mistake becomes a high-confidence default; sub-threshold state undefined · 3/3
- **Clause:** "`smartpaste_alias_min_hits` (default `"1"` …) ; confidence in `[85,99]` ; rank: `exact` > `learned`/`synonym` > history fuzzy > fuzzy"
- **Malicious reading:** a single (possibly mis-clicked) confirmation pre-selects that SKU at ≥85, ranked above a genuine `ordered 8×` history match (96); and for a sub-threshold alias the spec never says what `selected_sku`/`status` become.
- **Harm:** one-off errors propagate as high-confidence pre-selections; undefined resolved-line state.
- **Tightening:** default `alias_min_hits = 2`; a **1-hit** alias is advisory — shown as a candidate but **capped ≤ 70** and never pre-selected over a higher-confidence history/exact candidate (precedence by confidence, not a fixed band). For a sub-threshold alias: `selected_sku` falls through to the best qualifying candidate, else is left unselected (`status` per the normal matched/unmatched rule). State whether learned candidates are additive to or counted within `limit:3` (**additive, then whole list re-ranked and truncated to 3**).

### 🟠 `alias-hit-rate-undefined` — KPI has no numerator/denominator or stored signal · 2/3
- **Tightening:** define `alias-hit rate = (confirm lines whose winning tier = "learned") ÷ (total confirm lines)`; computable once the winning tier is persisted on the confirm row (see `metrics-source-structurally-empty`).

### 🟠 `metrics-retention-vs-window` — 90-day window over 30-day (actually unpurged) data · 2/3
- **Tightening:** state retention per phase explicitly: confirm rows retained ≥ the max metrics window; **parse rows retained 30 days** and V2 **ships the 30-day purge job** (it does not exist today, so abandoned parse rows grow unbounded). Cap the selectable metrics window to **max 90 days** and source window-spanning metrics from confirm rows (retained), not parse rows.

### 🟠 `synonym-application-determinism` — "longest first"/overlap/single-pass ambiguous · 2/3
- **Tightening:** "longest" = by **token count, then char length**; match **contiguous** token runs only, **left-to-right longest-match at each position with span consumption** (a rewritten span is never re-rewritten), over the **original** normalised token run.

### 🟠 `alias-conflict-tiebreak` — same-second ties non-deterministic; two conflicting rules · 2/3
- **Tightening:** learned candidates order by **`hits` desc, then `last_used_at` desc, then `sku` asc** (final total order); state this overrides the generic within-tier rule for the learned tier.

### 🟠 `metrics-synonym-rbac-and-api-contracts` — endpoints/roles undefined · 3/3
- **Tightening:** specify method + path + request + response for **synonym create / list / update / delete** and **metrics** (mirroring V1's parse-paste contract). Enumerate exact roles per verb: synonym CRUD = `{super_admin, ops_admin}` (else 403); synonym list + metrics read = `{super_admin, ops_admin}` all-clients, `{client_admin}` own-client-only; every client-side role confined via `denyClientCrossAccess`; all other roles default-deny (403). Check order `401 → 403 role → 404 tenancy` (consistent with R2-C1; resolves the vendor-403-vs-404 note).

## Adopted single-votes (1 vote — folded anyway; cheap + clearly correct)
| `id` | sev | fix folded |
|---|---|---|
| `alias-empty-norm-learned` | 🟠 | don't learn a line whose `normNameForMatch` yields an empty token set (merged into `product-text-source-missing`). |
| `within-order-duplicate-hits-overcount` | 🟠 | dedupe alias UPSERTs within one confirm so `hits` counts **distinct orders**, not lines. |
| `learn-enabled-config-truthiness` | 🟡 | `enabled = (getConfig(...) === "1")` — `"0"` is a truthy string; test it disables. |
| `learn-disabled-read-ambiguity` | 🟠 | `learn_enabled=0` disables **both** alias writes **and** the alias read-boost (one clean kill switch). |
| `learning-depends-optional-parse-session-id` | 🟠 | require `parse_session_id` on from-paste when `learn_enabled=1` (400 if absent). |
| `new-tier-ranking-total-order` | 🔴 | define numeric `tier_rank` (exact=4, learned=3, synonym=3, history-fuzzy=2, fuzzy=1); intra-bucket by confidence, order_count, then **`sku` asc** (unique). |
| `v2-parse-perf-budget` | 🟡 | restate: parse p95 ≤ **50 ms CPU** for 100 lines × 2,000-SKU pool **including** alias lookup + ≤50 synonyms, 200 sampled runs. |
| `metrics-perf-index` | 🟠 | add an index covering the `GROUP BY product_text` aggregation, e.g. `(phase, client_id, created_at, product_text)`; define "typical tenant" fixture = 50k rows / 90 days. |
| `synonym-replacement-empty/oversized` | 🟡 | reject (400) a `replacement` normalising to an empty token set; cap its contributed token count (≤ 8). |
| `synonym-admin-client_id-validation` | 🟡 | a non-null `client_id` on create/update must reference an existing client (404 otherwise). |

## Attacks That Failed (corroborate the spec holds here)
- **Alias tenancy isolation** — PK + lookup index are `(client_id, alias_norm[, sku])`, every scenario restates client scoping, `denyClientCrossAccess` enforces 404; no cross-tenant alias read under a straightforward impl.
- **Dead aliased SKU** — explicitly intersected with the client's current active catalogue at parse time (matches `smartPastePool` `active=1`); can't surface a stale SKU.
- **Exact catalogue match beats alias** — pinned confidence 100 / tier exact, and `rankCandidates` returns `exactTop` before any lower tier (only the *synonym→exact* case was a hole, filed above).
- **No-auto-commit regression** — the alias scenario restates "still returned for review, never auto-committed"; from-paste still creates a DRAFT needing the normal submit.
- **Replay double-learn** — the idempotency short-circuit returns before any write, so a sequential replay can't double-increment `hits` (the residual under-learn risk is fixed by putting learning in the atomic batch).

## Actions Taken
- [x] Wrote this review.
- [x] Fold all confirmed + adopted findings into spec.md §"🔧 Revisions from spec-validation r1" (authoritative).
- [ ] Re-run panel on revision → `spec-validation-r2.md` — _optional; fixes are concrete, additive, and non-conflicting. Deferred unless the architect surfaces a contradiction._
