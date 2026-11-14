// FR-07 Announcements proof. Run: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidAudience, audienceMatches, needsAck } from "../src/announcements.ts";

test("audiences validate", () => {
  assert.equal(isValidAudience("all"), true);
  assert.equal(isValidAudience("office"), true);
  assert.equal(isValidAudience("client_site"), true);
  assert.equal(isValidAudience("managers"), false);
});

test("audienceMatches: all reaches everyone; a segment reaches only that segment", () => {
  assert.equal(audienceMatches("all", "office"), true);
  assert.equal(audienceMatches("all", null), true);
  assert.equal(audienceMatches("office", "office"), true);
  assert.equal(audienceMatches("office", "client_site"), false);
  assert.equal(audienceMatches("client_site", null), false); // no segment → only 'all'
});

test("needsAck only when required and not yet acknowledged for the current version", () => {
  assert.equal(needsAck(1, 0), true);   // required, not acked
  assert.equal(needsAck(1, 1), false);  // required, already acked
  assert.equal(needsAck(0, 0), false);  // not required
  assert.equal(needsAck(true, false), true);
});
