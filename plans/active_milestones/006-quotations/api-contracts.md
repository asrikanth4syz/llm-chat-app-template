# API Contracts: 006-quotations (r2 — tightenings folded)

All routes JWT-authenticated (host `getUser`/`requireUser`). **Tenancy:** every quote route resolves the
caller's `account_id` and filters by it; `:id*` routes also resolve the quote's `client_id` and run
`denyClientCrossAccess` → **404** on mismatch (resolves `tenancy-isolation-missing`). All day-boundary
logic (today/due/expiry/valid_until) is computed in **Asia/Kolkata** (resolves timezone findings);
timestamps are stored UTC.

## Entitlement guard & its one exemption
- Every `/api/quotes/*` route **except `GET /api/quotes/access`** first calls `requireQuoteAccess(user,env)`
  → `{ quoteRole }` or **404** (hide). `GET /api/quotes/access` is **explicitly exempt** and always returns
  **200** for any authenticated user (resolves `access-endpoint-self-contradiction`).
- `quoteRole` is validated against the enum `{sales, ops, commercial_manager, finance, auditor}` on read;
  an unrecognized/typo'd stored role **fails closed** (treated as no-access + full redaction).

### Capability matrix (resolves `role-capability-matrix-missing`) — default-deny
| quoteRole | create/edit | submit | approve leg | send | accept/lost | followup | sees cost/margin |
|---|---|---|---|---|---|---|---|
| sales | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| ops | — | — | — | — | — | ✅ | **❌ (redacted)** |
| commercial_manager | — | — | `manager` | — | — | ✅ | ✅ |
| finance | — | — | `finance` | — | — | ✅ | ✅ |
| auditor | — (read-only) | — | — | — | — | — | ✅ |
Anything not ticked → **403**. `auditor` is strictly read-only.

## Admin (entitlement/settings) — platform `super_admin|ops_admin`, routes under `/api/admin/*`
- `GET  /api/admin/quote-access` → `{ users:[{id,name,role}], enabled:{userId:quoteRole}, _ver }`.
- `PUT  /api/admin/quote-access` body `{ userId, quoteRole|null, _ver }` → upsert/remove in
  `quote.enabled_users:<account_id>`. **422** unless `quoteRole` is null or one of the five (case-sensitive);
  **409** on `_ver` mismatch (optimistic concurrency). An admin **may not** grant an approver role
  (`commercial_manager`/`finance`) to their **own** userId → **403** (resolves `admin-self-grant`). Every
  change appends to `quote_entitlement_audit` (hash-chained) with before/after.
- `GET/PUT /api/admin/quote-settings` → read/write `quote.settings:<account_id>` (incl. `seller_state_code`);
  PUT 422 if `seller_state_code` missing/invalid; change audited.

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
| `POST /:id/send` | APPROVED | SENT; gen document; seed R1–R8 |
| `POST /:id/accept` | SENT | ACCEPTED; cancel PENDING+SNOOZED reminders |
| `POST /:id/lost` `{reason}` | SENT, PENDING_APPROVAL, APPROVED | LOST (`reason` required); cancel reminders |
| (cron) | SENT & `valid_until < today(IST)` | EXPIRED; cancel reminders; audit `expired` |
Any other source status → **409**.

- **submit** computes required legs: `manager` always; `finance` iff `!itc_claimable_all` OR
  post-round-off, GST-inclusive `grand_total_paise ≥ settings.approval_threshold_paise` (default
  50000000 paise = ₹5,00,000, inclusive) — resolves `finance-threshold-basis`. If **no eligible non-creator
  approver** exists for a required leg, submit is rejected **409 `E_NO_ELIGIBLE_APPROVER`** before entering
  PENDING_APPROVAL (resolves `sod-sole-approver-deadlock`); a platform `super_admin` may be configured as
  fallback approver.
- **approve** guard: `actor_id ∉ {quotes.created_by} ∪ {every quote_versions.created_by for current
  version}` → **403 SoD** (resolves `sod-version-author`); caller's quoteRole must match the leg.
  Completion flip uses a guarded conditional UPDATE in the approving batch (resolves
  `approval-completion-race`). Audited + `pushNotification` to creator.

## Customer document
- `GET /api/quotes/:id/document` → latest `quote_documents.content_b64` + `content_hash` (always redacted;
  hash computed over the body with the hash field blanked, then stamped — verifiable per `doc-hash-self-reference`).

## Reminders / follow-ups / Today / bell (all IST; concrete predicates — resolves `today-bell-bucket-thresholds`)
- `GET  /api/quotes/today` → `{ due_reminders, followups_due, expiring }` where `due_reminders` =
  reminders `status∈{PENDING,SNOOZED}` & `due_date ≤ today(IST)`; `followups_due` = `next_action_date ≤
  today(IST)`; `expiring` = SENT quotes with `valid_until` within `settings.expiring_window_days` (default 3).
- `GET  /api/quotes/bell` → `{ count }` = my PENDING approval legs (leg matches my quoteRole & I ∉
  contributor set) + my follow-ups due today(IST).
- `POST /api/quotes/:id/reminders/:rid/snooze` `{ until }` (valid from PENDING/SENT; → SNOOZED).
- `POST /api/quotes/:id/followups` `{ channel, note, next_action_date? }` → append + audit.
- Cron `runQuoteReminderPass(env)` added to `scheduled()`: fires due reminders (dedup per `quote_reminders`
  state machine), AND transitions SENT→EXPIRED past `valid_until(IST)` (resolves `expired-transition`).

## Idempotency (resolves `idempotency-key-semantics`)
`Idempotency-Key` header **required** on all mutating routes (create/put/submit/approve/reject/send/accept/
lost/followups/snooze/admin PUTs). Scoped `(account_id, user_id, route, key)`, stored 24h in
`quote_idempotency`. Replay same key+body → cached response; same key + different body → **409**.

## Error conventions
`401` no/invalid JWT · `403` authenticated but role/SoD/self-grant denies · `404` not entitled OR
cross-tenant hide · `409` illegal state transition / `_ver` mismatch / idempotency-body-mismatch /
no-eligible-approver · `422` calc/validation error `{field, code}`.
