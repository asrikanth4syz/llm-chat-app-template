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

- [ ] **Milestone 4: Smart Paste Order (V1)** — STATUS: READY TO BUILD (spec validated r1+r2; plan validated + fixes folded — ready for construction)
  - *Description:* Paste a free-text item+quantity list and get a reviewable DRAFT order. Deterministic
    unit-aware parser + history-weighted fuzzy match (reuses `normNameForMatch`) scoped to the selected
    client's catalogue ∪ order history, with visible confidence and "why this match". Every line is
    human-reviewed (no auto-commit); unmatched lines are preserved with manual SKU search; Confirm
    creates a DRAFT via the existing order path. New `paste_match_log` captures confirmations as the
    seed for later alias learning. Knowledge graph, alias auto-learning, AI parser and embeddings are
    explicitly deferred to V2+.
  - *Moniker:* `004-smart-paste-order`
  - *Spec:* `plans/active_milestones/004-smart-paste-order/spec.md`
