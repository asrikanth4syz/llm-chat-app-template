# Expert Review — "4SYZ HRMS — Engineering Blueprint v1.0"

> **Reviewer stance:** senior engineering / architecture review of the proposed
> *Engineering Blueprint v1.0* (custom build, Vue 3 + Django + PostgreSQL stack,
> 12-sprint plan). Read alongside [`hrms-gap-analysis.md`](./hrms-gap-analysis.md).
> **Context the blueprint omits:** 4SYZ already runs a **live, deployed Employee
> Portal** (Cloudflare Workers + D1 + TypeScript) with 9 modules in production
> (profile, leave, biometric-fed attendance, approvals + delegation, directory,
> announcements, tasks, documents, helpdesk + POSH, notifications), behind
> default-deny RBAC, 2FA-for-all, field encryption, and an append-only audit log.

---

## 1. Verdict (TL;DR)

**The blueprint is excellent as a *target model* and dangerous as a *plan*.**

- **As a spec of WHAT to build** — data model, business rules, controls, edge cases,
  permission matrix, Definition of Done — it is high quality and should be adopted
  almost wholesale, regardless of stack.
- **As a plan of HOW to build it** — "custom development from scratch" on a different
  stack, with a 12-sprint greenfield that re-implements auth, employee master,
  attendance, leave, documents, approvals, and audit — it **ignores that those exact
  P0 modules already exist, tested and in production.** Sprints 1–8 largely rebuild what
  you already have.

**Recommendation: do not rebuild from scratch.** Treat this blueprint as the
authoritative data/rules/security target and **evolve the existing portal** toward it,
back-porting its genuinely better ideas. Reserve a stack migration for a deliberate,
evidence-driven decision (§4), not a reflex to start clean.

The single highest *content* risk is that **India statutory payroll is one sprint line
("statutory rules … versioned") standing in for the hardest, most legally-exposed part
of the whole system.** That needs its own workstream and a CA/payroll-specialist review.

---

## 2. What's genuinely strong (keep all of this)

These are senior-grade decisions. Adopt them on whatever stack wins:

- **Architecture rules (§1.4)** — API-first; *backend* permission enforcement ("frontend
  visibility is not a security boundary"); unique transaction IDs; no silent overwrite of
  attendance/payroll history; payroll consumes *approved* data; **configurable,
  effective-dated** business rules; versioned APIs from day one. This is exactly right.
- **Ledger-based state** — leave as a `leave_balance_ledger`, payroll as runs/lines, and
  the rule that **derived records (weekly summaries, payroll) must be reproducible from
  approved events + rules** (§2.4). This is the correct way to keep HR/finance data
  defensible.
- **Effective-dated history** — salary, employment, reporting relationships kept as
  history, not overwritten. Overlap constraint on salary revisions called out explicitly.
- **Maker–checker payroll** — HR review → finance approval → lock → **controlled revision
  instead of edit-after-lock**, plus **idempotency per run version**. Most in-house
  payrolls get this wrong; this gets it right.
- **Server-authoritative timestamps** — check-in time generated server-side, client never
  trusted (§4.4). `client_request_id` idempotency on check-in to prevent duplicates.
- **Separation of duties** — "manager ≠ salary access by default"; finance permissions
  explicitly assigned (§3.12, §7.1). Correct and often violated.
- **Generic workflow engine** (`workflow_definitions / steps / approval_requests /
  approval_actions`) — an upgrade over the portal's current per-type approvals; matches the
  R4 item in the gap analysis.
- **Edge-case catalogues (§6)** — attendance, payroll, leave scenarios are thorough, and
  §6.1's clarification ("don't classify someone non-compliant just because *approved* leave
  reduced hours") shows real domain care.
- **Definition of Done (§8)** — "not done because the screen exists or the API returns 200"
  is the right bar.
- **Object storage for documents** — S3-compatible store with short-lived authorised
  download URLs is the right call (the portal currently base64s files into D1 with a ~1.5 MB
  cap — a real limitation this fixes).

---

## 3. The #1 issue: the plan ignores the system that already exists

The blueprint reads as if 4SYZ is at zero. It is not. Mapping its sprints to reality:

| Blueprint sprint | Already live in the portal? |
| --- | --- |
| S1 Auth & permissions | ✅ **Yes** — default-deny policy engine, 2FA-for-all, token-version revocation, audited. *Stronger* than the blueprint's "MFA when enabled". |
| S2 Employee master & org | 🟡 Partial — employee records, directory, profile, manager link exist; org masters (dept/designation/location/cost-centre) + import are the real additions. |
| S3 Documents & audit | ✅ Mostly — documents module (draft-gated, audited open) + append-only audit with DB triggers already exist. |
| S4–S6 Attendance | ✅ Largely — biometric monthly feed, exceptions, corrections + manager/HR approval all live. Web check-in and shift-awareness are the additions. |
| S7 Leave | ✅ Mostly — types, balances, apply/approve/cancel live; accrual/carry-forward/holiday-calendar are additions. |
| S8 Self-service | ✅ Yes — mobile-first SPA, profile change-approval, announcements, notifications live. |
| S9–S11 Payroll | ❌ **Genuinely new** — this is the real greenfield work. |
| S12 UAT/go-live | n/a |

**~7 of 12 sprints re-deliver working software.** A from-scratch rebuild would:
- discard tested, in-production code and its **security surface that's already been hardened**
  (IDOR-tested scoping, field encryption, POSH confidentiality, append-only audit);
- re-introduce that entire attack surface to be re-reviewed;
- delay the one thing you don't have (payroll) by ~5 months of rebuilding things you do;
- during the rebuild, leave you maintaining two systems or freezing the live one.

For a 21–50 person company, **throwing away working HR software to start clean is almost
never the right trade.**

---

## 4. The stack decision — make it on evidence, not reflex

The proposed stack (Vue 3 / Django REST / PostgreSQL / Celery+Redis / S3 / Docker) is a
**sound, conventional HRMS stack** — nothing wrong with it on its own merits. Django/Postgres
is arguably *more* natural than Workers/D1 for heavy payroll batch jobs, statutory report
generation, and Postgres **row-level security** (which your own PRD v1.4 named as the
production enforcement layer). So this isn't "bad stack" — it's "different stack from the one
you've already shipped on." Three honest options:

**Option A — Evolve the existing portal (recommended).**
Keep Workers + D1 + TypeScript. Adopt the blueprint as the data/rules/security target. Add
**Cloudflare R2** (S3-compatible) for documents/payslips. Build payroll + lifecycle + shift on
the current stack. Back-port the better ideas (workflow engine, effective-dated salary, payroll
ledger + maker-checker, idempotency).
*Why:* fastest path to the only missing piece (payroll); preserves hardened security; lowest
risk. At 21–50 employees, D1's real limits (10 GB, per-request CPU) **will not bite for years** —
payroll for 50 people is trivial compute, and 50 payslips is nothing.

**Option B — Deliberate migration to Django/Postgres.**
Choose this *only* if a real driver exists: the team is Python/Django-native and won't maintain
TS Workers long-term; you want Postgres **RLS as the primary** enforcement layer (defence in
depth beyond app-code checks); or you project attendance/reporting data volumes that genuinely
strain D1. If so, run it as a **planned migration with dual-run + reconciliation and a cutover
plan** — never a greenfield that ignores the live system. Sequence it so the working portal
keeps serving users during the ~6-month build.

**Option C — Greenfield rebuild exactly as written (avoid).**
Discards working, tested, secure software; longest time-to-value; re-opens every security
question already answered. Only if A and B are both impossible (e.g. a mandate to hand the whole
thing to a Django agency that won't touch the existing code).

**How to decide (answer these first):**
1. Who maintains it in 2 years — a TypeScript team or a Python/Django team?
2. Is Postgres RLS a *compliance mandate*, or a nice-to-have? (App-layer checks + audit already
   satisfy most auditors at this scale.)
3. Realistic 3-year data volume for attendance events and documents?
4. Is a vendor doing the build, and on what stack?
5. Can the business tolerate ~6 months with no new HR features during a rebuild?

If answers are "TS team / nice-to-have / modest / in-house / no" → **Option A**. If "Django team
/ mandate / large / agency / yes" → **Option B**.

---

## 5. Material gaps & risks in the content (ranked)

Independent of the stack decision, fix these before building:

1. **India statutory payroll is drastically under-specified (highest risk).**
   "Statutory rules … versioned and validated" (S10-05) hides the hardest part of the system.
   It must expand into: **EPF** (EPFO, monthly **ECR** file + challan), **ESI** (ESIC, monthly
   contribution + returns), **Professional Tax** (per-state slabs/periodicity), **TDS on salary**
   (old vs **new tax regime** election, investment **declarations + proof submission**, monthly
   deduction, **24Q** quarterly returns, annual **Form 16**), **LWF** where applicable, plus a
   **bank payment / NEFT advice** file. Budget this as its own workstream and get a
   **CA/payroll specialist to validate the rules and outputs**. Three sprints (S9–S11) is thin
   for *compliant* India payroll.

2. **Security regressions vs. what you already have (high risk).**
   PART 7 is a permission matrix + test list but omits controls the portal *already ships*:
   - **Field-level encryption at rest** (PAN/bank/Aadhaar — AES-256-GCM today).
   - **Mask-by-default + audited reveal-on-click** for sensitive fields.
   - **Append-only, tamper-evident audit** (today enforced by DB triggers blocking
     update/delete — the blueprint's `audit_events` table doesn't state immutability).
   - **POSH confidentiality** (committee-gated, *not* visible to super_admin by role).
   - **2FA for *all*** — the blueprint downgrades to "MFA when enabled" and a login example of
     email+password only. Keep 2FA-for-all.
   Carry every one of these forward; losing them is a step backwards.

3. **DPDP Act 2023 / data protection is absent (high risk, legal).**
   An India HRMS holding Aadhaar, PAN, bank, and salary must address consent/purpose limitation,
   **retention + deletion**, data-principal rights, and breach handling. **Aadhaar has specific
   handling constraints** — store only what's needed (the portal keeps `aadhaarLast4`, not the
   full number; keep that discipline). This was already on the portal's roadmap; the blueprint
   drops it.

4. **Biometric priority inversion (operational).**
   The blueprint files "biometric integration" under **P3 — later**. But 4SYZ's biometric system
   is the **current source of truth** feeding live attendance. Demoting it to P3 contradicts
   reality. The biometric feed must stay **first-class**; web/mobile check-in (S4) is *additive*
   for client-site staff without a device, not a replacement.

5. **Overtime (OT) is missing.**
   Your biometric report already carries OT columns, and OT feeds payroll. There's no OT model,
   no OT → payroll path, and Indian wage law has OT rules. Add it to the attendance + payroll
   scope.

6. **Scoping model is under-defined (RBAC vs. relationship/ABAC).**
   §7.2 mentions "attribute-based" once, but the model is RBAC. Real scoping here is
   **relationship- and attribute-based** (manager→reporting tree, HR→company, finance→payroll
   scope, location/cost-centre). Specify scoping as **data-driven** (reporting tree, location)
   rather than role flags, or it will be re-hardcoded. The portal already does relationship
   scoping in code — formalise it.

7. **Sprint-plan realism.**
   12 × 2-week sprints (~6 months) with **2 developers** to build a *full* HRMS including
   compliant India payroll from scratch is optimistic. (Credit: the doc says it's "not a
   promise.") If evolving (Option A), the timeline compresses dramatically because S1–S8 are
   mostly done. If rebuilding (B/C), payroll + statutory alone likely needs more than S9–S11.

8. **Migration/cutover underplayed.**
   Data migration appears only at S12. If rebuilding, migrating off the **live** portal needs its
   own plan (dual-run, reconciliation, cutover, rollback). If evolving, migration is mostly schema
   evolution on the existing D1 — far easier, another point for Option A.

9. **Payroll statutory *outputs* not modelled.**
   `payroll_register` exists, but the filing artifacts don't: PF ECR, ESIC return, PT challan, 24Q,
   Form 16, bank NEFT file. Add them as first-class outputs (they publish through the Documents
   module).

10. **Notification delivery channels thin.**
    NOTIF is P1 but email/push/escalation detail is light; the portal's notifications are in-app
    only today. Specify channels + escalation (also an open R2 item in the gap analysis).

---

## 6. Section-by-section quick notes

- **§1.1 Stack** — fine on merits; the issue is divergence from the deployed stack (§4). If you
  stay on Cloudflare, map: Workers↔Django, D1/Postgres, **R2**↔S3, **Queues/Cron Triggers**↔
  Celery/Redis, **Durable Objects** only if you need coordination (you don't yet).
- **§1.4 Rules** — adopt verbatim. Add one: *"sensitive fields encrypted at rest; audit is
  append-only and tamper-evident."*
- **§2 Data model** — strong. Add: `overtime`/OT on attendance; statutory master tables (PF/ESI/PT
  config, tax-regime election, investment declarations); `document_access_log` (you have the
  behaviour, model it); retention metadata.
- **§2.4 Constraints** — add: audit immutability; Aadhaar minimisation; payroll outputs tied to a
  *locked* run only.
- **§3 Wireframes** — clear and sensible. Ensure the salary/statutory tabs honour the existing
  mask + audited-reveal pattern, not plain display.
- **§4 APIs** — solid REST conventions. Keep the existing portal's `/api/*` live during any
  transition; version as `/api/v1`. `/auth/login` must keep **mandatory 2FA**, not optional.
- **§5 Backlog** — re-baseline against §3 of this review: collapse S1–S8 into "extend existing"
  and expand payroll/statutory.
- **§6 Business rules** — excellent; add OT and half-day/proration decisions (flagged as open —
  get HR sign-off before building, per your own §6.1).
- **§7 Security** — merge in the five controls from §5(2) above; this is the section that most
  needs strengthening.
- **§9 First milestone** — "Foundation + Employee Master" is the *wrong* first milestone for 4SYZ
  because that foundation largely exists. See §7 below.

---

## 7. Recommended path & first milestone (reconciled)

**Adopt the blueprint as the target; execute as evolution.** Concretely:

1. **Lock the stack decision (§4)** with the five questions. Default to **Option A (evolve)** unless
   a Django-native team or an RLS mandate pushes to **B**.
2. **Ratify the data model, rules, controls, and DoD** from this blueprint as the project's
   standard — they're good.
3. **Re-baseline the backlog:** replace S1–S8 with "extend what exists to the blueprint's model"
   (org masters, cost-centre, import, holiday calendars, leave accrual, shift, web check-in,
   object storage via R2), and **expand payroll + statutory** into a properly-sized,
   specialist-reviewed workstream.
4. **First milestone (corrected):** *not* "Foundation + Employee Master" (mostly done), but
   **"Payroll-ready attendance"** — attendance **month cutoff + lock**, working-day/holiday-calendar
   counting, OT capture, and a clean, locked monthly input payload. It's self-contained, finishes
   the attendance story, and is the prerequisite the payroll engine consumes. (This matches the gap
   analysis's recommended next step.)
5. **Then payroll core → India statutory (CA-validated) → payslips (via Documents) → JV to Zoho
   Books.**
6. **Carry forward, non-negotiable:** field encryption, mask+audited-reveal, append-only audit,
   2FA-for-all, POSH confidentiality, DPDP/retention. Make these a design-review checklist for
   every new module.

**Bottom line:** keep the blueprint's brain, keep your working product, and spend the saved months
on the part you actually don't have yet — **compliant India payroll** — with a specialist checking
the statutory math.

---

*Reviewed against: Engineering Blueprint v1.0 (pasted), the live `employee-portal/` (R1), PRD v1.4,
and [`hrms-gap-analysis.md`](./hrms-gap-analysis.md).*
