# Context & Fit Assessment: GIFTSYZ Quotations in Smart Pantry

**Moniker:** `006-quotations`
**Source:** `GIFTSYZ_Quotation_App_PRD_v2.1.docx` (external PRD; the "working app in /giftsyz" it
references is a **separate codebase not present in this repo** — treat as net-new here).
**Added requirement (beyond PRD):** the quote feature must be assignable to **specific users** and be
**configurable** (per-user enablement + per-user quote-role), not role-hardcoded.

## Verdict
**Integrate — do not build a second standalone app.** The host platform fits well (auth, tenancy,
clients, catalogue, approval engine, audit, document store, FY numbering, cron, config). The
**pricing/calc engine is genuinely new** and is the center of gravity. Effort: **medium-large**;
platform risk **low**; domain (calc/GST/ITC) risk **medium** — mitigated by a pure, vector-tested
module.

## Reuse map (verified against code)
| PRD need | Host asset | Verdict |
|---|---|---|
| AuthN/Z, tenancy | `getUser`/`requireUser`/`denyClientCrossAccess`, JWT (`src/index.ts:95`) | Reuse. Adapt PRD cookie+CSRF → host JWT/Bearer. **Do not port cookies.** |
| Customers | `clients` (GSTIN/state) | Reuse as quote customer. |
| Catalogue + GST rate | `inventory`/`client_catalog.gst_rate` | Reuse rate lookup only. |
| Approvals | `approval_chains/steps/instances/actions` (`migrations/0003_features.sql:111`) | Reuse engine; add quote chain + SoD + conditional Finance leg. |
| Audit | `audit_logs` + `audit()` (`src/index.ts:185`) | Extend with SHA-256 hash-chain for quotes. |
| Document blob + hash | `dc_documents.content_b64` (`migrations/0018`), `crypto.subtle` SHA-256 present (`src/index.ts:9`) | Reuse pattern for immutable customer doc. |
| FY numbering | `allocateDCSeriesNumber`/`currentFY` (`src/index.ts:341,360`) | Reuse for quote no. + counters. |
| Reminders | `scheduled()` + 3 crons (`src/index.ts:4441`; `wrangler.jsonc:31`), `pushNotification` (`:2695`) | Extend: gated pass for the 3-step cadence + Today + bell. |
| Settings store | `app_config` + `getConfig`/`setConfig` (`src/index.ts:236,242`) | Reuse for quote settings **and** the entitlement list. |
| Self-heal schema | `ensureFeatureTables` (`:2777`), scoped guard `_spSchemaReady` (`:6205`) | Follow pattern — `ensureQuoteSchema` once-per-isolate. |

## Gaps (net-new)
1. **Pricing/calc engine** — host `computeOrderGst` (`src/index.ts:6082`) is flat `Σ qty·price·rate/100`.
   No landed cost, mixed cost+markup / MRP−disc, ITC-claimable, CGST/SGST-vs-IGST by place-of-supply,
   weighted margin, or rounding policy. → `src/quote_calc.ts` (pure, 18 PRD calc vectors).
2. **Immutable hashed versions + hash-chained audit** — enforce in app-layer `env.DB.batch()`,
   **NOT SQL triggers** (self-heal runner splits on `;` and breaks on trigger bodies).
3. **Separation-of-duties approvals** — **Manager leg always; Finance leg** when `itc_claimable=No`
   OR grand total ≥ ₹5,00,000 (two legs only; ops holds no approval leg). Approver ∉ author set.
4. **Reminders/follow-ups** — 3-step cadence, dedup, snooze, Lost state, follow-up log, Today page, bell badge.
5. **Cost/margin redaction** — Operations quote-role must never receive cost/margin fields
   (server-side strip, mirroring existing client-vs-internal price redaction).

## Configurable per-user assignment (the added requirement)
No per-user entitlement exists today (RBAC is pure role). Design, no schema churn:
- `app_config['quote.enabled_users:<account_id>']` = JSON `{ _ver, users:{ "<userId>": "<quoteRole>" } }`
  where `quoteRole ∈ {sales, ops, commercial_manager, finance}` (auditor dropped per product decision).
  Empty/unset ⇒ feature OFF for everyone.
- `app_config['quote.settings']` = JSON (freight defaults, branding defaults, approval threshold,
  reminder cadence, counters seed) — admin editable.
- Enforced in **three** layers:
  1. **Nav** — `ACTION_PAGES['quotations']` gated + runtime check against the allowlist so the tile
     only shows for enabled users.
  2. **Server** — `requireQuoteAccess(user, env)` guard on every `/api/quotes/*` route, returning the
     caller's quote-role (or 404, matching host's tenancy-hide convention).
  3. **Approvals** — SoD + leg routing keyed on quote-role, not platform role.
- Admin UI: a Settings sub-page (super_admin/ops_admin) listing users with a toggle + quote-role
  select; writes the two config keys via `setConfig`. Instant grant/revoke, **no deploy**.

## Host conventions to honor
- CSP forbids inline JS → delegated `data-act`/`data-input`/`data-change` → top-level globals;
  `test/smoke.mjs` must resolve every handler + gate `PAGE_MAP`/`ACTION_PAGES`/`canAccessPage`.
- New SPA module `public/app.NN-quotes.js` (pick next free NN), wired into `public/index.html` load
  order and the smoke test's module list.
- Schema via self-heal `ensureQuoteSchema` (idempotent `CREATE TABLE IF NOT EXISTS`, single-statement
  per `.prepare`, once-per-isolate guard) — the prod DB is self-heal-managed; `migrations apply
  --remote` is known-broken. A migration file is added for parity/local but self-heal is the source of
  truth at runtime.

## Resolved decisions (folded from spec-validation r1 → r2)
The adversarial panel confirmed 31 findings (`adversarial-reviews/spec-validation.md`). All are folded in:
- **Pricing/GST/landed-cost/rounding/margin** → fully specified in `calc-spec.md`. **Integer-only money &
  rates (§0 I0): no float anywhere** — money is integer paise, rates are integer basis points (`_bp`),
  nothing float is stored/computed/hashed; a single `roundHalfAwayFromZero(int,int)` primitive (via
  `applyBp`) is the only rounding op; `tsc`-branded `Paise`/`Bp` + an I0 grep test enforce it. Explicit
  intra/inter-state rule keyed on `seller_state_code`, per-line ITC with a separate `purchase_cost_paise`
  basis for `mrp_discount`, pure-integer `ceilHalf` odd-paisa CGST split, round-to-rupee-ties-up,
  revenue-weighted `weighted_margin_bp`, computed-magnitude safe-integer guard, and 18 hand-authored named
  vectors as the acceptance oracle.
- **Tenancy** → `account_id` on every table + `denyClientCrossAccess` + per-tenant config keys.
- **Concurrency** → UNIQUE(quote_id,version)/(quote_id,seq)/(account_id,quote_no) + CAS on `current_version`
  + counter `RETURNING` + retry.
- **Hashing** → RFC 8785 canonicalization; length-prefixed audit preimage including account_id+quote_id+salt;
  a `verifyQuoteChain` verifier; document hashed with its hash field blanked.
- **Entitlement (4 roles: sales/ops/commercial_manager/finance — auditor dropped)** → role enum validated +
  fail-closed redaction (allowlist), full capability matrix (view/calc/create/submit/reject/approve/send/
  accept-lost/followup/snooze/audit-read columns), admin self-grant of approver roles forbidden + hash-chained
  `quote_entitlement_audit`, nav re-checks `/access` per navigation, optimistic `_ver` on both config blobs.
- **Redaction** → allowlist-based, deep (nested `payload_json`/`detail_json`), on all 8 response paths.
- **Approvals (r3 product decisions)** → author set = creator ∪ all version authors; **Manager leg
  auto-satisfied when an author holds `commercial_manager`** ("editor who is a manager needs no extra
  approval"); **Finance leg never auto-satisfied** (preserves ITC/₹5L control); else a non-author approver,
  else the configured **`fallback_approver_id`**, else 409; eligibility re-checked at act time (no deadlock);
  reject supersedes all rows; completion via guarded UPDATE; Finance basis = post-round-off GST-inclusive grand.
- **Reminders/lifecycle (r3)** → **3-step** `R1=send+2d, R2=send+7d, R3=valid_until−2d`, **no post-expiry
  nudge**; snooze only from PENDING (defers via `snooze_until`); cron fires reminders **then** sweeps
  SENT→EXPIRED; IST day boundaries; accept/lost/expire cancel PENDING+SNOOZED.
- **Idempotency** → required header, `(account_id,user_id,resolved-route,key)` scope, in-batch `IN_PROGRESS`
  reservation (no in-flight double-exec), 24h TTL, 409 on body mismatch.
- **18 calc vectors** → hand-authored, frozen in `calc-vectors.md` (the oracle); fixtures must reproduce it.

### Reminder rule defaults (`quote.settings.reminder_rules`, admin-editable)
`R1 = send_date + 2d`, `R2 = send_date + 7d`, `R3 = valid_until − 2d` (IST). No post-expiry nudge. A rule
whose offset lands ≤ send_date (very short validity) is skipped at seed time. The seeding test asserts the
three computed IST due-dates under a frozen clock.

## Explicitly out of scope for this milestone
WhatsApp/SMS reminder channels; e-sign; multi-currency; PostgreSQL migration (PRD D-6); importing the
external /giftsyz test suite. Deploy is **manual** (`npx wrangler deploy` by the user).
