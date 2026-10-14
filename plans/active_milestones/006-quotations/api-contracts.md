# API Contracts: 006-quotations (r2 — tightenings folded)

All routes JWT-authenticated (host `getUser`/`requireUser`). **Tenancy:** every quote route resolves the
caller's `account_id` and filters by it; `:id*` routes also resolve the quote's `client_id` and run
`denyClientCrossAccess` → **404** on mismatch (resolves `tenancy-isolation-missing`). All day-boundary
logic (today/due/expiry/valid_until) is computed in **Asia/Kolkata** (resolves timezone findings);
timestamps are stored UTC.

## Entitlement guard & its one exemption
- Every `/api/quotes/*` route **except `GET /api/quotes/access`** first calls `requireQuoteAccess(user,env)`
  → `{ quoteRole }` or **404** (hide). `GET /api/quotes/access` is **explicitly exempt** and always returns
  **200** `{ enabled: boolean, quoteRole: string|null }` for any authenticated user — the nav gates the tile
  on `enabled` (resolves `access-endpoint-self-contradiction`, `access-endpoint-body-undefined`).
- `quoteRole` is validated against the enum `{sales, ops, commercial_manager, finance}` (**auditor dropped**
  per product decision) on read; an unrecognized/typo'd stored role **fails closed** (no-access + full
  redaction).

### Capability matrix (resolves `role-capability-matrix-missing`, `capability-matrix-missing-actions`) — default-deny
Every reachable action has a column; anything not ✅ → **403**. (view = list/detail/versions/document/today/bell.)
| quoteRole | view | calc | create/edit | submit | reject | approve leg | send | accept/lost | followup | snooze | audit read | sees cost/margin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sales | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ops | ✅ | ✅ | — | — | — | — | — | — | ✅ | ✅ | ✅ | **❌ (redacted)** |
| commercial_manager | ✅ | ✅ | — | — | `manager` | `manager` | — | — | ✅ | ✅ | ✅ | ✅ |
| finance | ✅ | ✅ | — | — | `finance` | `finance` | — | — | ✅ | ✅ | ✅ | ✅ |
- **reject** is tied to the leg an approver owns (a `manager`/`finance` user may reject their own pending leg,
  sending the quote back to DRAFT). `ops` is view + follow-up only, always cost-redacted. The configured
  `fallback_approver_id` gains the approve/reject capability for whichever leg it is standing in for.

## Admin (entitlement/settings) — platform `super_admin|ops_admin`, routes under `/api/admin/*`
- `GET  /api/admin/quote-access` → `{ users:[{id,name,role}], enabled:{userId:quoteRole}, _ver }`.
- `PUT  /api/admin/quote-access` body `{ userId, quoteRole|null, _ver }` → upsert/remove in
  `quote.enabled_users:<account_id>`. **422** unless `quoteRole` is null or one of the **four**
  `{sales, ops, commercial_manager, finance}` (case-sensitive); **409** on `_ver` mismatch. An admin **may
  not** grant an approver role (`commercial_manager`/`finance`) to their **own** userId → **403** (resolves
  `admin-self-grant`). Every change appends to `quote_entitlement_audit` (hash-chained) with before/after.
- `GET/PUT /api/admin/quote-settings` → read/write `quote.settings:<account_id>` (incl. `seller_state_code`,
  `fallback_approver_id`, `expiring_window_days`, 3-step `reminder_rules`). PUT validates the full blob,
  **422** on invalid `seller_state_code`; **409** on `_ver` mismatch (resolves `settings-config-no-ver`);
  change audited.

## Calc preview (pure engine; no persistence)
- `POST /api/quotes/calc` body `QuoteCalcInput` (see `calc-spec.md §1`; server fills `seller_state_code`
  from settings and resolves catalogue GST rates per `calc-spec §6`). → computed lines + totals (all paise).
  Validation per `calc-spec §7` → **422 {field,code}** on violation. Response deep-redacted for `ops`.

## Quote CRUD + immutable versions
- `GET  /api/quotes?status=&client_id=&page=&page_size=` → tenant-scoped list; `page_size` default 50,
  max 100 (resolves `unbounded-lines`). Redacted.
- `POST /api/quotes` body `{ client_id, place_of_supply, valid_until?, lines:[Line] }` (full body —
  resolves `valid-until-source-undefined`); `valid_until` defaults to `send_date + settings.default_validity_days`,
  must be a future date (IST) at send. Allocates `quote_no` via counter `RETURNING` + retry; writes v1
  `quote_versions`+`quote_lines`+`quote_audit(created)` in one `batch()`. → `{ id, quote_no, version:1 }`.
- `GET  /api/quotes/:id` → header + current version + lines + approvals + audit summary, **all passed through
  `redactForQuoteRole`** including nested `payload_json`/`detail_json`.
- `PUT  /api/quotes/:id` (DRAFT only; **409** otherwise) → appends a new immutable version (CAS on
  `current_version`); any pricing-affecting change (`place_of_supply`/`itc_claimable`/lines) forces a new
  version; supersedes prior approval rows. Writes `quote_audit(version_added)` with `prev_hash`.
- `GET  /api/quotes/:id/versions` → `{ versions:[{version,content_hash,created_at}], verified, first_broken_version }`
  (the verifier recomputes hashes + linkage — resolves `no-chain-verifier`).

## Lifecycle + approvals (SoD) — full transition matrix (resolves `accept-lost-state-guards`)
| endpoint | allowed source status | result |
|---|---|---|
| `POST /:id/submit` | DRAFT | PENDING_APPROVAL (or 409 — see deadlock) |
| `POST /:id/approve` `{leg,comments?}` | PENDING_APPROVAL | APPROVED when all required legs done |
| `POST /:id/reject` `{leg,comments}` | PENDING_APPROVAL | DRAFT; **all approval rows → SUPERSEDED** |
| `POST /:id/send` | APPROVED | SENT; gen document; seed R1–R3 reminders |
| `POST /:id/accept` | SENT | ACCEPTED; cancel PENDING+SNOOZED reminders |
| `POST /:id/lost` `{reason}` | SENT, PENDING_APPROVAL, APPROVED | LOST (`reason` required); cancel reminders |
| (cron) | SENT & `valid_until < today(IST)` | EXPIRED; cancel reminders; audit `expired` |
Any other source status → **409**.

- **submit** computes required legs: `manager` always; `finance` iff `!itc_claimable_all` OR post-round-off,
  GST-inclusive `grand_total_paise ≥ settings.approval_threshold_paise` (default 50000000 paise = ₹5,00,000,
  inclusive). Then applies the **SoD + author-authority rule** (see data-model `quote_approvals`):
  - *author set* = `{created_by} ∪ {every quote_versions.created_by}` (ALL versions).
  - **Manager leg** → `AUTO_SATISFIED` if any author holds `commercial_manager`; else a non-author
    `commercial_manager` must approve; else `settings.fallback_approver_id`; else **409 `E_NO_ELIGIBLE_APPROVER`**.
  - **Finance leg** → **never** auto-satisfied by an authoring finance user (confirmed product decision —
    preserves the ITC/₹5L control); a non-author `finance` user must approve; else the fallback approver; else 409.
  - Eligibility is re-checked at **act time** with the same author set, so a revoke-after-submit falls back
    to `fallback_approver_id` rather than deadlocking (resolves `sod-sole-approver-deadlock`).
- **approve** guard: `actor_id ∉` author set → **403 SoD** (unless the caller is `fallback_approver_id`
  standing in for the leg, and is not themselves in the author set); caller's quoteRole must match the leg
  (or caller is the fallback approver). Completion = all `required` legs in `APPROVED`∪`AUTO_SATISFIED` for
  `current_version`, flipped via a guarded conditional UPDATE in the approving batch (resolves
  `approval-completion-race`, `sod-author-set-inconsistent`). Audited + `pushNotification` to creator.

## Customer document
- `GET /api/quotes/:id/document` → latest `quote_documents.content_b64` + `content_hash` (always redacted;
  hash computed over the body with the hash field blanked, then stamped — verifiable per `doc-hash-self-reference`).

## Reminders / follow-ups / Today / bell (all IST; concrete predicates — resolves `today-bell-bucket-thresholds`)
Reminders are the **3-step cadence** (`R1=send+2d`, `R2=send+7d`, `R3=valid_until−2d`; no post-expiry nudge).
- `GET  /api/quotes/today` → `{ due_reminders, followups_due, expiring }` where `due_reminders` =
  reminders due per the state machine (PENDING & `due_date ≤ today(IST)`, or SNOOZED & `snooze_until ≤
  today(IST)`); `followups_due` = `next_action_date ≤ today(IST)`; `expiring` = SENT quotes with
  `valid_until` within `settings.expiring_window_days` (default 3).
- `GET  /api/quotes/bell` → `{ count }` = my PENDING approval legs (leg matches my quoteRole & I ∉ author
  set) + my follow-ups due today(IST).
- `POST /api/quotes/:id/reminders/:rid/snooze` `{ until }` — valid **only from PENDING** → SNOOZED with a
  future `snooze_until` (a SENT rule cannot be snoozed → 409; resolves `reminder-snooze-state-machine`).
- `POST /api/quotes/:id/followups` `{ channel, note, next_action_date? }` → append + audit.
- Cron `runQuoteReminderPass(env)`: **(1) fires due reminders first, then (2) sweeps SENT→EXPIRED** for
  `valid_until < today(IST)` (ordering fixed so no reminder is cancelled before it fires — the R8/expiry
  collision is gone since there is no post-expiry rule). EXPIRED cancels PENDING+SNOOZED reminders, audits
  `expired` (resolves `expired-transition`).

## Idempotency (resolves `idempotency-key-semantics`, `idempotency-inflight-race`)
`Idempotency-Key` header **required** on all mutating routes (create/put/submit/approve/reject/send/accept/
lost/followups/snooze/admin PUTs). Scoped `(account_id, user_id, resolved-route-incl-:id, key)`. The handler
**reserves the key by INSERTing the `quote_idempotency` PK row (`IN_PROGRESS`) inside the same `batch()` as
the mutation**, so a concurrent same-key request fails the PK and is served the reservation (never double-
executes). On success the row flips to `DONE` with the cached response. Replay same key+body → cached
response; same key + different `request_hash` → **409**; TTL 24h (expired key treated as absent).

## Error conventions
`401` no/invalid JWT · `403` authenticated but role/SoD/self-grant denies · `404` not entitled OR
cross-tenant hide · `409` illegal state transition / `_ver` mismatch / idempotency-body-mismatch /
no-eligible-approver · `422` calc/validation error `{field, code}`.
