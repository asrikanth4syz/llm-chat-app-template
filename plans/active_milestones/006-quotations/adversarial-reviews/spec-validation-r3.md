# Spec Adversarial Review r3 — GIFTSYZ Quotations in Smart Pantry (006-quotations)

> `spec-validator` · 3 fresh independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate · all 3 hand-recomputed the 18 vectors

| Field | Value |
|---|---|
| Milestone | `006-quotations` |
| Artifact | 6-file corpus (context/calc-spec/calc-vectors/data-model/api-contracts/plan), r3 |
| Date | 2026-10-14 |
| Gate | 2-of-3 majority |
| Result | **15 confirmed (4 high · 9 medium · 2 low) + 5 one-vote FYI** |

## Verdict
**Not clean yet — one more fold.** Two things drove the count back up: (1) one **objective arithmetic
error in the vector oracle** (V8 `round_off`), caught unanimously — the other 17 vectors were
independently recomputed and confirmed correct by all three skeptics; and (2) the **`fallback_approver`
escape hatch added during grilling is under-specified**, producing a 6-finding cluster (unreachable through
the auth guard, can clear both legs, can be an author → deadlock, invisible in bell). Plus a real approval
logic gap (an all-auto-satisfied quote never reaches APPROVED). None are architectural; all have concrete
tightenings. Fold → one more panel → build.

## Confirmed Findings (≥ 2 votes)

### 🔴 High
- **`v8-roundoff-wrong` (3/3)** — V8 lists `round_off -6`; correct is **−47** (`3006+541=3547 →
  roundToRupee 3500 → round_off −47`). The oracle self-contradicts (`3500 − 3547 ≠ −6`). → Fix V8 to
  `round_off −47`; add a loader invariant `grand == subtotal+cgst+sgst+igst+round_off` and `grand % 100 == 0`
  checked on every vector. **(Objective; fixing now.)**
- **`fallback-approver-unreachable` (3/3)** — nothing requires `fallback_approver_id` to be an entitled user
  with an approver role, so `requireQuoteAccess`/the capability matrix 404/403 them before the fallback
  exception runs → the leg routes to them at submit but they can never act → permanent PENDING. → fallback
  must be a `quote.enabled_users` member holding an approver role (422 at settings PUT otherwise); define
  guard precedence.
- **`fallback-both-legs` (2/3)** — one `fallback_approver_id` can clear **both** manager and finance legs of
  the same ≥₹5L/non-ITC quote → one person defeats two-person control. → forbid the same user satisfying >1
  leg of a quote (else 409); finance-leg fallback must itself hold `finance`.
- **`weighted-margin-numerator-overflow` (2/3)** — the `Σmargin * 10000` numerator is **not** covered by the
  ≤10^12/safe-integer guard; near-cap quotes silently lose precision on `weighted_margin_bp` (violates I0).
  → assert `Number.isSafeInteger` on the numerator (and its ×2) → 422, or lower the money cap, or BigInt that path.

### 🟠 Medium
- **`fallback-in-author-set-deadlock` (3/3)** — submit routes to a fallback who is in the author set; act-time
  guard then 403s them → deadlock with no up-front 409. → at submit, treat an author-set fallback as no
  fallback → 409 `E_NO_ELIGIBLE_APPROVER`.
- **`fallback-no-bell` (3/3)** — bell counts a leg only when `leg == my quoteRole`, so a fallback standing in
  (different role) never sees it and is never notified. → count legs routed to me as fallback; `pushNotification`
  the assignee at submit.
- **`create-v1-header-cache-unset` (2/3)** — header caches (`itc_claimable_all`/`grand_total_paise`) are only
  specified to be set in the version-append CAS UPDATE (PUT path); a created-then-submitted v1 quote may read
  NULL → Finance leg skipped on a ≥₹5L/non-ITC v1. → create must populate the caches; submit must re-derive
  from the current version payload, never trust a possibly-null header.
- **`catalogue-rate-off-slab` (2/3)** — §6 (catalogue rate authoritative, no 422) vs §7 (rate ∈ 6-slab set)
  contradict for a catalogued SKU whose stored GST rate is off-slab (3%, 0.25%, cess). → state whether
  server-resolved catalogue rates are exempt from the slab check; define behavior when off-slab.
- **`idempotency-in-progress-semantics` (3/3)** — the DONE flip is a separate write after the batch; a crash
  between leaves the key stuck `IN_PROGRESS` for 24h, and the in-flight-collision response is undefined. →
  define the IN_PROGRESS read (409 + Retry-After); add a short staleness lease so an abandoned IN_PROGRESS is
  re-executable before the 24h TTL.
- **`entitlement-chain-salt-undefined` (3/3)** — `quote_entitlement_audit` references a "per-account salt row"
  that has no storage and no preimage formula; verifier not wired to it. → add the per-account salt column/
  table + explicit length-prefixed preimage; extend `verifyQuoteChain`.
- **`version-hash-no-domain-separation` (3/3)** — `content_hash = sha256(canonical(payload_json))` has no
  account/quote/version/salt binding (unlike the audit chain), so a version row can be transplanted across
  quotes and still verify. → bind the version hash to `account_id/quote_id/version/genesis_salt`.
- **`reminder-overshoot-post-expiry` (2/3)** — the seed-skip only drops offsets ≤ send_date, not offsets ≥
  valid_until; a short-validity quote can fire R1/R2 on/after expiry (fire-before-sweep), the exact collision
  r2 claimed gone. → also skip any rule whose `due_date ≥ valid_until`.
- **`manager-autosatisfy-scope` (2/3)** — auto-satisfy keys on *any* historical version author holding
  `commercial_manager`, and the capability matrix forbids managers from editing → the rule is either dead
  code or a churn-exploit (one cosmetic manager edit waives manager review for all future versions). →
  auto-satisfy only when a `commercial_manager` authored the **current** version; reconcile with the matrix.

### 🟡 Low
- **`magnitude-cap-ambiguous` (2/3)** — the "₹10 crore = 10^10 paise" label contradicts the stated 10^12-paise
  cap (100× off). → delete the label; state `cap = 10^12 paise (₹1,000 crore)`; add a boundary vector.
- **`expiring-bucket-predicate` (2/3)** — "within expiring_window_days" lacks a closed form. → `today(IST) ≤
  valid_until ≤ today(IST)+window`; state inclusivity and exclusion of already-expired.

## One-vote (FYI) — acting on the clearly-correct ones
| `id` | sev | verdict |
|---|---|---|
| `submit-all-auto-satisfied-never-completes` | 🔴 (S3) | **Verified correct — fixing.** If the Manager leg is AUTO_SATISFIED at submit and no Finance leg is required, no approve call ever runs the completion UPDATE → quote stuck in PENDING forever. submit must evaluate completion and go straight to APPROVED. |
| `valid-until-basis-create-vs-send` | 🟠 (S3) | Real — fixing: valid_until defaults from `created_date + default_validity_days` at create; re-anchor at send if past. |
| `default-validity-days-no-default` | 🟡 (S3) | Fixing: default 30. |
| `reminder-rules-values-unvalidated` | 🟡 (S2) | Fixing: non-negative, R1≤R2, no due ≥ valid_until. |
| `context-ops-approval-leg-stale` | 🟡 (S3) | Fixing: context.md still says "Ops→Manager"; the model has manager+finance legs only. |

## Attacks That Failed (confirmed solid)
All three skeptics hand-recomputed **V1–V7, V9–V18 and confirmed every value correct** (only V8's round_off
is wrong). Also confirmed closed: the 40%/4000bp slab (consistent across all files), `/access` exemption,
concurrency serialization (UNIQUE + meta.changes + counter UPSERT + idempotency PK-in-batch), header-cache
sync on the PUT path, GST-rate authority, doc-hash self-reference, redaction allowlist/deep/fail-closed,
`ceilHalf` odd-paisa split, `roundHalfAwayFromZero`, reminder dedup + snooze state machine (normal validity).

## Actions Taken — all folded
- [x] V8 oracle fixed (`round_off −47`); loader consistency invariant added to `calc-vectors.md`.
- [x] `fallback_approver` redesigned: must be an entitled approver-role user; ∉ author set; one leg per
  quote only; finance-leg fallback must hold `finance`; reaches approve/reject through normal gates (no
  bypass); submit emits 409 up front when unreachable; counted in bell + notified at submit.
- [x] submit evaluates completion → **direct APPROVED** when all required legs auto-satisfy.
- [x] Manager auto-satisfy scoped to the **current-version** author.
- [x] version `content_hash` + entitlement chain domain-separated (account/quote/version/salt; per-account
  salt table + preimage + verifier); create-v1 populates header caches + submit re-derives; idempotency
  IN_PROGRESS → 409+lease; reminder skip extended to `due ≥ valid_until`; weighted-margin numerator added to
  the overflow guard; magnitude annotation fixed; expiring predicate made closed-form; `default_validity_days`
  default 30 + reminder_rules value validation; catalogue off-slab → 422; context "Ops→Manager" wording fixed.
- [ ] Re-run panel → `spec-validation-r4.md`.