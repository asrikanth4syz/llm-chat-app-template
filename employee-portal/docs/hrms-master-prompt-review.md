# Expert Review — "Master Development Prompt — 4SYZ HRMS"

> Third in the series. Read with [`hrms-gap-analysis.md`](./hrms-gap-analysis.md) and
> [`hrms-prd-review.md`](./hrms-prd-review.md). This reviews the *Master Development
> Prompt* (React + NestJS + PostgreSQL greenfield, "start from the clickable HTML
> prototype", "wait for architecture approval before coding").
>
> **Decision already taken (2026-11-14), still in force:** keep the **live stack**
> (Cloudflare Workers + D1 + TypeScript), ratify the blueprint as the *target model*,
> **extend the live portal** rather than rebuild, first milestone **payroll-ready
> attendance shipped (M1, 2026-11-14/15)**. This review is written against that decision.

---

## 1. Verdict (TL;DR)

**This is an excellent requirements catalogue and acceptance spec — adopt it as the
project's master "definition of done." But its *framing* is already superseded**, in two
ways you've consciously decided:

1. It assumes a **greenfield build on React/NestJS/PostgreSQL**. You chose to **keep the
   live Workers + D1 + TypeScript portal and extend it.** Don't re-open that — the stack
   rationale is in `hrms-prd-review.md §4`. Read this prompt as *what to build*, not
   *what to build it on*.
2. It says **"wait for architecture approval before coding."** That gate has effectively
   already passed: the architecture is decided, the gap analysis + PRD review are the
   approved plan, and **implementation is underway** (10 modules live + M1). Treat this
   document as the backlog's requirements source, not a reset to phase 0.

So: **adopt the requirements, the UI/API/testing standards, and the acceptance criteria
as checklists; ignore the "rebuild from the prototype" and "stop and wait" framing.** Most
of its Phases 1–5 and 7 are already built; the real remaining work is **payroll, lifecycle,
reports, and multilingual hardening**, exactly as the roadmap already says.

One open input: it repeatedly cites a **"supplied clickable HTML prototype"** as the
visual reference. **That prototype is not in this repo.** The portal already has a
shipped HRMS-style UI; decide whether to align it to that prototype or treat the current
UI as the reference (see §6).

---

## 2. What this prompt adds over the Engineering Blueprint v1.0

Credit where due — this is a more complete spec than the blueprint. Genuinely stronger:

- **Multilingual as a first-class, detailed requirement** (§18) — the biggest net-new
  section. Reviewed in detail in §4 below.
- **Richer role model** (8 roles incl. HR Executive, Finance Admin vs Finance Approver,
  Management Viewer) and **configurable permissions at module/page/record/field/action**.
- **Reports & analytics** as its own module with permission-scoped exports.
- **Responsive breakpoints spelled out** (1440/1024/768/360) with "transform tables to
  cards on mobile, don't just shrink."
- **UI state discipline** — every list page (search/filter/empty/loading/error states),
  every form (inline validation, unsaved-changes guard, no browser `alert()`).
- **Lifecycle depth** — probation, contract-expiry alerts, onboarding, exit + full-and-final.
- **Separation of duties** and maker-checker named explicitly for payroll.
- **Delivery artifacts list** (§15) and a concrete **testing/acceptance matrix** (§14).

All of this is good. None of it requires a different stack.

---

## 3. Requirement → current status (what this prompt actually changes)

Legend: ✅ live · 🟢 shipped in M1 · 🟡 partial · 🔜 on roadmap · 🆕 net-new vs. everything so far

| Prompt section | Status | Notes |
| --- | --- | --- |
| **6. Roles / RBAC** | 🟡 | 7 code-based roles live (default-deny policy engine). Prompt wants **8 roles** + **configurable field/record-level** perms (see §4). |
| **5A. Dashboards (role-specific)** | 🟡 | Per-module views + notifications bell live; a composed **role dashboard** (HR/employee/management tiles) is 🆕. |
| **5B. Employee management** | 🟡 | Profile, directory, documents, photo, change-approval live. Missing: org masters (dept/designation/location/cost-centre), **bulk import**, lifecycle. |
| **5C. Attendance** | 🟢🟡 | Biometric feed, corrections+approval, exceptions live; **month lock, holiday calendar, OT, payroll-input shipped in M1**. Missing: **shifts**, policy-by-category/location, break-time, live punch. |
| **5D. Leave** | 🟡 | Types, balances, apply/approve/cancel live. Missing: **accrual/carry-forward/encashment**, leave calendar, holiday-aware day counting. |
| **5E. Approvals** | ✅🟡 | Unified inbox + delegation live. Prompt adds **return-for-correction, escalation, multi-level, more categories** → 🔜 (the generic workflow engine). |
| **5F. Payroll** | 🔜 | **Not built — the core remaining work.** M1 produced the clean locked input it will consume. |
| **5G. Self-service** | ✅ | Live (profile, attendance, leave, docs, announcements, tasks, requests). |
| **5H. Documents** | 🟡 | Publish/draft/audited-open live. Missing: **expiry reminders, version history, verification**, object storage (R2). |
| **5I. Tasks & performance** | 🟡 | Tasks live. **KPI/performance** 🆕 (keep light; prompt rightly warns against auto-ratings). |
| **5J. Helpdesk & announcements** | ✅ | Both live (helpdesk + POSH confidentiality; targeted, versioned-ack announcements). |
| **12. Reports & analytics** | 🆕 | New module; CSV live only for M1 payroll-input. Permission-scoped exports needed. |
| **18. Multilingual** | 🟡 | EN/KN/HI keyed `t()` + selector (login + sidebar) + EN fallback live. Gaps in §4. |
| **11. Security** | ✅🟡 | Field encryption, append-only audit (DB triggers), 2FA-for-all, token-revocation, POSH confidentiality live. Add: DPDP retention, rate-limiting, real SSO/MFA. |

**Takeaway:** this prompt reshuffles priorities only at the margins. The spine of the
plan is unchanged: **payroll core → India statutory (CA-validated) → payslips → JV to
Books**, with lifecycle, reports and multilingual hardening threaded in.

---

## 4. New requirements worth a specific decision

### 4.1 Configurable field/record/page/action-level permissions — **scope caution**
The prompt wants an admin-configurable permission matrix at five levels. At **21–50
employees**, a fully data-driven, admin-editable field-level RBAC engine is **over-build**:
it's a large, bug-prone subsystem whose flexibility nobody will use at this size.
**Recommendation:** keep the current **code-based policy engine** (it's already
IDOR-tested and default-deny), add the **8 roles** and **separation-of-duties** maker-checker
(those are cheap and valuable), and expose configurability **only where a real need
appears** (e.g. who sits on the POSH committee — already data-driven). Revisit a general
permission-config UI only past ~150 employees. Document this as a deliberate deviation.

### 4.2 Eight-role model + separation of duties — **adopt**
Maps cleanly onto the existing engine: split HR Admin/Executive, Finance Admin/Approver,
add Management Viewer (aggregate-read, no PII). Enforce maker≠checker on payroll. Low cost.

### 4.3 Shift management + policy-by-category/location — **roadmap (R3)**
M1 already does **per-location holiday calendars**. Full shift types/rosters and
policy-assignment-by-category belong with payroll/ops depth, not before payroll.

### 4.4 Reports & analytics — **new module, permission-scoped**
Build after the data exists (post-payroll). Every report must filter by the caller's
scope (the prompt says this — correct). Reuse the M1 CSV-export pattern.

### 4.5 Lifecycle (probation, contract-expiry, onboarding, F&F) — **the "tenure" gap**
This is the connective tissue the flat employee record lacks (already flagged in the gap
analysis as R2). Contract-expiry alerts matter for 4SYZ's contract/outsourced categories.

### 4.6 Multilingual hardening (§18) — **real, well-scoped gaps to close**
Current state vs. the prompt's asks:

| §18 requirement | Current | Action |
| --- | --- | --- |
| Selector in header + login; switch anytime; EN default; EN fallback | ✅ | — |
| Unicode / Devanagari / Kannada fonts | ✅ (Noto fonts loaded) | — |
| Keyed strings, not hardcoded in components | ✅ (`t()` + `DICT`) | — |
| Business data language-independent; don't translate names/IDs | ✅ | — |
| **Persist language to the user profile (cross-device)** | 🟡 client storage only | 🆕 store on the user/profile, load at login |
| **Admin-configurable default system language** | ❌ | 🆕 small setting |
| **Locale-aware dates / numbers / currency (INR, Indian format)** | ❌ (ISO/manual) | 🆕 `Intl`-based formatting |
| **Separate resource files / i18n framework** | 🟡 inline `DICT` in `app.js` | optional refactor; fine as-is for now |
| **Professionally reviewed KN/HI** (esp. payroll/HR terms) | ❌ "initial" | 🆕 **native-speaker review before go-live** (non-negotiable for payslips) |
| PDF/email translation | N/A (none yet) | with payroll/payslips |

The foundation is sound; the gaps are **profile-persisted language, locale-aware
number/date/currency, and reviewed translations** — all small except the human translation
review, which must happen before anything money-facing ships in KN/HI.

---

## 5. Adopt these as standing checklists

No argument, fold straight in:
- **API standards (§9):** validation, versioned responses, pagination/filter/sort, audit
  logging, OpenAPI. The portal is already `/api/*`, consistent-JSON; add an OpenAPI doc.
- **UI state matrix (§10):** search/empty/loading/error on every list; inline validation,
  unsaved-changes guard, no browser `alert()`, consistent toast/confirm. (The portal uses
  `flash()`/inline today; a couple of `confirm()` calls should become styled dialogs.)
- **Testing/acceptance matrix (§14):** make it the module DoD. The pure-domain + unit-test
  pattern already matches; add API integration + a few e2e for payroll when it lands.
- **Security list (§11)** and **Definition of Done (§16).**

---

## 6. The "clickable HTML prototype" question

The prompt treats a supplied prototype as the visual starting point and says to preserve
its navigation. **It isn't in the repo, so I can't align to it.** The portal already has a
shipped HRMS-style sidebar/topbar UI. Two paths:
- **(a)** Treat the **current portal UI as the reference** and keep evolving it (default).
- **(b)** If the prototype is the intended look, share it (add it under `employee-portal/`
  or paste it) and I'll reconcile the portal's components/navigation to it.

This isn't blocking the next build step (payroll is backend-heavy), so I'll proceed on (a)
unless you hand over the prototype.

---

## 7. Carry-forward non-negotiables (don't let a "rebuild" mindset regress them)

Every new module keeps, by design review: **field-level encryption** (PAN/bank/Aadhaar),
**append-only/tamper-evident audit** (DB triggers), **POSH confidentiality** (committee-gated,
not super_admin-by-role), **2FA-for-all**, **DPDP/Aadhaar minimisation + retention**. The
prompt's security section is compatible with all of these — just make sure they survive
contact with the new features.

---

## 8. Cautions (unchanged from prior reviews, still the top risks)

1. **India statutory payroll** is still the hardest, most legally-exposed part. The prompt's
   "keep statutory configurable, subject to HR/Finance verification" is the right posture
   but is **not a payroll spec** — it needs its own workstream and a **CA sign-off** on
   PF/ESI/PT/TDS/Form-16 math and filing outputs.
2. **Over-scope.** The prompt lists ~10 modules + reports + multilingual + configurable RBAC.
   Its own §13/§16 say "don't build every module superficially at once" — agreed. Hold the
   phased line; finish each module's logic + perms + tests before moving on.
3. **Configurable-everything.** Flexibility you won't use at 50 employees is cost, not value
   (see §4.1). Default to sensible config + code; add admin-editable config only on real need.

---

## 9. Recommendation & next step

- **Ratify this document as the 4SYZ HRMS master requirements + acceptance spec.** It
  supersedes the Engineering Blueprint v1.0 as the canonical "what/DoD."
- **No change to the agreed plan or stack.** Keep extending the live portal on the phased
  sequence. Fold the net-new items (§4) into the backlog at their right phase.
- **Next build (unchanged): payroll core** — salary structures/components (effective-dated),
  a payroll run that consumes the **M1 locked payroll input**, maker-checker + lock +
  versioned revisions, payslips via the Documents module. Then **India statutory
  (CA-validated)** → bank/NEFT output → JV to Zoho Books.
- **Quick wins to slot in alongside:** the 8-role split + maker-checker, profile-persisted
  language + locale-aware INR/date formatting, and the `attendance_policy` editor (already
  offered). These are small and unblock later phases.
- **Before any money-facing KN/HI ships:** professional translation review.

---

*Reviewed against: Master Development Prompt (pasted, 2026-11-15), the live `employee-portal/`
(10 modules + M1), and the two prior review docs. No code changed by this review.*
