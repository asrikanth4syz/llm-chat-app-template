# Spec Adversarial Review — GIFTSYZ Quotations in Smart Pantry (006-quotations)

> `spec-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `006-quotations` |
| Artifact | `plans/active_milestones/006-quotations/{context,data-model,api-contracts,plan}.md` (no single spec.md) |
| Date | 2026-10-14 |
| Gate | 2-of-3 majority |
| Result | **31 confirmed · 10 unconfirmed** — highest severity **high** |

## Verdict

**Not yet ready to build against.** The architecture skeleton is sound (reuse map, no-trigger
immutability, entitlement model, slicing), but the corpus **defers its three most important rules to
an external PRD that isn't in-repo** (the 18 calc vectors, the rounding pipeline, and the R1–R8 reminder
cadence) — making the keystone acceptance criteria untestable — and carries real correctness/security
holes: **tenant isolation is absent**, the **hash-chain + counter have unserialized concurrent writes**,
**cost/margin redaction misses half the response paths**, and the **sole-approver case deadlocks**. All
11 highs and 20 mediums are fixable at spec stage; fold the tightenings in and re-run before planning
construction.

## Confirmed Findings (≥ 2 votes)

> Fold each **Tightening** into the spec before construction. Grouped by area; 🔴 high · 🟠 medium.

### Pricing / GST engine (the keystone)

#### 🔴 `calc-vectors-not-inlined` — 18 calc vectors live only in the external PRD · 3/3
- **Clause:** "`quote_calc.ts` passes all 18 PRD calc vectors … **before** any persistence code."
- **Malicious reading:** write 18 trivial assertions (`expect(computeQuote([]).grand_total).toBe(0)`) that match whatever the code already emits; "passes all 18 vectors" is literally satisfied while testing no real GST figure.
- **Harm:** the central tax/margin engine ships unverified; systematic over/under-charging of GST ships green.
- **Tightening:** inline all 18 vectors as a fixtures table (inputs → expected `unit_price, landed_cost, cgst, sgst, igst, line_gst, grand_total, weighted_margin, round_off`) with exact paise values; acceptance = byte-exact match on named vectors V1…V18, and CI fails if fewer than 18 named vectors are present.

#### 🔴 `rounding-policy-underspecified` — only 2 of many rounding decisions stated · 3/3
- **Clause:** "rounding: half-up to 2dp per line then round-off to nearest rupee on grand total"
- **Malicious reading:** GST-component rounding (per-line vs aggregated CGST/SGST), tie direction, negative handling, and whether `line_gst` is computed on rounded or unrounded base are all unstated — round however float math yields.
- **Harm:** totals drift paise/rupees from the customer's own GST computation; CGST+SGST ≠ IGST; the drift flips the ₹5L Finance boundary and breaks hash reproducibility.
- **Tightening:** specify the ordered pipeline — (1) unit_price full precision, (2) line_total = half-away-from-zero(unit_price·qty, 2), (3) line_gst = round(line_taxable·rate/100, 2), (4) CGST=SGST=round(line_gst/2, 2) with odd paisa to CGST and `assert CGST+SGST==IGST`, (5) single round-off-to-rupee on grand total, ties up, surfaced as a named `round_off` line. Define half-up as arithmetic, currency INR, with a worked example.

#### 🔴 `seller-state-origin-missing` — CGST/SGST-vs-IGST has no seller state to compare against · 3/3
- **Clause:** "place_of_supply | TEXT | state code; drives CGST/SGST vs IGST"
- **Malicious reading:** intra- vs inter-state needs the seller's state, which is captured nowhere; hardcode intra-state (always CGST/SGST) or always IGST.
- **Harm:** an entire class of quotes gets the wrong GST heads → legally invalid invoices, customer can't claim ITC.
- **Tightening:** add required `quote.settings.seller_state_code` (GSTIN-derived); rule: `intraState := place_of_supply == seller_state_code`, else IGST; 422 when seller state unset; add a vector per branch.

#### 🔴 `itc-landed-cost-fold-formula` — landed-cost GST fold + purchase-vs-sale rate undefined · 3/3
- **Clause:** "ITC-claimable=Yes (GST excluded from landed cost) vs No (GST folded into landed cost)"
- **Malicious reading:** only a per-line *sale* `gst_rate` exists; which rate folds into landed cost when ITC=No, and the GST treatment of `freight_alloc`/`branding_cost`, are unstated — fold an arbitrary rate or nothing.
- **Harm:** landed cost (hence margin and markup-derived sell price) is wrong for the whole ITC=No path — the same path that forces Finance review, so the highest-scrutiny quotes are the most likely miscalculated.
- **Tightening:** give the explicit formula `landed_cost = purchase_cost + freight_alloc + branding_cost + (itc_claimable ? 0 : purchase_cost·purchase_gst_rate/100)`, name the rate field, add a `purchase_gst_rate` if it can differ from sale rate, state freight/branding GST treatment, and add paired Yes/No vectors.

#### 🟠 `weighted-margin-undefined` — no formula or weighting basis · 3/3
- **Clause:** "weighted margin across lines"
- **Malicious reading:** weighted by qty/cost/revenue? margin over price or cost? pick the cheapest; still "returns weighted_margin".
- **Tightening:** define `weighted_margin = Σ(line_revenue − line_landed_cost) / Σ(line_revenue)` (pre-GST revenue), to 2dp; define the negative-margin flag as `line_margin < 0`; add a ≥2-line vector.

#### 🟠 `gst-rate-authority` — client-supplied line rate vs catalogue rate · 2/3
- **Clause:** "`inventory`/`client_catalog.gst_rate` … Reuse rate lookup only." vs `lines:[{…gst_rate}]`
- **Malicious reading:** trust the client-supplied `gst_rate`, letting a creator under-charge GST.
- **Tightening:** for catalogued SKUs `gst_rate` is server-resolved and client input ignored/validated-equal; only ad-hoc (null-SKU) lines may supply it, constrained to the allowed slab set.

#### 🟠 `calc-input-validation-422` — 422 reserved but rules never enumerated · 2/3
- **Clause:** "`422` calc/validation error." / "zero-qty / zero-price guards"
- **Malicious reading:** qty=0, discount_pct>100, negative cost, missing mode fields → return 200 with NaN/Infinity that gets hashed into an immutable version and printed on a customer doc.
- **Tightening:** enumerate rules — required fields per `pricing_mode`, qty>0, costs≥0, 0≤discount_pct≤100, gst_rate in the allowed slab set, non-empty `lines`, max magnitude — each → 422 with field path.

### Immutability, hashing & concurrency

#### 🔴 `concurrent-version-append-race` — no CAS / no UNIQUE(quote_id,version) · 3/3
- **Clause:** "concurrent version appends → serialize via `batch()` reading `current_version` + `prev_hash` … reject on version mismatch."
- **Malicious reading:** D1 `batch()` is atomic-per-batch but not serializable across requests; two PUTs both read v1, both write v2 with `prev_hash=v1.hash`. "Reject on version mismatch" has no mechanism (no CAS, no unique index).
- **Harm:** forked hash chain (two v2 rows, one `prev_hash`), clobbered `current_version` — the core immutability guarantee silently fails exactly where the spec claims it holds.
- **Tightening:** add `UNIQUE(quote_id, version)`; advance via conditional `UPDATE quotes SET current_version=:new WHERE id=:id AND current_version=:expected` inside the batch; 0 rows or a uniqueness violation fails the batch → client retries. Name this as the serialization mechanism.

#### 🔴 `hash-canonicalization-undefined` — "canonicalized" and the audit delimiter never defined · 3/3
- **Clause:** "content_hash | SHA-256 of canonicalized `payload_json`" / "entry_hash | SHA-256(seq‖action‖actor‖detail‖prev_hash)"
- **Malicious reading:** key ordering, number/float formatting, whitespace, Unicode normalization unstated; the `‖` join has no escaping, so an `actor_name`/`detail` containing the delimiter forges adjacent fields; `quote_id` isn't in the audit preimage → cross-quote replay.
- **Harm:** the "verifiable" chain and the hash "printed on the doc" aren't reproducible by anyone recomputing them; delimiter injection + replay defeat tamper-evidence.
- **Tightening:** specify RFC 8785 (JCS) for `payload_json` with money as fixed-scale strings; for `entry_hash` use a length-prefixed / JSON-array framing including `quote_id` and a genesis salt, explicit UTF-8, `actor_id` (not name); pin a sample `payload → hex digest` vector.

#### 🟠 `no-chain-verifier` — nothing ever recomputes or checks the chain · 2/3
- **Clause:** "`GET /api/quotes/:id/versions` → … (chain verifiable)"
- **Malicious reading:** the endpoint only echoes stored hashes; no code recomputes `content_hash` from `payload_json` or checks `prev_hash` links, so a direct-DB edit is undetected.
- **Tightening:** add a server-side verifier (endpoint + test) that recomputes each hash and checks linkage, returning `verified:bool` + `first_broken_version`.

#### 🟠 `quote-counter-allocation-race` — read-then-write mints duplicate quote_no · 3/3
- **Clause:** "last_no | atomically incremented inside the create `batch()`"
- **Malicious reading:** `batch()` can't feed a mid-batch increment into a sibling INSERT; read-before-batch lets two creates read `6` and both mint `0007` (UNIQUE then 500s one), or a gap/reuse appears.
- **Tightening:** allocate via single-statement `UPDATE quote_counters SET last_no=last_no+1 WHERE fy=? RETURNING last_no`, then format; retry the create batch on `UNIQUE(quote_no)` conflict; define FY-rollover seeding.

### Approvals / separation of duties

#### 🔴 `sod-sole-approver-deadlock` — the only role-holder is the creator · 3/3
- **Clause:** "Rejects if caller would be sole approver (SoD) — pre-check only; actual block at act time."
- **Malicious reading:** submit succeeds even when no *other* user holds the required quote-role; act-time 403 then blocks forever — no escalation/delegation/override defined. Common in a small tenant (one manager who also quotes).
- **Harm:** quotes stuck permanently in PENDING_APPROVAL; the feature deadlocks under realistic staffing.
- **Tightening:** define the no-eligible-approver outcome — block submit with a specific 409 ("no eligible approver for leg X") before PENDING_APPROVAL, or route to a configured fallback/admin override that is audited; have the admin UI warn about the minimum-staffing invariant.

#### 🟠 `reject-resubmit-stale-approvals` — approvals leak across versions on resubmit · 3/3
- **Clause:** "`POST /api/quotes/:id/reject` … → status `DRAFT`" + "approval binds to the exact version approved"
- **Malicious reading:** manager APPROVED v2, finance rejected → DRAFT; creator edits price → v3; the stale v2 APPROVED row lets the manager leg auto-pass on content they never saw.
- **Tightening:** on reject (and any version append) mark all prior PENDING/APPROVED rows SUPERSEDED; completion is computed only over rows where `version == current_version`; no approval carries across a version bump.

#### 🟠 `finance-threshold-basis` — ₹5L test base (pre/post tax, pre/post round-off) undefined · 3/3
- **Clause:** "`finance` iff `itc_claimable=0` OR `grand_total≥500000`" (data-model says "total≥5L")
- **Malicious reading:** choose pre-tax subtotal to drop the Finance leg more often; or a 499,999.60 that rounds to 500,000 toggles it.
- **Tightening:** "Finance leg required iff `itc_claimable=0` OR post-round-off, GST-inclusive `grand_total` ≥ 500000 (inclusive)"; add boundary vectors at 499999 / 500000 / 500001. (Threshold *value* is consistent across docs — only the basis is the hole.)

#### 🟠 `sod-version-author` — SoD checks header `created_by`, not who priced the version · 2/3
- **Clause:** "guard: `actor_id ≠ created_by` (**403 SoD**)"
- **Malicious reading:** B edits A's draft (B authors the priced version) then B approves — B ≠ `created_by(A)`, guard passes; the person who set the numbers approves them.
- **Tightening:** SoD = approver disjoint from `created_by` **and** from every `quote_versions.created_by` contributor to the version being approved; specify who may edit a draft.

### Entitlement (the configurable per-user requirement)

#### 🔴 `redaction-paths-incomplete` — chokepoint wired to 4 of ~8 response paths · 3/3
- **Clause:** "single `redactForQuoteRole()` chokepoint applied on every response path" vs plan Task 2.C "applied on list/detail/calc/document response builders"
- **Malicious reading:** wire only the four named builders; `GET /:id/versions`, the audit summary in `GET /:id`, `GET /today`, `GET /bell`, and nested `quote_versions.payload_json` / `quote_audit.detail_json` (which hold landed cost + margin) pass through verbatim.
- **Harm:** an `ops` user reads full cost/margin via version payloads, audit detail, or Today/bell — redaction bypass on untested paths.
- **Tightening:** enumerate every path (list, detail incl. embedded version + audit summary, calc, versions, document, audit read, today, bell); require deep-redaction of nested `payload_json`/`detail_json`; add a CI grep asserting no quote handler serializes a row/payload without the chokepoint.

#### 🔴 `redaction-field-list-incomplete` — denylist-of-one leaks derivable cost · 3/3
- **Clause:** "`ops` quote-role never receives `purchase_cost`, `markup_pct`, `margin`, `landed_cost`, `itc_*`."
- **Malicious reading:** the list omits `freight_alloc`, `branding_cost`, `mrp`, `discount_pct` (cost back-derivable) and `weighted_margin` (keyed differently from `margin`); and it's a denylist, so any role string other than exactly `ops` (a typo'd `Ops`, `sales`, `auditor`) sees everything.
- **Harm:** Ops reconstructs cost/margin, or a one-char config typo leaks it — the exact confidentiality failure the feature exists to prevent.
- **Tightening:** invert to an **allowlist** (define per quote-role which fields are visible); any unrecognized role string is redacted as if `ops` (fail-closed); include `freight_alloc`, `branding_cost`, `mrp`, `discount_pct`, `weighted_margin`, and line-level `margin` in the stripped set; test the unknown-role case.

#### 🟠 `quote-role-enum-unvalidated` — PUT accepts any role string · 3/3
- **Clause:** "`PUT /api/admin/quote-access` body `{ userId, quoteRole|null }` → upsert/remove in `quote.enabled_users`."
- **Malicious reading:** no check that `quoteRole ∈ {sales, ops, commercial_manager, finance, auditor}`; store `Ops` or `manager` → redaction keyed on exact `ops` misses it (cost leak) and leg routing keyed on `commercial_manager` silently never matches (never-approvable).
- **Tightening:** 422 unless `quoteRole` is null or exactly one of the five (case-sensitive); centralize the enum so redaction/routing reference it and unknown roles fail closed (deny + redact).

#### 🟠 `role-capability-matrix-missing` — `sales` and `auditor` have zero defined behavior · 2/3
- **Clause:** "`quoteRole ∈ {sales, ops, commercial_manager, finance, auditor}`"
- **Malicious reading:** only `ops`/`commercial_manager`/`finance` have rules; `sales` and `auditor` default to full unredacted access and can create/approve (an "auditor" should be read-only).
- **Tightening:** add a capability matrix for all five roles (create/edit/submit/approve-leg/send/accept/lost/followup/view-cost), default-deny anything unlisted.

#### 🟠 `admin-self-grant-escalation` — configurer can grant themselves an approver role · 3/3
- **Clause:** "Admin UI … (super_admin/ops_admin) … toggle + quote-role select; writes the two config keys via `setConfig`."
- **Malicious reading:** an admin grants self `finance`/`commercial_manager`, approves a quote they influenced, then revokes — SoD only checks creator≠approver, not who controls the allowlist.
- **Tightening:** audit every quote-access change with before/after (ideally into a hash-chained/entitlement audit stream, since per-quote `quote_audit` has no `quote_id` for a config change); forbid an admin assigning an approver role to their own userId; optionally require a second admin for approver grants; evaluate SoD at submit time too.

#### 🟠 `nav-stale-after-revoke` — nav checks entitlement once, on load · 2/3
- **Clause:** "nav calls `GET /api/quotes/access` on load rather than trusting client state."
- **Malicious reading:** after revoke the tile stays until a full reload (clicks now 404); after grant the tile is absent until reload — contradicting "instant grant/revoke, no deploy".
- **Tightening:** re-fetch `/access` on route navigation (or a short TTL); define a bounded max-staleness window N seconds; the acceptance test revokes-then-navigates without reload.

#### 🟠 `malformed-config-fail-closed` — unparseable `quote.enabled_users` has no defined failure mode · 2/3
- **Clause:** "`getQuoteEnabledUsers(env)` → `JSON.parse(getConfig(env,'quote.enabled_users','{}'))`"
- **Malicious reading:** a bad admin write makes `JSON.parse` throw → 500s on every quote route, or a silent catch flips semantics.
- **Tightening:** on parse failure treat as empty map (feature OFF, fail-closed) + surface an admin-visible config-invalid warning; never 500; validate JSON shape on PUT before persisting. (Same for `quote.settings`.)

### Tenancy / lifecycle / reminders

#### 🔴 `tenancy-isolation-missing` — quote tables carry no account scope; `denyClientCrossAccess` not required · 3/3
- **Clause:** "`404` not entitled OR cross-tenant hide" (but no quote route is required to call `denyClientCrossAccess`; `quote_*` tables have only `client_id`, no account column; `quote.enabled_users` is one global key)
- **Malicious reading:** an entitled tenant-A user reads/approves tenant-B quotes by id; one global allowlist enables the feature across all tenants at once.
- **Harm:** cross-tenant data leak of quotes/costs/documents in a multi-tenant B2B ERP.
- **Tightening:** carry account/tenant scope on every `quote_*` table (or via client→account); require `denyClientCrossAccess` on create/list/`:id*` (404 on mismatch); decide and state whether `quote.enabled_users`/`quote.settings` are per-tenant keys.

#### 🟠 `reminder-cadence-R1-R8-not-restated` — the eight rules live only in the PRD · 3/3
- **Clause:** "seed `quote_reminders` (R1–R8 due dates)" / "due_date | computed from `valid_until`/send date"
- **Malicious reading:** seed 8 rows all due today (or never); "R1–R8 fire once each" is trivially met while the chase cadence is meaningless.
- **Tightening:** restate each R1…R8 as `{offset, anchor (send_date|valid_until), channel, skip-condition}` inline; the seeding test asserts the eight concrete due dates under a frozen clock.

#### 🟠 `reminder-snooze-state-machine` — "fires once" contradicts snooze · 2/3
- **Clause:** "sent_at | dedup: a (quote_id,rule) fires once" + status `SNOOZED` + `snooze body {until}`
- **Malicious reading:** either snooze is a no-op (dedup already marked done) or reminders re-fire violating "once"; can a SENT rule be snoozed? undefined.
- **Tightening:** define the reminder state machine — snooze valid from PENDING/SENT, sets `SNOOZED`+`snooze_until`; the pass fires when `status∈{PENDING,SNOOZED}` and `due≤now`; "dedup" = at most one SENT per cycle; CANCELLED terminal. (Related, 1-vote: accept/lost must cancel SNOOZED rows too, not only PENDING — fold in.)

#### 🟠 `today-bell-timezone-ist` — day boundaries computed in UTC for an IST business · 3/3
- **Clause:** "created_at/updated_at | `datetime('now')`" + `GET /today` + `expiring`
- **Malicious reading:** UTC `now` vs date-only `valid_until` crosses the day boundary 5.5h early; "due today"/"expired" are off by one for the 18:30–00:00 IST window.
- **Tightening:** specify Asia/Kolkata for all day-boundary logic (expiry, Today, reminder due, next_action_date); store UTC, compare against IST calendar dates; `valid_until` compared end-of-day IST.

#### 🟠 `today-bell-bucket-thresholds` — "expiring"/"due"/"for me" undefined · 2/3
- **Clause:** "`GET /today` → `{ due_reminders, followups_due, expiring }`" / "`GET /bell` → count (pending approvals for me + my due follow-ups)"
- **Malicious reading:** return empty arrays / count 0 — a valid shape; "expiring within how many days?", "for me by role or by created_by?" unspecified.
- **Tightening:** define each bucket with a concrete predicate + window (e.g. `expiring = valid_until within N days`; `due = next_action_date ≤ today IST`; "for me" = PENDING legs matching my quote-role where I ≠ created_by).

#### 🟠 `expired-transition-no-mechanism` — EXPIRED is declared but nothing sets it · 3/3
- **Clause:** "status … →(`ACCEPTED`|`LOST`|`EXPIRED`)" + "valid_until … feeds EXPIRED"
- **Malicious reading:** no endpoint/cron transitions SENT→EXPIRED; quotes stay SENT forever past validity and keep firing reminders.
- **Tightening:** assign SENT→EXPIRED to the reminder/cron pass (`valid_until < today IST` → EXPIRED, cancel reminders, audit `expired`), define its timezone basis, and block `accept` once EXPIRED.

#### 🟠 `accept-lost-state-guards` — accept/lost name no source-state precondition · 3/3
- **Clause:** "`POST /:id/accept` → `ACCEPTED`" / "`POST /:id/lost` → `LOST`"
- **Malicious reading:** accept a DRAFT/PENDING quote (skipping approval, SoD, Finance leg, and the immutable document); mark LOST a never-sent quote.
- **Tightening:** publish the full transition matrix with required source status (accept: SENT only; lost: SENT or PENDING_APPROVAL/APPROVED — decide); 409 otherwise; `lost_reason` required + bounded.

#### 🟠 `valid-until-source-undefined` — not in the POST body, no default, no format · 2/3
- **Clause:** "valid_until | expiry date (feeds EXPIRED + reminders)" (absent from `POST /api/quotes` body)
- **Malicious reading:** leave it NULL → expiry + all R1–R8 reminders silently never fire.
- **Tightening:** specify the full `POST /api/quotes` body (client_id, place_of_supply, itc_claimable, valid_until, lines); `valid_until` required or default `send_date + settings.default_validity_days`; format YYYY-MM-DD interpreted end-of-day IST; must be future at send.

#### 🟠 `idempotency-key-semantics` — required? scope? TTL? replay? all unstated · 3/3
- **Clause:** "Mutations are idempotent via an `Idempotency-Key` header (stored like the Smart Paste idem pattern)."
- **Malicious reading:** treat as optional → a double-clicked `POST /quotes` or `/approve` creates two quotes / double-acts; or an under-scoped key collides across users.
- **Tightening:** required on all mutating routes, scoped `(user, route)`, stored with the response for a defined TTL; replay returns the original result; same key + different body → 409.

## Unconfirmed (FYI · 1 vote)

| `id` | severity | note |
|---|---|---|
| `money-stored-as-real-float` | 🔴 high | REAL (IEEE float) for money → paise drift + non-reproducible hash. Strongly reinforces rounding + canonicalization fixes — recommend integer-paise arithmetic. |
| `access-endpoint-self-contradiction` | 🟠 med | `GET /api/quotes/access` is under `/api/quotes/*` so the "every route 404s if not entitled" rule makes its `{enabled:false}` branch unreachable. Explicitly exempt `/access` from `requireQuoteAccess`. |
| `doc-hash-self-reference` | 🟠 med | The content hash is printed inside the document it hashes (circular). Hash the body with the hash field blanked, then stamp; define the verify procedure. |
| `header-mutation-desyncs-version` | 🟠 med | `place_of_supply`/`itc_claimable` mutable on the header but baked into the immutable version → drift. Any pricing-affecting change should append a new version. |
| `approval-completion-race` | 🟠 med | Two legs approved concurrently → neither (or both) flip to APPROVED. Compute completion in the approving batch via guarded conditional UPDATE. |
| `itc-per-quote-mixed-basket` | 🟠 med | Single per-quote `itc_claimable` can't model a basket mixing ITC-blocked and claimable SKUs. Move per-line or forbid mixed at 422. |
| `config-rmw-lost-update` | 🟡 low | Two admins editing the `quote.enabled_users` JSON blob → last-write-wins drops a change. Add an ETag/version or per-user rows. |
| `accept-lost-leaves-snoozed` | 🟠 med | "cancels pending reminders" cancels only PENDING, leaving SNOOZED rows to fire for won/lost quotes. Cancel `IN ('PENDING','SNOOZED')`. (Folded into reminder state machine.) |
| `two-quote-roles-contradiction` | 🟡 low | Guarding "a user with two quote-roles" is a phantom state (the map is userId→one role). Decide: one role, or model an array. |
| `unbounded-lines-and-pagination` | 🟡 low | No max lines-per-quote or list page cap → oversized batch DoS. Add a line cap + default/max page size. |

## Attacks That Failed (corroborations)

- **Finance-leg threshold *value*** — context.md (₹5,00,000), data-model.md (5L), api-contracts.md (500000) agree on inclusive `≥500000`; only the *basis* (pre/post-tax) is a hole.
- **Empty-config semantics** — "empty/unset ⇒ feature OFF for everyone" is stated identically across context.md, data-model config keys, and the `requireQuoteAccess` test. Only the *malformed-JSON* case is a hole.
- **Cookie vs JWT auth** — context.md explicitly says adapt the PRD's cookie+CSRF to host JWT/Bearer ("Do not port cookies"); no contradiction leaks in.
- **No-trigger architecture** — every doc repeats the self-heal-splits-on-`;` constraint and app-layer `batch()` immutability; internally consistent (the residual gap is the concurrency CAS, filed separately).
- **Creator-approves-own-quote (direct)** — closed by the act-time `actor_id ≠ created_by` 403; only the sole-approver *deadlock* and the *version-author* variant remain.
- **Admin bootstrap chicken-and-egg** — admin routes are `/api/admin/*` gated on platform `super_admin|ops_admin`, not `/api/quotes/*`, so an admin can seed an empty allowlist without being entitled.
- **Idempotency entirely absent** — the mechanism is at least named, so the weakness is under-specification, not absence.

## Actions Taken

- [x] Wrote this review (31 confirmed, 10 unconfirmed) — evidence artifact for the gate.
- [ ] Fold the 11 high + 20 medium tightenings into `context.md` / `data-model.md` / `api-contracts.md` / `plan.md` _(pending user go-ahead — it's a material spec revision)._
- [ ] Surface the high-value unconfirmed items (float money, access-endpoint exemption) to the user.
- [ ] Re-run the panel on the revision → `spec-validation-r2.md` _(after folding)._
