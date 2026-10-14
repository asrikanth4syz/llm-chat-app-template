# Swarm Master Roadmap

## 📦 Release v0.2.0 — SmartPantry Consolidation — STATUS: ACTIVE

- [x] **Milestone 1: Phase 2 — Consolidation** — STATUS: COMPLETED
  - *Description:* Merge Orders surfaces and the Deliveries hub into addressable tabbed hubs, add a
    shared phase-based order-status stepper, and make all hub tabs URL-addressable. Brownfield
    verification-and-hardening of the existing implementation on
    `claude/phase-2-consolidation-34ggxj`, plus a Due-Items hub-tab count badge.
  - *Moniker:* `001-phase2-consolidation`
  - *Spec:* `plans/active_milestones/001-phase2-consolidation/spec.md`
  - *Context:* `plans/active_milestones/001-phase2-consolidation/context.md`

- [x] **Milestone 2: Zoho Inventory → App sync** — STATUS: COMPLETED (built; ships disabled + dry-run, awaiting secrets + live rollout)
  - *Description:* One-way Zoho Inventory → SmartPantry sync (Model A: Zoho owns stock). Cron
    delta every 3h + nightly full reconcile; OAuth refresh-token auth; SKU-keyed upsert; watermark
    in app_config; import_jobs audit; super-admin "Sync now"; dry-run rollout. Backend + small
    super-admin UI.
  - *Moniker:* `002-zoho-inventory-sync`
  - *Spec:* `plans/active_milestones/002-zoho-inventory-sync/spec.md`
  - *Context:* `plans/active_milestones/002-zoho-inventory-sync/context.md`

- [ ] **Milestone 3: Phase 3 — Finance (Receivables & Payables)** — STATUS: BUILT (awaiting live rollout)
  All slices built + green, ship inert: AR mirror + consolidated dunning (Gmail transport), AP mirror,
  3-way reconciliation exception queue, and the finance dashboard. Awaiting Worker secrets + enabling
  `books_sync_enabled`/`reminders_mode`. Deferred (own follow-ups): WhatsApp/SMS channels,
  open-tracking + bounce scan, Pay-Now gateway, in-app late-fee computation.
  - *Description:* AP/AR cockpit over Zoho Books as the accounting system of record. App mirrors
    invoices/bills/payments from Books (idempotent, provenance-stamped like inventory) and adds the
    operational overlay Books lacks: order/DC/PO linkage, aging buckets, a reconciliation/exception
    queue, and reminders/dunning on the existing cron + notification + email infra. AR first, then
    AP, then reconciliation + dunning + finance dashboard. No in-app GL/GST-filing (Books owns it).
  - *Moniker:* `003-finance-ar`
  - *PRD:* `plans/active_milestones/003-finance-ar/PRD-receivables-reminders.md` (AR + Payment
    Reminders — first shippable slice, reminder-first)
  - *Plan:* `plans/active_milestones/003-finance-ar/plan.md`
  - *Context:* `plans/active_milestones/003-finance-ar/context.md`

## 📦 Release v0.3.0 — Faster Order Entry — STATUS: PENDING

- [x] **Milestone 4: Smart Paste Order (V1)** — STATUS: COMPLETED (Group 1 pure module + schema #126; Group 2 parse-paste/from-paste endpoints + integration tests #127; Group 3 paste→review→DRAFT UI; Group 4 verification sweep — tsc/smoke/vitest all green, smart_paste ACL pinned in smoke)
  - *Description:* Paste a free-text item+quantity list and get a reviewable DRAFT order. Deterministic
    unit-aware parser + history-weighted fuzzy match (reuses `normNameForMatch`) scoped to the selected
    client's catalogue ∪ order history, with visible confidence and "why this match". Every line is
    human-reviewed (no auto-commit); unmatched lines are preserved with manual SKU search; Confirm
    creates a DRAFT via the existing order path. New `paste_match_log` captures confirmations as the
    seed for later alias learning. Knowledge graph, alias auto-learning, AI parser and embeddings are
    explicitly deferred to V2+.
  - *Moniker:* `004-smart-paste-order`
  - *Spec:* `plans/active_milestones/004-smart-paste-order/spec.md`

- [ ] **Milestone 5: Smart Paste Order V2 — Alias Learning & Smarter Matching** — STATUS: BUILDING (spec validated r1; Slice 1 alias-learning core built + green — learned tier surfaces honestly; synonym layer, metrics, admin UI, purge = later slices)
  - *Description:* Turn the V1 `paste_match_log` exhaust into a learning layer. Client-scoped
    learned aliases (`norm(product_text) → sku`, created/strengthened on Confirm) plus an
    ops-curated synonym layer (e.g. `coke → coca cola`, global or per-client) feed the existing
    parse-paste ranking with new `learned`/`synonym` tiers and honest "why", closing the brand-
    synonym gap the bare matcher can't. Adds a synonyms admin (ops/admin) and a match-quality
    metrics view over `idx_pml_metrics` (match rate, unresolved %, top unmatched phrases). All V1
    guardrails preserved: operator review, honest confidence, no auto-commit. Embeddings, LLM
    parser and full knowledge graph remain deferred to V3.
  - *Moniker:* `005-smart-paste-v2`
  - *Spec:* `plans/active_milestones/005-smart-paste-v2/spec.md`

## 📦 Release v0.4.0 — Quotations (GIFTSYZ) — STATUS: PLANNED (architecture only; not built)

- [ ] **Milestone 6: Quotations — GIFTSYZ into Smart Pantry** — STATUS: BUILDING (spec-validated r1–r4,
  31→20→15→8 findings folded; **Slice 1 calc engine + Slice 2 entitlement gate BUILT + green** —
  `src/quote_calc.ts` (18 vectors byte-exact) + `src/quote_access.ts` + Worker routes (/api/quotes/access,
  /calc, /admin/quote-access, /admin/quote-settings); 500 tests green, tsc + smoke clean. Next slices: CRUD+versions →
  approvals/SoD → document+hash → reminders/Today/bell)
  - *Description:* Fold the GIFTSYZ B2B quotation workflow (PRD v2.1) into this app, reusing the
    platform spine (JWT auth, clients/catalogue, approval engine, audit, document store + SHA-256, FY
    numbering, cron + notifications, app_config). Net-new: a pure vector-tested pricing/landed-cost/GST
    engine (`src/quote_calc.ts` — mixed cost+markup / MRP−discount, ITC-claimable, CGST/SGST-vs-IGST,
    weighted margin, rounding policy), immutable hash-chained quote versions + audit (app-layer, no SQL
    triggers), separation-of-duties approvals (Ops→Manager always + Finance when ITC=No or ≥₹5,00,000),
    reminders R1–R8 + follow-ups + Today page + bell, and server-side cost/margin redaction for the Ops
    role. **Added requirement:** the feature is assignable to specific users and configurable — an
    `app_config` allowlist + per-user quote-role, admin-editable, enforced at nav + server guard +
    approval routing, grant/revoke with no deploy. Sliced: calc engine → entitlement gate → quote
    CRUD+versions → approvals/SoD → customer document+hash → reminders/Today/bell. Ships inert until an
    admin populates `quote.enabled_users`.
  - *Moniker:* `006-quotations`
  - *Source PRD:* `GIFTSYZ_Quotation_App_PRD_v2.1.docx` (external; no `/giftsyz` code in this repo)
  - *Assessment:* `plans/active_milestones/006-quotations/context.md`
  - *Plan:* `plans/active_milestones/006-quotations/plan.md`
  - *Data model:* `plans/active_milestones/006-quotations/data-model.md`
  - *API contracts:* `plans/active_milestones/006-quotations/api-contracts.md`
