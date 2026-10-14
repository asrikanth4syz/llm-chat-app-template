# Spec Adversarial Review r2 — GIFTSYZ Quotations in Smart Pantry (006-quotations)

> `spec-validator` · 3 fresh independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `006-quotations` |
| Artifact | `{context,calc-spec,data-model,api-contracts,plan}.md` (5-file corpus, r2) |
| Date | 2026-10-14 |
| Gate | 2-of-3 majority |
| Result | **20 confirmed · 7 unconfirmed** — highest severity **high** |
| Change vs r1 | 31 → 20 confirmed. **All 11 r1 highs + the big structural risks are confirmed CLOSED.** |

## Verdict

**Conditional GO.** The r1 fold worked: all three skeptics independently confirm tenancy isolation,
concurrency fork-prevention (UNIQUE), chain verifier + canonicalization, deep redaction path coverage,
IST day-boundaries, lifecycle guards, Finance-leg basis, SoD-vs-version-author, idempotency presence, and
per-tenant config are now **properly closed**. The 20 remaining findings are **not architectural** — they
are (a) a handful of concrete arithmetic/typo bugs introduced into the new `calc-spec.md` oracle, and
(b) under-specified corners of otherwise-correct mechanisms. Every one has an unambiguous tightening.
**One item gates the build: the 18 calc vectors must be hand-computed and inlined (not engine-generated)
before the calc engine is written**, because test-first against self-generated fixtures is worthless. Fix
the four highs + inline the vectors in a short r3 touch-up and this is a clean GO.

## Confirmed Findings (≥ 2 votes)

### 🔴 High (4)

#### `ceilhalf-formula-typo` — the odd-paisa CGST split is a no-op bitshift · 3/3
- **Clause:** "`ceilHalf(x) := (x + 1) >> 0` when x odd else x/2 — i.e. `Math.ceil(x/2)`"
- **Bug:** `(x+1) >> 0` is a ToInt32 no-op = `x+1`, not `(x+1)/2`. For odd `line_gst=541` → `cgst=542`,
  `sgst=541−542=−1`. The symbol and the "Math.ceil(x/2)" gloss contradict; `>>` would also overflow 32-bit
  for ₹-crore lines.
- **Tightening:** `cgst := Math.ceil(line_gst/2)` as plain integer arithmetic (no bitshift); assert
  `0 ≤ cgst ≤ line_gst` and `cgst+sgst==line_gst`; pin V8 with hand values (e.g. `line_gst=541 → 271/270`).

#### `finance-boundary-vector-unit-mismatch` — V17/V18 test ₹5,000 not ₹5,00,000 · 3/3
- **Clause:** "`V17` boundary grand_total = 500000 … `V18` 499999 / 500001"
- **Bug:** engine money is paise and the threshold is `50000000` paise; `500000` paise = ₹5,000 (100× off).
  Worse, `grand_total_paise` is always a multiple of 100 (round-to-rupee), so `499999`/`500001` are
  unreachable, and the calc totals object carries no finance-leg flag to assert against.
- **Tightening:** express boundaries in paise at the real threshold (`49999900 / 50000000 / 50000100`);
  assert the Finance decision in a **lifecycle/submit** test, not the calc test; state expected
  `finance_required` per vector.

#### `calc-vectors-not-inlined` — 17 of 18 vectors have no pinned numbers (self-certifying) · 3/3
- **Clause:** "The concrete expected numbers are derived by applying §1–§5 (this doc is the oracle) … CI
  fails if `< 18` vectors are present."
- **Bug:** only V1 has inlined expected paise; V2–V18 are described, not pinned. The implementer writes the
  engine *and* generates the fixtures from it → "byte-exact match" is tautological, and the `ceilHalf`/
  `mrp` bugs below would pass green. "CI fails if <18" counts rows, not correctness.
- **Tightening (the build gate):** inline the full expected object for **every V1..V18** as literal paise,
  hand-computed/cross-checked (against the PRD where applicable), committed as a frozen oracle; forbid
  generating fixtures from the engine.

#### `genesis-salt-not-persisted` — audit preimage needs a salt no table stores · 2/3
- **Clause:** "`entry_hash | sha256Hex(canonical([…, prev_hash, genesis_salt]))`"
- **Bug:** no column holds `genesis_salt` and no derivation is given, so `verifyQuoteChain` cannot recompute
  the hash — the central tamper-evidence claim is unimplementable (or the salt silently becomes a constant,
  which is security theatre; replay is already blocked by `account_id`+`quote_id` in the preimage).
- **Tightening:** add a stored per-quote (and per-account) salt written at genesis and read by the verifier,
  **or** drop the salt and rely on the `account_id`+`quote_id`+`seq` framing; pin one `preimage → hex digest`
  sample vector.

### 🟠 Medium (14)

- **`mrp-discount-cost-equals-sell` (3)** — for `mrp_discount`, `base_cost` and `unit_price` are the *same
  expression*, so margin = `−(freight+branding+nonITC-GST) ≤ 0` for every such line (V1's L2 shows −540).
  → give `mrp_discount` a separate `purchase_cost_paise` basis; discounted MRP is the sell price only.
- **`header-version-desync` (3)** — the version-append CAS updates only `current_version`+`grand_total_paise`;
  `place_of_supply`/`itc_claimable_all` stay at v1 while the current version changes → submit routes the
  Finance leg off a stale flag. → update them in the same CAS UPDATE, or read them only from the current version.
- **`cas-zero-row-not-abort` (3)** — a 0-row `UPDATE … WHERE current_version=:expected` does **not** error or
  abort a D1 batch; only `UNIQUE(quote_id,version)` prevents the fork. → correct the claim; have the handler
  inspect `meta.changes` and treat 0 as retry; name UNIQUE as the authoritative serializer.
- **`fy-counter-seeding` (3)** — first quote of a new `(account_id, fy)` has no counter row, so
  `UPDATE … RETURNING` yields nothing. → atomic `INSERT … ON CONFLICT(account_id,fy) DO UPDATE SET
  last_no=last_no+1 RETURNING last_no` with a defined seed.
- **`reminder-snooze-state-machine` (3)** — the firing predicate checks `due_date` not `snooze_until`, so a
  snoozed reminder re-fires on the next pass; "at most one SENT per rule" contradicts snooze→re-fire; "cycle"
  undefined. → add `AND (status!='SNOOZED' OR snooze_until ≤ today(IST))`; define the dedup unit (e.g. one
  SENT per rule per IST day); give a multi-day frozen-clock test.
- **`r8-vs-expiry-ordering` (3)** — `R8=valid_until+1d` falls on the day the cron also expires the quote and
  cancels PENDING/SNOOZED reminders; with no intra-pass order, R8 is dead by construction. → fire due
  reminders (incl. R8) **before** the SENT→EXPIRED sweep, or move R8's anchor; test it.
- **`capability-matrix-missing-actions` (2)** — the matrix has no column for reject / snooze / calc / list /
  detail / versions / audit / document, so "anything not ticked → 403" makes the read surface and reject
  unreachable (or implementers guess). → add those columns/rows with explicit per-role ticks, default-deny.
- **`redaction-is-really-denylist` (3)** — every doc says "allowlist" but the only concrete spec (plan 2.C +
  success list) is a denylist that omits `base_cost_paise`, `input_gst_paise`, `freight_alloc`,
  `branding_cost`, `mrp`, `discount_pct`, `weighted_margin`; "other roles untouched" also re-breaks
  fail-closed. → write the true positive allowlist per role; unknown role → full redaction; test that ops
  receives none of the nested cost fields.
- **`idempotency-inflight-race` (2)** — the row is written at completion, so two concurrent same-key requests
  both miss and both execute (double create/approve); TTL expiry re-mints a new `quote_no`. → reserve the key
  (INSERT PK, `IN_PROGRESS`) in the **same batch** as the mutation; define expired-key semantics.
- **`sod-author-set-inconsistent` (2)** — data-model says exclude "all version authors"; api-contracts says
  "current version" only → the narrow reading lets a prior-version pricer approve. → state one set identically
  (recommend creator ∪ all `quote_versions.created_by` for the quote).
- **`sod-sole-approver-deadlock` (3)** — submit eligibility excludes only the *creator*, but act-time SoD also
  excludes version authors, so a lone approver who edited a version still 403s forever; the `super_admin`
  fallback has no `quoteRole` so it's 404'd at the guard and has no config key; revoke-after-submit re-opens
  the deadlock. → make submit eligibility use the full SoD set; define the fallback concretely (settings key +
  synthetic approver capability + SoD treatment); add a post-submit escalation path.
- **`unbounded-markup-qty-overflow` (2)** — `markup_pct` and `qty` have no upper bound, so computed
  `unit_price·qty` can exceed 2^53 and silently lose precision (finite, so the "never NaN" guard misses it).
  → bound `markup_pct`/`qty` and validate **computed** money ≤ 10^12 paise (or use BigInt) → 422.
- **`round-primitive-and-rate-representation` (2)** — §3–§5 call a one-arg `round(x·rate/100)` never bound to
  the §0 `roundHalfAwayFromZero` primitive, and §0's "basis-point integers" conflict with the `REAL`
  `markup_pct`/`discount_pct`/`gst_rate` columns that feed the hash. → route every rounding site through the
  integer primitive; store rates as basis-point INTEGERs; no `REAL` feeding a computation or hash.
- **`valid-until-default-timing` (2)** — `valid_until` is `NOT NULL` set at create, but its default is
  `send_date + N` and `send_date` doesn't exist until `/send`. → default from `created_date` at insert, or
  make it nullable until send with an explicit `sent_at` column; state the reminder anchor consistently.

### 🟡 Low (2)
- **`expiring-window-days-missing-from-settings` (3)** — api-contracts reads `settings.expiring_window_days`
  but the `quote.settings` schema omits it. → add it (default 3).
- **`settings-config-no-ver` (2)** — `quote.enabled_users` got `_ver` optimistic concurrency but
  `quote.settings` didn't → concurrent admin edits lose updates. → add `_ver` to `quote.settings`.

## Unconfirmed (FYI · 1 vote)
| `id` | sev | note |
|---|---|---|
| `freight-branding-per-unit-vs-per-line` | 🟠 | Is `freight_alloc`/`branding` per-unit or per-line? §8's qty=1 can't disambiguate. Worth stating + a qty>1 vector. |
| `gst-slab-set-too-narrow` | 🟠 | `{0,5,12,18,28}` rejects legit 3% (gold) / 0.25% / cess catalogue items. Widen, or exempt catalogue-resolved rates from the whitelist. |
| `idempotency-route-scope-ambiguous` | 🟠 | Is `route` the template or the resolved path (incl. `:id`)? Pin it (resolved path). |
| `max-magnitude-unit-error` | 🟡 | "10^12 paise (₹10 crore)" — 10^12 paise is ₹1000 crore. Fix the annotation. |
| `catalogue-gst-authority-ignored-or-422` | 🟡 | "ignored **or** 422 on mismatch" — pick one. |
| `access-endpoint-body-undefined` | 🟡 | `/access` is exempt + 200 but its body shape isn't specified; define `{enabled, quoteRole}`. |
| `reminder-anchors-collide-short-validity` | 🟡 | If `default_validity_days < 7`, R5–R7 compute to ≤ send date (bunch-fire). Clamp/skip or enforce a floor. |

## Attacks That Failed (r1 findings confirmed CLOSED by the panel)
tenancy-isolation · concurrent-version-append fork (UNIQUE blocks it) · quote-counter duplicate (steady
state) · access-endpoint-self-contradiction · no-chain-verifier · hash delimiter-injection / cross-quote
replay · approval-completion-race · reject-resubmit-stale-approvals · sod-version-author (basic) ·
finance-threshold-basis · today-bell-timezone (IST) · expired-transition · accept-lost-state-guards ·
valid-until-source · money-as-float (money columns) · doc-hash-self-reference · itc-per-quote-mixed-basket ·
accept-lost-leaves-snoozed · malformed-config-fail-closed · nav-stale-after-revoke · admin-self-grant ·
redaction-paths-incomplete (coverage) · weighted-margin-undefined · gst-rate-authority ·
quote-role-enum-unvalidated · unbounded-lines · two-quote-roles(phantom). The §8 V1/V1b worked example was
independently recomputed by two skeptics and is internally correct (weighted_margin 5.82).

## Actions Taken
- [x] Wrote this r2 review (20 confirmed, 7 unconfirmed).
- [x] **Integer-paise hardening pass** (folded into `calc-spec.md`/`data-model.md`/`plan.md`/`context.md`):
  - `ceilhalf-formula-typo` (🔴) → `ceilHalf(x) := (x + (x & 1)) / 2`, pure integer, no bitshift; `541→271/270`.
  - `finance-boundary-vector-unit-mismatch` (🔴) → V17/V18 restated in paise (`50000000`, `49999900/50000100`);
    Finance decision asserted in the submit/lifecycle test (calc totals carry no finance flag).
  - `round-primitive-and-rate-representation` + `rates-stored-as-real-drift` (🟠) → **no `REAL` anywhere**;
    rates are integer basis points (`markup_bp`/`discount_bp`/`sale_gst_bp`/`purchase_gst_bp`); every rounding
    site routed through `roundHalfAwayFromZero(int,int)`/`applyBp`; §0 I0 invariant + `tsc` `Paise`/`Bp`
    brands + I0 grep test.
  - `mrp-discount-cost-equals-sell` (🟠) → `mrp_discount` carries its own `purchase_cost_paise` basis; §8
    recomputed (L2 margin now +580, V1 both-positive; V16 covers negative).
  - `unbounded-markup-qty-overflow` (🟠) + `max-magnitude-unit-error` (unconf) → bounded `markup_bp`/`qty`,
    computed-value safe-integer + ≤10^12-paise assertion → 422; magnitude annotation corrected.
  - `weighted-margin` now integer `weighted_margin_bp` (no float percent).
  - `freight-branding-per-unit` (unconf) → stated **per unit** + a `qty>1` vector (V11).
  - `catalogue-gst-authority-ignored-or-422` (unconf) → chose "client rate ignored, server authoritative".
  - redaction field list in `plan.md` updated to the `_bp`/`_paise` names + allowlist/deep/8-path shape.
- [x] **Grill + fold pass (all remaining confirmed + most unconfirmed closed):**
  - `calc-vectors-not-inlined` (🔴) → all 18 vectors hand-computed and frozen in `calc-vectors.md`;
    `calc-spec §9` points at it; fixtures must reproduce it (not engine-generated).
  - `genesis-salt-not-persisted` (🔴) → `genesis_salt` column on `quotes` (+ per-account for the entitlement
    chain), minted at creation, read by the verifier.
  - `header-version-desync` → header `place_of_supply`/`itc_claimable_all`/`grand_total_paise` are caches
    refreshed in the version-append CAS UPDATE; current version is authoritative for pricing/approval.
  - `cas-zero-row-not-abort` → wording corrected: `UNIQUE(quote_id,version)` serializes; handler checks
    `meta.changes`; a 0-row UPDATE does not abort.
  - `fy-counter-seeding` → single atomic UPSERT (`ON CONFLICT … DO UPDATE … RETURNING`).
  - `reminder-snooze-state-machine` + R8/expiry → **3-step cadence** (send+2d/+7d, valid−2d), no post-expiry
    nudge (collision gone); snooze only from PENDING via `snooze_until`; cron fires reminders then expires.
  - `capability-matrix-missing-actions` → full matrix (view/calc/reject/snooze/audit-read/… columns) for the
    **4 roles** (auditor dropped per product decision).
  - `idempotency-inflight-race` → in-batch `IN_PROGRESS` key reservation; resolved-route scope.
  - `sod-author-set-inconsistent` + `sod-sole-approver-deadlock` → author set = creator ∪ all version
    authors (stated identically both docs); Manager leg auto-satisfied when an author is a manager; Finance
    leg never auto-satisfied; `fallback_approver_id` escape hatch; act-time re-check.
  - `settings-config-no-ver`, `expiring-window-days-missing`, `access-endpoint-body-undefined`,
    `catalogue-gst-authority-ignored-or-422` (→ ignore client rate), `max-magnitude-unit-error`,
    `freight-branding-per-unit` → all folded.
- [ ] **Deferred (low):** `gst-slab-set-too-narrow` (unconfirmed) — widen allowed GST slab set if the
  catalogue carries 3%/0.25%/cess items; confirm with finance before building.
- [ ] Re-run panel on the revised corpus → `spec-validation-r3.md` (recommended, to confirm no new holes).
