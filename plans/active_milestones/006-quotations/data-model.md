# Data Model: 006-quotations

All tables created idempotently by `ensureQuoteSchema(env)` (self-heal, one statement per
`env.DB.prepare(...).run()`, once-per-isolate guard `_quoteSchemaReady`). A parity migration file
(`migrations/00NN_quotations.sql`) mirrors these for local `d1 migrations apply`, but runtime truth is
self-heal. **No SQL triggers** — immutability/append-only is enforced in app-layer `env.DB.batch()`.

## `quotes` (header — mutable only while DRAFT)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `q_<ulid>` |
| quote_no | TEXT UNIQUE | FY-aware, via counter (see `quote_counters`) e.g. `GZ/25-26/0007` |
| client_id | TEXT | FK `clients.id` |
| place_of_supply | TEXT | state code; drives CGST/SGST vs IGST |
| status | TEXT | `DRAFT`→`PENDING_APPROVAL`→`APPROVED`→`SENT`→(`ACCEPTED`\|`LOST`\|`EXPIRED`) |
| current_version | INTEGER | points at latest row in `quote_versions` |
| itc_claimable | INTEGER | 0/1; set per quote (drives approval leg) |
| created_by | TEXT | user id (SoD: ≠ approver) |
| created_at / updated_at | TEXT | `datetime('now')` |
| valid_until | TEXT | expiry date (feeds EXPIRED + reminders) |
| lost_reason | TEXT NULL | when `LOST` |

## `quote_versions` (immutable snapshot — append-only)
| col | type | notes |
|---|---|---|
| id | TEXT PK | `qv_<ulid>` |
| quote_id | TEXT | FK |
| version | INTEGER | 1..n, monotonic per quote |
| payload_json | TEXT | full computed snapshot: lines, per-line pricing, landed cost, GST split, totals, weighted margin |
| content_hash | TEXT | SHA-256 of canonicalized `payload_json` |
| prev_hash | TEXT NULL | hash chain: previous version's `content_hash` (NULL for v1) |
| created_by | TEXT | |
| created_at | TEXT | |
**Rule:** rows are never UPDATEd/DELETEd. A new version = new row; `quotes.current_version` advances
in the same `batch()`.

## `quote_lines` (denormalized for query; snapshot of truth lives in `quote_versions.payload_json`)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| quote_id / version | TEXT / INTEGER | |
| sku | TEXT | FK catalogue (nullable for ad-hoc) |
| description | TEXT | |
| qty | REAL | |
| pricing_mode | TEXT | `cost_markup` \| `mrp_discount` |
| purchase_cost / markup_pct / mrp / discount_pct | REAL NULL | mode-dependent inputs |
| freight_alloc / branding_cost | REAL | landed-cost inputs |
| gst_rate | REAL | per-line |
| unit_price / line_total / line_gst | REAL | computed outputs |
Cost/margin columns are **redacted server-side** for the `ops` quote-role.

## `quote_approvals` (reuse pattern of `approval_chain_*`, quote-scoped)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| quote_id | TEXT | |
| version | INTEGER | approval binds to the exact version approved |
| leg | TEXT | `manager` \| `finance` |
| required | INTEGER | computed at submit (finance leg required iff itc=No or total≥5L) |
| status | TEXT | `PENDING`\|`APPROVED`\|`REJECTED` |
| actor_id / actor_name | TEXT NULL | SoD: actor_id ≠ quotes.created_by |
| comments | TEXT NULL | |
| acted_at | TEXT NULL | |

## `quote_audit` (hash-chained, append-only — tamper-evident)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| quote_id | TEXT | |
| seq | INTEGER | per-quote monotonic |
| action | TEXT | `created`\|`version_added`\|`submitted`\|`approved`\|`rejected`\|`sent`\|`accepted`\|`lost`\|`expired`\|`reminder_sent`\|`followup_logged` |
| actor_id / actor_name | TEXT | |
| detail_json | TEXT | |
| entry_hash | TEXT | SHA-256(seq‖action‖actor‖detail‖prev_hash) |
| prev_hash | TEXT NULL | |
| created_at | TEXT | |

## `quote_documents` (immutable customer doc — mirrors `dc_documents`)
| col | type | notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| quote_id / version | TEXT / INTEGER | |
| content_b64 | TEXT | redacted customer-facing doc (no cost/margin/ITC) |
| content_hash | TEXT | SHA-256 of bytes; printed on doc for verification |
| mime_type | TEXT | `application/pdf` or `text/html` |
| created_by / created_at | TEXT | |

## `quote_reminders` (R1–R8 schedule + dedup)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| quote_id | TEXT | |
| rule | TEXT | `R1`..`R8` |
| due_date | TEXT | computed from `valid_until`/send date |
| status | TEXT | `PENDING`\|`SENT`\|`SNOOZED`\|`CANCELLED` |
| sent_at | TEXT NULL | dedup: a (quote_id,rule) fires once |
| snooze_until | TEXT NULL | |

## `quote_followups` (manual follow-up log)
| col | type | notes |
|---|---|---|
| id | TEXT PK | |
| quote_id | TEXT | |
| actor_id / actor_name | TEXT | |
| channel | TEXT | `call`\|`email`\|`meeting`\|`note` |
| note | TEXT | |
| next_action_date | TEXT NULL | feeds Today page |
| created_at | TEXT | |

## `quote_counters` (FY-aware numbering — reuse `currentFY`)
| col | type | notes |
|---|---|---|
| fy | TEXT PK | e.g. `25-26` |
| last_no | INTEGER | atomically incremented inside the create `batch()` |

## Config keys (`app_config`, not tables)
- `quote.enabled_users` → `{ "<userId>": "<quoteRole>" }`
- `quote.settings` → `{ freight_default, branding_default, approval_threshold:500000, reminder_rules:{...}, number_prefix:"GZ" }`

## Indexes
`idx_quotes_client`, `idx_quotes_status`, `idx_qv_quote`, `idx_qlines_quote`,
`idx_qappr_quote_status`, `idx_qaudit_quote_seq`, `idx_qrem_due_status`, `idx_qfu_quote`.
