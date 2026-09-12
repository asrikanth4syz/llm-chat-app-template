# DC Manager → SmartPantry — Integration Review & DC-Number Alignment

**Author:** ERP integration review · **Status:** Review only (no build) · **Scope:** how to fold the *DC Manager v2.0* capabilities — and specifically its **Delivery-Challan number allocation** — into the current SmartPantry system.

> This is a decision document. Nothing here is built. It ends with a recommended
> phased plan and a companion visual mock of the proposed **DC Number Series**
> screen and unified **DC Register**.

---

## 1. Executive summary

DC Manager is a **challan-first**, single-file, localStorage app: the Delivery Challan is its primary document, numbered by an **FY-aware, category-based series** (7xxxxx / 8xxxxx, reset every 1 April). It carries 1,100 real DCs and 59 clients.

SmartPantry is a **fulfilment-first** ERP: the challan (`delivery_challans`) is a *downstream* document of an order / PO, numbered by a **single global monotonic counter** (`DCN-#####`) with **no FY reset and no category series**.

The two disagree on exactly one thing that matters for integration: **how a DC number is allocated.** Everything else (billing, samples, reminders, reports, route planning) is either already present in SmartPantry or is an additive module. So the integration is best framed as:

1. **Align DC-number allocation first** (the hard, data-sensitive part), then
2. **Layer the remaining DC Manager modules** onto SmartPantry's existing challan spine.

The recommendation is to **adopt DC Manager's FY + category series model as SmartPantry's canonical DC numbering**, migrate the 1,100 existing DCs at their real numbers, and continue allocation from the last-used number per series — so no number ever changes and no number ever collides.

---

## 2. Side-by-side: DC numbering today

| Aspect | DC Manager v2.0 | SmartPantry (current) |
|---|---|---|
| Identifier | `700001…`, `80001…` (bare numeric) | `DCN-00001` (prefixed, zero-padded) |
| Allocation source | Per-FY, per-category **series** with configurable start | Single global counter `app_config.dc_seq` |
| Category awareness | **Yes** — Consumables/Non-Returnable → `7xxxxx`; Gifting/Returnable-Sample → `8xxxxx` | None — one stream for all |
| Financial-year reset | **Yes** — resets 1 April; new-FY wizard; per-FY records | **No** — monotonic forever |
| Who assigns | System, from active FY series | System, at dispatch (`nextDCNumber`) |
| Standalone DC (no order) | **Yes** — challan-first | **No** — DC requires `order_id` (has optional `po_id`) |
| History / audit of series | Per-FY series card: start, last-used, total, active/closed | None (just the counter value) |

**Implication:** SmartPantry's `nextDCNumber()` is a single-line counter. DC Manager's is a small **registry** (FY × category-class → {start, last_used, status}). Aligning means replacing the counter with the registry — a contained change with real migration care.

---

## 3. SmartPantry assets we can reuse (so this is mostly *wiring*, not *building*)

The current schema already carries most of the DC lifecycle:

- **`delivery_challans`** — `id, order_id, po_id, status, dispatched_at, delivered_at, billed, billed_at, vehicle_no, driver_name, driver_phone, scheduled_date`, plus the discrepancy-approval columns (`delivery_approval, variance_*`) and `reminder_armed / reminder_sent_at`.
- **`dc_items`** — line-level `qty_ordered / qty_delivered`.
- **`dc_documents`** — base64 **scanned-copy** store (PDF/JPG/PNG) — DC Manager's "Upload Scan" already has a home.
- **`returns`** — a returnable/return lifecycle already exists (partial Sample-Tracker parity).
- **`billed / billed_at`** flags — Pending-Billing parity is one query away.
- **`nextDCNumber()`** — the exact seam to change for numbering.

So the integration is **≈ 30% new** (FY series registry + a couple of modules) and **≈ 70% wiring** existing SmartPantry data into DC-Manager-style views.

---

## 4. Module-by-module mapping

| # | DC Manager module | SmartPantry today | Gap → work |
|---|---|---|---|
| 1 | Dashboard (KPIs, volume, top clients) | Ops dashboard exists | **Reuse** — add DC-specific KPI band |
| 2 | New DC (auto number, category, recurring) | Dispatch flow assigns `DCN-#####` | **Change numbering** + allow ad-hoc (no-order) DC |
| 3 | All DCs (filter, paginate, inline actions) | Deliveries hub lists challans | **Wire** filters + CSV + pagination |
| 4 | Pending Billing (grouped, day-counter, reminders) | `billed/billed_at` flags | **New view** over existing flags |
| 5 | Sample Tracker (returnables) | `returns` table | **Partial** — dedicated returnable view |
| 6 | Route Planner (optimise, Maps links) | — | **New** (client `map_pin` already stored) |
| 7 | Recurring DCs (weekly/biweekly/monthly) | `standing_orders` (partial) | **Extend** standing orders → generate DC |
| 8 | Reports (by client/month/range, CSV) | Reports exist | **Wire** DC report types |
| 9 | Reminders (15/30-day tiers) | `reminder_armed/*` columns | **New view** over existing columns |
| 10 | **DC Series (FY)** | `dc_seq` counter | **NEW — the core of this integration** |
| 11 | Clients (directory, Maps, DC count) | Clients module exists | **Reuse** — add DC-count badge |
| 12 | Users (CRUD, roles, SHA-256) | Auth + roles exist (JWT, hashed) | **Reuse** — map roles (below) |

**Net-new modules:** DC Series (FY), Route Planner, and the Pending-Billing / Reminders / Sample views (thin, over data we already store).

---

## 5. Recommended target model for DC numbering

### 5.1 Series registry (replaces the single counter)

A new `dc_series` registry keyed by **financial year × category-class**:

```
dc_series(
  fy            TEXT,     -- '2026-27'
  class         TEXT,     -- 'CONSUMABLE' (7xxxxx) | 'GIFTING' (8xxxxx)
  prefix_digit  INTEGER,  -- 7 | 8
  start_no      INTEGER,  -- 700001 | 80001
  last_no       INTEGER,  -- last allocated (e.g. 700932)
  status        TEXT,     -- 'ACTIVE' | 'CLOSED'
  PRIMARY KEY (fy, class)
)
```

**Category → class mapping** (matches DC Manager exactly):

| DC category | Class | Series |
|---|---|---|
| Consumables | CONSUMABLE | 7xxxxx |
| Non-Returnable | CONSUMABLE (shared) | 7xxxxx |
| Gifting | GIFTING | 8xxxxx |
| Returnable-Sample | GIFTING (shared) | 8xxxxx |

### 5.2 Allocation logic (the new `nextDCNumber`)

1. Determine **active FY** from today's date (FY starts **1 April**).
2. Map the DC's **category → class**.
3. `UPDATE dc_series SET last_no = last_no + 1 WHERE fy=? AND class=? AND status='ACTIVE'` (atomic), return `last_no`.
4. If no ACTIVE series exists for the FY → **block + prompt admin** with the "Start FY Series" wizard (dashboard banner + sidebar badge, exactly as DC Manager does).

### 5.3 Format decision (recommended)

- **Adopt the bare numeric format** (`700933`, `80056`) as the canonical DC number, because **1,100 historical DCs already use it** — changing format would rewrite history and break references.
- Keep a **display option** to show `DC 700933` in the UI; the stored value is the integer/string as-is.
- Retire `DCN-#####` for *new* DCs. Existing `DCN-` challans (if any were created in SmartPantry testing) are migrated or left as legacy — see §6.

> **Alternative considered:** keep `DCN-#####` and add category/FY as columns. Rejected — it leaves you with two numbering worlds and makes the 1,100 imported DCs second-class. One canonical series is cleaner.

---

## 6. Data migration (1,100 DCs + 59 clients)

1. **Clients:** upsert 59 clients by name (SmartPantry clients already carry address, contact, `map_pin`, GSTIN). Backfill DC counts after DC import.
2. **DCs:** import 1,100 `delivery_challans` at their **real numbers** (700001–700932, 80001–80055), mapping DC Manager fields → SmartPantry columns:
   - `category → class`, `date → dispatched_at`, `client → order/client link` (or ad-hoc client ref), `items → dc_items`, `delivery person → driver_name`, `invoice status → billed`, `returnable → returns` link, `scan → dc_documents`.
   - DCs with no order become **ad-hoc challans** (requires allowing `order_id` NULL — see §7).
3. **Seed the series registry** so allocation continues without collision:
   - `dc_series('2026-27','CONSUMABLE',7,700001, 700932,'ACTIVE')`
   - `dc_series('2026-27','GIFTING',   8, 80001,  80055 ,'ACTIVE')`
   - Next Consumable DC → **700933**; next Gifting DC → **80056**. No collision, no renumber.
4. **Idempotent + flag-guarded** one-time migration (mirrors the existing `app_config`-flag migration pattern in `src/index.ts`).

---

## 7. Structural changes required (small, contained)

- **`delivery_challans.order_id` → nullable** (or an `ad_hoc` flag), to allow challan-first DCs. Today it's `NOT NULL`.
- Add **`dc_class`** and **`fy`** columns to `delivery_challans` for reporting/series joins.
- New **`dc_series`** table (§5.1) + **`recurring_schedules`** (or extend `standing_orders`) for module 7.
- New endpoints: `GET/POST /api/dc-series`, `POST /api/dc-series/start-fy`, `GET /api/dcs` (filter/paginate), plus thin read views for pending-billing / reminders / samples.

---

## 8. Role mapping

| DC Manager | SmartPantry role | Notes |
|---|---|---|
| Admin | `super_admin`, `ops_admin` | Series mgmt, edit DC, manage clients/users, reminders |
| User | `delivery_exec`, `ops_user` | Create DC, status update, upload scan, invoice update |

SmartPantry already has JWT auth + hashed passwords + RBAC, so DC Manager's SHA-256/localStorage auth is **not** carried over — SmartPantry's is stronger. Only the **permission matrix** is mapped.

---

## 9. Recommended phased plan

- **Phase 0 — DC-number alignment (core, do first).** `dc_series` registry, FY-aware category allocation, "Start FY Series" wizard + dashboard banner, migrate the 1,100 DCs and seed last-used numbers. *Outcome: SmartPantry allocates the next DC as `700933` / `80056`, correctly, per FY.*
- **Phase 1 — Unified DC Register.** Ad-hoc (no-order) DC creation, All-DCs filters + pagination + CSV, DC-count badges on clients. *(Scans already work.)*
- **Phase 2 — Billing & Reminders.** Pending-Billing grouped view + 15/30-day tiers over existing `billed / reminder_*` columns.
- **Phase 3 — Samples & Recurring.** Returnable Sample Tracker over `returns`; recurring schedules generate DCs.
- **Phase 4 — Route Planner.** Stop sequencing + Google Maps links from client `map_pin`.

Each phase ships independently; **Phase 0 unblocks everything and is the thing you asked to align.**

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Number collision during migration | Seed `last_no` from the real max per series **before** any new allocation; migration is flag-guarded + idempotent |
| Two numbering worlds (`DCN-` vs `7xxxxx`) | Make the FY category series canonical; treat any `DCN-` test rows as legacy/migrated |
| FY rollover missed on 1 April | Auto-detect active FY on every allocation; hard-block + admin banner when no ACTIVE series (same UX as DC Manager) |
| `order_id NOT NULL` blocks ad-hoc DCs | Make nullable + add `ad_hoc` flag (Phase 1) |
| Concurrent allocation double-issues a number | Single atomic `UPDATE … last_no = last_no + 1` (same pattern as today's `dc_seq`) |

---

## 11. What NOT to port

- **localStorage storage** — SmartPantry is D1-backed; keep it.
- **SHA-256 + `dc_users.json`** — SmartPantry's JWT/RBAC is stronger.
- **Single-file HTML deployment** — SmartPantry is a Workers app; N/A.

These are DC Manager's constraints as a zero-backend tool, not features to inherit.

---

## 12. Feasibility verdict — build natively inside SmartPantry

**Decision framing:** *do not* run DC Manager as a second tool or import it as-is. Build its capabilities as **native SmartPantry modules** on the existing challan spine. The single-file/localStorage/SHA-256 app is a deployment convenience for a zero-backend context — SmartPantry already has a stronger backend (D1), auth (JWT/RBAC) and challan data model, so "integration" here means **re-implementing the useful behaviours natively**, not embedding the other app.

**Overall verdict: FEASIBLE, and low-to-moderate effort** — because ~70% of it is wiring SmartPantry data into new views, not new subsystems. The only genuinely new, data-sensitive piece is the DC-number series (Phase 0).

### Effort & risk by phase (native build)

| Phase | Native scope | Reuse | New build | Effort | Risk | Data migration |
|---|---|---|---|---|---|---|
| **0 · DC numbering** | `dc_series` registry, FY-aware category allocation, Start-FY wizard + banner, migrate 1,100 DCs | `nextDCNumber` seam, `app_config` flag pattern, dispatch flow | series table + allocator + admin UI | **M** | **Med** (numbering/migration) | **Yes** — 1,100 DCs + 59 clients, seed last-used |
| **1 · DC Register** | Ad-hoc (no-order) DC, filters + pagination + CSV, DC-count badges | `delivery_challans`, `dc_items`, `dc_documents` (scans) | `order_id` nullable; list endpoint | **M** | Low | No |
| **2 · Billing & Reminders** | Pending-Billing grouped view, 15/30-day tiers | `billed/billed_at`, `reminder_armed/*` columns | 2 read views | **S** | Low | No |
| **3 · Samples & Recurring** | Returnable Sample Tracker; recurring→generate DC | `returns` table, `standing_orders` | tracker view; schedule→DC job | **M** | Low | No |
| **4 · Route Planner** | Stop sequence + Maps links | client `map_pin` | sequencing UI | **S–M** | Low | No |

*Effort key: S ≈ small, M ≈ medium (each phase ships independently).*

### Why it's feasible (as SmartPantry-native)

- **The spine already exists.** `delivery_challans` + `dc_items` + `dc_documents` + `returns` + `billed/reminder_*` columns cover most of modules 2–6 as *views over data we already store*.
- **The numbering seam is a single function.** `nextDCNumber()` is the one place to swap the counter for the `dc_series` registry — contained, testable, and it reuses the exact atomic-counter pattern already proven by `dc_seq`/`po_seq`.
- **No auth/storage rework.** SmartPantry's JWT + RBAC + D1 supersede DC Manager's SHA-256/localStorage; we map only the permission matrix.
- **Migration is bounded and idempotent.** 1,100 DCs + 59 clients, seeded via the existing flag-guarded one-time-migration pattern; seed each series' last-used *before* allocating → zero collisions, zero renumbering.

### Principal risks (and why they're manageable)

1. **Numbering migration** — the one place to be careful; mitigated by seeding last-used from the real max and gating with an idempotent flag (Phase 0 only).
2. **`order_id NOT NULL`** blocks challan-first DCs — a one-column change (Phase 1).
3. **FY rollover on 1 April** — auto-detect active FY + hard-block with admin banner when no series (same UX DC Manager already validates in production).

### Recommended way forward

1. **Do Phase 0 first, in isolation** — it's the thing you asked to align, it's the only migration-sensitive piece, and it unblocks everything else. Ship it, migrate, verify the next DCs allocate as `700933` / `80056`, then pause.
2. **Then layer Phases 1–2** (Register + Billing) — fast, low-risk, high daily value.
3. **Phases 3–4** (Samples/Recurring, Route Planner) as capacity allows.
4. Keep each phase a **separate, validated PR** (tsc + vitest + smoke), consistent with how this app already ships.

**Bottom line:** building DC Manager natively into SmartPantry is feasible and mostly incremental. Phase 0 is the real engineering; the rest is presentation over data the app already owns. Recommend proceeding **Phase 0 first** when you're ready to build.

## 13. Companion mock

A visual mock of the two Phase-0 surfaces — **DC Number Series (FY)** config and the unified **DC Register** — is provided alongside this document, styled to SmartPantry's enterprise palette. It shows the series cards (start / last-used / active), the "Start FY Series" wizard, and category-aware allocation, so the numbering behaviour is reviewable before any build.
