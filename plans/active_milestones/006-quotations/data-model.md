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
- **Concurrency** (resolves `concurrent-version-append-race`, `quote-counter-allocation-race`): UNIQUE
  constraints + conditional (compare-and-swap) `UPDATE ... WHERE current_version=:expected` inside the
  batch; a 0-row result or a UNIQUE violation fails the batch and the handler retries. SQLite/D1 enforces
  UNIQUE within a batch.
- **Hashing** (resolves `hash-canonicalization-undefined`): `canonical(x)` = RFC 8785 (JSON Canonicalization
  Scheme) with all money as integer-paise numbers; `sha256Hex(canonical(x))`. Audit preimage is a
  length-prefixed JSON array (not a `‖` join) that **includes `account_id` and `quote_id`** and a per-quote
  genesis salt, so no field can inject a delimiter and entries cannot be replayed across quotes.

## `quotes` (header — only non-pricing metadata mutable while DRAFT)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `q_<ulid>` |
| account_id | TEXT NOT NULL | tenant scope |
| quote_no | TEXT NOT NULL | FY-aware; **UNIQUE(account_id, quote_no)** |
| client_id | TEXT NOT NULL | FK `clients.id`; guarded by `denyClientCrossAccess` |
| place_of_supply | TEXT NOT NULL | state code; drives CGST/SGST vs IGST (`calc-spec §2`) |
| status | TEXT | `DRAFT`→`PENDING_APPROVAL`→`APPROVED`→`SENT`→(`ACCEPTED`\|`LOST`\|`EXPIRED`) |
| current_version | INTEGER NOT NULL | CAS target; latest `quote_versions.version` |
| itc_claimable_all | INTEGER | derived: 1 iff every line claimable; drives Finance leg (`!all`) |
| grand_total_paise | INTEGER | cached from current version; INTEGER paise |
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
**Append rule:** new row + `UPDATE quotes SET current_version=:v, grand_total_paise=:g WHERE id=:id AND
current_version=:expected` in one `batch()`. 0 rows affected or UNIQUE(quote_id,version) violation → batch
fails → handler retries by re-reading. Rows are never UPDATEd/DELETEd.

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
| status | TEXT | `PENDING`\|`APPROVED`\|`REJECTED`\|`SUPERSEDED` |
| actor_id / actor_name | TEXT NULL | SoD: `actor_id ∉ {created_by} ∪ {all version authors}` |
| comments | TEXT NULL | |
| acted_at | TEXT NULL | |
On reject or any version append, all prior PENDING/APPROVED rows → `SUPERSEDED`; completion is computed only
over rows where `version == quotes.current_version`. Completion flip to `APPROVED` uses a guarded conditional
UPDATE inside the approving batch (resolves `approval-completion-race`).

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

## `quote_reminders` (R1–R8 — explicit state machine)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| account_id / quote_id | TEXT NOT NULL | |
| rule | TEXT | `R1`..`R8`; **UNIQUE(quote_id, rule)** |
| due_date | TEXT | `YYYY-MM-DD` IST; offset per `quote.settings.reminder_rules` (see context.md) |
| status | TEXT | `PENDING`\|`SENT`\|`SNOOZED`\|`CANCELLED` |
| sent_at | TEXT NULL | |
| snooze_until | TEXT NULL | |
**State machine** (resolves `reminder-snooze-state-machine`): pass fires a rule when `status ∈
{PENDING,SNOOZED}` AND `due_date ≤ today(IST)` AND not already sent this cycle → set `SENT`, `sent_at`;
"dedup = at most one SENT per rule per quote". Snooze valid from `PENDING`/`SENT` → `SNOOZED` +
`snooze_until`. `accept`/`lost`/`expire` cancel rules `IN ('PENDING','SNOOZED')` (resolves
`accept-lost-leaves-snoozed`). `CANCELLED` is terminal.

## `quote_followups`
| id | account_id | quote_id | actor_id | actor_name | channel (`call`\|`email`\|`meeting`\|`note`) | note | next_action_date (YYYY-MM-DD IST, NULL) | created_at |

## `quote_counters` (FY-aware; atomic single-statement increment)
| fy | account_id | last_no | — PK(account_id, fy). Increment is `UPDATE quote_counters SET last_no=last_no+1 WHERE account_id=? AND fy=? RETURNING last_no` (never read-then-write); create retries on UNIQUE(account_id, quote_no) conflict. |

## `quote_idempotency` (resolves `idempotency-key-semantics`)
| key | account_id | user_id | route | request_hash | response_json | status_code | created_at | — PK(account_id, user_id, route, key). TTL 24h. Replay with same body → cached response; same key + different `request_hash` → 409. |

## Config keys (`app_config`, per-tenant)
- `quote.enabled_users:<account_id>` → `{ "<userId>": "<quoteRole>" }`, `quoteRole ∈
  {sales, ops, commercial_manager, finance, auditor}`. Empty/unset ⇒ feature OFF. Stored with a `_ver`
  integer for optimistic concurrency (resolves `config-rmw-lost-update`); PUT sends expected `_ver`, 409 on
  mismatch. Malformed JSON ⇒ treated as empty (fail-closed) + admin warning (resolves
  `malformed-config-fail-closed`).
- `quote.settings:<account_id>` → `{ seller_state_code, freight_default_paise, branding_default_paise,
  approval_threshold_paise:50000000, default_validity_days, reminder_rules:{R1..R8 offsets}, number_prefix }`.

## Indexes
`idx_quotes_acct_client`, `idx_quotes_acct_status`, `idx_qv_quote`, `idx_qlines_quote`,
`idx_qappr_quote_status`, `idx_qaudit_quote_seq`, `idx_qent_acct_seq`, `idx_qrem_due_status`,
`idx_qfu_quote`, plus the UNIQUE constraints named above.
