# Spec — Payroll Core (Phase 6)

> **Status:** DRAFT for approval. No code until the **Decisions required** (§12) are
> confirmed. Built on the live stack (Workers + D1 + TypeScript), consuming the **M1
> locked payroll input** and the **maker-checker scaffolding** already shipped
> (`canApprovePayroll`, `payroll.prepare|review|approve|read_all`).
>
> **In scope:** salary structures/components, employee salary (effective-dated), a payroll
> run that computes from locked attendance, maker-checker + lock + versioned revisions,
> payslips via the Documents module, bank/NEFT advice export.
> **Out of scope (next phase, CA-validated):** the actual **India statutory math** —
> PF/ESI/PT/TDS rates, declarations, challans, 24Q, Form 16. The data model *accommodates*
> statutory components; their rules are a separate workstream (§11).

---

## 1. Objective & non-negotiables

Turn the locked monthly attendance input into correct, auditable pay, with maker-checker
controls, and deliver payslips to employees — without ever silently changing approved pay.

Non-negotiables (from the ratified blueprint / master prompt):
- **Money is integer paise.** No floats in stored or computed money. Round half-up once,
  at the component level.
- **Payroll consumes approved, locked data.** A run can only be prepared for a month whose
  attendance is **locked (M1)**.
- **No silent overwrite.** An approved/locked run is immutable; changes create a **new
  version**. Reopening is authorised + audited.
- **Separation of duties.** The approver of a run is never its preparer (`canApprovePayroll`
  already enforces this; super_admin is not exempt).
- **Restricted visibility.** Salary/bank/payslip data is visible only to `payroll.read_all`
  holders and the employee's own payslip. Never in unrestricted APIs, logs, or the bundle.
- **Reproducible & traceable.** A run's numbers are recomputable from the employee salary
  (as of the period), the locked attendance input, and the component rules — every line
  keeps its component breakdown.

---

## 2. Prerequisite (blocking) — employee master dates

Correct proration needs **date of joining** and **date of exit**, which the employee
record **does not currently have** (migration `0001` has no joining/exit dates). Without
them, a mid-month joiner's pre-joining days would wrongly count as loss-of-pay.

**Prereq migration (small, part of P6a):** add `date_of_joining` and `date_of_exit` to
`employees`. Proration then bounds the payable window to `[max(period_start,
date_of_joining), min(period_end, date_of_exit ?? period_end)]`. (Full lifecycle —
probation, F&F — remains a later milestone; this is just the two dates payroll needs.)

---

## 3. Data model (migration `0014_payroll.sql`, built in P6a/P6b)

All money columns are `INTEGER` paise. All tables are additive; nothing existing changes
except the two date columns in §2.

**Salary component catalog** — reusable definitions.
```
salary_components(
  code TEXT PK,                 -- e.g. BASIC, HRA, SPECIAL, PF_EE, PT, LOP, OT
  name TEXT,
  kind TEXT,                    -- earning | deduction
  calc_method TEXT,             -- fixed | percent_of_base | attendance_prorated | formula
  base_code TEXT,               -- for percent_of_base (e.g. HRA = 40% of BASIC)
  taxable INTEGER DEFAULT 1,
  statutory INTEGER DEFAULT 0,  -- PF/ESI/PT/TDS flag (rules handled in the statutory phase)
  prorates INTEGER DEFAULT 1,   -- does this component reduce for LOP days?
  sequence INTEGER DEFAULT 0,   -- display/calc order
  active INTEGER DEFAULT 1
)
```

**Employee salary (effective-dated, revisioned)** — one row = one salary version.
```
employee_salaries(
  id TEXT PK, employee_id TEXT,
  effective_from TEXT,          -- YYYY-MM-DD
  effective_to TEXT,            -- NULL = open-ended
  revision_no INTEGER,
  monthly_gross_paise INTEGER,  -- derived from components; stored for traceability
  status TEXT,                  -- active | superseded
  created_by TEXT, created_at TEXT
)
employee_salary_components(
  id TEXT PK, employee_salary_id TEXT,
  component_code TEXT, kind TEXT,
  calc_method TEXT, value INTEGER,  -- paise (fixed) or basis points (percent)
  base_code TEXT
)
```
Constraint: **no two active salary rows overlap** for the same employee (checked in code;
D1 has no RLS/exclusion constraints — enforced + unit-tested, like the rest of the policy).

**Payroll run (versioned, maker-checker state machine).**
```
payroll_runs(
  id TEXT PK, ym TEXT,              -- YYYY-MM
  version INTEGER,                  -- 1,2,… ; a controlled revision bumps this
  status TEXT,                      -- draft | in_review | approved | locked | cancelled
  prepared_by TEXT, prepared_at TEXT,
  reviewed_by TEXT, reviewed_at TEXT,
  approved_by TEXT, approved_at TEXT,
  locked_at TEXT, note TEXT, created_at TEXT
)
payroll_lines(
  id TEXT PK, run_id TEXT, employee_id TEXT, employee_salary_id TEXT,
  calendar_days INTEGER, payable_days INTEGER, lop_days INTEGER, ot_minutes INTEGER,
  gross_paise INTEGER, deductions_paise INTEGER, net_paise INTEGER,
  exception TEXT,                   -- NULL | negative_net | missing_bank | no_salary | zero_pay
  note TEXT
)
payroll_line_components(
  id TEXT PK, line_id TEXT, component_code TEXT, kind TEXT, amount_paise INTEGER
)
payslips(
  id TEXT PK, line_id TEXT, employee_id TEXT, ym TEXT,
  document_id TEXT,                -- FK → documents (category 'payslip')
  generated_at TEXT
)
```
Uniqueness: at most **one non-cancelled run per (ym)** at a time; a revision cancels/supersedes
the prior and creates `version+1`. Enforced + tested.

---

## 4. Calculation engine (pure, unit-tested — `src/payroll.ts`)

All computation is pure functions (no D1), exactly like `policy.ts`/`attendance.ts`, so the
statutory math can be added and tested in isolation later.

1. **Resolve salary** for the period: the `employee_salaries` row whose
   `[effective_from, effective_to]` covers the period (see §12 for mid-month revisions).
2. **Expand components** in `sequence`: `fixed` → value; `percent_of_base` → `round(base ×
   bps / 10000)`; `attendance_prorated` → see step 4; `formula` → reserved (statutory phase).
3. **Gross (full-month)** = Σ earnings.
4. **Proration (attendance link)** from the **M1 payroll input** for the employee-month, as a
   **loss-of-pay deduction** (never a payable/divisor *multiply*, so a 31-day fully-present
   month can never overpay): for each prorating earning,
   `lop_amount = round(full_component × unpaid_days / divisor)`, and the component pays
   `full − lop_amount`. `unpaid_days` = LOP days (absent working days **within employment**)
   + working days **outside** the `[date_of_joining, date_of_exit]` window (§2). The LOP
   amount is recorded as its own line component for transparency.
   **Divisor is configurable** (`portal_config.payroll_divisor`): `calendar` (actual days in
   the month — **default**, reconciles with M1), `fixed_30`, or `fixed_26`.
5. *(Overtime pay is not computed in this phase — OT stays capture-only. The engine leaves an
   OT earning hook for later.)*
6. **Deductions** = Σ deduction components (statutory deductions are zero-valued until the
   statutory phase supplies their rules).
7. **Net** = round(Σ earnings) − round(Σ deductions), in paise.
8. **Exceptions**: `negative_net`, `missing_bank`, `no_salary` (no effective salary row),
   `zero_pay` (payable_days = 0). Exceptions **block lock** until resolved (except
   `missing_bank`, which warns and marks the line unpayable but can proceed).

Rounding: half-up, applied once per component; totals are sums of rounded components, so a
line always reconciles to its breakdown.

---

## 5. Run lifecycle (maker-checker state machine)

```
            prepare                submit_review            approve (+lock)
 (none) ───────────────▶ draft ───────────────▶ in_review ───────────────▶ locked
   ▲                       │                        │                         │
   │        cancel         │        reject          │       reopen (new ver)  │
   └───────────────────────┴────────────────────────┘◀────────────────────────┘
```

- **prepare** (`payroll.prepare`, maker): month must be **attendance-locked (M1)**; computes
  all lines from the resolved salary + locked input; status `draft`. Idempotent — re-preparing
  an existing `draft`/`in_review` run **recomputes in place** (same version); it never creates
  a duplicate.
- **submit_review** (`payroll.prepare`): `draft → in_review`.
- **approve** (`payroll.approve`, **SoD: approver ≠ prepared_by**, enforced by
  `canApprovePayroll`): `in_review → locked`; **generates payslips** (§7). Blocked if any
  unresolved blocking exception.
- **reject** (`payroll.approve` or `payroll.review`): `in_review → draft` with a comment.
- **reopen** (`payroll.approve`, authorised + audited): a `locked` run is **never edited**;
  reopen cancels nothing retroactively — it creates `version+1` in `draft` for correction.
  The locked version and its payslips are retained.
- Every transition writes an **audit** row (actor, run, from→to, comment).

The optional middle **review** step (`payroll.review`, finance_approver as checker) can sit
between `in_review` and `approve` if a 3-party flow is wanted; default is 2-party
(maker → approver) which suffices at 21–50 employees. (§12)

---

## 6. RBAC (already scaffolded)

| Action | Permission | Roles |
| --- | --- | --- |
| Define components / assign salary | `payroll.prepare` | hr_admin, finance_admin (+ super_admin) |
| Prepare / recompute / submit a run | `payroll.prepare` | hr_admin, finance_admin |
| Review (optional) | `payroll.review` | finance_approver |
| Approve + lock + reopen | `payroll.approve` (SoD) | finance_approver (+ super_admin, SoD-bound) |
| View register / salary / bank export | `payroll.read_all` | hr_admin, finance_*, (+ super_admin) |
| View **own** payslip | — (owner) | every employee |

Salary/bank values are decrypted (NFR-03) only for `payroll.read_all` holders and only where
needed (register, bank advice); otherwise masked. Bank export access is itself audited.

---

## 7. Payslips & outputs

- On **approve/lock**, generate one **payslip per line** as a **Documents** record
  (category `payslip`, published to the employee). Reuses the existing draft-gated,
  audited-open Documents module — employees already see only their own published docs.
- Payslip content: employee + period, payable/LOP days, each earning/deduction component,
  gross, deductions, net, employer identifiers. Format fields per §12.
- **Bank/NEFT advice** export (`payroll.read_all`): CSV of employee, bank account
  (decrypted for finance only), net payable — for the locked run. Lines flagged
  `missing_bank` are excluded and listed separately.
- **Payroll register** export (CSV): all lines + component columns, for the run.

---

## 8. API (all under `/api/admin/payroll` except the employee payslip reads)

| Method | Path | Perm | Purpose |
| --- | --- | --- | --- |
| GET·POST | `/api/admin/salary/components` | payroll.prepare | component catalog |
| GET | `/api/admin/employees/:id/salary` | payroll.read_all | salary history (effective-dated) |
| POST | `/api/admin/employees/:id/salary` | payroll.prepare | assign/revise salary (new revision) |
| GET | `/api/admin/payroll/runs?month=YYYY-MM` | payroll.read_all | runs for a month (+ versions) |
| POST | `/api/admin/payroll/runs` | payroll.prepare | prepare/recompute a run `{ym}` |
| GET | `/api/admin/payroll/runs/:id` | payroll.read_all | run + lines + totals + exceptions |
| POST | `/api/admin/payroll/runs/:id/submit-review` | payroll.prepare | draft → in_review |
| POST | `/api/admin/payroll/runs/:id/approve` | payroll.approve (SoD) | in_review → locked (+payslips) |
| POST | `/api/admin/payroll/runs/:id/reject` | payroll.approve/review | in_review → draft |
| POST | `/api/admin/payroll/runs/:id/reopen` | payroll.approve | locked → new draft version |
| GET | `/api/admin/payroll/runs/:id/register` | payroll.read_all | CSV register |
| GET | `/api/admin/payroll/runs/:id/bank` | payroll.read_all | CSV bank/NEFT advice (audited) |
| GET | `/api/payroll/payslips` | any login | my payslips (via Documents) |
| GET | `/api/payroll/payslips/:id` | owner / payroll.read_all | one payslip |

Standard JSON envelope, validation, audit on every mutation — consistent with the rest of
the Worker.

---

## 9. UI

- **New "Payroll" nav item** (visible to payroll roles). Tabs/cards:
  - **Salary setup** — component catalog; per-employee salary assignment + revision history.
  - **Run** — pick month (must be attendance-locked), **Prepare**, see the line register with
    per-employee gross/LOP/net and an **exceptions** panel; maker-checker buttons
    (Submit for review → Approve & lock) with SoD enforced in the UI and server.
  - **Register / Bank advice** — CSV exports (locale-aware INR on screen via `fmtINR`).
- **Employee**: a **Payslips** view (or under Documents) listing their locked-month payslips
  to open/download. Amounts in INR, dates in Indian locale (quick-win formatters).
- All amounts on screen use `fmtINR`; business data stays language-independent.

---

## 10. Testing & acceptance (Definition of Done)

Pure unit tests (`test/payroll.test.ts`):
- Component expansion: fixed, percent_of_base, sequence, rounding reconciles to breakdown.
- Proration: full month = full gross; LOP reduces by the agreed divisor; **joiner/exiter**
  windows exclude pre-join/post-exit days; zero payable → net 0 + `zero_pay`.
- OT pay (if enabled).
- Net = earnings − deductions, in paise; negative net → `negative_net` exception.
- Effective-dated salary resolution picks the right revision for the period.
- Separation of duties: `canApprovePayroll` already covered; add run-level "approver ≠
  preparer" at the handler boundary.

Integration/behavioural:
- Prepare refused unless the attendance month is **locked**.
- Re-prepare recomputes in place (no duplicate run); unique active run per ym.
- Approved/locked run is immutable; edits require **reopen → new version**; old version +
  payslips retained.
- Payslip visibility: employee sees only their own; non-finance cannot read others' salary;
  bank export is audited.
- Blocking exceptions prevent lock.

---

## 11. Statutory extension points (next phase — CA-validated)

The engine treats PF/ESI/PT/TDS as **deduction components with `statutory=1`**, zero-valued
until their rules land. The statutory phase adds: a `formula`/rule evaluator, employer
contributions, tax-regime election + investment declarations/proofs, and the filing outputs
(PF ECR, ESIC return, PT challan, 24Q, Form 16). **All statutory math must be validated by a
CA/payroll specialist before any production payslip includes it.** Nothing in payroll-core
hardcodes a statutory rate.

---

## 12. Decisions — CONFIRMED (2026-11-15)

1. **Proration basis** → **Calendar-day default**, implemented as a **configurable divisor**
   (`portal_config.payroll_divisor` = `calendar` | `fixed_30` | `fixed_26`) via the LOP-deduction
   model (§4). Finance can switch to **fixed_30** at any time. ✅
2. **Statutory (PF/ESI/PT/TDS)** → **next phase (CA-validated)**; payroll-core ships with
   configurable-but-empty statutory components. ✅
3. **Mid-month salary revision** → **day-weighted proration** across the two revisions. ✅
4. **Overtime** → **not paid in this phase** (capture-only remains; OT earning hook left for
   later). ✅

Still to supply (not blocking P6a — a sensible template is used and refined):
5. **Salary component breakup** — 4SYZ's actual CTC structure. P6a seeds a template
   (BASIC 50% of gross, HRA 40% of basic, special allowance = balance); refine per real
   structure when provided.
6. **Payslip fields & rounding** — confirmed default: net rounds to the **rupee** on the
   payslip (paise retained internally); payslip field layout finalised in P6c.

---

## 13. Build phasing (after approval)

- **P6a** — prereq dates (§2) + salary component catalog + employee salary (effective-dated)
  + pure engine skeleton + tests. *Deploys; no run yet.*
- **P6b** — payroll run: prepare/recompute from locked input, lines + exceptions + register,
  tests. *Deploys behind payroll roles.*
- **P6c** — maker-checker controls (submit/approve/lock/reopen/version) + payslip generation
  via Documents + bank advice + Payroll UI + employee Payslips view + tests.
- **Then** — the separate **India statutory (CA-validated)** phase (§11), then **JV to Zoho
  Books**.

---

*Spec aligns with: `hrms-gap-analysis.md`, `hrms-prd-review.md`, `hrms-master-prompt-review.md`,
M1 (`payroll-ready attendance`), and the maker-checker scaffolding in `policy.ts`.*
