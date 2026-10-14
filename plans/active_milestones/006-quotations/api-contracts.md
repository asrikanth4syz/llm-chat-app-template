# API Contracts: 006-quotations

All routes JWT-authenticated (host `getUser`/`requireUser`). Every `/api/quotes/*` route first calls
`requireQuoteAccess(user, env)` → returns `{ quoteRole }` or a **404** (host convention: hide, don't
401, when feature not entitled). Responses are role-redacted server-side: `ops` quote-role never
receives `purchase_cost`, `markup_pct`, `margin`, `landed_cost`, `itc_*`. Mutations are idempotent via
an `Idempotency-Key` header (stored like the Smart Paste idem pattern). Route registration goes in the
existing block near `src/index.ts:4480`.

## Entitlement / settings (admin — super_admin|ops_admin)
- `GET  /api/quotes/access` → `{ enabled: bool, quoteRole: string|null }` (for the current user; drives nav).
- `GET  /api/admin/quote-access` → `{ users:[{id,name,role}], enabled:{userId:quoteRole} }`.
- `PUT  /api/admin/quote-access` body `{ userId, quoteRole|null }` → upsert/remove in `quote.enabled_users`. Audited.
- `GET  /api/admin/quote-settings` / `PUT /api/admin/quote-settings` → read/write `quote.settings`.

## Calc preview (pure engine, no persistence)
- `POST /api/quotes/calc` body `{ place_of_supply, itc_claimable, lines:[{sku?,qty,pricing_mode,purchase_cost?,markup_pct?,mrp?,discount_pct?,freight_alloc?,branding_cost?,gst_rate}] }`
  → `{ lines:[{unit_price,landed_cost?,line_total,line_gst,margin?}], totals:{ subtotal, cgst, sgst, igst, grand_total, weighted_margin? }, rounding:{...} }`.
  Thin wrapper over `src/quote_calc.ts`; cost/margin stripped for `ops`.

## Quote CRUD + versions
- `GET  /api/quotes?status=&client_id=&page=` → list (redacted).
- `POST /api/quotes` → create DRAFT; allocates `quote_no` via `quote_counters`+`currentFY`; writes v1
  `quote_versions` + `quote_lines` + `quote_audit(created)` in one `batch()`. → `{ id, quote_no, version:1 }`.
- `GET  /api/quotes/:id` → header + current version + lines + approvals + audit summary (redacted).
- `PUT  /api/quotes/:id` (DRAFT only) → **appends a new immutable version** (never mutates prior);
  advances `current_version`; writes `quote_audit(version_added)` with `prev_hash` chain. 409 if not DRAFT.
- `GET  /api/quotes/:id/versions` → list of `{version, content_hash, created_at}` (chain verifiable).

## Lifecycle + approvals (SoD)
- `POST /api/quotes/:id/submit` → compute required legs (`manager` always; `finance` iff
  `itc_claimable=0` OR `grand_total≥500000`), create `quote_approvals` rows (PENDING), status→
  `PENDING_APPROVAL`. Rejects if caller would be sole approver (SoD) — pre-check only; actual block at act time.
- `POST /api/quotes/:id/approve` body `{ leg, comments? }` → guard: `actor_id ≠ created_by` (**403 SoD**),
  caller quote-role matches leg (`commercial_manager`→manager, `finance`→finance). When all required
  legs APPROVED → status `APPROVED`. Audited + `pushNotification` to creator.
- `POST /api/quotes/:id/reject` body `{ leg, comments }` → status `DRAFT` (back to editing). Audited.
- `POST /api/quotes/:id/send` (APPROVED only) → generate `quote_documents` (redacted + hashed),
  status→`SENT`, seed `quote_reminders` (R1–R8 due dates). Returns `{ document_hash }`.
- `POST /api/quotes/:id/accept` → status `ACCEPTED`; cancels pending reminders.
- `POST /api/quotes/:id/lost` body `{ reason }` → status `LOST`; cancels reminders.

## Customer document
- `GET /api/quotes/:id/document` → latest `quote_documents.content_b64` + `content_hash`
  (customer-safe; always redacted regardless of role).

## Reminders / follow-ups / Today
- `GET  /api/quotes/today` → `{ due_reminders:[...], followups_due:[...], expiring:[...] }` (drives Today page).
- `GET  /api/quotes/bell` → `{ count }` (badge: pending approvals for me + my due follow-ups).
- `POST /api/quotes/:id/reminders/:rid/snooze` body `{ until }`.
- `POST /api/quotes/:id/followups` body `{ channel, note, next_action_date? }` → append `quote_followups` + audit.
- Cron: `runQuoteReminderPass(env)` added to `scheduled()` (gated on an existing or new cron expr),
  dedup on `(quote_id,rule)`, sends via `pushNotification`, marks `SENT`.

## Error conventions (match host)
`401` no/invalid JWT · `403` authenticated but role/SoD denies · `404` not entitled OR cross-tenant
hide · `409` illegal state transition (e.g. edit non-DRAFT) · `422` calc/validation error.
