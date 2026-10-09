# Spec Adversarial Review r2 — Smart Paste Order (V1)

> `spec-validator` round 2 · 3 fresh independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `004-smart-paste-order` |
| Artifact | `plans/active_milestones/004-smart-paste-order/spec.md` (as revised by the r1 "Revisions" section) |
| Date | 2026-10-09 |
| Gate | 2-of-3 majority (any-one for security) |
| Result | **21 confirmed · ~13 unconfirmed** — highest severity **🔴 high** |

## Verdict

**Still NOT ready — but for a healthier reason: the r1 fixes mostly held, and the panel's fire moved onto the fixes themselves.** The header/oversize/no-auto-commit/atomicity closures passed cleanly (all three skeptics logged them as "attacks that failed"). What remains splits into two kinds: (a) **real contradictions the r1 edits introduced** — decimals "accepted" (B5) yet un-confirmable (A2/D1-rev); the valid-SKU set defined two ways (A2 `catalog ∪ history` vs C3 `catalog only`); parse-time logging that breaks the "read-only parse" contract; and the two `pick one in planning` escapes I left (scoring function, metric source) — and (b) **one provably-impossible fixture**: all three skeptics independently computed that the flagship "Goodday 100 → Britannia Good Day 100g ≥ 90%" cannot happen, because `normNameForMatch` gives those strings **zero** token overlap and even the proposed +0.3 assist lands at ~41, not ≥90. Several remaining items are **genuine product/architecture decisions**, not wording — so rather than a third blind edit, I'm folding the mechanical fixes and putting four real decisions to you (see "Grill" below). A third panel run should follow once those are answered.

## Confirmed Findings (≥ 2 votes)

### 🔴 `goodday-fixture-unsatisfiable` · 3/3
The primary acceptance scenario is mathematically impossible under the specified matcher (token Jaccard = 0 for "Goodday 100" vs "Britannia Good Day 100g"; +0.3 assist → ~0.41 score → ~41 confidence, and <0.5 is `unmatched`). **Tightening:** choose a real scoring function that bridges `Goodday→Good Day` and `100→100g` (space-collapse + numeric/unit token equivalence), recompute the fixture's expected confidence from it, and assert that number — do not assert ≥90 unless the function provably reaches it. *(Decision 2 below.)*

### 🔴 `scoring-pick-one-in-planning` · 3/3
C2 offers two incompatible scoring designs and defers the choice — the single most important algorithm is undefined at spec-freeze. **Tightening:** pin one closed formula with every constant fixed and ≥5 worked `input→score→boost→confidence` fixtures. *(Decision 2.)*

### 🔴 `decimal-vs-integer-contradiction` · 3/3
B5 "accepts decimals and passes them through" directly contradicts A2/D1-rev "quantities MUST be integers ≥ 1" and the `parsed_qty INTEGER` column — a decimal line parses as matched but can never be resolved/confirmed, with no remedy. **Tightening:** decide decimals globally (reject at parse → `needs_qty`, OR allow end-to-end with `qty`/`parsed_qty` REAL and A2/D1-rev → "> 0"). *(Decision 1.)*

### 🔴 `confirm-contract-undefined` · 3/3
`parse-paste` is fully specified; **Confirm is not** — no route, method, or body, and "the existing order-draft endpoint" cannot today do A2 re-validation, D5-rev merge, D4-rev tagging, and D3-rev single-transaction logging. Undefined whether the existing endpoint is extended (regressing all other order callers) or a new wrapper is added. **Tightening:** specify the Confirm endpoint fully. *(Decision 4.)*

### 🔴 `parse-time-logging-contradiction` · 3/3
E2-rev writes a `paste_match_log` row per line at parse time, contradicting the "read-only (no rows)" API contract and E7; re-parses accumulate orphan rows without bound; and it collides with D3-rev's Confirm-time writes → two rows per line, breaking "one row per original line" and every metric. **Tightening:** pick ONE metric source (a dedupeable parse-event counter, or Confirm-time-only logging with an explicit unmatched-at-confirm action); if parse-time rows stay, key them to a parse-session and UPSERT on Confirm. *(Decision 3 + folded.)*

### 🔴 `a2-c3-pool-mismatch` · 2/3 (A,C)
A2 validates `chosen_sku` against `client_catalog ∪ approved history`; C3 says the pool is `client_catalog` only. Two authoritative clauses define different legal-SKU sets → either legit matches 422, or de-listed history SKUs slip onto drafts (re-opening the D2 hole C3 closed). **Tightening:** one canonical valid-SKU set — **current `client_catalog` only** — reused verbatim by the matcher pool, manual search (A3), and Confirm re-validation (A2). *(Folded.)*

### 🔴 `unit-regex-no-word-boundary` · 2/3 (A,B)
`/\d+\s?(unit)/i` with short units (`l,g,no,bag,box,tin,jar,pc`) and no word boundary matches inside ordinary words: `5 notebooks`→"5 no"→needs_qty, `12 granola`→"12 g", `2 litre`→"2 l". Common quantities silently lost. **Tightening:** anchor units as whole tokens (`(?<![a-z])\d+(?:\.\d+)?\s?(unit)s?(?![a-z])`), and special-case 1–2-char units that collide with English. *(Folded.)*

### 🔴 `metric-source-undecided` · 2/3 (A,C)
E2-rev leaves the Unmatched-rate data source "decide in planning" (parse-time rows vs counter) — changes both schema and write path. **Tightening:** pick one in the spec. *(Decision 3.)*

### 🟠 `auth-400-vs-404` · 3/3 _(C rated high)_ — security
"client_id must exist → 400" still stands beside A1's "not-owned → 404", so a probing client_admin distinguishes exists-but-not-yours (404) from nonexistent (400) — the exact enumeration A1 tried to prevent. **Tightening:** for non-super/ops callers return **404 uniformly** for both nonexistent and not-owned; reserve 400 for malformed input only; fix the check order (401→403 role→404 ownership). *(Folded.)*

### 🟠 `client-admin-binding-undefined` · 3/3 _(B rated high)_ — security
A1 hinges on "a client_admin is bound to a client" but no table/column/claim is named, so a lazy impl ships a no-op check and re-opens cross-tenant access. **Tightening:** name the binding source of truth (the claim/field the existing `denyClientCrossAccess`/`clientIds(user)` uses), deny on zero bindings, and write the acceptance scenario. *(Folded.)*

### 🟠 `merge-offered-vs-forced` · 3/3
The Gherkin/UI say merge is "offered; not silent" (operator's choice); D5-rev says the server MUST always sum duplicate SKUs. Contradiction. **Tightening:** choose one policy. *(Decision — folded into Decision set as a sub-choice; recommend always-sum + informational UI.)*

### 🟠 `order-status-set-undefined` · 3/3
"approved/terminal statuses (exclude DRAFT, CANCELLED, REJECTED)" — but the real FSM has **no `REJECTED`**, and "approved/terminal" doesn't map to the 13-state enum. **Tightening:** enumerate the exact `orders.status` whitelist that counts as history (real FSM names), name the date column/anchor for "12 months", and make A2 and C3 reference the same set. *(Folded.)*

### 🟠 `comma-grammar` · 3/3 _(A rated high)_
Comma is both a thousands separator in B5 (`1,000`) and a stripped name/qty separator in the original §Parsing — `Rice 1,000` → 1000 or 1 or 000. India grouping `1,00,000` unaddressed. **Tightening:** define the numeric grammar explicitly with fixtures. *(Folded.)*

### 🟠 `parse-flags-schema-and-pool-truncated` · 3/3
`pool_truncated` is listed as a per-line `parse_flag` (E1-rev) but is a response-level condition (C4); the canonical response JSON omits `parse_flags`; `low_confidence_parse` vs `multi_number` overlap. **Tightening:** move `pool_truncated` to `summary`; republish the full response JSON with per-line `parse_flags[]`; one condition → one flag. *(Folded.)*

### 🟠 `log-schema-overload` · 3/3
D5-rev adds `merged` and E2-rev adds parse-time status/flags, but the `paste_match_log` DDL has only 5 action values and no `status`/`parse_flags`/`phase` column; `action` is overloaded to mean parse-time status. **Tightening:** update the DDL (`merged` in a CHECK, add `status`/`parse_flags`/parse-session/`phase`), define each column's meaning at parse vs confirm. *(Folded with Decision 3.)*

### 🟠 `confirm-idempotency-key` · 3/3
"idempotent on the draft id" is vacuous — the draft id is created server-side, so a network-retry after a timed-out-but-succeeded Confirm has nothing to key on → duplicate draft + log batch. **Tightening:** require a client idempotency key (or deterministic draft id from client_id + content hash); server returns the existing draft on replay. *(Folded.)*

### 🟠 `order-count-undefined` · 2/3 (B,C)
`order_count` ("times ordered") is undefined — distinct orders vs order_items rows vs summed qty — so the boost, the ≥90 fixture, and the "ordered N×" chip are all implementation-dependent. **Tightening:** `order_count = COUNT(DISTINCT order_id)` for the whitelisted-status set in the window; reuse for the chip. *(Folded.)*

### 🟠 `status-vs-needs_qty-orthogonality` · 2/3 (A,C)
`status ∈ {matched, unmatched, needs_qty}` is single-valued, so a strong catalogue match that lacks a quantity can't be both; candidates may be hidden for `needs_qty` lines, forcing manual search for an item the catalogue clearly has. **Tightening:** make match-state and qty-state orthogonal (keep `status ∈ {matched, unmatched}` + a separate `needs_qty` boolean); run matching for qty-less lines. *(Folded.)*

### 🟠 `b6-separator-rule` · 2/3 (A,C)
B6's "quantity after the LAST separator" breaks on hyphenated names (`Coca-Cola 300ml - 5`, `A-1 Sauce 3`) and on non-numeric tails (`Water 20 - organic`). **Tightening:** distinguish intra-token hyphens (letters both sides) from whitespace-flanked separators; define the fallback when the post-separator token isn't a lone bare integer. *(Folded.)*

### 🟠 `why-reason-underived` · 2/3 (A,C)
The "why this match" chips are the trust feature, yet only "ordered N×" has a defined rule; "same name tokens" and "same pack size" have no firing condition and no pack-size extractor exists. **Tightening:** define each chip's computable predicate; add an acceptance assertion for a non-trivial "same pack" case. *(Folded.)*

### 🟡 `perf-p95-unmeasurable` · 2/3 (A,C)
"p95 ≤ 50 ms CPU (acceptance-tested)" names no sample size, environment, or harness, and ignores the matcher's >800-posting-list token skip. **Tightening:** specify N samples, Worker CPU metric, fixture pool, whether index-build counts, and the >800 skip. *(Folded.)*

## Unconfirmed (FYI · 1 vote)

| `id` | sev | note |
|---|---|---|
| `non-ascii-names-unmatchable` (A) | 🟠 | `normNameForMatch` strips non-ASCII → Devanagari/Tamil/accented items unmatchable, or collapse to equal empty strings and "exact match" at 100. Real for the India context — recommend adopting (ASCII-only decision + never exact-match on empty tokens). |
| `manual-search-c4-vs-a3` (B) | 🟠 | C4 "manual search = full catalogue" vs A3 "same client pool" — reconcile (full current `client_catalog`). Adopted with `a2-c3-pool-mismatch`. |
| `confidence-exact-100-vs-cap-99` (B) | 🟠 | `min(99,…)` would cap exact matches at 99, breaking the Exact=100 tier / "100% confidence" scenario. Adopt: formula applies to fuzzy tier only. |
| `edit-product-text-no-rematch` (B) | 🟠 | UI allows editing product text but no re-match endpoint is defined → stale candidates. Decide whether edit re-runs matching. |
| `ordinal-vs-decimal-leading` (C) | 🟠 | `1. Sugar` (ordinal) vs `1.5 kg` (decimal) ambiguity; define ordinal as `^\s*\d+\.\s+`. Adopt. |
| `pool-cap-exact-prefix-undefined` (C) | 🟠 | "exact-prefix" cap key has no referent before a line is parsed. Adopt: cap by history-freq desc, then name asc. |
| `action-enum-ui-mapping` (C) | 🟠 | searched vs changed vs accepted overlap → acceptance-rate KPI non-comparable. Needs a UI-gesture→enum decision table. |
| `match-min-config-unbounded` (A) | 🟠 | `MATCH_MIN=0` passes all acceptance tests yet matches garbage; bound the config range + add an "irrelevant line stays unmatched" test. |
| `pack-x-regex-vs-fixture` (C) | 🟠 | `Coke 300ml x 24` has no digit before `x`, so B2's pack regex misses → qty 24 unless a trailing separator rescues it. Fold into the parsing rewrite. |
| `required-fixtures-no-expected-output` (C) | 🟠 | B2 mandates fixtures but asserts no expected result; `Sugar 5 kg`→needs_qty is likely wrong for "buy 5 kg". Add expected `{productText,qty,status}` to each. |
| `toctou-parse-vs-confirm` (B) | 🟡 | catalogue changes between parse and Confirm → opaque 422; define re-resolution UX. |
| `subtotal-missing-price` (C) | 🟡 | footer ₹subtotal over an E6 price-"—" line is undefined (NaN?). |
| `confirm-enabled-when-all-removed` (C) | 🟡 | all-removed enables Confirm but D2-rev 400s → dead-end; require ≥1 resolved line to enable. |

## Attacks That Failed (r1 fixes that held — corroborated by all three)
- **Header silent-drop** — B1 abolished heuristic detection; every non-blank line is a row. ✅
- **Oversized/counting** — D6-rev pins `/\r\n|\r|\n/`, code points, raw-text-before-filter, 400. ✅
- **No auto-commit** — D1 + Gherkin + disabled-until-resolved. ✅
- **Confirm atomicity** — D3-rev single D1 batch (gap = idempotency key, filed). ✅
- **Write-time tenancy** — A2 forces server re-derivation (gaps = binding source + pool-set, filed). ✅
- **orders.source backward-compat** — D4-rev additive nullable column. ✅
- **Global-inventory leak / out-of-stock / empty-catalogue** — D2/E4/E5/E6 + C3 handle deterministically. ✅

## Actions Taken
- [x] Wrote this review.
- [x] Surfaced the **four genuine decisions** to the owner and recorded the answers: matching = **ship bare token-Jaccard, honest thresholds** (Goodday expected `unmatched` in V1); quantities = **whole numbers; `.0`/`.00` coerce; suggest qty from history when missing**; duplicate SKUs = **operator-confirmed merge**; Confirm = **new dedicated `POST /api/orders/from-paste`**.
- [x] Folded all four decisions + the 14 mechanical closures (R2-C1…C14) into `spec.md` → new AUTHORITATIVE "Revisions from spec-validation r2" section (last-wins over r1 and body).
- [x] Surfaced the unconfirmed tail in the table above (most adopted into r2 closures; `edit-product-text-no-rematch` and the `Sugar 5 kg` fixture result are flagged for the architect).
- [ ] Optional **`spec-validation-r3.md`** run on the r2 revision — advisable but the owner may proceed to `architect` and treat r3 as a plan-time check.
