// FR-09 Helpdesk + FR-21 POSH proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { slaDueISO, isOverdue, canViewTicket, canHandleTicket, isValidCategory, isValidStatus } from "../src/helpdesk.ts";

test("SLA due is category hours after creation; resolved/closed are never overdue", () => {
  assert.equal(slaDueISO("2026-11-14 10:00:00", "it"), "2026-11-14T18:00:00.000Z");       // +8h
  assert.equal(slaDueISO("2026-11-14 10:00:00", "general"), "2026-11-16T10:00:00.000Z");   // +48h
  assert.equal(isOverdue("2026-11-14 10:00:00", "it", "open", "2026-11-14T19:00:00.000Z"), true);
  assert.equal(isOverdue("2026-11-14 10:00:00", "it", "open", "2026-11-14T12:00:00.000Z"), false);
  assert.equal(isOverdue("2026-11-14 10:00:00", "it", "resolved", "2026-12-01T00:00:00.000Z"), false);
});

test("categories and statuses validate", () => {
  assert.equal(isValidCategory("posh"), true);
  assert.equal(isValidCategory("payroll"), false);
  assert.equal(isValidStatus("in_progress"), true);
  assert.equal(isValidStatus("archived"), false);
});

test("POSH tickets are visible only to the complainant and the committee (FR-21)", () => {
  const posh = { employeeId: "e_asha", category: "posh" };
  const hr = { employeeId: "e_asha", category: "hr" };
  assert.equal(canViewTicket("e_asha", posh, { isAgent: false, isCommittee: false }), true);  // own complaint
  assert.equal(canViewTicket("e_hr", posh, { isAgent: true, isCommittee: false }), false);     // agent, not on committee → NO
  assert.equal(canViewTicket("e_hr", hr, { isAgent: true, isCommittee: false }), true);        // agent sees ordinary tickets
  assert.equal(canViewTicket("e_ic", posh, { isAgent: false, isCommittee: true }), true);      // committee sees POSH
  assert.equal(canHandleTicket(posh, { isAgent: true, isCommittee: false }), false);           // only committee handles POSH
  assert.equal(canHandleTicket(posh, { isAgent: false, isCommittee: true }), true);
  assert.equal(canHandleTicket(hr, { isAgent: true, isCommittee: false }), true);
});
