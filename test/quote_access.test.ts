// Pure-logic unit tests for the Quotations entitlement / capability core
// (milestone 006, Slice 2). The configurable per-user assignment requirement:
// parse (fail-closed), resolve role, capability matrix, admin-PUT validation
// (enum / optimistic _ver / self-grant), fallback-approver validation.
import { describe, it, expect } from "vitest";
import {
  QUOTE_ROLES, APPROVER_ROLES, isQuoteRole, can, canApproveLeg, seesCost,
  parseEnabledUsers, resolveQuoteRole, accessDecision, requireQuoteAccessDecision,
  applyAccessChange, validateFallbackApprover, revokeBreaksFallback,
  QuoteAccessError, type EnabledUsers,
} from "../src/quote_access";

describe("quote_access — capability matrix (default-deny)", () => {
  it("sales authors but does not approve", () => {
    expect(can("sales", "create_edit")).toBe(true);
    expect(can("sales", "submit")).toBe(true);
    expect(can("sales", "sees_cost")).toBe(true);
    expect(canApproveLeg("sales", "manager")).toBe(false);
    expect(canApproveLeg("sales", "finance")).toBe(false);
  });
  it("commercial_manager can author AND approve the manager leg", () => {
    expect(can("commercial_manager", "create_edit")).toBe(true); // r4 fix: managers can author
    expect(canApproveLeg("commercial_manager", "manager")).toBe(true);
    expect(canApproveLeg("commercial_manager", "finance")).toBe(false);
    expect(seesCost("commercial_manager")).toBe(true);
  });
  it("finance approves only the finance leg and cannot author", () => {
    expect(canApproveLeg("finance", "finance")).toBe(true);
    expect(canApproveLeg("finance", "manager")).toBe(false);
    expect(can("finance", "create_edit")).toBe(false);
    expect(seesCost("finance")).toBe(true);
  });
  it("ops is view/follow-up only and NEVER sees cost", () => {
    expect(can("ops", "view")).toBe(true);
    expect(can("ops", "followup")).toBe(true);
    expect(can("ops", "create_edit")).toBe(false);
    expect(can("ops", "submit")).toBe(false);
    expect(seesCost("ops")).toBe(false);
  });
  it("unknown / typo'd role fails closed on every capability", () => {
    expect(can("Ops", "view")).toBe(false);
    expect(can("manager", "create_edit")).toBe(false);
    expect(seesCost("auditor")).toBe(false); // auditor was dropped
    expect(canApproveLeg("superuser", "finance")).toBe(false);
  });
  it("auditor is not a quote-role", () => {
    expect(isQuoteRole("auditor")).toBe(false);
    expect([...QUOTE_ROLES]).toEqual(["sales", "ops", "commercial_manager", "finance"]);
    expect([...APPROVER_ROLES]).toEqual(["commercial_manager", "finance"]);
  });
});

describe("quote_access — parseEnabledUsers (fail-closed)", () => {
  it("unset / empty → feature OFF", () => {
    expect(parseEnabledUsers(null)).toEqual({ ver: 0, users: {} });
    expect(parseEnabledUsers("")).toEqual({ ver: 0, users: {} });
  });
  it("malformed JSON → empty + warns, never throws", () => {
    const warns: string[] = [];
    expect(parseEnabledUsers("{not json", (m) => warns.push(m))).toEqual({ ver: 0, users: {} });
    expect(warns.length).toBe(1);
  });
  it("drops entries whose role is invalid (typo fails closed)", () => {
    const warns: string[] = [];
    const p = parseEnabledUsers(JSON.stringify({ _ver: 3, users: { u1: "sales", u2: "Ops", u3: "finance", u4: 42 } }), (m) => warns.push(m));
    expect(p.ver).toBe(3);
    expect(p.users).toEqual({ u1: "sales", u3: "finance" });
    expect(warns.length).toBe(2); // u2, u4 dropped
  });
  it("wrong shape (no users object) → OFF", () => {
    expect(parseEnabledUsers(JSON.stringify({ _ver: 1 }))).toEqual({ ver: 0, users: {} });
    expect(parseEnabledUsers(JSON.stringify(["sales"]))).toEqual({ ver: 0, users: {} });
  });
});

describe("quote_access — resolve / access decision", () => {
  const enabled: EnabledUsers = { ver: 2, users: { u1: "sales", u2: "finance" } };
  it("resolveQuoteRole returns role or null", () => {
    expect(resolveQuoteRole(enabled, "u1")).toBe("sales");
    expect(resolveQuoteRole(enabled, "nobody")).toBe(null);
  });
  it("accessDecision drives the nav tile", () => {
    expect(accessDecision(enabled, "u1")).toEqual({ enabled: true, quoteRole: "sales" });
    expect(accessDecision(enabled, "nobody")).toEqual({ enabled: false, quoteRole: null });
  });
  it("requireQuoteAccessDecision throws 404 when not entitled", () => {
    expect(requireQuoteAccessDecision(enabled, "u2")).toEqual({ quoteRole: "finance" });
    try { requireQuoteAccessDecision(enabled, "nobody"); throw new Error("should throw"); }
    catch (e) { expect(e).toBeInstanceOf(QuoteAccessError); expect((e as QuoteAccessError).status).toBe(404); }
  });
});

describe("quote_access — applyAccessChange (admin PUT)", () => {
  const cur: EnabledUsers = { ver: 5, users: { u1: "sales" } };
  it("grants a role and bumps ver", () => {
    const next = applyAccessChange(cur, { userId: "u2", quoteRole: "finance", expectedVer: 5 }, "admin");
    expect(next).toEqual({ ver: 6, users: { u1: "sales", u2: "finance" } });
  });
  it("null role removes the user", () => {
    const next = applyAccessChange(cur, { userId: "u1", quoteRole: null, expectedVer: 5 }, "admin");
    expect(next.users).toEqual({});
  });
  it("invalid role → 422", () => {
    try { applyAccessChange(cur, { userId: "u2", quoteRole: "boss" as any, expectedVer: 5 }, "admin"); throw new Error("no throw"); }
    catch (e) { expect((e as QuoteAccessError).status).toBe(422); }
  });
  it("stale _ver → 409", () => {
    try { applyAccessChange(cur, { userId: "u2", quoteRole: "sales", expectedVer: 4 }, "admin"); throw new Error("no throw"); }
    catch (e) { expect((e as QuoteAccessError).status).toBe(409); }
  });
  it("admin granting an approver role to SELF → 403", () => {
    try { applyAccessChange(cur, { userId: "admin", quoteRole: "finance", expectedVer: 5 }, "admin"); throw new Error("no throw"); }
    catch (e) { expect((e as QuoteAccessError).status).toBe(403); expect((e as QuoteAccessError).code).toBe("E_SELF_GRANT"); }
  });
  it("admin granting a NON-approver role to self is allowed", () => {
    const next = applyAccessChange(cur, { userId: "admin", quoteRole: "sales", expectedVer: 5 }, "admin");
    expect(next.users.admin).toBe("sales");
  });
});

describe("quote_access — fallback approver validation", () => {
  const enabled: EnabledUsers = { ver: 1, users: { s: "sales", m: "commercial_manager", f: "finance", o: "ops" } };
  it("accepts an entitled approver-role user; null clears", () => {
    expect(() => validateFallbackApprover(enabled, "m")).not.toThrow();
    expect(() => validateFallbackApprover(enabled, "f")).not.toThrow();
    expect(() => validateFallbackApprover(enabled, null)).not.toThrow();
  });
  it("rejects a non-approver or non-entitled fallback (422)", () => {
    for (const bad of ["s", "o", "ghost"]) {
      try { validateFallbackApprover(enabled, bad); throw new Error(`should reject ${bad}`); }
      catch (e) { expect((e as QuoteAccessError).status).toBe(422); }
    }
  });
  it("revokeBreaksFallback flags a revoke/demote that strands the fallback", () => {
    // demote the fallback manager 'm' to sales → breaks
    const demoted: EnabledUsers = { ver: 2, users: { ...enabled.users, m: "sales" } };
    expect(revokeBreaksFallback("m", demoted, "m")).toBe(true);
    // removing a different user does not break it
    expect(revokeBreaksFallback("m", enabled, "s")).toBe(false);
    // no fallback configured → never breaks
    expect(revokeBreaksFallback(null, demoted, "m")).toBe(false);
  });
});
