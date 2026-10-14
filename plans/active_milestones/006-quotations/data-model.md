# Data Model: 006-quotations (r2 — tightenings folded)

All tables created idempotently by `ensureQuoteSchema(env)` (self-heal, one statement per
`env.DB.prepare(...).run()`, once-per-isolate guard `_quoteSchemaReady`). Parity migration file
`migrations/00NN_quotations.sql` mirrors these (single statements, **no triggers** — the self-heal runner
splits on `;`). Immutability/append-only is enforced in app-layer `env.DB.batch()` with the constraints
below, never by SQL triggers.

## Cross-cutting decisions folded from spec-validation r1
- **Integer-only money & rates** (resolves `money-stored-as-real-float`, `rates-stored-as-real-drift`):
  **no `REAL` column anywhere in the quote feature.** Money is `INTEGER` paise; rates are `INTEGER`
  basis points (`*_bp`, `18% → 1800`). Nothing float is stored, computed, or hashed (calc-spec §0 I0).
  Presentation converts paise/bp → strings only at the SPA edge.
- **Tenancy** (resolves `tenancy-isolation-missing`): every `quote_*` table carries `account_id TEXT NOT
  NULL`. Every read/write filters by the caller's `account_id`; a mismatch is a **404** (host convention),
  and `denyClientCrossAccess(user, client_id)` additionally guards `client_id` on create/list. The
  entitlement config keys are **per-tenant**: `quote.enabled_users:<account_id>` and
  `quote.settings:<account_id>`.
- **Concurrency** (resolves `concurrent-version-append-race`, `quote-counter-allocation-race`,
  `cas-zero-row-not-abort`): the **authoritative serializer is `UNIQUE(quote_id, version)`** — on D1's
  single writer only one `version=N` INSERT can commit; a racing second batch aborts on the constraint and
  the handler retries by re-reading `current_version`. The CAS `UPDATE quotes SET current_version=:v, …
  WHERE id=:id AND current_version=:expected` is a guard, **not** a batch-aborter: a 0-row UPDATE does NOT
  throw on D1, so the handler inspects `meta.changes` and treats 0 as a retry. (We never rely on "0 rows
  aborts the batch".) The FY counter increments via a single atomic UPSERT (see `quote_counters`), not
  read-then-write.
- **Hashing** (resolves `hash-canonicalization-undefined`, `genesis-salt-not-persisted`): `canonical(x)` =
  RFC 8785 (JSON Canonicalization Scheme) with all money as integer-paise numbers; `sha256Hex(canonical(x))`.
  Audit preimage is a length-prefixed JSON array (not a `‖` join) that **includes `account_id`, `quote_id`,
  and a stored `genesis_salt`** (a random 16-byte hex minted once per quote at creation, column on `quotes`;
  the entitlement chain uses a per-account salt row). The verifier reads the stored salt to recompute every
  hash, so the chain is reproducible; the salt + account_id + quote_id framing blocks delimiter injection
  and cross-quote/cross-account replay.

## `quotes` (header — only non-pricing metadata mutable while DRAFT)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `q_<ulid>` |
| account_id | TEXT NOT NULL | tenant scope |
| genesis_salt | TEXT NOT NULL | random 16-byte hex, minted once at creation; read by `verifyQuoteChain` (resolves `genesis-salt-not-persisted`) |
| quote_no | TEXT NOT NULL | FY-aware; **UNIQUE(account_id, quote_no)** |
| client_id | TEXT NOT NULL | FK `clients.id`; guarded by `denyClientCrossAccess` |
| place_of_supply | TEXT NOT NULL | **cache of current version**; refreshed in the version-append CAS UPDATE (resolves `header-version-desync`) |
| status | TEXT | `DRAFT`→`PENDING_APPROVAL`→`APPROVED`→`SENT`→(`ACCEPTED`\|`LOST`\|`EXPIRED`) |
| current_version | INTEGER NOT NULL | CAS target; latest `quote_versions.version` |
| itc_claimable_all | INTEGER | **cache**: 1 iff every current-version line claimable; refreshed in the CAS UPDATE; drives Finance leg (`!all`) |
| grand_total_paise | INTEGER | cache from current version; refreshed in the CAS UPDATE; INTEGER paise |

**Authoritative read for pricing/tax/approval is always the current `quote_versions.payload_json`.** The
header columns `place_of_supply`/`itc_claimable_all`/`grand_total_paise` are caches kept in sync by being
set **in the same CAS UPDATE** that advances `current_version`; submit and the Finance-leg test read them
from (or re-derive them from) the current version, never from a stale header. (Resolves `header-version-desync`.)
| created_by | TEXT NOT NULL | SoD anchor |
| valid_until | TEXT NOT NULL | `YYYY-MM-DD`, end-of-day **Asia/Kolkata**; default `send_date + settings.default_validity_days` |
| lost_reason | TEXT NULL | required when `LOST` (≤500 chars) |
| created_at / updated_at | TEXT | `datetime('now')` (UTC stored; compared in IST — see below) |

Mutable while DRAFT: **non-pricing metadata only**. Any change to `place_of_supply`, `itc_claimable`, or
lines **appends a new version** (recomputed + rehashed) rather than mutating the header
(resolves `header-mutation-desyncs-version`).

## `quote_versions` (immutable snapshot — append-only)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `qv_<ulid>` |
| account_id / quote_id | TEXT NOT NULL | |
| version | INTEGER NOT NULL | **UNIQUE(quote_id, version)** — blocks the concurrent-append fork |
| payload_json | TEXT | full computed snapshot (money as integer paise); canonicalized before hashing |
| content_hash | TEXT NOT NULL | `sha256Hex(canonical(payload_json))`; **UNIQUE(quote_id, version)** already serializes |
| prev_hash | TEXT NULL | previous version's `content_hash` (NULL for v1) |
| created_by | TEXT NOT NULL | version author — part of SoD contributor set |
| created_at | TEXT | |
**Append rule:** new row + `UPDATE quotes SET current_version=:v, grand_total_paise=:g,
place_of_supply=:pos, itc_claimable_all=:itc WHERE id=:id AND current_version=:expected` in one `batch()`
(the UPDATE refreshes all header caches, resolving `header-version-desync`). The `UNIQUE(quote_id,version)`
on the new row is what actually serializes concurrent appends; the handler also checks the UPDATE's
`meta.changes` and, on 0, retries by re-reading (a 0-row UPDATE does not throw — resolves
`cas-zero-row-not-abort`). Rows are never UPDATEd/DELETEd.

## `quote_lines` (denormalized query view; source of truth is `quote_versions.payload_json`)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| account_id / quote_id / version | TEXT/TEXT/INTEGER | |
| sku | TEXT NULL | catalogue SKU (null = ad-hoc) |
| description | TEXT | |
| qty | INTEGER | > 0 |
| pricing_mode | TEXT | `cost_markup` \| `mrp_discount` |
| purchase_cost_paise / markup_bp / mrp_paise / discount_bp | INTEGER (NULL by mode) | all integers; `markup_bp`/`discount_bp` are basis points; `mrp_discount` carries its own `purchase_cost_paise` cost basis (not the discounted MRP) |
| freight_alloc_paise / branding_cost_paise | INTEGER | cost inputs, **per unit** |
| sale_gst_bp / purchase_gst_bp | INTEGER | per line, basis points; server-resolved (bp) for catalogued SKUs |
| itc_claimable | INTEGER | **per line** (0/1) |
| landed_cost_paise / unit_price_paise / line_taxable_paise / line_gst_paise / cgst_paise / sgst_paise / igst_paise / line_margin_paise | INTEGER | computed outputs (all paise) |
Cost/margin columns are **deep-redacted** server-side for non-cost quote-roles (see api-contracts redaction).

## `quote_approvals` (version-bound; superseded on reject/version bump)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| account_id / quote_id | TEXT NOT NULL | |
| version | INTEGER NOT NULL | approval binds to the exact version |
| leg | TEXT | `manager` \| `finance` |
| required | INTEGER | computed at submit |
| status | TEXT | `PENDING`\|`APPROVED`\|`REJECTED`\|`SUPERSEDED`\|`AUTO_SATISFIED` |
| actor_id / actor_name | TEXT NULL | the approver (null until acted) |
| comments | TEXT NULL | |
| acted_at | TEXT NULL | |

**SoD + author-authority rule** (per product decision; resolves `sod-sole-approver-deadlock`,
`sod-author-set-inconsistent`). The *author set* = `{quotes.created_by} ∪ {every quote_versions.created_by
for the quote}` (ALL versions, not just current). Per leg:
1. **Manager leg** — if any member of the author set holds the `commercial_manager` quote-role, the leg is
   recorded `AUTO_SATISFIED` at submit with `actor_id` = that author (the authoring manager's authority
   covers it; *"if the editor himself is a manager, no additional approval is needed"*). Otherwise a user
   with `commercial_manager` who is **not** in the author set must APPROVE it; if none exists, the configured
   **fallback approver** (`quote.settings.fallback_approver_id`, below) may APPROVE it; if neither exists,
   submit is rejected **409 `E_NO_ELIGIBLE_APPROVER`**.
2. **Finance leg** (required iff `!itc_claimable_all` OR grand ≥ threshold) — **not** auto-satisfied by an
   authoring finance user (confirmed product decision): it is the high-value ITC/₹5L control, so it always
   needs a distinct `finance` approver ∉ author set (else the fallback approver, else 409).

On reject or any version append, all prior `PENDING`/`APPROVED`/`AUTO_SATISFIED` rows → `SUPERSEDED`;
completion (all `required` legs in `APPROVED`∪`AUTO_SATISFIED`) is computed only over rows where
`version == quotes.current_version`, via a guarded conditional UPDATE inside the approving batch (resolves
`approval-completion-race`). Eligibility is re-checked at act time with the **same** author set as submit,
so a revoke-after-submit that empties a leg falls back to the fallback approver rather than deadlocking.

## `quote_audit` (hash-chained, append-only — tamper-evident)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| account_id / quote_id | TEXT NOT NULL | |
| seq | INTEGER NOT NULL | **UNIQUE(quote_id, seq)** |
| action | TEXT | `created`\|`version_added`\|`submitted`\|`approved`\|`rejected`\|`sent`\|`accepted`\|`lost`\|`expired`\|`reminder_sent`\|`followup_logged` |
| actor_id | TEXT NOT NULL | actor_id used in preimage (not name) |
| detail_json | TEXT | |
| entry_hash | TEXT NOT NULL | `sha256Hex(canonical([account_id, quote_id, seq, action, actor_id, detail_json, prev_hash, genesis_salt]))` |
| prev_hash | TEXT NULL | previous entry's `entry_hash` |
| created_at | TEXT | |
A **verifier** (`verifyQuoteChain`) recomputes every `content_hash`/`entry_hash` and checks linkage;
exposed via `GET /:id/versions` and `/audit` as `{verified, first_broken_version}` (resolves
`no-chain-verifier`).

## `quote_entitlement_audit` (hash-chained — config changes)
Config grants/revokes have no `quote_id`, so they append here (same chaining, keyed on `account_id`),
giving entitlement changes the same tamper-evidence as quotes (resolves the `admin-self-grant` audit gap).
| id | account_id | seq (UNIQUE per account) | action (`grant`\|`revoke`\|`settings_change`) | actor_id | before_json | after_json | entry_hash | prev_hash | created_at |

## `quote_documents` (immutable customer doc — mirrors `dc_documents`)
| col | type | notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| account_id / quote_id / version | TEXT/TEXT/INTEGER | |
| content_b64 | TEXT | redacted customer doc (no cost/margin/ITC); hash field **blanked** in hashed bytes |
| content_hash | TEXT | `sha256Hex(canonical-body-with-hash-field-blank)`; stamped after (resolves `doc-hash-self-reference`) |
| mime_type | TEXT | `application/pdf` or `text/html` |
| created_by / created_at | TEXT | |

## `quote_reminders` (3-step cadence — explicit state machine)
Per product decision: **3 rules** — `R1 = send_date + 2d`, `R2 = send_date + 7d`, `R3 = valid_until − 2d`
(IST). **No post-expiry nudge** (this removes the R8-vs-expiry ordering problem entirely). If an offset
computes to ≤ `send_date` (very short validity), that rule is skipped at seed time (not bunch-fired).
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| account_id / quote_id | TEXT NOT NULL | |
| rule | TEXT | `R1`\|`R2`\|`R3`; **UNIQUE(quote_id, rule)** |
| due_date | TEXT | `YYYY-MM-DD` IST; from `quote.settings.reminder_rules` |
| status | TEXT | `PENDING`\|`SENT`\|`SNOOZED`\|`CANCELLED` |
| sent_at | TEXT NULL | |
| snooze_until | TEXT NULL | |
**State machine** (resolves `reminder-snooze-state-machine`): the cron fires a rule when
`status = 'PENDING' AND due_date ≤ today(IST)`, OR `status = 'SNOOZED' AND snooze_until ≤ today(IST)` →
set `SENT`, `sent_at`. **Dedup = one `SENT` per (quote_id, rule)**; a `SENT` rule is not re-fired. Snooze is
valid only from `PENDING` → `SNOOZED` with a future `snooze_until` (a `SENT` rule cannot be snoozed — 409);
this makes snooze a genuine deferral (the predicate checks `snooze_until`, not `due_date`). `accept`/`lost`,
and the SENT→EXPIRED cron sweep, cancel rules `IN ('PENDING','SNOOZED')`. `CANCELLED` is terminal.

## `quote_followups`
| id | account_id | quote_id | actor_id | actor_name | channel (`call`\|`email`\|`meeting`\|`note`) | note | next_action_date (YYYY-MM-DD IST, NULL) | created_at |

## `quote_counters` (FY-aware; atomic UPSERT — resolves `fy-counter-seeding`)
| fy | account_id | last_no | — PK(account_id, fy). |
Allocation is a **single atomic UPSERT** that seeds the row on the first quote of a new FY/tenant and
increments otherwise: `INSERT INTO quote_counters(account_id, fy, last_no) VALUES(?,?,1) ON CONFLICT(account_id,fy)
DO UPDATE SET last_no = last_no + 1 RETURNING last_no` (single statement, no trigger, no read-then-write).
`quote_no` is formatted `<settings.number_prefix>/<fy>/<last_no padded 4>` (e.g. `GZ/25-26/0007`); FY boundary
is IST (Apr 1). Create retries on `UNIQUE(account_id, quote_no)` conflict.

## `quote_idempotency` (resolves `idempotency-key-semantics`, `idempotency-inflight-race`)
| key | account_id | user_id | route | request_hash | status (`IN_PROGRESS`\|`DONE`) | response_json | status_code | created_at |
— PK(account_id, user_id, **resolved route incl. `:id`**, key). The mutation **reserves the key by INSERTing
the PK row with `status=IN_PROGRESS` inside the same `batch()` as the write**; a concurrent second request
with the same key fails the PK and is served the reservation (replay/`409`), so double-click can never
create two quotes/approvals. On success the row flips to `DONE` with `response_json`/`status_code`. Replay
same key+body → cached response; same key + different `request_hash` → **409**. TTL 24h; an expired key is
treated as absent (documented: a replay after 24h may re-execute).

## Config keys (`app_config`, per-tenant)
- `quote.enabled_users:<account_id>` → `{ "_ver": <int>, "users": { "<userId>": "<quoteRole>" } }`,
  `quoteRole ∈ {sales, ops, commercial_manager, finance}` (**auditor dropped** per product decision).
  Empty/unset ⇒ feature OFF. `_ver` gives optimistic concurrency (resolves `config-rmw-lost-update`); PUT
  sends expected `_ver`, 409 on mismatch. Malformed JSON ⇒ treated as empty (fail-closed) + admin warning
  (resolves `malformed-config-fail-closed`).
- `quote.settings:<account_id>` → `{ "_ver": <int>, seller_state_code, freight_default_paise,
  branding_default_paise, approval_threshold_paise:50000000, default_validity_days,
  reminder_rules:{R1_send_plus_days:2, R2_send_plus_days:7, R3_valid_minus_days:2},
  expiring_window_days:3, fallback_approver_id:<userId|null>, number_prefix }`. Same `_ver` optimistic
  concurrency as above (resolves `settings-config-no-ver`); PUT validates the full blob shape, 422 on
  invalid `seller_state_code`. `fallback_approver_id` is the user who may approve a leg when no eligible
  non-author approver exists (resolves the sole-approver escape hatch); `expiring_window_days` feeds the
  Today "expiring" bucket (resolves `expiring-window-days-missing-from-settings`).

## Indexes
`idx_quotes_acct_client`, `idx_quotes_acct_status`, `idx_qv_quote`, `idx_qlines_quote`,
`idx_qappr_quote_status`, `idx_qaudit_quote_seq`, `idx_qent_acct_seq`, `idx_qrem_due_status`,
`idx_qfu_quote`, plus the UNIQUE constraints named above.
