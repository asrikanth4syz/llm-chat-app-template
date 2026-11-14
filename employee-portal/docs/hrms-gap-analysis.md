# 4SYZ Employee Portal — HRMS Gap Analysis & "HRMS Pro" Roadmap

> **Reference benchmark:** [Frappe HR (`frappe/hrms`)](https://github.com/frappe/hrms) —
> a mature, open-source, India-first HRMS. This doc maps **what a full HRMS covers**
> against **what the 4SYZ Employee Portal has today (R1)**, then lays out a prioritized
> path to an "HRMS pro"-grade product, tailored to 4SYZ's reality (India statutory
> payroll, an existing biometric attendance feed, a mixed office + client-site
> workforce, DPDP/CERT-In obligations).
>
> This is a **planning document**, not a spec. Each roadmap item becomes its own
> PRD/spec → plan → build, following the existing pure-domain + Worker + D1 pattern.
> Status words below describe the portal **as of this writing**, not aspirations.

---

## 1. TL;DR

The portal has a **strong, security-first self-service core** (R1): profile, leave,
attendance (biometric-fed), approvals + delegation, directory, announcements, tasks,
documents, helpdesk + POSH, notifications — all behind 2FA-for-all, a default-deny RBAC
policy engine, field encryption, and an append-only audit log.

Measured against a full HRMS, the portal is **roughly the "self-service + attendance"
third** of the product. The large missing pieces, in rough business-value order, are:

1. **Payroll & India statutory** (salary structures, payslips, PF/ESI/PT/TDS, Form 16) — the
   single biggest gap and the reason most SMBs buy an HRMS.
2. **Employee lifecycle / tenure** (onboarding, confirmation, transfer, promotion, exit) —
   the connective tissue the current flat employee record lacks.
3. **Shift management** (shift types, rosters, client-site scheduling) — 4SYZ runs a
   client-site workforce, so this is higher-value here than for a typical office-only shop.
4. **Expenses & advances** — claims, approval, reimbursement, accounting hand-off.
5. **Performance** (goals/KRA, appraisal cycles, feedback).
6. **Recruitment / ATS** (job openings → applicant → offer → onboarding).
7. **Platform maturity** — mobile PWA, geo check-in, reporting/analytics, workflow engine,
   and the go-live hardening the PRD already lists.

A credible "HRMS pro" sequence is **Payroll → Lifecycle → Shift → Expenses → Performance
→ Recruitment**, with platform maturity threaded throughout.

---

## 2. Frappe HR module map (the benchmark)

Frappe HR advertises 13+ modules; its core module set is:

| # | Frappe module | What it covers |
| - | --- | --- |
| 1 | **HR Setup** | Company/department/designation/grade masters, HR settings, holiday lists, workflows |
| 2 | **Tenure (Employee Lifecycle)** | Onboarding, confirmation/probation, promotion, transfer, separation/exit, exit interviews |
| 3 | **Recruitment** | Job requisition/opening, applicant tracking, interviews, job offer → onboarding |
| 4 | **Shift & Attendance** | Shift types, shift assignment/roster, **geolocation check-in/out**, attendance, regularization, holiday calendars, attendance reports |
| 5 | **Leaves** | Leave types & policies, allocation/accrual, application + approval, encashment, compensatory off, regional holiday import |
| 6 | **Expenses** | Expense claims, employee advances, **travel requests**, multi-level approval, **ERPNext accounting integration** |
| 7 | **Performance** | Appraisal cycles, **KRA/goals**, self-evaluation, feedback |
| 8 | **Payroll** | Salary structures, salary slips, payroll entry/runs, additional salary, off-cycle payments, **loans**, income breakdowns |
| 9 | **Tax & Benefits** | Income tax slabs, flexible benefits, proof submission, income-tax computation on slips |
| + | **Mobile app (PWA)** | Leave apply/approve, check-in/out, profile — on mobile |
| + | **Reports/Analytics** | Attendance, leave balance, payroll and statutory registers |

---

## 3. Side-by-side: Frappe vs. 4SYZ portal (R1)

Legend: ✅ have · 🟡 partial · ❌ missing · ➖ out of scope / deliberate non-goal

| Capability area | Frappe HR | 4SYZ portal today | Status | Notes |
| --- | --- | --- | --- | --- |
| **Identity / RBAC / audit** | Roles + permissions, doc-level perms | Default-deny policy engine, 2FA-for-all, append-only audit, token-version revocation | ✅ **ahead on rigor** | Portal's IDOR-tested scoping + field encryption is stronger than stock Frappe perms |
| **Employee master** | Rich `Employee` doctype (lifecycle fields) | Flat employee record (profile, contact, sensitive fields) | 🟡 | No grade/band, cost-center, reporting-tree-as-data, lifecycle status |
| **Profile self-service** | Yes | Profile edit, photo, masked sensitive + reveal, change-approval | ✅ | At parity / ahead (encryption + verify queue) |
| **Directory** | Employee list/org | Searchable public directory | ✅ | Org-chart view is a nice-to-have gap |
| **Leave** | Full (accrual, encashment, comp-off) | Types, balances, apply, approve, cancel | 🟡 | Missing: accrual/carry-forward rules, encashment, comp-off, holiday-calendar-aware day counting, per-location calendars |
| **Attendance** | Check-in (geo), shifts, regularization | Biometric monthly import, exceptions, corrections + approval | 🟡 | Have biometric truth + corrections; missing live check-in, shift-awareness, payroll-cutoff lock |
| **Shift management** | Shift types + roster | — | ❌ | **High value for client-site workforce** |
| **Approvals / workflow** | Generic workflow engine | Unified inbox + delegation (leave/attendance/profile) | 🟡 | Solid for current types; not a general configurable workflow engine |
| **Announcements** | Energy/notice | Targeted + versioned must-ack | ✅ **ahead** | Ack-versioning is a genuinely strong feature |
| **Tasks** | (via Projects) | Assign/track with evidence | ✅ | Light but present |
| **Documents** | Attachments | Publish payslip/letter/policy, draft gating | 🟡 | No letter templating/e-sign; no doc categories beyond the basics |
| **Helpdesk / POSH** | (via Helpdesk app) | Tickets + SLA + **confidential POSH committee** | ✅ **ahead** | POSH confidentiality model is a differentiator |
| **Notifications** | Email/mobile | In-app computed bell | 🟡 | No email/push/escalation yet (R2) |
| **Payroll** | Full India payroll | — | ❌ | **Biggest gap** |
| **Statutory (PF/ESI/PT/TDS/Form 16)** | Yes | — | ❌ | India compliance; pairs with payroll |
| **Expenses & advances** | Full + accounting | — | ❌ | |
| **Performance (goals/appraisal)** | Full | — | ❌ | |
| **Recruitment / ATS** | Full | — | ❌ | |
| **Lifecycle (onboard→exit)** | Full | — | ❌ | |
| **Mobile PWA** | Dedicated app | Mobile-first responsive SPA | 🟡 | Responsive, but not installable/offline/push |
| **Reporting / analytics** | Many reports | Per-module summaries only | 🟡 | No cross-module reports or exports |
| **Accounting integration** | ERPNext native | SmartPantry has Zoho Books AR/AP | 🟡 | Payroll JV → Zoho Books is the natural bridge |

**Where the portal already beats stock Frappe:** security posture (default-deny + IDOR
tests + field encryption + 2FA-for-all), POSH confidentiality, versioned must-ack
announcements, and a cleaner mobile-first UX. These are worth preserving as the product
grows — don't regress them while chasing feature breadth.

---

## 4. Prioritized roadmap to "HRMS pro"

Phases are value-ordered and mostly sequential, but each is independently shippable.
Effort is a rough order of magnitude (S ≈ days, M ≈ 1–2 wks, L ≈ 3–5 wks, XL ≈ 6 wks+)
at the current one-module-at-a-time cadence.

### R2 — Make it a system of record (payroll-ready)
The theme: turn attendance + leave into **money**, and give the employee record a **life**.

| Item | Why | Depends on | Effort |
| --- | --- | --- | --- |
| **Attendance → payroll feed + cutoff lock** (FR-16) | Lock the month (e.g. 25th), count working days against per-location holiday calendars, freeze corrections after cutoff | Attendance (have) | M |
| **Payroll core** | Salary structures (earnings/deductions components), salary slips, a payroll run that consumes locked attendance + leave-without-pay | Cutoff lock | **XL** |
| **India statutory** | PF, ESI, Professional Tax, TDS (income-tax slabs, declarations, proof submission), Form 16/24Q | Payroll core | **XL** |
| **Payslip documents** | Generate + publish payslips into the existing **Documents** module (already draft-gated) | Documents (have), Payroll | S–M |
| **Payroll JV → Zoho Books** | Post the monthly payroll journal to SmartPantry's existing Zoho Books integration | Payroll, SmartPantry AP | M |
| **Employee lifecycle / tenure** | Onboarding checklist, probation→confirmation, transfer, promotion (with grade/band), **separation + F&F + exit interview**; lifecycle status on the employee record | Employee master changes | L |
| **Letters & templating** | Offer/appointment/confirmation/relieving letters from templates → Documents (optional e-sign) | Documents, Lifecycle | M |
| **Notifications: email/push + escalation** | Finish FR-13: actually deliver, with manager escalation on SLA breach | Notifications (have) | M |
| **Step-up auth on sensitive changes** (FR-26) | Re-auth before bank/PAN/Aadhaar change; already flagged in Profile | Auth (have) | S |

### R3 — Operations depth
The theme: schedule the workforce and move money for expenses.

| Item | Why | Depends on | Effort |
| --- | --- | --- | --- |
| **Shift management** | Shift types, rosters, client-site assignment; feed shift context into attendance/exceptions | Attendance | L |
| **Live check-in (geo + selfie)** | Mobile check-in for client-site staff where biometric hardware isn't present; complements the biometric feed, not replaces it | Shift, Mobile PWA | L |
| **Expenses & advances** | Claims, employee advances, multi-level approval (reuse approvals+delegation), reimbursement, **JV → Zoho Books** | Approvals (have), Books integration | L |
| **Travel requests** | Pre-trip request → advance → expense reconciliation | Expenses | M |
| **Leave engine depth** | Accrual/carry-forward, encashment, comp-off, LOP integration with payroll, per-location holiday calendars + regional import | Leave (have), Payroll | M–L |
| **Reporting & exports** | Cross-module registers (muster roll, leave ledger, payroll register, statutory returns), CSV/PDF export | All modules | M |

### R4 — Talent & platform
The theme: grow people and harden the platform.

| Item | Why | Depends on | Effort |
| --- | --- | --- | --- |
| **Performance** | Appraisal cycles, goals/KRA, self-evaluation, 360 feedback, rating → increment hand-off to payroll | Lifecycle, Payroll | L |
| **Recruitment / ATS** | Job openings → applicant pipeline → interviews → offer → onboarding (closes the loop into Lifecycle) | Lifecycle | L |
| **Mobile PWA** | Installable, offline-tolerant, push notifications — the SPA is already mobile-first, so this is an upgrade not a rewrite | SPA (have) | M |
| **Workflow engine** | Generalize approvals into configurable multi-step workflows (so new doc types don't each hand-roll approval) | Approvals (have) | L |
| **Org chart & analytics** | Reporting tree as data, org-chart view, HR dashboards | Employee master | M |

### Continuous — Go-live hardening (from PRD v1.4, already tracked)
Not a phase — do before/with the first real-data module, especially payroll:
- Real **SSO + DLT mobile-OTP** (replace dev password/`000000` OTP) and **rotate all seed logins**.
- Set real per-employee **`attendance_code`** mappings.
- **PostgreSQL + RLS** as the second enforcement layer (D1/SQLite has no RLS).
- **DPDP/CERT-In**: retention matrix + automation, log-retention windows, data-inventory & ADR as signed G1 artefacts.
- Native-speaker review of **kn/hi** strings.

---

## 5. Architecture guidance (how to add without bloat)

The current pattern is good; scale it, don't abandon it:

- **Keep the pure-domain core.** Each module = pure, unit-tested domain functions
  (validators, policy predicates, calculations) + thin Worker route handlers. Payroll
  especially must be **pure and exhaustively tested** — statutory math is where bugs cost
  money and trust.
- **One policy engine.** Every new permission goes through `src/policy.ts` (default-deny,
  super_admin allow-all, membership-gated exceptions like POSH). Never scatter access
  checks.
- **Migration-managed D1 + runtime-pure logic.** Continue CI-applied migrations; new
  modules add numbered migrations. Treat money as **integer paise** (as SmartPantry
  already does) — never floats.
- **Reuse, don't duplicate, approvals.** Expenses, lifecycle transitions, and letters
  should plug into the existing unified approvals inbox + delegation, not grow parallel
  queues. This is the strongest argument for the R4 **workflow engine**.
- **Documents is the output sink.** Payslips, letters, Form 16 all publish through the
  existing draft-gated Documents module — don't build per-module file handling.
- **Bridge to SmartPantry only at the ledger.** Keep HR PII isolated (the Option-B
  boundary). The *only* integration surface is **payroll/expense JVs → Zoho Books**;
  don't co-mingle employee data into the ERP D1.
- **Preserve the differentiators.** Field encryption, POSH confidentiality, 2FA-for-all,
  ack-versioning — carry these forward into every new module's design review.

---

## 6. Deliberate non-goals (for now)

- **Full ERPNext-style doctype/scripting platform** — the portal is a focused product, not
  a low-code framework. Hard-code the modules 4SYZ needs; don't build a meta-framework.
- **Benefits marketplace / insurance portals** — integrate later only if a real need lands.
- **Learning management, surveys, engagement gamification** — out of scope until the core
  system-of-record phases (payroll, lifecycle) are done.
- **Replacing the biometric system** — the biometric feed stays the attendance source of
  truth; live check-in is additive for client-site staff only.

---

## 7. Suggested next step

**Payroll is the highest-value gap**, but it's XL and statutory-heavy. Two sane entry points:

- **De-risk first:** build the **R2 attendance→payroll cutoff + working-day/holiday-calendar
  counting** (M). It's self-contained, finishes the attendance story, and produces the clean
  monthly input payroll will consume — so payroll starts from locked, trustworthy data.
- **Or start the lifecycle spine:** **employee lifecycle/tenure** (L) enriches the flat
  employee record (grade, cost-center, status, reporting tree) that payroll, performance,
  and shift all depend on.

Recommendation: **cutoff + calendar counting next**, then **payroll core**, because payroll
is the reason an SMB adopts an HRMS and everything downstream (statutory, JV, payslips)
hangs off it.

---

*Benchmark source: [frappe/hrms](https://github.com/frappe/hrms) README + module set
(HR Setup, Tenure, Recruitment, Shift & Attendance, Leaves, Expenses, Performance, Payroll,
Tax & Benefits). Portal status reflects `employee-portal/` at R1 (FR-01–09, 13).*
