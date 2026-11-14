// FR-05 Tasks domain proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidTaskStatus, isValidPriority, isTaskOpen, taskOverdue } from "../src/tasks.ts";

test("task status and priority validate", () => {
  assert.equal(isValidTaskStatus("in_progress"), true);
  assert.equal(isValidTaskStatus("archived"), false);
  assert.equal(isValidPriority("high"), true);
  assert.equal(isValidPriority("urgent"), false);
});

test("isTaskOpen covers open and in_progress only", () => {
  assert.equal(isTaskOpen("open"), true);
  assert.equal(isTaskOpen("in_progress"), true);
  assert.equal(isTaskOpen("done"), false);
  assert.equal(isTaskOpen("cancelled"), false);
});

test("taskOverdue only when still open and past due", () => {
  assert.equal(taskOverdue("2026-11-10", "open", "2026-11-14"), true);
  assert.equal(taskOverdue("2026-11-20", "open", "2026-11-14"), false); // not due yet
  assert.equal(taskOverdue("2026-11-10", "done", "2026-11-14"), false); // completed
  assert.equal(taskOverdue(null, "open", "2026-11-14"), false);         // no due date
});
