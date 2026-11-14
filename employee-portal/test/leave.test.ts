// FR-03 Leave domain proof. Run: npm test (node --test, strips TS types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { countLeaveDays, canTakeLeave, availableAfterPending, isValidDate } from "../src/leave.ts";

test("isValidDate accepts real dates and rejects malformed/impossible ones", () => {
  assert.equal(isValidDate("2026-11-14"), true);
  assert.equal(isValidDate("2026-2-3"), false);   // not zero-padded
  assert.equal(isValidDate("2026-02-31"), false); // impossible day
  assert.equal(isValidDate("not-a-date"), false);
});

test("countLeaveDays counts inclusive days; half-day only for a single day", () => {
  assert.equal(countLeaveDays("2026-11-14", "2026-11-14"), 1);
  assert.equal(countLeaveDays("2026-11-14", "2026-11-16"), 3);
  assert.equal(countLeaveDays("2026-11-14", "2026-11-14", true), 0.5);
  assert.equal(countLeaveDays("2026-11-14", "2026-11-16", true), 3); // half ignored for a range
  assert.equal(countLeaveDays("2026-11-16", "2026-11-14"), 0);       // inverted range
  assert.equal(countLeaveDays("bad", "2026-11-16"), 0);              // invalid input
});

test("balance checks subtract used and pending before allowing a request", () => {
  assert.equal(availableAfterPending(12, 3, 2), 7);
  assert.equal(canTakeLeave(12, 3, 2, 7), true);  // exactly fits
  assert.equal(canTakeLeave(12, 3, 2, 8), false); // one day too many
  assert.equal(canTakeLeave(12, 0, 0, 0), false); // a zero-day request never fits
});
