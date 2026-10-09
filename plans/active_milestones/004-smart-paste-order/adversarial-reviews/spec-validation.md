# Spec Adversarial Review — Smart Paste Order (V1)

> `spec-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate (security findings triaged at any-one per the skill's high-stakes rule)

| Field | Value |
|---|---|
| Milestone | `004-smart-paste-order` |
| Artifact | `plans/active_milestones/004-smart-paste-order/spec.md` |
| Date | 2026-10-09 |
| Gate | 2-of-3 majority (any-one for security) |
| Result | **16 confirmed · 7 unconfirmed** — highest severity **🔴 high** |

## Verdict

**NOT ready to plan against as written.** The intent is sound, but three independent skeptics converged on the same load-bearing holes. Two are existential: (1) the flagship acceptance fixture — "Goodday 100" → "Britannia Good Day 100g" at confidence ≥ 90 — is **unsatisfiable** with the specified matcher, because `normNameForMatch` lowercases and token-splits, giving those two strings near-zero token overlap, and the confidence "frequency boost" has no formula; and (2) the endpoint gates on caller **role** but never checks the caller is **scoped to** the `client_id` in the body — a cross-tenant data leak. All 16 confirmed tightenings have been folded into the spec (see the new "Revisions from spec-validation r1" section); a re-run is warranted because the parsing and matching sections changed materially.

## Confirmed Findings (≥ 2 votes)

### 🔴 `client-scope-auth` — endpoint checks role, not tenancy · 3/3
- **Clause:** "Auth: same gate as order import … else 403" + "client_id required and must exist → else 400"
- **Malicious reading:** a `client_admin` passes any other client's `client_id` (it merely "exists"); the endpoint returns that client's catalogue, per-client prices and order history, and lets them build drafts for it.
- **Harm:** cross-tenant IDOR — one client enumerates competitors' SKUs, negotiated prices and purchase history.
- **Tightening:** caller must be authorized for the specific `client_id` (super_admin/ops_admin: any; client_admin: only their own bound client, else 404 to avoid existence disclosure). Same ownership check gates Confirm.

### 🔴 `confidence-boost-undefined` — flagship fixture unsatisfiable + arbitrary confidence · 3/3
- **Clause:** "Confidence = round(score×100), boosted (capped 99) by an order-frequency factor" + Scenario "confidence ≥ 90"
- **Malicious reading:** boost = +0 (a no-op satisfies "boosted"). Then confidence = round(Jaccard×100); "Goodday 100" vs normalised "britannia good day 100g" shares ~no tokens → confidence ≈ 0, so the headline scenario can **never** pass; or an implementer invents an unverifiable boost.
- **Harm:** the entire trust UX rests on an undefined, non-reproducible number, and the primary acceptance test is impossible against the stated matcher.
- **Tightening:** define the boost as an explicit bounded function AND resolve the token-overlap gap for the Goodday case (alias/substring/bigram assist, or weaken the fixture to a value the matcher provably reaches), with a worked numeric expectation.

### 🔴 `header-line-silent-drop` — "obvious header lines" undefined, violates D3 · 3/3
- **Clause:** "blank lines and obvious header lines are ignored."
- **Malicious reading:** classify any line lacking a digit (e.g. `Rice`, `ASSORTED BISCUITS`) as a "header" and drop it silently.
- **Harm:** directly violates D3 "Nothing is dropped silently" — a pasted item vanishes with no unresolved row and no log entry.
- **Tightening:** remove header detection in V1 — every non-blank line becomes a row (needs_qty if no quantity); never discard a product line. If any skip is kept, it must be a fixed exact pattern list AND surfaced with status `skipped_header`.

### 🔴 `resolved-requires-qty` — "resolved" doesn't require a quantity · 2/3 (S1,S2)
- **Clause:** "Confirm … disabled until every line is resolved or removed."
- **Malicious reading:** "resolved" = "has a SKU"; a needs_qty line with a SKU but null/0 qty enables Confirm.
- **Harm:** draft created with null/0 quantities; contradicts the needs_qty scenario.
- **Tightening:** define *resolved* = has exactly one selected catalogue SKU **AND** integer quantity ≥ 1.

### 🔴 `confirm-atomicity` — draft + log writes not transactional · 2/3 (S1,S2)
- **Clause:** "Order creation happens on Confirm … with a source tag and the paste_match_log write" (two parallel effects)
- **Malicious reading:** create the draft, write log best-effort; a mid-way failure leaves a draft with no log, or orphan log rows with a dangling `order_id`.
- **Harm:** corrupts the learning-seed/metrics dataset that is the whole business case; operator unsure whether the order was created.
- **Tightening:** draft creation + all `paste_match_log` rows for a Confirm are one atomic D1 batch/transaction; on failure nothing persists and the operator sees a retriable error; `order_id` set in the same unit; retried Confirm idempotent.

### 🟠 `single-candidate-margin` — margin test undefined when only one candidate · 3/3 _(S3 rated high)_
- **Clause:** "score ≥ MATCH_MIN **and** beats the runner-up by ≥ MATCH_MARGIN"
- **Malicious reading:** with one candidate there is no runner-up → margin "unmet" → always `unmatched`.
- **Harm:** small-catalogue clients (the common case) get everything marked unmatched; the feature is useless where it should be easiest.
- **Tightening:** a sole candidate clearing MATCH_MIN auto-satisfies the margin; the margin test applies only when ≥ 2 candidates clear MATCH_MIN.

### 🟠 `parse-adjacency-x` — "adjacent/bound to a unit" whitespace & `x` undefined · 3/3 _(S1 rated high)_
- **Clause:** 'bound to a unit if adjacent to … `×, x<digits>`'
- **Malicious reading:** literal `x<digits>` / zero-space adjacency means `Coke 300ml x 24` leaves `24` unbound → qty 24; `Sugar 5 kg` → qty 5; and `x` means opposite things in `2 x item` (qty) vs `item x24` (pack).
- **Harm:** pack/case counts written with a space become the order quantity — the exact wrong-delivery failure the feature exists to prevent.
- **Tightening:** define adjacency by regex allowing optional whitespace (`\d+\s?unit` and `unit\s?\d+`); define `x`/`×` precisely — leading `^\s*\d+\s*[x×]\s+` = quantity, embedded/trailing `\d+\s*[x×]\s*\d+` = pack multiplier kept in product text; add spaced fixtures.

### 🟠 `history-sku-price-contradiction` — D2 vs history-UNION vs E6 · 3/3
- **Clause:** "Never suggest a SKU the client cannot buy/price" vs "UNION SKUs that client has in order_items history" vs E6 "price missing … candidate still shown"
- **Malicious reading:** offer historical SKUs now delisted from `client_catalog` (no current price); E6 blesses priceless candidates — contradicting D2.
- **Harm:** operator confirms an unbuyable/unpriceable SKU → draft line with undefined pricing/subtotal.
- **Tightening:** pool = current `client_catalog` SKUs; history only **ranks/boosts** catalogue SKUs, never introduces non-catalogue SKUs. Also scope history to approved/terminal order statuses (exclude draft/cancelled/rejected) over a stated window _(fold of S3 `history-pool-order-status`)_. If priceless history SKUs are intentionally kept, amend D2 and define draft pricing.

### 🟠 `source-tag-vs-no-orders-change` — tag mandated, schema change forbidden · 2/3 (S2,S3)
- **Clause:** "source: \"smart_paste\" tag" vs "No change to … orders" (and the orders INSERT has no `source` column)
- **Malicious reading:** drop the tag to honour "no change to orders" → smart-paste orders indistinguishable from manual.
- **Harm:** provenance lost; §Success-metrics join breaks.
- **Tightening:** permit an additive `orders.source TEXT` column (declare it in-scope) **or** carry provenance only via `paste_match_log.order_id` and delete the on-order tag requirement. Pick one.

### 🟠 `status-enum-parse-flags` — low-confidence-parse unrepresentable · 2/3 (S2,S3)
- **Clause:** `status: matched | unmatched | needs_qty` vs E2 "flag the line low-confidence-parse"
- **Malicious reading:** no field carries `low-confidence-parse`, so it is never surfaced; the riskiest parses look identical to clean ones.
- **Harm:** operator isn't warned to scrutinise ambiguous lines — the safety signal is dropped. Plus `needs-qty`/`needs_qty` spelling drift.
- **Tightening:** add `parse_flags: string[]` per line with an enumerated vocabulary; require the UI to visibly mark flagged rows; normalize to `needs_qty`.

### 🟠 `perf-budget-pool-cap` — no measurable budget; cap value/order undefined · 3/3
- **Clause:** "within the Worker's normal request budget; if the pool query is heavy, cap candidate pool and document it."
- **Malicious reading:** any latency passes; cap the pool at an arbitrary tiny N (even 1) and "document" it.
- **Harm:** untestable; a silent cap drops the correct SKU → false `unmatched` for large catalogues (violates D3).
- **Tightening:** concrete budget (e.g. p95 ≤ 50ms CPU for 100 lines against a 2,000-SKU pool); if capping, state the cap value + deterministic ordering (history-frequency then exact-prefix) + a visible truncation warning; the **manual search box queries the full catalogue regardless of any match-pool cap**.

### 🟠 `empty-zero-line-draft` — whitespace/all-removed → empty draft · 3/3
- **Clause:** "text required, non-empty" + "Confirm … disabled until every line is resolved or removed"
- **Malicious reading:** whitespace-only or all-header text passes "non-empty" → zero parsed lines; or operator removes all lines → zero unresolved → Confirm enables → empty draft.
- **Harm:** empty/zero-item draft orders + orphan state; undefined "nothing to order".
- **Tightening:** "non-empty" = ≥ 1 parseable non-blank line else 400; Confirm disabled and endpoint rejects when the draft would have zero resolved lines; never create an empty draft.

### 🟠 `duplicate-sku-merge` — optional merge + no `merged` action · 2/3 (S1,S3)
- **Clause:** "the operator … can merge to quantity 30 (merge is offered; not silent)" vs action enum without `merged`
- **Malicious reading:** operator declines merge → two lines with the same SKU hit the draft path (undefined: error / sum / duplicate rows); merges are unloggable in the fixed enum.
- **Harm:** wrong totals and mislabelled learning data for exactly the high-signal correction case.
- **Tightening:** define unmerged-duplicate behaviour against the draft path (reject or sum) and add a `merged` action (or `merged_into_line_no`) so duplicate-SKU confirms are deterministic and auditable.

### 🟠 `unmatched-action-metric` — `unmatched` action unreachable, metric ~0 · 2/3 (S1,S3)
- **Clause:** action enum includes `unmatched`, but logs write only on Confirm and Confirm blocks while any line is unmatched
- **Malicious reading:** `unmatched` is never written; "Unmatched rate" metric is structurally zero; abandoned items logged only as `removed`.
- **Harm:** the headline readiness/V2-seeding metric is permanently unmeasurable.
- **Tightening:** log a per-line row at **parse time** (capturing initial status) so `unmatched` is observable, or redefine Unmatched-rate off the parse response; reconcile the enum accordingly.

### 🟡 `input-limit-counting` — line/char counting semantics undefined + vacuous oversized test · 2/3 (S1,S2)
- **Clause:** "≤ 200 lines and ≤ 20,000 chars" + "no partial parse is created"
- **Malicious reading:** undefined split (`\n` vs `\r\n`), count before/after filtering, chars = code points vs UTF-16 vs bytes; "no partial parse" is vacuously true since parse is read-only.
- **Harm:** platform-dependent accept/reject; the oversized criterion verifies nothing.
- **Tightening:** split on `/\r\n|\r|\n/`; count raw lines and Unicode code points of the raw submitted text **before** filtering; both limits apply to raw input; drop the vacuous clause.

### 🟡 `line-no-basis` — `line_no` basis ambiguous across dropped lines · 2/3 (S1,S2)
- **Clause:** `line_no INTEGER` + "one row per original line"
- **Malicious reading:** renumber only surviving lines, so `line_no` no longer maps to the pasted text; unclear if dropped lines are counted/logged.
- **Harm:** numbers drift from what the operator sees; corrupts debugging and the V2 learning seed.
- **Tightening:** `line_no` = 1-based index into the original newline-split text (preserved across blanks); state blank lines are not logged; "one row per original line" means per surviving parsed line.

## Unconfirmed (FYI · 1 vote)

| `id` | severity | note / disposition |
|---|---|---|
| `confirm-sku-not-revalidated` (S2) | 🔴 high | **Security — adopted despite 1 vote** (any-one gate): Confirm must server-side re-derive the client pool and reject (422) any `chosen_sku` not in catalogue∪history; qty must be int ≥ 1. Closes the write-time D2 bypass. |
| `manual-search-scope-undefined` (S3) | 🟠 med | **Security-adjacent — adopted:** the manual SKU search box must be restricted to the same client-scoped pool, else it's a back-door D2 bypass. |
| `decimal-quantity-misparse` (S3) | 🟠 med | Adopted into parsing rules: define quantity as a numeric token (decimal / thousands-sep per locale) or explicitly reject non-integers as needs_qty. |
| `list-marker-as-quantity` (S1) | 🟠 med | Adopted: strip leading `N.` ordinal/list markers **before** quantity extraction; their digits are never eligible as quantity. |
| `unit-list-divergence` (S2) | 🟠 med | Adopted: make §Parsing's unit list the single normative set; delete the divergent D5 inline list. |
| `unit-list-incomplete` (S3) | 🟠 med | Adopted: case-insensitive + plural handling; expand/extensible unit vocabulary (nos, carton/ctn, bag, bottle/btl, tin, jar, strip, bundle). |
| `e1-fixture-self-ambiguous` (S2) | 🟠 med | Adopted: make E1 deterministic via the separator tie-break (quantity = bare int after the last `- : |` separator); remove the word "ambiguous" from the fixture. |
| `draft-path-rejects-history-sku` (S1) | 🟠 med | Superseded by `history-sku-price-contradiction` fix (pool restricted to catalogue), which removes the reject risk. |

## Attacks That Failed (corroborate the spec holds here)
- **Auto-commit of 100% matches** — blocked by D1 + the dedicated "no line is auto-committed" scenario. (3/3 skeptics agreed.)
- **Confirm = submit-to-approval** — spec unambiguously states DRAFT only, not entering approval (D6).
- **Parse endpoint side-effects** — E7 states parse is pure/read-only; only Confirm writes.
- **Double-click Confirm duplicate orders** — E7 defers to the app's existing in-flight action lock.
- **Out-of-stock / inactive SKU excluded** — E5 explicitly keeps them matchable with a muted chip.
- **Global inventory leaking into candidates** — D2 + the Kinley-Water scenario explicitly exclude it.
- **Empty-catalogue client** — E4 defines exact behaviour (all unmatched + banner).
- **Zero/negative/non-numeric qty** — E3 maps to needs_qty with Confirm blocked.
- **CSP inline-JS** — in-scope item 1 + E9 require delegated handlers + the smoke test.

## Actions Taken
- [x] Wrote this review.
- [x] Folded all 16 confirmed tightenings + the 2 security 1-vote findings + the adopted parsing 1-voters into `spec.md` → new section **"🔧 Revisions from spec-validation r1 (authoritative)"**.
- [x] Surfaced unconfirmed findings above with disposition.
- [ ] Re-run panel on the revised spec → `spec-validation-r2.md` (recommended — parsing/matching/confirm changed materially).
