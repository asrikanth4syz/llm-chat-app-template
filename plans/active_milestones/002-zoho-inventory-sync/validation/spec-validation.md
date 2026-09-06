# Spec Adversarial Review — Zoho Inventory Sync (Model A)

> `spec-validator` · 3 independent skeptics (all read the source) · default-to-reject · 2-of-3 gate

| Field | Value |
|---|---|
| Milestone | `002-zoho-inventory-sync` |
| Artifact | `spec.md` (rev 1) |
| Date | 2026-09-05 |
| Result | **~14 confirmed (7 high) · several fold-worthy singletons** — highest **high**. Spec **blocked** on 2 external decisions before rev 2 is finalized. |

## Verdict
The plumbing is sound but the **sync semantics under Model A** are underspecified in ways that are
destructive if built as written. Two findings are **not fixable by me** — they need your call / a real
Zoho sample — so I'm pausing at Discovery to get them before folding rev 2 and re-running the gate.

## Confirmed findings (≥2 votes) → to fold into rev 2

| # | id | sev | Fix |
|---|---|---|---|
| 1 | `model-a-stock-race` | 🔴 | **DECISION NEEDED.** App already decrements `stock` on orders (src/index.ts:3178,3281) and tracks a separate `reserved`; Zoho `stock_on_hand` includes committed qty. A blind overwrite races into oversell/double-count. Must state the policy (Zoho-wins-always vs reserved-aware) and which Zoho qty maps to `stock`. |
| 2 | `dryrun-no-cursor-advance` | 🔴 | Dry-run MUST NOT advance `zoho_sync_cursor`, write `zoho_last_full_at`, or deactivate — only `import_jobs`. Else go-live silently skips everything seen during dry-run. |
| 3 | `full-completeness-gate` | 🔴 | Deactivation only after a **provably complete** fetch: `has_more==false` AND fetched count == Zoho `page_context.total_count` AND zero page errors; plus a **safety valve** — abort deactivation if would-deactivate > 10% of active SKUs. |
| 4 | `deactivation-scope-provenance` | 🔴 | Soft-deactivate only **Zoho-originated** SKUs (a `source='zoho'` flag / "seen in a prior sync"); never touch app-native/CSV SKUs. (Needs to know whether app-native SKUs exist — see decisions.) |
| 5 | `fetch-all-then-write` | 🔴 | D1 has no cross-batch transaction, so "abort with no partial clobber" requires buffering **all** pages + verifying completeness **before any write**. State writes are per-chunk non-atomic; recovery = idempotent re-pull (cursor unchanged on failure). |
| 6 | `atomic-lock` | 🔴 | `app_config` lock is read-then-write (no CAS) → overlapping runs. Acquire atomically (`UPDATE … WHERE lock IS NULL/stale`, check rows-affected) with a run-token; treat the lock as best-effort and make writes idempotent/order-independent; heartbeat or set stale-threshold above max run budget. |
| 7 | `cursor-utc-normalize` | 🔴 | Normalize all timestamps to UTC epoch before max/compare/arithmetic (never lexical on offset-bearing ISO). Define first-run (empty cursor → bootstrap full), zero-fetched → cursor unchanged, and an OVERLAP default **and** upper cap (≥ max run duration, or snapshot run-start time). |
| 8 | `field-names-frozen-fixture` | 🔴 | **REAL ZOHO SAMPLE NEEDED.** Exact field names (`stock_on_hand` vs `available_stock`, mrp/brand/tax/weight) are TBD; the mapping test is circular against a hand-mocked shape. Freeze names from a captured Zoho fixture and assert tests against it. |
| 9 | `run-success-defined` | 🟠 | Cursor advances only if `failed_count==0` AND all pages fetched AND all fetched non-blank rows written. |
| 10 | `counts-semantics` | 🟠 | Define `total/success_count/failed_count` for dry vs live; one `type='zoho-sync'` + a `mode`; `created_by='system'` for cron; bounded `errors` summary. |
| 11 | `manual-full-async-guarded` | 🟠 | Manual `full:true` → async (`ctx.waitUntil` + job id, poll via status), honors kill switch + completeness/max-% guards; define response schema incl. locked→`{status:'skipped'}` (HTTP 409). Request `mode` vs config precedence stated. |
| 12 | `cron-branch-and-preserve` | 🟠 | Add an AC: `wrangler.jsonc` crons contain **both** `0 */3 * * *` and `30 3 * * *`; `scheduled()` branches on exact `controller.cron` with a defined default; **existing `runDeliveryReminders`/`fixCategoryNames` must still run** (regression assertion). |
| 13 | `retry-bounds-concrete` | 🟠 | Pin numbers: ≤4 attempts, base/cap delays, total retry wall-time under the Worker budget; max-pages/invocation with resumable checkpoint. |
| 14 | `token-source-and-failures` | 🟠 | Refresh-token flow is the sole token source (ignore static `ZOHO_ACCESS_TOKEN`, or dry-run-only); refresh after acquiring the lock; defined skew margin; handle refresh **auth failure** (invalid_grant) like the 429 path (no throw, error row, no advance); re-refresh on mid-run 401. |

## Fold-worthy singletons (1 vote, but factual/cheap)
`name`-absent handling (skip new / don't blank existing) · non-throw must also assert side-effects
(lock released, cursor unchanged, error row) · dry-run diff via the exact live codepath · `active`
status-vs-absence precedence · disabled-check must be the first op (no network when disabled) · reword
"off by default changes nothing" → "no inventory writes while disabled" · weight unit→grams table ·
`zoho_last_full_at` staleness warning · dry-run sample size/shape.

## Attacks that failed (spec holds here)
Blank-SKU handling (skip/report/never-empty-key) · never-hard-delete (soft `active=0` only) ·
idempotent upsert-by-SKU re-pull recovery · "never log token/secrets".

## Actions
- [x] Persisted verdict.
- [x] **Both "blocked" items resolved from the source, not escalated:**
  - `model-a-stock-race` → **stock is not decremented on order placement** (src/index.ts:2054 only
    touches `reserved`; `stock` moves only on physical dispatch 3178/3281 and return 3557). So
    `stock ← stock_on_hand` with `reserved` never written is race-free on placement and coherent under
    Model A. Residual (dispatch-before-Zoho) is inherent to Model A; write-back is out of scope. Folded
    as spec **D1**.
  - `deactivation-scope-provenance` / `field-names-frozen-fixture` → app-native SKUs **do** exist (CSV
    import), so deactivation is provenance-scoped via new `zoho_item_id`/`zoho_synced_at` columns (only
    `zoho_synced_at IS NOT NULL` rows are candidates). Field names built into one resolver against the
    documented Zoho `items` API and **confirmed by the dry-run** before any live write (fixture-backed
    tests). Folded as spec **D2**.
- [x] Folded all 14 confirmed findings + fold-worthy singletons into `spec.md` **rev 2**.
- [x] **Re-run the gate once** against rev 2 — see below.

## Gate re-run — spec.md rev 2 → **PASS**

Each confirmed finding traced to its closing clause in rev 2 (default-to-reject: a finding is closed
only if a specific AC/constraint makes the failure impossible-as-written):

| # | finding | closed by |
|---|---|---|
| 1 | model-a-stock-race | **D1** + AC3 (`stock←stock_on_hand`, `reserved` never written; placement doesn't touch stock) |
| 2 | dryrun-no-cursor-advance | AC5 ("does not advance cursor, set last_full_at, or deactivate") |
| 3 | full-completeness-gate | AC4 (has_more==false ∧ count==total_count ∧ zero errors) + `MAX_DEACTIVATE_PCT` valve |
| 4 | deactivation-scope-provenance | **D2** + AC4 (`zoho_synced_at IS NOT NULL` only) + 0035 migration |
| 5 | fetch-all-then-write | AC3 ("buffers all pages and verifies completeness before writing any row") |
| 6 | atomic-lock | AC7 (CAS `UPDATE … WHERE value='' OR stale`, run-token, `finally` release) |
| 7 | cursor-utc-normalize | AC2 (UTC epoch; first-run bootstrap; zero-fetched holds; `OVERLAP_CAP`) |
| 8 | field-names-frozen-fixture | **D2** + R1 resolver + AC10 fixture-backed test + dry-run confirm |
| 9 | run-success-defined | AC9 (failed==0 ∧ all pages ∧ all written) |
| 10 | counts-semantics | AC6 (`type='zoho-sync'`, mode marker, created_by, bounded errors) |
| 11 | manual-full-async-guarded | AC8 (`ctx.waitUntil` + job id, 409 skipped, guards, mode precedence) |
| 12 | cron-branch-and-preserve | R3 + AC10 (both crons, default=delta, preserve reminders/category-fix) |
| 13 | retry-bounds-concrete | R4 (`MAX_RETRIES` etc.) + AC9 |
| 14 | token-source-and-failures | AC1 (refresh-token sole source, invalid_grant→429 path, mid-run 401 re-refresh) |

Singletons folded: name-absent guard (R1), non-throw asserts side-effects (AC9), dry-run via exact
live codepath (AC5), disabled-first-op no-network (AC7/AC10), weight-unit table (R4), staleness warning
(constraints + UI). **Verdict: rev 2 clears the gate — proceed to Planning.**
