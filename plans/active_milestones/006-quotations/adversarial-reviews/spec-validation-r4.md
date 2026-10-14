# Spec Adversarial Review r4 — GIFTSYZ Quotations (006-quotations)

> `spec-validator` · 3 fresh skeptics, no shared scratchpad · default-to-reject · 2-of-3 gate · all 3 hand-recomputed the 18 vectors

| Field | Value |
|---|---|
| Milestone | `006-quotations` |
| Date | 2026-10-14 |
| Gate | 2-of-3 majority |
| Result | **8 confirmed (2 high · 4 medium · 2 low) + 7 one-vote FYI** |
| Trend | confirmed per round: **31 → 20 → 15 → 8** (converging) |

## Verdict
**One targeted fold left; the calc core is locked.** All three skeptics independently re-recomputed V1–V18
**byte-exact and confirmed every value** (V8 now −47 ✓) — the pricing engine and its oracle are solid and
**Slice 1 is safe to build**. Every r4 finding lives in the **approval / fallback / idempotency** machinery
(later slices). The headline is a real self-contradiction: the capability matrix bars `commercial_manager`
from create/edit, so the "manager-who-authored auto-satisfies the manager leg" rule (your grill decision)
and the submit→APPROVED path can **never fire** — the matrix must let managers author.

## Confirmed Findings (≥ 2 votes)

### 🔴 High
- **`manager-autosatisfy-unreachable` (3/3)** — matrix gives `commercial_manager` create/edit = `—`, and a
  user holds one role, so no author can be a manager → the Manager auto-satisfy branch **and** the
  submit→APPROVED path are dead/untestable; the only way to trigger it is to promote the author to manager
  (an SoD bypass). → **grant `commercial_manager` create/edit/submit/send/accept-lost** so the rule is
  reachable and matches your intent (a manager pricing their own quote needs no extra manager review); add a
  lifecycle fixture (manager authors, sub-₹5L, all-ITC → APPROVED at submit).
- **`idempotency-lease-double-execute` (3/3)** — the `DONE` flip is a post-batch write; a crash after commit
  but before flip leaves the key `IN_PROGRESS`, and lease-expiry "re-executable" then re-runs create →
  **duplicate quote**. Also the `quote_idempotency` schema has **no `lease_until` column**, so the lease is
  unimplementable as written. → carry the idempotency key onto the created row (`idem_key`); a stale-lease
  retry must **probe for the committed effect by `idem_key` and return it, never blindly re-run**; add the
  `lease_until` column.

### 🟠 Medium
- **`weighted-margin-cap-vs-money-cap` (3/3)** — the guarded numerator `Σmargin·10000·2` hits 2^53 at
  ~₹450cr margin, so quotes between ~₹450cr and the documented ₹1000cr cap 422 on an ancillary metric. →
  compute `weighted_margin_bp` with **BigInt** (exact to the real cap); keep one documented cap.
- **`catalogue-null-or-unknown-sku-gst` (3/3)** — a catalogued SKU with NULL `gst_rate` coerces to 0% (silent
  under-tax); a non-null SKU **not** in the catalogue falls through to the client-supplied-rate path (client
  controls GST). → null/missing catalogue rate → **422 `E_CATALOGUE_RATE_MISSING`**; unknown non-null SKU →
  **422 `E_UNKNOWN_SKU`** (never ad-hoc fallback). Only `sku===null` uses the client-supplied rate.
- **`valid-until-default-at-create` (3/3)** — `valid_until` is `NOT NULL` at create but its default references
  `send_date`, which doesn't exist until send → either NOT-NULL violation, or validity anchored to the wrong
  date (old drafts unsendable). → make `valid_until` **nullable until send**; set it in the send batch to
  `send_date + default_validity_days`; add a `sent_at` column; reminders seed at send (already do).
- **`small-org-permanent-409` (3/3)** — a finance-leg quote needs ≥3 distinct entitled users (author +
  non-author manager + non-author finance; the single fallback covers only one leg), but no minimum-staffing
  is documented and the 409 is opaque. → document the minimum; make `E_NO_ELIGIBLE_APPROVER` name the
  specific leg/role missing; warn at settings time.

### 🟡 Low
- **`fallback-stale-after-role-change` (3/3)** — `fallback_approver_id` is validated only at settings PUT; a
  later `quote-access` revoke/demote of that user isn't cross-checked → silent 409s. → re-validate on GET
  quote-settings (warning flag) and reject/ warn on a `quote-access` change that invalidates the fallback.
- **`content-hash-payload-repr` (2/3)** — preimage embeds `payload_json` without stating string-vs-object →
  writer/verifier can diverge → false tamper. → embed the exact stored canonical **string**; pin a
  known-answer hash vector.

## One-vote (FYI) — acting on the clearly-correct ones
| `id` | sev | verdict |
|---|---|---|
| `round-primitive-float-division` | 🔴 (S2) | **Verified real** — JS `/` in the primitive is IEEE float; `Math.trunc(n/d)` can be off-by-1 for `n` near 2^53. Fixing: do the division in **BigInt** inside `roundHalfAwayFromZero`; I0 grep bans all bare `/` outside the primitive. |
| `fallback-one-leg-not-enforced-act-time` | 🔴 (S2) | Real — `quote_approvals` has no assignee col, so "one leg per quote" isn't enforced post-submit. Fixing: add `assigned_actor_id`/`assigned_as_fallback`; act-time re-check applies the full rule. |
| `snooze-reintroduces-post-expiry-nudge` | 🟠 (S2) | Fixing: reject `snooze_until ≥ valid_until`; fire-step also skips a reminder whose quote is already past `valid_until` (covers cron lag — S3's `reminder-fires-on-cron-lag`). |
| `bell-counts-ineligible-fallback-leg` | 🟡 (S3) | Fixing: bell mirrors submit-time fallback eligibility (finance-holds-finance, one-leg). |
| `bell-followup-overdue` | 🟡 (S2) | Fixing: bell follow-up predicate = `≤ today(IST)` (match Today). |
| `approval-completion-read-then-write` | 🟡 (S2) | Tightening: mandate the single conditional `UPDATE … WHERE NOT EXISTS(pending required leg)`, forbid SELECT-then-UPDATE. |
| `context-autosatisfy-scope` | 🟡 (S2) | Fixing: context.md still says "any author"; align to current-version author. |

## Attacks That Failed
All 18 vectors re-verified byte-exact by all three skeptics (independent recomputation); the loader invariant
holds for every vector and would have caught the old V8 slip; domain-separated hashes block cross-quote/
account transplant; create-v1 cache + submit re-derive closes the Finance-skip; reminder seed invariant +
fire-then-sweep is safe for normal crons; the `/access` exemption, redaction allowlist, GST slab set
(incl. 40%), and Finance-threshold inclusivity are all consistent.

## Actions Taken — all folded
- [x] `commercial_manager` granted authoring (create/edit/submit/send/accept-lost) → auto-satisfy +
  submit→APPROVED now reachable/testable; trade-off flagged in api-contracts.
- [x] BigInt division in `roundHalfAwayFromZero` + `weighted_margin_bp` (exact to the 10^12 cap, no sub-cap
  422); I0 grep now bans **all** bare `/`/`%` on Numbers.
- [x] Idempotency: `idem_key` on `quotes` + `lease_until` column + **probe-before-reexec** (no duplicate on
  crash-after-commit).
- [x] Catalogue null rate → 422 `E_CATALOGUE_RATE_MISSING`; unknown SKU → 422 `E_UNKNOWN_SKU`.
- [x] `valid_until` nullable-until-send + `sent_at` column (set in send batch).
- [x] Min-staffing documented + `E_NO_ELIGIBLE_APPROVER` names the missing leg; settings warns.
- [x] Fallback `assigned_to`/`assigned_as_fallback` persisted; act-time full re-check; bell keys on
  `assigned_to`; revoke of the fallback user → 409 + `fallback_valid` flag.
- [x] snooze bound `< valid_until` + cron fire-step skips expired quotes (cron-lag safe).
- [x] content-hash embeds the stored canonical **string**; single conditional completion UPDATE; bell
  follow-up predicate `≤ today`; context auto-satisfy scope → current-version author.
- [ ] Re-run panel → `spec-validation-r5.md` (recommended) — or build **Slice 1 (calc engine)**, which all
  three skeptics certified (18 vectors byte-exact) and which is independent of the churny approval machinery.