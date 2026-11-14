// FR-04 Approvals delegation-window proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDelegationActive } from "../src/approvals.ts";

test("isDelegationActive respects the active flag and the date window", () => {
  assert.equal(isDelegationActive({ active: 1, startsOn: null, endsOn: null }, "2026-11-14"), true);
  assert.equal(isDelegationActive({ active: 0, startsOn: null, endsOn: null }, "2026-11-14"), false); // revoked
  assert.equal(isDelegationActive({ active: 1, startsOn: "2026-11-10", endsOn: "2026-11-20" }, "2026-11-14"), true);
  assert.equal(isDelegationActive({ active: 1, startsOn: "2026-11-20", endsOn: null }, "2026-11-14"), false); // before start
  assert.equal(isDelegationActive({ active: 1, startsOn: null, endsOn: "2026-11-10" }, "2026-11-14"), false); // after end
  assert.equal(isDelegationActive({ active: true, startsOn: "2026-11-14", endsOn: "2026-11-14" }, "2026-11-14"), true); // single-day inclusive
});
