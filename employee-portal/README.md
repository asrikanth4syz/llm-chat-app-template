# 4SYZ Employee Portal — R0 foundation

> **Lives inside the SmartPantry repo (`employee-portal/`), but is its own system**
> — separate Cloudflare **Worker** (`employee-portal`), separate **D1**
> (`employee-portal-db`), separate **identity realm** and `JWT_SECRET`. SmartPantry
> and the portal share nothing but the git repo and the CI runner; they deploy on
> independent, path-filtered pipelines. This is the "Option B" boundary: one repo to
> clone and one pipeline to know, without co-mingling HR PII with ERP data or auth.

The start of the people platform (Employee Portal), per **PRD v1.4 → Release R0**.
This slice stands up the security foundation everything else is built on:

- **Separate identity realm** from SmartPantry (own `users` table, own `JWT_SECRET`) — DEC-02.
- **RBAC + policy engine, default deny** (`src/policy.ts`) — the single source of truth for who may see what.
- **Strict record scoping** — the headline R0 rule:
  - every login sees **strictly its own** employee record;
  - a **manager** also sees its team;
  - **HR / Finance / Auditor** see all records for their function;
  - **super_admin** sees **everything**, including all sensitive fields.
- **Sensitive-field redaction** (PAN, bank, Aadhaar, CTC) — shown only to the owner and to roles with sensitive-read-all.
- **Append-only audit log** — inserts only; DB triggers block any update/delete (not even System Administrator can alter it).

> D1 (SQLite) has no row-level security, so **every scope check lives in Worker code** and is unit-tested directly — the IDOR safety net the PRD requires. Production adds **PostgreSQL + RLS** as a second layer.

## Prove the isolation rule (no install needed)

```bash
cd employee-portal
npm test          # node --test, strips TS types; proves the access-control core
```

`test/policy.test.ts` asserts: an employee sees only their own record; one employee cannot reach another's (IDOR denied both ways); a manager sees the team but not the team's sensitive fields; super_admin sees all records and all sensitive fields; default deny.

## Run locally

```bash
npm install
wrangler d1 create employee-portal-db        # paste the id into wrangler.jsonc
npm run migrate:local                        # schema + seed logins
echo "dev-secret" | wrangler secret put JWT_SECRET   # or set in .dev.vars for `wrangler dev`
npm run dev
```

Dev logins (password `pw123`): `admin@4syz.com` (super_admin), `hr@4syz.com` (HR), `meera@4syz.com` (manager), `asha@4syz.com` / `bala@4syz.com` (employees).

```bash
# Asha logs in (2FA for all → password + otp) and sees only herself:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"asha@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
curl -s localhost:8787/api/employees -H "Authorization: Bearer $TOKEN"   # → just Asha
curl -s localhost:8787/api/employees/e_bala -H "Authorization: Bearer $TOKEN"   # → 403 forbidden
# Omitting "otp" now returns {"mfa_required":true} for every role, employee included.
# Super admin sees everyone, with sensitive fields:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"admin@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
curl -s localhost:8787/api/employees -H "Authorization: Bearer $TOKEN"   # → all, incl. pan/bank/ctc
```

## Deploy

A **dedicated** workflow, `.github/workflows/employee-portal.yml` (at the repo
root), is **path-filtered to `employee-portal/**`** — it typechecks, runs the
access-control tests, applies the D1 migrations and deploys the portal Worker on
every push to `main` that touches this folder. A SmartPantry-only change never
triggers it, and a portal change never redeploys SmartPantry.

The D1 database already exists (`employee-portal-db`, id in `wrangler.jsonc`), and
the repo already carries the `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
secrets (SmartPantry uses the same Cloudflare account). So the only one-time step
left before logins work is the portal's **own** app secret:

```bash
cd employee-portal
npx wrangler secret put JWT_SECRET            # a long random string — separate realm from SmartPantry
openssl rand -base64 32 | npx wrangler secret put FIELD_ENC_KEY   # NFR-03 field-encryption key
```

`FIELD_ENC_KEY` (base64 of 32 bytes) encrypts bank/PAN/Aadhaar at rest. Reads of the
plaintext scaffold seed work without it; **submitting an encrypted change (bank/PAN/
Aadhaar) requires it** (returns 501 until set). Never rotate it without re-encrypting
existing values, or they become unreadable.

Then push a change under `employee-portal/` to `main` (or run the workflow
manually). CI applies the migrations and deploys. Check the first login with the
seed users, then rotate/disable them.

Deploy from your machine instead (from `employee-portal/`):
`npm install && npm run migrate:remote && npm run deploy`.

## UI (Profile, Leave, Attendance, Tasks, Directory, Announcements, Documents, Helpdesk, Approvals)

The Worker serves a mobile-first SPA from `public/` (static-assets binding in
`wrangler.jsonc`; `/api/*` still falls through to the Worker). It uses an HRMS-style
**sidebar + topbar** layout (a scrollable tab bar on phones) with **Profile**,
**Leave**, **Attendance**, **Tasks**, **Directory**, **Announcements**, **Helpdesk** and
**Approvals** sections, a **notifications bell** in the top bar, and **inline `?` help**
tooltips on the key section headers. Open the Worker URL in a browser:

- **Sign in** with email + password + the 2FA code (dev `000000`).
- **Profile** — a welcome header (time-based greeting + name + **profile photo**,
  uploaded and auto-downscaled client-side); employment details (read-only); contact
  fields you can edit inline (phone, personal email, address, emergency contact →
  apply immediately); and the identity/financial block **masked by default** with
  per-field **Reveal** (logged) and **Request change** (bank/PAN/Aadhaar → encrypted
  pending request). HR/super_admin get a **Verification queue** for pending changes.
  The signed-in user's name + photo show in the top bar.
- **Leave** — balances per type (entitled / used / pending / available), an apply form
  (type, dates, half-day, reason), your request history with **Cancel**, and — for
  managers (team) and HR/super_admin (all) — a **Leave approvals** queue.
- **Attendance** — pick a month: per-day IN/OUT, worked hours, **overtime** and status
  from the biometric system, with **exception flags** (missing punch, absence, short
  hours) and your month's **payable days** (calendar − loss-of-pay) against the holiday
  calendar; a **Request correction** form (regularisation / on-duty / client visit /
  WFH); your corrections; and, for managers/HR, a **Correction approvals** queue. HR /
  Finance additionally get **payroll cutoff & lock**, a **holiday calendar** editor, and
  the **payroll-input register** (per-employee payable days / LOP / OT, CSV export).
- **Tasks** — your assigned tasks (status, priority, due date, overdue flag); update
  status and add evidence. Managers/HR assign tasks within their scope; employees can
  self-assign. An "assigned by me" list shows what you've delegated.
- **Notifications** — the top-bar bell shows a live count of what needs you (pending
  approvals, must-acknowledge announcements, open tasks, tickets to handle); click an
  item to jump to it.
- **Directory** — search all colleagues by name / role / location; shows name,
  designation, location, segment, work email and manager only. No salary, bank,
  identity or personal contact.
- **Announcements** — a feed of posts targeted to you; **must-acknowledge** ones show an
  Acknowledge button. Publishers (HR/super_admin) create posts for an audience, mark
  policy items must-acknowledge, re-publish (bumps the version → people re-acknowledge),
  retire/reactivate, and see **who acknowledged** the current version.
- **Documents** — your **published** documents (payslips, letters, policies) to open or
  download; draft payslips are never shown. HR/super_admin publish documents to an
  employee (file upload or text), and can keep them as drafts until ready.
- **Helpdesk** — raise HR / IT / general requests or a **confidential POSH complaint**;
  track status, SLA and the comment thread. Agents (HR/IT) handle ordinary tickets; a
  **queue** shows what's assigned to you. super_admin configures the **POSH Internal
  Committee** — only its members (and the complainant) can see POSH tickets.
- **Approvals** — one inbox of everything awaiting your decision (leave, attendance
  corrections, and — for HR — profile changes), approve/reject with a comment; plus
  **delegation** (hand your approval authority to a colleague for a date range).
- Language switcher: **English / ಕನ್ನಡ / हिन्दी** (kn/hi strings are initial — have a
  native speaker review before go-live).

## Endpoints (R0 + R1: FR-01, FR-03)

| Method | Path | Who | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | JWT; **all** roles must also send `otp` (dev `000000`) — 2FA for all, DEC-02 |
| GET | `/api/dashboard` | any login | role-aware aggregates (me: present/tasks/latest payslip; org: headcount, dept breakdown, contract/probation alerts, payroll status) |
| POST | `/api/admin/employees` | employee.manage | create a full employee master record |
| POST | `/api/admin/employees/:id/update` | employee.manage | edit the employee master (sensitive fields encrypted; blank keeps current) |
| GET·POST | `/api/admin/employees/:id/additional-pay?month=YYYY-MM` | GET payroll.read_all, POST payroll.prepare | list / add a month's bonus/variable/incentive/ad-hoc pay for an employee |
| POST | `/api/admin/additional-pay/:id/delete` | payroll.prepare | remove an additional-pay item (if its month isn't locked) |
| GET | `/api/me` | any login | own profile (+ `lang`); sensitive fields **masked** — `?reveal=pan,bankAccount,aadhaarLast4` returns full + logs REVEAL |
| POST | `/api/me/lang` | any login | set preferred UI language (`en`/`hi`/`kn`), persisted to the user profile (migration `0013`) |
| GET | `/api/employees` | any login | scoped list — self / team / all by role, sensitive fields masked |
| GET | `/api/employees/:id` | any login | one record if policy allows (masked; `?reveal=…`), else 403 (+ DENY audit) |
| GET | `/api/directory?q=` | any login | FR-08: all colleagues' public fields (name, designation, location, segment, work email, manager); salary/bank/identity/personal contact never selected |
| POST | `/api/profile/change` | any login | FR-01: `{field,value}`. Direct fields (phone, personalEmail, address, emergencyContact) apply now; bank/PAN/Aadhaar → encrypted **pending** request |
| GET | `/api/profile/changes` | any login | own change requests (status; encrypted value never returned) |
| POST | `/api/profile/bank` | any login | FR-01: self-service bank details `{bankPayeeName,bankAccount,bankIfsc,bankAccountType,bankName,bankProof?}` — account # encrypted, stored **unverified** (`bank_verified=0`) pending HR KYC |
| GET | `/api/me/bank-proof` | owner | own stored cancelled-cheque / passbook data URL (kept out of list/profile payloads) |
| GET | `/api/admin/employees/:id/bank-proof` | sensitive-read-all | an employee's cancelled-cheque / passbook (audited `BANK_PROOF_VIEW`) |
| POST | `/api/admin/profile/changes/:id/approve`·`/reject` | hr_admin, super_admin | verify a pending bank/identity change (`profile.verify`) |
| GET | `/api/audit` | auditor, super_admin | recent audit entries |
| GET | `/api/policy/matrix` | it_admin, auditor, super_admin | role → permission matrix (G1 artefact) |
| POST | `/api/admin/users/:id/revoke` | it_admin, super_admin | kill a user's sessions (`{"deactivate":true}` also disables login) |
| GET | `/api/leave/types` · `/api/leave/balances` | any login | FR-03: leave types; own balances (entitled/used/pending, current year) |
| GET·POST | `/api/leave/requests` | any login | own requests; submit `{leaveTypeId,startDate,endDate,halfDay?,reason?}` (409 if over balance) |
| POST | `/api/leave/requests/:id/cancel` | owner | cancel own pending/approved request (approved restores balance) |
| GET | `/api/leave/approvals` | manager, hr_admin, super_admin | pending requests to decide — team for a manager, all for HR |
| POST | `/api/leave/requests/:id/approve`·`/reject` | manager (team), hr_admin, super_admin | decide `{comment?}`; self-approval blocked; approve adds to `used` |
| POST | `/api/admin/attendance/import` | hr_admin, it_admin, super_admin | FR-02: ingest biometric rows `{month,rows[]}`; matches `attendance_code`→employee, upserts days, reports unmatched codes |
| GET | `/api/attendance?month=YYYY-MM` | any login | own days (IN/OUT/work/status) + per-day exceptions + monthly summary |
| GET·POST | `/api/attendance/corrections` | any login | own corrections; submit `{date,type,requestedIn?,requestedOut?,reason?}` |
| GET | `/api/attendance/corrections/approvals` | manager, hr_admin, super_admin | pending corrections — team for a manager, all for HR |
| POST | `/api/attendance/corrections/:id/approve`·`/reject` | manager (team), hr_admin, super_admin | decide; approve writes the day back (status P, source manual) — **refused if the month is locked** |
| GET | `/api/admin/attendance/periods` | attendance.lock (hr_admin, finance, super_admin) | M1: month lock states (last 36) |
| POST | `/api/admin/attendance/periods/:ym/lock`·`/unlock` | attendance.lock | lock/unlock a month for payroll (audited); locking freezes import/corrections |
| GET | `/api/admin/attendance/payroll-input?month=YYYY-MM` | attendance.lock | per-employee payroll input (payable days, present/leave/LOP, OT) + locked flag |
| GET·POST | `/api/admin/attendance/policy` | attendance.lock (GET also attendance.manage) | read/update the attendance policy (weekly-off days, weekly target, full-day hours) |
| GET·POST | `/api/admin/salary/components` | payroll.prepare | P6a: salary component catalog; upsert `{code,name,kind,calcMethod,baseCode?,prorates?,…}` |
| GET | `/api/admin/employees/:id/salary` | payroll.read_all | effective-dated salary history + component breakdown |
| POST | `/api/admin/employees/:id/salary` | payroll.prepare | add a salary revision `{effectiveFrom,components[]}` (supersedes the open one; forward-only) |
| GET | `/api/admin/payroll/runs?month=YYYY-MM` | payroll.read_all | P6b: payroll runs (latest versions) for a month |
| POST | `/api/admin/payroll/runs` | payroll.prepare | prepare/recompute a run `{ym}` — month must be attendance-locked |
| GET | `/api/admin/payroll/runs/:id` | payroll.read_all | run + per-employee lines + component breakdown |
| GET | `/api/admin/payroll/runs/:id/register` | payroll.read_all | CSV register (audited) |
| POST | `/api/admin/payroll/runs/:id/submit-review` | payroll.prepare | P6c: draft → in_review |
| POST | `/api/admin/payroll/runs/:id/approve` | payroll.approve (SoD) | in_review → locked; generates payslips |
| POST | `/api/admin/payroll/runs/:id/reject` | payroll.approve/review | in_review → draft `{comment?}` |
| POST | `/api/admin/payroll/runs/:id/reopen` | payroll.approve | locked → a new draft version (locked kept) |
| GET | `/api/admin/payroll/runs/:id/bank` | payroll.read_all | bank/NEFT advice CSV (decrypts bank; audited) |
| GET | `/api/admin/statutory/config?statute=pt` | payroll.read_all | S7a: statutory config (PT slabs per state) |
| POST | `/api/admin/statutory/config` | statutory.config | upsert a PT state config `{statute:"pt",state,params,enabled}` or TDS config `{statute:"tds",…}` |
| GET | `/api/tax/me` | any login | S7b: own FY regime + investment declarations |
| POST | `/api/tax/regime` | any login | elect `{regime:"old"\|"new"}` for the FY |
| POST | `/api/tax/declarations` | any login | declare `{section,amountRupees,fy?}` (80C/80D/HRA/HOME_LOAN/OTHER) |
| GET | `/api/admin/tax/declarations` | tax.verify | declaration queue to verify |
| POST | `/api/admin/tax/declarations/:id/verify`·`/reject` | tax.verify | verify/reject a declaration `{note?}` |
| GET·POST | `/api/admin/holidays?year=YYYY` | attendance.lock / attendance.manage | holiday calendar; add `{date,name,location?}` (`*`=all locations) |
| POST | `/api/admin/holidays/:id/delete` | attendance.lock / attendance.manage | remove a holiday (refused if its month is locked) |
| GET | `/api/approvals` | manager, hr_admin, super_admin, delegates | FR-04: unified pending inbox (leave + attendance + profile) within scope, incl. delegated; each item carries its `decideBase` |
| GET·POST | `/api/approvals/delegations` | approvers | list my delegations (out/to-me); create `{delegateEmployeeId,startsOn?,endsOn?}` |
| POST | `/api/approvals/delegations/:id/revoke` | delegator, it_admin, super_admin | deactivate a delegation |
| GET·POST | `/api/helpdesk/tickets` | any login | FR-09: my tickets; raise `{category,subject,description}` (category hr/it/general/posh) |
| GET | `/api/helpdesk/queue` | helpdesk.agent, POSH committee | tickets to handle — non-POSH for agents, POSH for committee |
| GET | `/api/helpdesk/tickets/:id` | creator, agent, POSH committee | ticket + comments (+ `canHandle`); POSH view audited |
| POST | `/api/helpdesk/tickets/:id/comment` · `/status` | viewers / handlers | add a comment; set status + assignee |
| GET·POST | `/api/admin/posh/committee` | super_admin | list / add committee members (FR-21) |
| POST | `/api/admin/posh/committee/:employeeId/remove` | super_admin | remove a committee member |
| GET | `/api/announcements` | any login | FR-07: feed targeted to me (audience all/segment), each with `acked` for the current version |
| POST | `/api/announcements/:id/ack` | any login | acknowledge the current version |
| GET·POST | `/api/admin/announcements` | announcement.publish | list all (with ack counts); create `{title,body,audience,requiresAck}` |
| POST | `/api/admin/announcements/:id` · `/:id/active` | announcement.publish | re-publish (bumps version → re-ack); activate/retire |
| GET | `/api/admin/announcements/:id/acks` | announcement.publish | who acknowledged the current version |
| GET·POST | `/api/tasks` | any login | FR-05: tasks assigned to me; create `{assigneeEmployeeId?,title,description,dueDate,priority}` |
| GET | `/api/tasks/assigned` | any login | tasks I assigned to others |
| POST | `/api/tasks/:id` | assignee or assigner | update `{status?,evidence?}` (done sets completed_at) |
| GET | `/api/notifications` | any login | FR-13: computed counts (approvals, must-ack announcements, open tasks, helpdesk queue) |
| GET | `/api/documents` · `/api/documents/:id` | any login | FR-06: my published documents; open one (own+published, or document.manage) |
| GET·POST | `/api/admin/documents` | document.manage | list all (incl. drafts); publish `{employeeId,title,category,file?,body?,status?}` |
| POST | `/api/admin/documents/:id/publish` · `/:id/delete` | document.manage | publish a draft; delete |

## FR-06 Documents

- HR/super_admin (`document.manage`) publish documents to a specific employee — a file
  (PDF/image data URL, ~1.5 MB cap) and/or text, as a **draft** or **published**
  (migration `0011`). The employee sees **only their own published** documents;
  `canViewDocument` keeps draft payslips invisible to the employee. Opening a document
  is audited.

## FR-05 Tasks & FR-13 Notifications

- **Tasks** (migration `0010`): owner, due date, priority, status and an evidence note.
  `canAssignTaskTo` allows self-assignment, a manager assigning to direct reports
  (`task.assign_team`), and HR/super_admin to anyone (`task.assign_all`). Both the
  assignee and the assigner may update a task.
- **Notifications** are **computed on demand** (no new storage) from existing state —
  pending approvals in your scope, unacknowledged must-ack announcements, your open
  tasks (with an overdue count), and your helpdesk queue. The top-bar bell shows the
  total and refreshes on navigation. Email/push reminders and escalations are a
  follow-up (R2).

## FR-07 Announcements

- **Audience targeting** — `all`, `office` or `client_site` (by employee segment); the
  feed shows only posts that reach you.
- **Versioned acknowledgement** — a post can require acknowledgement; editing it bumps
  `version`, so prior acks no longer count and people must acknowledge again. The
  publisher sees the ack count and the list of who acknowledged the current version
  (migration `0009`). `announcement.publish` is granted to HR and super_admin.

## FR-09 Helpdesk & FR-21 POSH

- **Tickets** carry a category (hr / it / general / posh), subject, description, status
  (open → in_progress → resolved → closed), optional assignee and a comment thread;
  an **SLA** target per category drives an *overdue* flag (migration `0008`).
- **Agents** (`helpdesk.agent`: HR, IT, super_admin) see and handle ordinary tickets.
- **POSH is confidential (FR-21):** a POSH ticket is visible **only** to the
  complainant and the **Internal Committee** — never to ordinary agents, and *not to
  super_admin by role*. `canViewTicket`/`canHandleTicket` gate on committee membership
  (the `posh_committee` table), not on `hasPermission`'s allow-all. Committee access to
  a POSH complaint is audited.
- **Committee is configurable** by super_admin (`posh.manage`) — add/remove specific
  employees in the Helpdesk tab's POSH section.

## FR-04 Approvals

- **One inbox** aggregates every pending item the signed-in user may decide — leave
  requests, attendance corrections, and (for `profile.verify` holders) profile
  changes — each with its own decide URL. Self-approval is blocked throughout.
- **Delegation:** an approver can grant their authority to a colleague for a date
  range (`approval_delegations`, migration `0006`). While active, the delegate's inbox
  includes the delegator's team's requests and they may decide them — the leave and
  attendance decide endpoints honour delegated authority, not just the base role
  scope. Revoking (or the window lapsing) withdraws it immediately.

## Payroll core — P6a (salary setup)

First slice of payroll (full spec: `docs/payroll-core-spec.md`). **No run engine yet** —
this lays the salary foundation. Money is **integer paise**; percent values are **basis
points**. Migration `0014`.

- **Employee master dates** — `employees.date_of_joining` / `date_of_exit` (needed so
  proration bounds pay to the employment window, not counting pre-joining days as LOP).
- **Salary component catalog** (`salary_components`) — reusable earning/deduction
  definitions (`fixed` or `percent_of_base`, taxable/statutory/prorates flags). Seeded with
  BASIC, HRA (40% of basic), SPECIAL, CONVEY, and **statutory placeholders** PF/PT/TDS
  (zero-valued — rules land in the CA-validated statutory phase).
- **Effective-dated employee salary** (`employee_salaries` + `employee_salary_components`) —
  a new revision supersedes the open one from its start date (forward-only, no overlap);
  history is retained; `monthly_gross_paise` is stored for traceability. Component rows are
  denormalised onto the revision so historical salaries stay immutable.
- **Pure engine** (`src/payroll.ts`, unit-tested): `expandComponents` (percent-of-base,
  sequence), `computeLine` (LOP as its own line; **configurable divisor** calendar/fixed_30/
  fixed_26 via the deduction model — a 31-day fully-present month never overpays;
  negative-net / zero-pay exceptions), `resolveSalarySegments` (effective-dated incl.
  **day-weighted mid-month revisions**, joiner/exit windows). Decisions confirmed
  2026-11-15: calendar-day default (fixed_30 selectable), statutory next phase, OT
  capture-only, day-weighted revisions.
- **UI** — a **Payroll** tab (payroll roles only) to assign/revise employee salary (live
  gross in ₹) and manage the component catalog.
### P6b — the payroll run (migration `0015`)

- **Prepare a run** for a month whose **attendance is locked (M1)** — refused otherwise.
  It computes **one line per employee** from their effective-dated salary and the locked
  attendance: `computeLine` per salary segment (LOP from working-day absences within the
  employment window), `aggregatePayLines` to combine **day-weighted mid-month revisions**,
  with the configured divisor. **Idempotent** — re-preparing a `draft` run recomputes in
  place (same version); an `approved`/`locked` run is refused (reopen → new version, P6c).
- **Lines** carry employed/LOP days, OT minutes, earned gross, deductions, LOP and net (all
  paise), each with its **component breakdown**, plus an **exception** flag
  (`no_salary` / `missing_bank` / `negative_net` / `zero_pay`). A run stores totals +
  exception count; nothing is approved yet (status `draft`).
- **UI** — the Payroll tab's **Run** card: pick a locked month, **Prepare**, review the
  register (per-employee net in ₹, exceptions highlighted) and **export CSV**.
- **Pure engine** stays fully unit-tested (`computeLine`, `aggregatePayLines`,
  `resolveSalarySegments`); the Worker only orchestrates DB + persistence.
### P6c — maker-checker, lock, payslips, bank advice (migrations `0016`, `0017`)

Closes **payroll core**. The run becomes a controlled, auditable, maker-checker artefact.

- **State machine:** `draft → in_review → locked`, with **reject** (→ draft) and **reopen**
  (locked → a new draft **version**; the locked version and its payslips are retained).
  Every transition is audited.
- **Separation of duties:** approve requires `payroll.approve` **and** the approver ≠ the
  preparer (`canApprovePayroll`, super_admin not exempt). Approve is **blocked** while any
  line has a blocking exception (`negative_net` / `no_salary` / `zero_pay`); `missing_bank`
  only warns.
- **Payslips:** on approve+lock, each line generates a **payslip published through the
  Documents module** (category `payslip`) — employees see it in their **Documents** tab
  (own + published only). Re-approving a month supersedes the prior payslips. Net is shown
  rounded to the rupee (exact paise retained).
- **Bank/NEFT advice:** an audited CSV that **decrypts bank accounts** (finance only), with
  payee name, account number, IFSC, account type and bank name per line, excluding lines with
  no account or non-positive net. A `kyc_verified` column plus a trailing **WARNING** line
  flag any accounts not yet HR-verified, so finance verifies KYC before releasing payment.
- **Dev seed (`0017`):** `finmaker@4syz.com` (Finance Admin / maker) and
  `fincheck@4syz.com` (Finance Approver / checker), both `pw123` + OTP `000000`, so the
  flow is demonstrable. Rotate before go-live.

**End-to-end:** assign salaries → lock the attendance month → **Prepare** (maker) →
**Submit for review** → **Approve & lock** (checker, different user) → payslips land in
employees' Documents; export register + bank advice.

**Payroll core is now feature-complete.**

## Statutory — S7a: Professional Tax (migration `0018`)

Full spec: `docs/payroll-statutory-spec.md`. At 4SYZ's current headcount **EPF and ESI are
not applicable** (confirmed 2026-11-15); **only Professional Tax** applies now, and **TDS is
S7b**. Statutory math is **parameterised and CA-validated** — no rate is hardcoded.

- **Config model** (`statutory_config`) — per-state, effective-dated params + an **`enabled`
  flag**. `employee_statutory` holds each employee's PT state (seeded `KA`).
- **Pure `ptForState`** (unit-tested) — slab lookup on the earned gross, optional February
  special, rupee rounding. Returns **0 unless a config exists and is enabled**, so PT is
  **inert until Finance turns it on**.
- **Run integration** — the payroll run adds a **Professional Tax** deduction line only for
  employees whose state has an enabled config; it flows into net, the register, the payslip
  and the bank advice automatically.
- **UI** — a **Professional Tax** card in the Payroll tab (finance): per-state slabs editor
  (nil threshold, ₹/month above, Feb special) + Enabled toggle, with a prominent **"seeded
  slabs are illustrative — enter CA-confirmed slabs, then enable"** warning.
- **Shipped DISABLED.** The seeded Karnataka slabs (nil ≤ ₹24,999, ₹200 above) are
  illustrative; **CA confirms the current-FY slabs**, Finance enters them and flips Enabled,
  and a **1–2 month parallel run reconciles to zero** before PT drives real payslips.
## Statutory — S7b: TDS on salary (migration `0019`)

Full spec: `docs/payroll-statutory-spec.md`. Parameterised + CA-validated; **no rate is
hardcoded**, and TDS is **inert until Finance enables the config**.

- **Pure engine** (`src/payroll.ts`, unit-tested): `slabTax` (progressive bands),
  `tdsMonthly` (projection method — annual tax on projected FY income, less **YTD already
  deducted**, over the **remaining months**, so it trues up), with **rebate 87A**, **cess**,
  **surcharge bands**, and **206AA** (no-PAN floor). `fyOf` / `fyMonthsRemaining` for the
  Indian Apr–Mar year. Returns 0 unless the config exists AND is enabled.
- **Self-service** (`tax_declarations`): an employee **elects a regime** for the FY and,
  under the **old** regime, **declares investments** (80C/80D/HRA/home-loan/other). Only
  **verified** declarations reduce TDS (unless the config honours provisional). HR/Finance
  **verify/reject** via a queue (`tax.verify`). New regime applies the standard deduction only.
- **Run integration** — the run projects each employee's annual gross (prior **locked** FY
  runs' gross + current month annualised), reads verified declarations + regime + PAN
  presence, computes monthly TDS via `tdsMonthly`, and adds a **TDS** deduction line →
  net/register/payslip/bank advice. YTD TDS comes from prior locked runs in the same FY.
- **UI** — employee **Tax (TDS)** card in Profile (regime + declarations); finance **TDS
  config** (advanced JSON params + enable) and **declaration-verify queue** in the Payroll tab.
- **Shipped DISABLED** with illustrative FY slabs. The CA confirms current-FY parameters,
  Finance enters them + enables, a **parallel run reconciles to zero**, then TDS goes live.
- **Next — S7c filings:** PT challan, TDS **24Q**, **Form 16 Part B** (PF ECR / ESIC not
  needed while EPF/ESI are inapplicable). Then **payroll JV → Zoho Books**.

## Additional pay, 2nd emergency contact, notice period (migration `0021`)

- **Additional pay (variable / retention / performance bonus, incentive, ad-hoc)** —
  `employee_additional_pay`, a **per-employee, per-month** amount (earning or deduction) that
  the payroll run picks up for that month and adds **before statutory** (so PT/TDS see the
  bonus in taxable gross). It is **not** baked into the recurring structure — recurring
  variable pay instead goes in the salary components. Managed in the Payroll tab
  (`payroll.prepare`); refused for a locked month.
- **Additional emergency contact** — `employees.emergency_contact_2` (optional second
  contact), in the employee form + detail.
- **Notice period** — `employees.notice_period_days`, in the **Lifecycle & contract** section
  of the employee master. This is where it belongs: it's an **employment term** on the
  employee/employment record (per Section 17, lifecycle config owned by Employee Profile),
  and it drives the **last-working-day** calculation at resignation. Indian norms vary by
  grade and by state Shops & Establishments Acts (commonly 30/60/90 days), so it is a
  **configurable per-employee field**, defaulted to 30, not a hardcoded constant.

## UI uplift + employee master (migration `0020`)

From the mock/Section-17 design review (`docs/design-review-mock-and-section17.md`):

- **Dashboard** (new landing tab, role-aware) — stat tiles (headcount/active/pending
  approvals/payroll status for HR+finance+management; present-days/open-tasks/notifications/
  latest-payslip for employees), an **Action centre** (pending items from `/api/notifications`
  with deep links), and (HR) a **department breakdown** + **contract-expiry / probation-due
  alerts**. All from real data (`/api/dashboard`).
- **Attendance: policy banner + weekly-hours bars** — every employee's Attendance tab shows
  the configured policy (reporting time, grace, weekly target, weekly-off) and **weekly
  working-hours bars with variance + on-track/below-target pills** (computed Mon–Sat vs the
  target). Policy now includes `reporting_time` + `grace_minutes` (editable in the policy card).
- **Employee master — full data collection** (`employee.manage`: hr_admin, hr_executive,
  super_admin). A new **Employees** tab (for read_all roles) lists the full master with
  search; HR can **Add** / **Edit** a complete record across: Personal (name, code, DOB,
  gender), Contact (work/personal email, phone, address, emergency contact), Employment
  (department, designation, type, segment, location, reporting manager, status, joining date),
  Lifecycle (probation, confirmation, contract start/end, exit date/reason/status),
  Compensation & statutory (CTC, PAN, Aadhaar — **encrypted at rest**, blank keeps
  current), and a dedicated **Bank details** card. The **Directory** stays
  public-fields-only for everyone.
- **Bank details (KYC)** (migration `0022`). Each employee carries payee (account-holder)
  name, account number, IFSC, account type (savings/current), bank name, a KYC `bank_verified`
  flag, and an uploaded **cancelled cheque / passbook** image (PDF or image). The account
  number reuses the encrypted+masked `bank_account` column; payee/IFSC/type/name are
  sensitive-but-shown to authorised viewers (stripped for everyone else, like CTC). The proof
  image is held in its own `bank_proof` column, **excluded from every list/profile payload**
  (only a `hasBankProof` boolean rides along) and fetched on demand by the owner or a
  sensitive-read-all role (audited). Employees self-submit their account on **My profile →
  Bank details**: a submission is always stored **unverified** (`bank_verified=0`), and HR
  must KYC-verify it against the cheque/passbook before payroll pays into it — the P6c bank
  advice already excludes lines with no account.
- Deliberately **not** adopted (per the review): the mock's demo actions and its
  mobile-overflowing tables; Section-17's full bitemporal/event-outbox (D1 can't do the
  gist-exclude; over-build at this scale) — the ownership-rule and effective-dated principles
  are followed where cheap.

## Quick wins (from the Master Prompt review)

- **Role model → 8 roles + separation of duties.** The policy engine now carries
  **HR Executive** (HR ops without sensitive-read-all / payroll / month-lock),
  **Finance Admin** (payroll *maker*) and **Finance Approver** (payroll *checker*), and
  **Management Viewer** (aggregate read + reports, no PII) — alongside the existing
  employee / manager / hr_admin / it_admin / auditor / super_admin. New permissions
  `payroll.prepare | review | approve | read_all` and `report.read` scaffold the payroll
  module. **Separation of duties** is enforced by the pure `canApprovePayroll(actor,
  preparedByUserId)` — the approver can never be the preparer, *and super_admin is not
  exempt*. (`finance` is kept as a legacy alias of Finance Admin.)
- **Language follows the user.** Preferred UI language (`en`/`hi`/`kn`) is stored on the
  user profile (migration `0013`), returned at login and from `/api/me`, and set via
  `POST /api/me/lang` — so it persists across devices and logins, not just the browser.
  An org-level `default_lang` (`portal_config`) seeds the choice. EN remains the fallback.
- **Locale-aware formatting.** Dates render in the Indian locale per language
  (`Intl.DateTimeFormat`, UTC), and money uses **INR** (`Intl.NumberFormat`, e.g. CTC);
  business data stays language-independent.
- **Attendance policy editor.** HR/Finance can edit the weekly-off days, weekly target
  hours and full-day threshold from the Attendance tab (`/api/admin/attendance/policy`),
  so working-day counting is configurable, not hardcoded.

## Payroll-ready attendance (M1 — first "extend the live portal" milestone)

The first step toward payroll: turn attendance into a clean, frozen monthly input.

- **Month cutoff & lock** (`attendance_periods`, migration `0012`) — HR/Finance
  (`attendance.lock`) lock a month once attendance is final. A locked month is **frozen**:
  biometric import skips its rows, new corrections are refused (409), and correction
  write-backs are refused (409). Unlocking (reopening) is audited. This is the
  "payroll reads stable data" guarantee.
- **Holiday calendar** (`holidays`) — per-location (`*` = company-wide) holidays. Together
  with the weekly-off policy (`attendance_policy`, default Mon–Sat / Sunday off, 48h/wk),
  they define **working days = calendar − weekly-off − holiday** — the reproducible
  denominator for day counting.
- **OT capture** — `attendance_days.ot_minutes` (already imported from the biometric OT
  row) now rolls up into the summary and the payroll input.
- **Payroll input** (derived, reproducible) — per employee per month: **payable days =
  calendar − LOP**, where a working day that is absent or (in the past) unrecorded is
  loss-of-pay, approved leave (`LV`) is paid, and future working days in an open month are
  `pending` (not LOP). Present/leave/LOP counts, OT minutes and exception days come with
  it. HR/Finance read the whole register and export CSV — **this is the payload the
  payroll engine will consume.**
- All day-math is **pure and unit-tested** (`src/attendance.ts`: `payrollInput`,
  `workingDaysInMonth`, `dayOfWeekUTC`, `daysInMonth`), computed in UTC so it is
  deterministic regardless of host timezone.

> Aligns with the **blueprint** (`docs/hrms-prd-review.md`, `docs/hrms-gap-analysis.md`):
> ledger/derived-record discipline, effective-dated rules, and "payroll consumes approved,
> locked data." Next: payroll core → India statutory (CA-validated) → payslips via
> Documents → JV to Zoho Books.

## FR-02 Attendance (biometric)

Daily punches come from the biometric attendance system's **monthly report** (an `.xls`
of 10-row blocks per employee). Flow:

1. Map each person's biometric **Empcode** to their portal record (`employees.attendance_code`).
   Migration `0005` sets a demo mapping for the seed users.
2. Convert the report to the import payload and POST it (one-time per month):
   ```bash
   pip install xlrd
   python3 employee-portal/scripts/parse_biometric.py monthreport.xls > import.json
   TOKEN=$(curl -s $URL/api/auth/login -d '{"email":"hr@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
   curl -s $URL/api/admin/attendance/import -H "Authorization: Bearer $TOKEN" \
        -H 'content-type: application/json' --data-binary @import.json
   ```
   The response reports `imported`, matched `employees`, and any `unmatchedCodes`.
3. Employees see their month in the **Attendance** tab; **exceptions** flag missing
   punches, absences and short hours (future days are not flagged).
4. **Corrections** (regularisation / on-duty / client-visit / WFH) go through the same
   manager→team / HR→all approval scoping as leave (self-approval blocked); an approved
   correction writes the day back as a manual record. Payroll cut-off locking (FR-16,
   e.g. the 25th) and working-day/holiday-calendar hour counting are follow-ups.

## FR-03 Leave

- **Balances change only after approval** — a pending request is checked against
  `entitled − used − pending`; approval moves days into `used`; cancelling an approved
  request restores them. Leave types + quotas seed in migration `0004` (CL 12, SL 12, EL 15).
- **Approval scope** — a manager decides only for direct reports (`leave.approve_team`),
  HR/super_admin for anyone (`leave.approve_all`); **self-approval is blocked** (FR-04).
- Days are inclusive calendar days (half-day for a single day). Working-day /
  per-location-holiday-calendar counting is a follow-up.

## FR-01 Profile & NFR-03 field encryption

- **Masked by default (NFR-03):** bank account, PAN and Aadhaar are returned masked
  (`••••••234F`) to everyone, including the owner and super_admin. A per-field
  `?reveal=` shows the full value and writes a `REVEAL` audit row (reveal-on-click).
  CTC is sensitive but not masked (a number), still gated by the policy engine.
- **Encrypted at rest:** those three fields are stored AES-256-GCM encrypted
  (`src/fieldcrypto.ts`); legacy plaintext (scaffold seed) still reads. Decryption
  happens in-Worker before the policy engine masks.
- **Controlled changes (FR-01):** an employee edits direct fields themselves; a
  bank/PAN/Aadhaar change is stored **encrypted** as a *pending* request and only
  applies after HR/super_admin approval. Step-up auth on these is R2 (FR-26).
- **Enter once, then approve:** a direct contact field (phone, personal email, address,
  emergency contact) can be **self-filled once while it is blank** (onboarding). Once it
  holds a value, every later change is queued as a **pending request** for admin approval
  instead of applying silently — the HR verify queue shows the proposed new value (direct
  fields are plaintext; bank/PAN/Aadhaar stay ciphertext-hidden with a *value hidden* note).
  Bank details keep their own stricter KYC flow (every submit lands unverified). Admin edits
  via the employee master always apply directly (the admin is the approver).
- **View persistence:** the open view is remembered (per-tab `sessionStorage`) and restored
  on refresh, so a reload no longer drops you back to the landing page. A restored view the
  current role may no longer see falls back to the dashboard; logout clears it.

## 2FA & access revocation

- **2FA for all (DEC-02, extended):** *every* login — employee and manager included —
  must present a second factor at `/api/auth/login` (dev OTP `000000`). The flow is
  enforced for all roles now; the real factor (TOTP / DLT mobile-OTP) replaces the
  stub later via `verifyOtp` in `src/auth.ts`. No role is single-factor.
- **Revocation (SLA):** each login carries a token version; `…/revoke` bumps the
  user's version so **every live session for them is rejected immediately** — the
  "sessions killed within 1 h of exit or role change" control. Flip `deactivate`
  to also disable the account.

## Not yet (later in R0 / R1), from PRD v1.4

Real SSO + DLT mobile-OTP (replacing the dev password/OTP); field-level encryption
(NFR-03); numeric NFRs and CERT-In/DPDP logging retention; PostgreSQL + RLS; the
data inventory/retention matrix and ADR as signed G1 artefacts.
