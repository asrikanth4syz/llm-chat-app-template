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

- [ ] **Milestone 3: Phase 3 — Finance (Receivables & Payables)** — STATUS: PLANNED
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
