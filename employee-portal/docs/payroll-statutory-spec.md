# Spec — India Statutory Payroll (Phase 7)

> **Status:** DRAFT for approval. **No production statutory deduction ships without
> CA/payroll-specialist sign-off** on its rules and test vectors (see §12). Built on the
> live stack, extending the **payroll-core** engine (`src/payroll.ts`) and run (P6a–P6c).
> Companion to [`payroll-core-spec.md`](./payroll-core-spec.md).
>
> **In scope:** PF (EPF/EPS/EDLI), ESI, Professional Tax (PT), TDS on salary (old & new
> regime), employer contributions, investment declarations + proof submission, and the
> statutory **filing outputs** (PF ECR, ESIC return, PT challan, TDS 24Q, Form 16 Part B).
> **Non-goals:** gratuity/bonus acts, LWF beyond a simple PT-style slab, PF/ESI portal API
> integration (we generate the upload files; filing stays manual), and anything a CA has
> not validated.

---

## 1. TL;DR & the CA gate

Payroll-core already treats PF/ESI/PT/TDS as **configurable, zero-valued deduction
components**. This phase makes them compute — as **parameterised, effective-dated,
pure functions**, never hardcoded rates and never free-form formulas in the DB.

The defining constraint: **statutory math is a correctness-and-legal problem, not a
feature.** So every statute ships behind two gates:
1. **CA-validated test vectors** — the CA supplies worked examples (inputs → expected
   deduction) for the current financial year; our pure functions must reproduce them
   exactly before the statute is enabled.
2. **Parallel run** — portal payroll runs alongside the company's existing/CA computation
   for **1–2 months**, reconciled to **zero variance**, before it drives real payslips.

Nothing here is "done" because the code runs; it is done when the CA signs the vectors and
the parallel run reconciles.

---

## 2. Principles

- **Effective-dated config, no hardcoded rates.** Every rate/ceiling/slab lives in an
  effective-dated `statutory_config` row (JSON params) keyed by statute + FY. A rate change
  (every Union Budget) is a new config row, not a code change. Historical runs reproduce
  because they read the config effective for their month.
- **Parameterised pure functions, not formulas.** Each statute is a typed pure function
  (`pfContribution`, `esiContribution`, `ptForState`, `tdsMonthly`) taking explicit params
  — never a `formula` string evaluated at runtime (that is both a correctness and a
  security risk). The `formula` calc-method stays reserved/unused.
- **Integer paise; statute-specific rounding.** Each statute rounds as the law/portal
  requires (PF/ESI typically rounded to the rupee a particular way, TDS to the rupee). The
  rounding rule is part of each statute's config and its CA vectors.
- **Reproducible & auditable.** A payroll line keeps every statutory component *and the
  config version used*, so a run is defensible years later.
- **Employee data stays private.** PAN, UAN, ESIC number, bank, declarations are sensitive
  (NFR-03 masking/encryption extends to them); statutory exports are audited.

---

## 3. Applicability — confirm before building (§15)

What actually applies to 4SYZ Infotech Solutions Pvt. Ltd. (CA to confirm):
- **EPF** — mandatory once ≥20 employees; 4SYZ is in range. Confirm registration + whether
  the ₹15,000 wage ceiling is applied or PF is on actual basic.
- **ESI** — applies to employees with gross ≤ ₹21,000/month where the establishment is
  covered (≥10 employees in most states). Confirm coverage + which employees qualify.
- **Professional Tax** — **state-specific**. Confirm the state(s) 4SYZ operates in
  (Karnataka for HSR/Bengaluru; client-site states may differ) and the current slabs.
- **TDS on salary** — always applies to taxable salaries. Confirm the **default regime**
  (new regime is the statutory default from FY2023-24) and the declaration/proof cycle.

---

## 4. Data model (migration `0018_statutory.sql`)

```
-- Effective-dated statutory parameters. One row per statute version. params is JSON.
statutory_config(
  id TEXT PK, statute TEXT,        -- epf | esi | pt | tds
  fy TEXT,                         -- '2026-27'
  effective_from TEXT, effective_to TEXT,
  state TEXT,                      -- for pt (NULL/'*' otherwise)
  params TEXT,                     -- JSON: rates, ceilings, slabs, rounding, thresholds
  created_by TEXT, created_at TEXT
)

-- Per-employee statutory profile + identifiers (sensitive — masked/encrypted).
employee_statutory(
  employee_id TEXT PK,
  pf_applicable INTEGER, uan TEXT,
  esi_applicable INTEGER, esic_number TEXT,
  pt_state TEXT,
  pan TEXT,                        -- for TDS (206AA: no PAN → higher rate)
  tax_regime TEXT,                 -- old | new  (elected for the FY)
  updated_at TEXT
)

-- Investment / exemption declarations for TDS (old regime) + proof workflow.
tax_declarations(
  id TEXT PK, employee_id TEXT, fy TEXT,
  section TEXT,                    -- 80C | 80D | HRA | HOME_LOAN | ...
  amount_paise INTEGER,
  status TEXT,                     -- declared | proof_submitted | verified | rejected
  proof_document_id TEXT,          -- → documents
  verified_by TEXT, note TEXT, created_at TEXT
)
```

Payroll lines already hold per-component amounts (P6b). Add **employer-contribution** lines
as `kind = 'employer'` components (EPF-ER, EPS, EDLI, admin, ESI-ER) — they don't reduce
net pay but must be recorded for ECR/returns and cost-to-company reporting.

---

## 5. Per-statute design (each a pure function + CA vectors)

### 5.1 EPF — `pfContribution(pfWage, config)`
- **PF wage** = basic + DA (+ others per config); optionally capped at the **₹15,000**
  ceiling (`apply_ceiling`).
- **Employee**: 12% of PF wage.
- **Employer**: 12% split — **EPS** 8.33% of min(PF wage, ceiling) (max ₹1,250), **EPF**
  the balance; plus **EDLI** 0.5% and **admin** charges (config).
- Config params: `rate_ee, rate_er, ceiling, apply_ceiling, eps_rate, eps_wage_cap,
  edli_rate, admin_rate, rounding`.
- Edge cases: ceiling opt in/out; international workers (out of scope v1); zero-LOP wage
  reduces PF wage; arrears month.

### 5.2 ESI — `esiContribution(grossWage, config, inPeriod)`
- Applies only if gross ≤ **₹21,000** threshold; **employee 0.75%**, **employer 3.25%**.
- **Contribution-period continuation**: once covered in a period (Apr–Sep / Oct–Mar), ESI
  continues to the period end even if gross later exceeds the threshold — `inPeriod` carries
  that state (derived from the FY calendar + prior coverage).
- Config: `rate_ee, rate_er, wage_threshold, rounding, periods`.
- Edge cases: crossing the threshold mid-period; mid-month joiner; disabled-employee higher
  threshold (config).

### 5.3 Professional Tax — `ptForState(grossWage, stateSlabs, month)`
- **Per-state monthly slabs**; some states (e.g. Maharashtra) have a **February special**.
  Annual cap (e.g. ₹2,500) enforced across the FY.
- Config (per `state`): `slabs: [{upTo, amount}], february_special, annual_cap, rounding`.
- Edge cases: state from the employee's work location; multi-state (client-site) employees;
  partial month.

### 5.4 TDS on salary — `tdsMonthly(projection, regime, config, ytd, monthIndex)` (the hard one)
- **Projected annual taxable income** = annualised gross − exemptions (regime-dependent) −
  standard deduction − verified declarations (old regime: 80C/80D/HRA/home-loan; new regime:
  limited).
- **Slabs** per regime per FY (config); **rebate 87A**, **cess 4%**, **surcharge** bands.
- **Monthly TDS** = (annual tax − YTD TDS already deducted) / remaining months — so it
  **trues up** as income/declarations change. Needs **YTD** from prior **locked** runs of
  the same FY.
- **No PAN (206AA)** → higher-of-rate flooring (config).
- Config: `regime_slabs{old,new}, std_deduction{old,new}, cess, surcharge_bands, rebate_87a,
  no_pan_min_rate, rounding`.
- Edge cases: regime locked for the FY (election once); declaration verified mid-year →
  re-project + true-up; arrears; exit mid-year (final true-up); joiner mid-year (annualise
  from join).

Each function is **exhaustively unit-tested against the CA's vectors** before enablement.

---

## 6. Payroll run integration

The P6b/P6c run gains a statutory pass (behind a per-statute `enabled` flag in config):
- For each line, after earnings/LOP: resolve the **config effective for the month** + the
  employee's **statutory profile**, compute PF/ESI/PT/TDS via the pure functions, and add
  them as **deduction** components; add **employer** components (info/employer kind).
- **TDS** needs YTD: sum prior locked runs' TDS for the employee in the FY; the function
  trues up. A reopened/corrected month re-projects.
- **Net** = earned gross − (statutory + other deductions). Exceptions extend with
  `statutory_config_missing` (a statute enabled but no effective config) — a **blocking**
  exception.
- Everything stays **reproducible**: the line records which `statutory_config` id drove each
  statute.

---

## 7. Investment declarations & proofs (employee self-service)

- Employees **elect a regime** for the FY and, under the old regime, **declare** investments
  (80C etc.) — a self-service form (new permission `tax.declare`, every employee).
- They **upload proofs** (via Documents) in the proof window; HR/Finance **verify**
  (`tax.verify`) — only **verified** declarations reduce TDS. Unverified declarations can be
  honoured provisionally per policy (config), with a year-end true-up.
- Audited throughout; declarations are sensitive.

---

## 8. Filing outputs (generators — manual upload stays with Finance)

Phased exports, each CA-reviewed for format:
- **PF ECR** — the EPFO text file (member-wise wages + contributions) for the month.
- **ESIC return** — monthly contribution CSV.
- **PT challan** — per-state monthly summary.
- **TDS 24Q** — quarterly salary-TDS return data (deductee-wise).
- **Form 16 Part B** — annual, per employee (Part A comes from TRACES).
We **generate the files**; Finance uploads them to the government portals (no direct API).

---

## 9. RBAC

| Action | Permission | Roles |
| --- | --- | --- |
| Edit statutory config (rates/slabs) | `statutory.config` (new) | finance_admin, super_admin |
| Maintain employee statutory profile | `payroll.prepare` | hr_admin, finance_admin |
| Declare investments / elect regime | `tax.declare` (new) | every employee (self) |
| Verify declarations/proofs | `tax.verify` (new) | hr_admin, finance_admin |
| Generate filings | `payroll.read_all` | finance_* |

Statutory config changes are audited and effective-dated; a change never alters a locked run.

---

## 10. UI

- **Statutory config** admin (finance): per-statute, effective-dated params editor (shows
  the active config; new row supersedes).
- **Employee statutory profile** (HR): PF/ESI applicability, UAN/ESIC/PAN, PT state.
- **Employee self-service**: regime election + investment declaration + proof upload +
  status; the **payslip** shows statutory deductions and (optionally) employer contributions.
- **Filings**: a screen listing the month/quarter exports with download + a reconciliation
  summary.

---

## 11. Testing & acceptance (Definition of Done)

- **Pure unit tests** reproduce the **CA's test vectors** for each statute, including the
  edge cases in §5. A statute cannot be enabled until its vectors pass.
- Run-integration tests: statutory pass adds the right components; YTD TDS trues up across
  months; `statutory_config_missing` blocks lock; reopened months re-project.
- Access tests: declarations/PAN/UAN visible only to the owner + authorised finance; exports
  audited.
- **Parallel-run reconciliation** (operational gate, not a unit test): 1–2 months at **zero
  variance** vs. the CA/existing computation, signed off, before go-live.

---

## 12. CA validation gates (the critical path)

1. CA confirms **applicability** (§3) and supplies **current-FY parameters** for each statute.
2. CA supplies **worked test vectors** (inputs → expected EE/ER amounts) per statute,
   including edge cases.
3. We implement the pure function + load the config; **vectors must pass exactly**.
4. **Parallel run** 1–2 months; reconcile to zero; CA signs off.
5. Enable the statute (flip its `enabled` flag) for live payslips.
Each statute passes this independently — PF/ESI/PT first (deterministic), TDS last (complex).

---

## 13. Phasing

- **S7a — Statutory config + profiles + PF/ESI/PT** (deterministic, lower risk). Config
  model, employee statutory profile, the three pure functions + CA vectors, run integration,
  payslip lines, parallel run.
- **S7b — TDS** (regime election, declarations + proofs, annual projection, slabs, YTD
  true-up, 206AA). The largest slice; CA-heavy.
- **S7c — Filing outputs** (ECR, ESIC, PT challan, 24Q, Form 16 Part B), each format-reviewed.
- **Then** — payroll **JV → Zoho Books** (the cross-boundary integration).

---

## 14. Risks & mitigations

- **Legal/financial exposure if rates or logic are wrong** → CA vectors + parallel run + no
  hardcoded rates + effective-dated config + full line traceability.
- **TDS complexity** (regimes, declarations, true-up, surcharge) → isolate as pure functions
  with heavy CA vectors; ship PF/ESI/PT first to de-risk.
- **Rate changes each FY** → effective-dated config; adding next year's rates is a data task.
- **Sensitive data growth** (PAN/UAN/declarations) → extend NFR-03 masking/encryption;
  audit every statutory read/export; DPDP retention applies.

---

## 15. Decisions — CONFIRMED (2026-11-15)

1. **Applicability** → at 4SYZ's current headcount, **EPF and ESI are NOT applicable**; only
   **Professional Tax (PT)** applies now. So **S7a scope = PT only**. (EPF/ESI can be added
   later via the same config model once thresholds are crossed; their designs in §5.1–5.2
   stand ready.) ✅
2. **TDS** → **deferred to S7b** (after PT is live and reconciled). ✅
3. **CA reviewer** → **available now**; will supply current-FY PT slabs + test vectors and
   reconcile the parallel run. ✅
4. **Build posture** → S7a ships the PT config model + pure `ptForState` + run integration +
   UI, with **illustrative Karnataka slabs seeded but PT DISABLED** until the CA confirms the
   numbers and the vectors pass; Finance then enters the CA's exact slabs and flips `enabled`.

### S7a (Professional Tax) — concrete build
- Per-state effective-dated PT config (slabs, optional February special, annual cap, rounding,
  **`enabled` flag**). Employee **PT state** on the statutory profile (seed `KA`).
- Pure `ptForState(grossPaise, config, month)` + CA vectors. Run integration adds a **PT
  deduction** line only when PT is enabled and a config exists for the employee's state.
- Nothing reaches a payslip until `enabled` is set after CA sign-off.

---

*Extends: payroll-core (P6a–P6c). Aligns with the gap analysis, PRD review, and master-prompt
review. Statutory math is CA-validated; nothing in this phase hardcodes a rate.*
