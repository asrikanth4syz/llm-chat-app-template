// FR-06 Documents proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDocCategory, isValidDocStatus, canViewDocument } from "../src/documents.ts";

test("document categories and statuses validate", () => {
  assert.equal(isValidDocCategory("payslip"), true);
  assert.equal(isValidDocCategory("invoice"), false);
  assert.equal(isValidDocStatus("published"), true);
  assert.equal(isValidDocStatus("archived"), false);
});

test("employees see only their OWN PUBLISHED documents; managers see all incl. drafts (FR-06)", () => {
  const pubOwn = { employeeId: "e_asha", status: "published" };
  const draftOwn = { employeeId: "e_asha", status: "draft" };
  const pubOther = { employeeId: "e_bala", status: "published" };
  assert.equal(canViewDocument("e_asha", pubOwn, false), true);    // own + published
  assert.equal(canViewDocument("e_asha", draftOwn, false), false); // own draft payslip hidden
  assert.equal(canViewDocument("e_asha", pubOther, false), false); // someone else's
  assert.equal(canViewDocument("e_hr", draftOwn, true), true);     // manager/HR sees drafts
  assert.equal(canViewDocument(null, pubOwn, false), false);       // no employee record
});
