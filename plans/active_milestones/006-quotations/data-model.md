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
  and cross-quote/cross-account replay. **Representation:** `payload_json`/`detail_json` are stored
  already-canonical and embedded in a preimage as the **exact stored string bytes** (never a re-parsed
  object), so writer and verifier are byte-identical (resolves `content-hash-payload-repr`); Task 2.D pins a
  known-answer `payload → hex digest` vector.

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
header columns `place_of_supply`/`itc_claimable_all`/`grand_total_paise` are display caches: the **v1 create
batch MUST populate all three** from the v1 computation, and each version-append CAS UPDATE refreshes them.
**submit always re-derives `itc_claimable_all` and `grand_total_paise` from the current version payload** (it
never trusts the header cache), so a created-then-submitted v1 quote cannot skip the Finance leg via a null
cache (resolves `header-version-desync`, `create-v1-header-cache-unset`).
| created_by | TEXT NOT NULL | SoD anchor |
| valid_until | TEXT NULL | `YYYY-MM-DD` end-of-day **Asia/Kolkata**; **nullable until send** (resolves `valid-until-default-at-create`): optional at create (if given, stored), otherwise set in the send batch to `sent_at + default_validity_days`. NOT NULL is enforced at send, not create. |
| sent_at | TEXT NULL | set in the send batch (IST date); the anchor for `valid_until` default and R1/R2 offsets |
| idem_key | TEXT NULL | the create's `Idempotency-Key`, stored so a stale-lease retry can detect the prior commit (resolves `idempotency-lease-double-execute`) |
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
| content_hash | TEXT NOT NULL | `sha256Hex(canonical([account_id, quote_id, version, genesis_salt, payload_json]))` — **domain-separated** like the audit chain so a version row cannot be transplanted across quotes/accounts and still verify (resolves `version-hash-no-domain-separation`); **UNIQUE(quote_id, version)** also serializes |
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
| assigned_to | TEXT NULL | userId assigned to this leg at submit (the eligible role-approver or the fallback) |
| assigned_as_fallback | INTEGER | 1 if `assigned_to` is standing in via `fallback_approver_id` (resolves `fallback-one-leg-not-enforced-act-time`) |
| actor_id / actor_name | TEXT NULL | the approver who acted (null until acted) |
| comments | TEXT NULL | |
| acted_at | TEXT NULL | |

**SoD + author-authority rule** (per product decision; resolves `sod-sole-approver-deadlock`,
`sod-author-set-inconsistent`, `manager-autosatisfy-scope`). The *author set* = `{quotes.created_by} ∪
{every quote_versions.created_by for the quote}` (ALL versions, used for the **disqualify-from-approving**
test). Per leg:
1. **Manager leg** — `AUTO_SATISFIED` at submit **only if the author of the _current_ version holds
   `commercial_manager`** (not merely any historical author — stops a single cosmetic manager edit from
   waiving review for all later versions; *"if the editor himself is a manager, no additional approval is
   needed"* applies to the person who actually priced the current version). Otherwise a `commercial_manager`
   ∉ author set must APPROVE; else the fallback approver (constraints below); else **409 `E_NO_ELIGIBLE_APPROVER`**.
2. **Finance leg** (required iff `!itc_claimable_all` OR grand ≥ threshold) — **never** auto-satisfied
   (confirmed): always a distinct `finance` approver ∉ author set; else a **finance-qualified** fallback; else 409.

**Fallback approver** (`quote.settings.fallback_approver_id`; resolves `fallback-approver-unreachable`,
`fallback-both-legs`, `fallback-in-author-set-deadlock`):
- Must be a `quote.enabled_users` member holding an **approver role** (`commercial_manager` or `finance`) —
  validated at settings PUT (422 otherwise) — so `requireQuoteAccess` + the capability matrix let them reach
  `approve`/`reject` through the normal gates (no magic bypass).
- May stand in for the **Manager** leg if they hold either approver role; may stand in for the **Finance**
  leg **only if they hold `finance`** (keeps the finance control from being cleared by a non-finance user).
- Is eligible only when **∉ author set** and **has not already satisfied the other leg of this quote**;
  if the only available fallback is in the author set or would take both legs, submit emits **409
  `E_NO_ELIGIBLE_APPROVER`** up front (no silent PENDING deadlock).

On reject or any version append, all prior `PENDING`/`APPROVED`/`AUTO_SATISFIED` rows → `SUPERSEDED`;
completion = all `required` legs in `APPROVED`∪`AUTO_SATISFIED` for `version == quotes.current_version`.
**Completion is evaluated both inside each approve batch AND at the end of the submit batch**, so a quote
whose every required leg is `APPROVED`∪`AUTO_SATISFIED` at submit transitions **directly to `APPROVED`**
rather than stalling in `PENDING_APPROVAL` (resolves `submit-all-auto-satisfied-never-completes`). Completion
is a **single conditional** `UPDATE quotes SET status='APPROVED' WHERE id=? AND status='PENDING_APPROVAL' AND
NOT EXISTS (a required leg for current_version still PENDING)` — never a SELECT-count-then-UPDATE — so two
concurrent approvals cannot both miss the flip (resolves `approval-completion-race`). **Act-time re-check**
applies the *full* rule, not just author membership: the actor must be the leg's `assigned_to` (or a still-
eligible role-approver), ∉ author set, hold the leg's required role when standing in for Finance, and **not
have already acted on the other leg of this quote** — so one fallback can never clear both legs
(resolves `fallback-one-leg-not-enforced-act-time`). A revoke-after-submit re-routes to a valid fallback
rather than deadlocking.

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
Config grants/revokes have no `quote_id`, so they append here (keyed on `account_id`), giving entitlement
changes the same tamper-evidence as quotes (resolves `admin-self-grant` audit gap + `entitlement-chain-salt-undefined`).
| id | account_id | seq (UNIQUE per account) | action (`grant`\|`revoke`\|`settings_change`) | actor_id | before_json | after_json | entry_hash | prev_hash | created_at |
**Per-account salt** lives in a dedicated `quote_account_salt(account_id PK, salt TEXT NOT NULL)` row minted
once per account. `entry_hash = sha256Hex(canonical([account_id, seq, action, actor_id, before_json,
after_json, prev_hash, account_salt]))` — the same length-prefixed, domain-separated framing as `quote_audit`.
`verifyQuoteChain` (or a sibling `verifyEntitlementChain`) recomputes and links this chain too; a `GET
/api/admin/quote-access` includes `{ verified, first_broken_seq }`.

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
(IST). **No post-expiry nudge.** At seed time a rule is **skipped** if its computed `due_date ≤ send_date`
**or `due_date ≥ valid_until`** — i.e. no reminder may be due on/after expiry, so a short-validity quote
cannot fire a nudge on the day it expires (resolves `reminder-overshoot-post-expiry`). This invariant
(`send_date < due_date < valid_until` for every seeded rule) makes the fire-then-expire cron ordering safe.
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
valid only from `PENDING` → `SNOOZED` with `today(IST) < snooze_until < valid_until` (a `SENT` rule cannot be
snoozed — 409; a `snooze_until ≥ valid_until` is rejected 422 so snooze can't push a nudge onto/after expiry
— resolves `snooze-reintroduces-post-expiry-nudge`). The predicate checks `snooze_until`, not `due_date`.
The cron's **fire step additionally skips any reminder whose quote already satisfies the expiry predicate
(`valid_until < today(IST)`)**, so even under cron lag no reminder fires for an expired quote (resolves
`reminder-fires-on-cron-lag-post-expiry`). `accept`/`lost` and the SENT→EXPIRED sweep cancel rules
`IN ('PENDING','SNOOZED')`. `CANCELLED` is terminal.

## `quote_followups`
| id | account_id | quote_id | actor_id | actor_name | channel (`call`\|`email`\|`meeting`\|`note`) | note | next_action_date (YYYY-MM-DD IST, NULL) | created_at |

## `quote_counters` (FY-aware; atomic UPSERT — resolves `fy-counter-seeding`)
| fy | account_id | last_no | — PK(account_id, fy). |
Allocation is a **single atomic UPSERT** that seeds the row on the first quote of a new FY/tenant and
increments otherwise: `INSERT INTO quote_counters(account_id, fy, last_no) VALUES(?,?,1) ON CONFLICT(account_id,fy)
DO UPDATE SET last_no = last_no + 1 RETURNING last_no` (single statement, no trigger, no read-then-write).
`quote_no` is formatted `<settings.number_prefix>/<fy>/<last_no padded 4>` (e.g. `GZ/25-26/0007`); FY boundary
is IST (Apr 1). Create retries on `UNIQUE(account_id, quote_no)` conflict.

## `quote_idempotency` (resolves `idempotency-key-semantics`, `idempotency-inflight-race`, `idempotency-lease-double-execute`)
| key | account_id | user_id | route | request_hash | status (`IN_PROGRESS`\|`DONE`) | response_json | status_code | lease_until | created_at |
— PK(account_id, user_id, **resolved route incl. `:id`**, key). The mutation **reserves the key by INSERTing
the PK row with `status=IN_PROGRESS` inside the same `batch()` as the write**; a concurrent second request
with the same key fails the PK and is served the reservation (replay/`409`), so double-click can never
create two quotes/approvals. On success the row flips to `DONE` with `response_json`/`status_code`. Replay:
a `DONE` row with same `request_hash` → cached response; same key + different `request_hash` → **409**; an
**`IN_PROGRESS` row → 409 `E_IN_PROGRESS` + `Retry-After`** (never a null body). The `IN_PROGRESS` row
carries a short **lease** (`lease_until`, ~30s). A row still `IN_PROGRESS` past its lease is treated as
abandoned (crashed worker), but recovery **does NOT blindly re-run** (that would mint a second quote_no): the
retry first **probes for the already-committed effect** — the `quotes` row (or approval/version) carrying
this `idem_key` — and, if found, returns that result and flips the row to `DONE`; it re-executes only when no
committed effect exists (resolves `idempotency-lease-double-execute`). So a committed-but-unflipped create
never yields a duplicate, and the key is not bricked for 24h. TTL 24h; expired key treated as absent.

## Config keys (`app_config`, per-tenant)
- `quote.enabled_users:<account_id>` → `{ "_ver": <int>, "users": { "<userId>": "<quoteRole>" } }`,
  `quoteRole ∈ {sales, ops, commercial_manager, finance}` (**auditor dropped** per product decision).
  Empty/unset ⇒ feature OFF. `_ver` gives optimistic concurrency (resolves `config-rmw-lost-update`); PUT
  sends expected `_ver`, 409 on mismatch. Malformed JSON ⇒ treated as empty (fail-closed) + admin warning
  (resolves `malformed-config-fail-closed`).
- `quote.settings:<account_id>` → `{ "_ver": <int>, seller_state_code, freight_default_paise:0,
  branding_default_paise:0, approval_threshold_paise:50000000, default_validity_days:30,
  reminder_rules:{R1_send_plus_days:2, R2_send_plus_days:7, R3_valid_minus_days:2},
  expiring_window_days:3, fallback_approver_id:<userId|null>, number_prefix }`. Same `_ver` optimistic
  concurrency (resolves `settings-config-no-ver`). PUT validates the full blob and **value constraints**
  (422 otherwise): `seller_state_code` valid; `default_validity_days` positive integer (**default 30** when
  omitted — resolves `default-validity-days-no-default`); `reminder_rules` offsets non-negative, `R1≤R2`,
  and none that would place a `due_date ≥ valid_until` for the default validity (resolves
  `reminder-rules-values-unvalidated`); `fallback_approver_id`, if set, resolves to an entitled user holding
  an approver role (resolves `fallback-approver-unreachable`). `expiring_window_days` feeds the Today
  "expiring" bucket.

## Indexes
`idx_quotes_acct_client`, `idx_quotes_acct_status`, `idx_qv_quote`, `idx_qlines_quote`,
`idx_qappr_quote_status`, `idx_qaudit_quote_seq`, `idx_qent_acct_seq`, `idx_qrem_due_status`,
`idx_qfu_quote`, plus the UNIQUE constraints named above.
