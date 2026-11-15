// Payroll core engine proof. Run: npm test (node --test, strips TS types).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundPaise, divisorDays, expandComponents, monthlyGross, computeLine, aggregatePayLines,
  resolveSalarySegments, daysInclusive, ptForState, type SalaryComponent, type PTConfig,
} from "../src/payroll.ts";

// A sample CTC: BASIC ₹20,000; HRA 40% of BASIC; SPECIAL ₹12,000; CONVEY ₹1,600 (non-prorating).
const comps: SalaryComponent[] = [
  { code: "BASIC",   name: "Basic",   kind: "earning", calcMethod: "fixed",           value: 2000000, prorates: true,  sequence: 10 },
  { code: "HRA",     name: "HRA",     kind: "earning", calcMethod: "percent_of_base", value: 4000, baseCode: "BASIC", prorates: true, sequence: 20 },
  { code: "SPECIAL", name: "Special", kind: "earning", calcMethod: "fixed",           value: 1200000, prorates: true,  sequence: 30 },
  { code: "CONVEY",  name: "Conveyance", kind: "earning", calcMethod: "fixed",        value: 160000,  prorates: false, sequence: 40 },
];
const GROSS = 2000000 + 800000 + 1200000 + 160000; // 41,60,000 paise = ₹41,600

test("roundPaise is half-up and sign-safe", () => {
  assert.equal(roundPaise(1866666.67), 1866667);
  assert.equal(roundPaise(0.5), 1);
  assert.equal(roundPaise(-0.5), -1);
});

test("divisorDays: calendar vs fixed", () => {
  assert.equal(divisorDays("2026-11", "calendar"), 30);
  assert.equal(divisorDays("2026-12", "calendar"), 31);
  assert.equal(divisorDays("2026-02", "calendar"), 28);
  assert.equal(divisorDays("2026-11", "fixed_30"), 30);
  assert.equal(divisorDays("2026-11", "fixed_26"), 26);
});

test("expandComponents resolves percent_of_base and respects sequence", () => {
  const exp = expandComponents(comps);
  assert.equal(exp.find((c) => c.code === "HRA")?.full, 800000); // 40% of 20,00,000
  assert.equal(exp.find((c) => c.code === "BASIC")?.full, 2000000);
  assert.equal(monthlyGross(comps), GROSS);
});

test("computeLine: full month pays full gross, no LOP", () => {
  const line = computeLine(comps, { employedDays: 30, lopDays: 0, divisor: divisorDays("2026-11", "calendar") });
  assert.equal(line.grossFull, GROSS);
  assert.equal(line.grossPaid, GROSS);
  assert.equal(line.lopReduction, 0);
  assert.equal(line.net, GROSS);
  assert.equal(line.exception, null);
});

test("aggregatePayLines: day-weighted mid-month revision sums to the parts", () => {
  // Nov (30d), calendar divisor. Old salary for 14 days, a raised salary for 16 days, no LOP.
  const raised = comps.map((c) => c.code === "BASIC" ? { ...c, value: 2200000 } : c);
  const seg1 = computeLine(comps, { employedDays: 14, lopDays: 0, divisor: 30 });
  const seg2 = computeLine(raised, { employedDays: 16, lopDays: 0, divisor: 30 });
  const agg = aggregatePayLines([seg1, seg2]);
  assert.equal(agg.net, seg1.net + seg2.net);
  assert.equal(agg.grossPaid, seg1.grossPaid + seg2.grossPaid);
  assert.equal(agg.exception, null);
  const basic = agg.components.find((c) => c.code === "BASIC");
  const b1 = seg1.components.find((c) => c.code === "BASIC").amount;
  const b2 = seg2.components.find((c) => c.code === "BASIC").amount;
  assert.equal(basic.amount, b1 + b2); // earnings aggregate by code (paid amounts)
});

test("computeLine: LOP reduces prorating earnings but not fixed reimbursements (calendar divisor)", () => {
  const line = computeLine(comps, { employedDays: 30, lopDays: 2, divisor: 30 });
  // BASIC 1866667 + HRA 746667 + SPECIAL 1120000 + CONVEY 160000 (unprorated) = 3893334 paid
  assert.equal(line.lopReduction, GROSS - 3893334); // 2,66,666
  assert.equal(line.net, 3893334);
  assert.equal(line.exception, null);
  // the LOP reduction is surfaced as its own line component
  assert.equal(line.components.find((c) => c.code === "LOP")?.amount, 266666);
});

test("computeLine: fixed_30 divisor never overpays a 31-day fully-present month", () => {
  const line = computeLine(comps, { employedDays: 31, lopDays: 0, divisor: divisorDays("2026-12", "fixed_30") });
  assert.equal(line.lopReduction, 0);   // each earning capped at its full amount
  assert.equal(line.net, GROSS);        // not GROSS × 31/30
});

test("computeLine: negative net is flagged", () => {
  const withBigDeduction: SalaryComponent[] = [
    ...comps,
    { code: "RECOVERY", name: "Recovery", kind: "deduction", calcMethod: "fixed", value: 5000000, prorates: false, sequence: 100 },
  ];
  const line = computeLine(withBigDeduction, { employedDays: 30, lopDays: 0, divisor: 30 });
  assert.equal(line.net, GROSS - 5000000); // negative
  assert.equal(line.exception, "negative_net");
});

test("computeLine: no paid days flags zero_pay (non-prorating components still pay)", () => {
  const line = computeLine(comps, { employedDays: 30, lopDays: 30, divisor: 30 });
  assert.equal(line.exception, "zero_pay");
  assert.equal(line.net, 160000); // only the non-prorating conveyance survives
});

test("daysInclusive counts both endpoints", () => {
  assert.equal(daysInclusive("2026-11-10", "2026-11-30"), 21);
  assert.equal(daysInclusive("2026-11-01", "2026-11-30"), 30);
  assert.equal(daysInclusive("2026-11-30", "2026-11-10"), 0); // reversed → 0
});

test("resolveSalarySegments: single open revision covers the whole month", () => {
  const segs = resolveSalarySegments(
    [{ id: "s1", effectiveFrom: "2024-04-01", effectiveTo: null }],
    "2026-11-01", "2026-11-30", "2024-04-01", null);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].days, 30);
});

test("resolveSalarySegments: mid-month revision splits into two day-weighted segments", () => {
  const segs = resolveSalarySegments(
    [{ id: "s1", effectiveFrom: "2026-01-01", effectiveTo: "2026-11-14" },
     { id: "s2", effectiveFrom: "2026-11-15", effectiveTo: null }],
    "2026-11-01", "2026-11-30", "2024-04-01", null);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].id, "s1"); assert.equal(segs[0].days, 14);
  assert.equal(segs[1].id, "s2"); assert.equal(segs[1].days, 16);
  assert.equal(segs[0].days + segs[1].days, 30);
});

test("ptForState (S7a): Karnataka-style slabs; disabled/absent config pays nothing", () => {
  // Illustrative KA slabs (CA to confirm): nil up to ₹24,999, ₹200/month above.
  const ka: PTConfig = { slabs: [{ upTo: 2499900, amount: 0 }, { upTo: null, amount: 20000 }], rounding: "rupee", enabled: true };
  assert.equal(ptForState(2000000, ka, 11), 0);      // ₹20,000 → nil
  assert.equal(ptForState(2499900, ka, 11), 0);      // exactly ₹24,999 → nil
  assert.equal(ptForState(2500000, ka, 11), 20000);  // ₹25,000 → ₹200
  assert.equal(ptForState(5000000, ka, 11), 20000);  // ₹50,000 → ₹200
  // nothing applies until Finance enables it after CA sign-off
  assert.equal(ptForState(5000000, { ...ka, enabled: false }, 11), 0);
  assert.equal(ptForState(5000000, null, 11), 0);
});

test("ptForState: February special overrides the slab amount only in February", () => {
  const mh: PTConfig = { slabs: [{ upTo: null, amount: 20000 }], februarySpecial: 30000, rounding: "rupee", enabled: true };
  assert.equal(ptForState(5000000, mh, 1), 20000);   // Jan → ₹200
  assert.equal(ptForState(5000000, mh, 2), 30000);   // Feb → ₹300 special
});

test("resolveSalarySegments: joiner and exit windows clip the segment", () => {
  const joiner = resolveSalarySegments([{ id: "s1", effectiveFrom: "2024-01-01", effectiveTo: null }],
    "2026-11-01", "2026-11-30", "2026-11-10", null);
  assert.equal(joiner[0].days, 21); // Nov 10–30

  const leaver = resolveSalarySegments([{ id: "s1", effectiveFrom: "2024-01-01", effectiveTo: null }],
    "2026-11-01", "2026-11-30", null, "2026-11-20");
  assert.equal(leaver[0].days, 20); // Nov 1–20

  const notYet = resolveSalarySegments([{ id: "s1", effectiveFrom: "2024-01-01", effectiveTo: null }],
    "2026-11-01", "2026-11-30", "2027-01-01", null);
  assert.equal(notYet.length, 0); // not employed during the period
});
