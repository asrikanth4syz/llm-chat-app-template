# Design Review — Clickable Mock + Section 17 Revision

> Reviewed as an **HRMS-pro** (architecture/workflow) and **UI/UX-pro** (interface),
> "to take in what is best," against the live portal. Two very different artifacts:
> - **Clickable mock** (`…_Clickable_Mock.html`) — a **UI prototype** (demo data, `alert()`
>   actions). A visual/navigation reference, not a system.
> - **Section 17 Revision** (PDF) — an **architecture/data-model revision** of the Employee
>   Profile module (ownership rules, Person/Employment model, event catalogue). Not a UI doc.
>
> So they're reviewed on different axes; the recommendation at the end says what to adopt
> from each, mapped to the current stack (Workers + D1 + TS) and scale (21–50 employees).

---

## 1. Verdict (TL;DR)

- **The mock is a good visual reference and its bones already match the live portal** (navy
  sidebar + white topbar + cards). Cherry-pick a handful of genuinely better UI patterns from
  it (dashboard stat tiles, attendance hours-bars + variance, the policy banner, pill/toolbar
  consistency). Don't copy its demo behaviours or its mobile tables (they overflow).
- **Section 17 is excellent, senior-grade architecture** — and more rigorous than the portal's
  current flat employee record. Adopt its *principles* now (module ownership, employee_id
  stable across rehire, effective-dated assignments). **Defer** its heavyweight parts
  (Person/Employment split, full bitemporal valid/record time, event outbox): they're
  over-build at this scale, and the bitemporal exclusion constraint is **Postgres-only** — D1
  can't enforce it, which ties back to the stack decision.

---

## 2. The clickable mock — UI/UX review

**What's good (adopt into the live portal):**
- **Dashboard stat-tile row** (Active employees / Present today / Pending approvals / Payroll
  status) + an **"Action centre"** card with counts and a CTA. Crisp, scannable. The portal
  has per-module views but no composed role dashboard — this is the pattern to build (it's
  also the Master Prompt's §5A ask).
- **Attendance weekly-hours row**: inline **progress bar + variance (+/− hrs) + compliance
  pill**. Much more scannable than the portal's current per-day list. Adopt the bar + variance
  into the attendance/payroll-input views.
- **Policy notice banner** (amber) restating the configured policy ("9:30 · 10-min grace ·
  Mon–Sat · 48h · Sunday off"). Good transparency; add to the Attendance tab (the portal now
  has a real, editable policy to show).
- **Consistent toolbar** (search + filter + primary action) and **semantic pills**
  (green/red/amber/blue). The portal is close; standardize to this across every list.
- **Clean ERP aesthetic** — validates the portal's existing sidebar/topbar direction. The
  mock's palette is navy `#17243a` + blue `#315efb`; the portal uses indigo `#4f46e5`.
  Optional: shift the portal accent to the mock's navy/blue for a more "finance-grade" look.

**What NOT to copy:**
- **Everything is `alert()` / sample data.** Expected for a mock — but the portal already has
  the real backend, RBAC, audit and payroll behind these screens. The mock is the paint, not
  the engine.
- **Tables overflow on mobile** (render confirms: Compliance/Action scroll off the right edge).
  This is exactly the responsive failure the Master Prompt warned against. The portal's
  row/card layout handles phones better — **keep the portal's approach**, borrow the mock's
  desktop richness, don't inherit its mobile tables.
- **Employee detail is a stub modal.** The portal's Profile (masked sensitive fields,
  reveal-on-click, change-approval, photo, payslips in Documents) is far richer — keep it.
- Browser `alert()`/`prompt()` for workflows — the portal should use its toast/inline pattern
  (a few `confirm()` calls remain to tidy).

**Net:** the mock is a strong *desktop visual* reference whose structure the portal already
shares. Highest-value borrowings: **dashboard tiles + action centre**, **attendance
hours-bar/variance**, **policy banner**, and **pill/toolbar consistency**.

---

## 3. Section 17 Revision — architecture review

This is a high-quality revision. The strong ideas:
- **Ownership rule** — every datum has exactly one owning module; others hold a **reference**
  or a **read-only projection**, and never write to another module's tables. This is the right
  backbone and the portal already follows its *spirit* (pure domain modules; payroll consumes
  *locked* attendance rather than recomputing it; documents own files).
- **Person / Employment model** — **one Person, many Employment records** over time; **rehire
  = a new employment** linked to the old, same Person; `person_id` (immutable, never shown) vs
  `employment_id` (what transactional modules key on) vs `employee_id` (business code). This
  cleanly removes rehire/contractor/intra-group special cases.
- **Effective-dated + bitemporal assignments** — department/designation/manager/location/type
  as dated `employment_assignment` rows with **valid time** *and* **record time**, no-overlap
  enforced, corrections close-and-insert (never update in place), and an **as-of-date** read
  API. Powerful and audit-safe.
- **Thin event catalogue** — events carry IDs + changed-field *names* only (never sensitive
  values), transactional outbox, per-employment `sequence_no` ordering, idempotency,
  dead-letter + replay, reconciliation job. Textbook.
- **DPDP-aware** — exit doesn't delete the person; retention/deletion follow policy.

**How it maps to the live portal (the gap):**
- Portal **already has**: module separation, effective-dated **salary** (`employee_salaries`),
  append-only audit, "payroll owns bank/statutory" (matches **Decision #1**), locked-month
  data feeding payroll (compatible with **Decision #5**: EFFECTIVE for calc, RECORDED for
  cut-off warnings).
- Portal **does not have**: the **Person/Employment split** (it has a flat `employees.id` with
  `date_of_joining`/`date_of_exit` added in P6a), bitemporal valid/record time, or an event
  bus.

**What to adopt now (high value, low cost):**
1. **Ratify the ownership rule** as a written architecture principle (we mostly follow it).
2. **`employee_id` stable across rehire** (**Decision #2** = yes, configurable) — cheap to honor.
3. **Extend effective-dated assignments** (department/designation/manager/location) the way
   salary already is — directly improves payroll segments and reporting history.

**What to defer / adapt (heavy, or stack-gated):**
- **Full bitemporal with `EXCLUDE USING gist` + `daterange`** — that SQL is **PostgreSQL-only**;
  **D1/SQLite cannot enforce it**. The portal enforces no-overlap **in code** (as it already
  does for salary revisions). Full bitemporal history is likely over-build at 21–50 employees;
  revisit only with a Postgres move (the stack decision you already made keeps D1).
- **Person/Employment split** — real value for rehire / multi-legal-entity, but a **migration**
  of modules that currently key on `employees.id`. Recommend: honor the *stable employee_id*
  convention now; schedule the split only when rehire or a second legal entity becomes a real
  need — and pair it with Postgres if that happens.
- **Event outbox / message bus** — the portal's direct in-Worker orchestration is simpler and
  adequate here. Keep the *principles* already in place (idempotency, no silent recalculation,
  reconciliation); don't build event-sourcing yet.

**Decisions (PDF "Open decisions") vs. what's built:** #1 payroll owns bank/statutory ✓
(matches our model); #2 employee_id reused on rehire → adopt the convention; #3 legal-entity
change = new employment → defer with the Person/Employment split; #5 EFFECTIVE vs RECORDED →
our locked-month model is compatible; #6 legal-entity time zone → note: the portal computes
dates in **UTC** today (fine for a single India entity; revisit if multi-tz).

---

## 4. "Take the best" — prioritized recommendation

**Do now (cheap, high value):**
- **UI polish toward the mock:** a composed **role dashboard** (stat tiles + action centre);
  attendance **hours-bar + variance + compliance pill**; the **policy banner**; pill/toolbar
  consistency across lists. Keep the portal's mobile row/card layout (don't adopt the mock's
  overflowing tables).
- **Architecture principles:** ratify the **ownership rule**; adopt **employee_id stable on
  rehire**; **extend effective-dated assignments** (dept/designation/manager/location).

**Defer (real value, but heavy or needs Postgres):**
- Person/Employment split; full **bitemporal** valid/record time (+ gist-exclude → Postgres);
  event outbox / bus. Trigger these on a concrete rehire/multi-entity need or a Postgres move.

**Skip:**
- The mock's demo-only behaviours and mobile tables; don't regress the portal's real backend.

**Suggested next build (if you want to act on this):** a small **UI uplift** sprint — the
dashboard tiles + action centre, the attendance hours-bar/variance, and the policy banner —
all on real data the portal already has. It's low-risk, visible, and closes the biggest gap
between the mock's polish and the live product, without touching the architecture.

---

*Reviewed: `4SYZ_HRMS_Clickable_Mock.html` (rendered desktop + mobile) and
`4SYZ_HRMS — Section 17 Revision.pdf` (17 pp), against the live `employee-portal/`. No code
changed by this review.*
