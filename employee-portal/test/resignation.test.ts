// Resignation workflow state-machine proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTransition, isActiveState, stageIndex, STAGE_ORDER, type RState } from "../src/resignation.ts";

test("active vs inactive states", () => {
  assert.equal(isActiveState("pending_manager"), true);
  assert.equal(isActiveState("notice_period"), true);
  assert.equal(isActiveState("rejected"), false);
  assert.equal(isActiveState("withdrawn"), false);
  assert.equal(isActiveState("relieved"), false);
});

test("stage ordering; clearance_in_progress maps onto clearance_pending", () => {
  assert.ok(stageIndex("pending_hr") > stageIndex("pending_manager"));
  assert.equal(stageIndex("clearance_in_progress"), STAGE_ORDER.indexOf("clearance_pending"));
  assert.equal(stageIndex("rejected"), -1);
});

test("manager approval routes to HR, never straight to notice", () => {
  const r = validateTransition("pending_manager", "manager_approve", { isManager: true, remarks: "ok" });
  assert.deepEqual(r, { ok: true, next: "pending_hr" });
});

test("manager/HR decisions require remarks on reject", () => {
  assert.equal(validateTransition("pending_manager", "manager_reject", { isManager: true }).ok, false);
  assert.equal(validateTransition("pending_manager", "manager_reject", { isManager: true, remarks: "dup" }).ok, true);
  assert.equal(validateTransition("pending_hr", "hr_reject", { isHr: true }).ok, false);
  assert.equal(validateTransition("pending_hr", "hr_reject", { isHr: true, remarks: "no" }).next, "rejected");
});

test("manager approval alone does not start notice; only HR approval does", () => {
  assert.equal(validateTransition("pending_manager", "hr_approve", { isHr: true }).ok, false);
  assert.equal(validateTransition("pending_hr", "hr_approve", { isHr: true }).next, "notice_period");
});

test("actor gating: employee cannot approve; manager cannot HR-review", () => {
  assert.equal(validateTransition("pending_manager", "manager_approve", { isOwner: true, remarks: "x" }).ok, false);
  assert.equal(validateTransition("pending_hr", "hr_approve", { isManager: true }).ok, false);
});

test("clearance recompute derives overall status from tasks", () => {
  assert.equal(validateTransition("clearance_pending", "clearance_recompute", { anyClearanceStarted: true }).next, "clearance_in_progress");
  assert.equal(validateTransition("clearance_in_progress", "clearance_recompute", { allClearanceDone: true }).next, "clearance_completed");
  assert.equal(validateTransition("clearance_in_progress", "clearance_recompute", {}).next, "clearance_pending");
});

test("relieve needs F&F complete, or an authorised exception with reason", () => {
  assert.equal(validateTransition("fnf_completed", "relieve", { isHr: true }).next, "relieved");
  assert.equal(validateTransition("clearance_pending", "relieve", { isHr: true }).ok, false); // open clearance, no exception
  assert.equal(validateTransition("clearance_pending", "relieve", { isHr: true, exception: true }).ok, false); // exception needs reason
  assert.equal(validateTransition("clearance_pending", "relieve", { isHr: true, exception: true, remarks: "MD approved" }).next, "relieved");
});

test("waiver stays in notice with a mandatory reason", () => {
  assert.equal(validateTransition("notice_period", "waive", { isHr: true }).ok, false);
  assert.equal(validateTransition("notice_period", "waive", { isHr: true, remarks: "buyout" }).next, "notice_period");
});

test("withdraw is direct only before HR approval; later needs HR approval", () => {
  assert.equal(validateTransition("pending_hr", "withdraw", { isOwner: true, remarks: "stay" }).next, "withdrawn");
  assert.equal(validateTransition("notice_period", "withdraw", { isOwner: true, remarks: "stay" }).ok, false);
  assert.equal(validateTransition("notice_period", "withdraw_approve", { isHr: true }).next, "withdrawn");
});
