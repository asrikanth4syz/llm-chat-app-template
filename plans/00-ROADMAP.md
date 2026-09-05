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

- [ ] **Milestone 2: Zoho Inventory → App sync** — STATUS: ACTIVE
  - *Description:* One-way Zoho Inventory → SmartPantry sync (Model A: Zoho owns stock). Cron
    delta every 3h + nightly full reconcile; OAuth refresh-token auth; SKU-keyed upsert; watermark
    in app_config; import_jobs audit; super-admin "Sync now"; dry-run rollout. Backend + small
    super-admin UI.
  - *Moniker:* `002-zoho-inventory-sync`
  - *Spec:* `plans/active_milestones/002-zoho-inventory-sync/spec.md`
  - *Context:* `plans/active_milestones/002-zoho-inventory-sync/context.md`
