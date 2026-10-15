// Pure-logic unit tests for the Quotations approval / SoD core (milestone 006,
// Slice 4): required legs, Manager-auto-satisfy / Finance-never, fallback
// selection + one-leg rule, act-time SoD, completion.
import { describe, it, expect } from "vitest";
import {
  requiredLegs, legRole, planSubmit, assertCanActOnLeg, isComplete, QuoteApprovalError,
} from "../src/quote_approval";
import type { QuoteRole } from "../src/quote_access";

const THRESH = 50000000;
const set = (...ids: string[]) => new Set(ids);

describe("quote_approval — requiredLegs", () => {
  it("manager always; finance when ITC=No or grand >= threshold", () => {
    expect(requiredLegs(true, 1000, THRESH)).toEqual(["manager"]);
    expect(requiredLegs(false, 1000, THRESH)).toEqual(["manager", "finance"]); // ITC=No
    expect(requiredLegs(true, THRESH, THRESH)).toEqual(["manager", "finance"]); // boundary inclusive
    expect(requiredLegs(true, THRESH - 1, THRESH)).toEqual(["manager"]);
  });
  it("legRole maps legs to quote-roles", () => {
    expect(legRole("manager")).toBe("commercial_manager");
    expect(legRole("finance")).toBe("finance");
  });
});

describe("quote_approval — planSubmit", () => {
  const users = (o: Record<string, QuoteRole>) => o;

  it("manager leg auto-satisfies when the current-version author is a manager; no finance → APPROVED", () => {
    const plan = planSubmit({
      requiredLegs: ["manager"], authorSet: set("mgr1"), currentVersionAuthor: "mgr1",
      users: users({ mgr1: "commercial_manager" }), fallbackId: null,
    });
    expect(plan.legs[0]).toMatchObject({ leg: "manager", status: "AUTO_SATISFIED", assigned_to: "mgr1" });
    expect(plan.finalStatus).toBe("APPROVED");
  });

  it("manager authored but is NOT the current-version author → needs a distinct manager", () => {
    // sales authored v2 (current), manager only authored v1 → still in authorSet, but auto-satisfy keys on current author
    const plan = planSubmit({
      requiredLegs: ["manager"], authorSet: set("sales1", "mgr1"), currentVersionAuthor: "sales1",
      users: users({ sales1: "sales", mgr1: "commercial_manager", mgr2: "commercial_manager" }), fallbackId: null,
    });
    expect(plan.legs[0]).toMatchObject({ status: "PENDING", assigned_to: "mgr2", assigned_as_fallback: false });
    expect(plan.finalStatus).toBe("PENDING_APPROVAL");
  });

  it("finance leg is never auto-satisfied even if a finance user authored", () => {
    const plan = planSubmit({
      requiredLegs: ["manager", "finance"], authorSet: set("fin1"), currentVersionAuthor: "fin1",
      users: users({ fin1: "finance", mgr1: "commercial_manager", fin2: "finance" }), fallbackId: null,
    });
    const fin = plan.legs.find((l) => l.leg === "finance")!;
    expect(fin.status).toBe("PENDING");
    expect(fin.assigned_to).toBe("fin2"); // fin1 is an author → excluded
  });

  it("falls back to fallback_approver_id when no non-author role approver exists (one leg only)", () => {
    const plan = planSubmit({
      requiredLegs: ["manager"], authorSet: set("mgrAuthor"), currentVersionAuthor: "mgrAuthor",
      // the only manager is the author; fallback covers it
      users: users({ mgrAuthor: "commercial_manager", fb: "finance" }), fallbackId: "fb",
    });
    // current author is a manager → AUTO_SATISFIED actually fires here; use a sales author instead:
    const plan2 = planSubmit({
      requiredLegs: ["manager"], authorSet: set("sales1"), currentVersionAuthor: "sales1",
      users: users({ sales1: "sales", fb: "finance" }), fallbackId: "fb",
    });
    expect(plan2.legs[0]).toMatchObject({ status: "PENDING", assigned_to: "fb", assigned_as_fallback: true });
    void plan;
  });

  it("one fallback cannot take BOTH legs → 409 on the second", () => {
    expect(() => planSubmit({
      requiredLegs: ["manager", "finance"], authorSet: set("sales1"), currentVersionAuthor: "sales1",
      users: users({ sales1: "sales", fb: "finance" }), fallbackId: "fb",
    })).toThrowError(QuoteApprovalError);
  });

  it("finance-leg fallback must hold finance (a commercial_manager fallback cannot cover finance)", () => {
    expect(() => planSubmit({
      requiredLegs: ["finance"], authorSet: set("sales1"), currentVersionAuthor: "sales1",
      users: users({ sales1: "sales", fb: "commercial_manager" }), fallbackId: "fb",
    })).toThrowError(/finance/);
  });

  it("no eligible approver at all → 409 naming the leg", () => {
    try {
      planSubmit({ requiredLegs: ["manager"], authorSet: set("sales1"), currentVersionAuthor: "sales1",
        users: users({ sales1: "sales" }), fallbackId: null });
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(QuoteApprovalError);
      expect((e as QuoteApprovalError).status).toBe(409);
      expect((e as QuoteApprovalError).leg).toBe("manager");
    }
  });
});

describe("quote_approval — assertCanActOnLeg (SoD)", () => {
  const base = { actorId: "mgr2", actorRole: "commercial_manager" as QuoteRole, leg: "manager" as const, authorSet: set("sales1"), fallbackId: null, otherLegActor: null };
  it("a non-author role holder may act", () => {
    expect(() => assertCanActOnLeg(base)).not.toThrow();
  });
  it("an author cannot act (403 E_SOD)", () => {
    try { assertCanActOnLeg({ ...base, actorId: "sales1", actorRole: "sales" }); throw new Error("no throw"); }
    catch (e) { expect((e as QuoteApprovalError).code).toBe("E_SOD"); }
  });
  it("cannot act on both legs of one quote (E_SOD_ONE_LEG)", () => {
    try { assertCanActOnLeg({ ...base, otherLegActor: "mgr2" }); throw new Error("no throw"); }
    catch (e) { expect((e as QuoteApprovalError).code).toBe("E_SOD_ONE_LEG"); }
  });
  it("wrong role for the leg is blocked unless fallback", () => {
    try { assertCanActOnLeg({ ...base, actorId: "fin1", actorRole: "finance", leg: "manager" }); }
    catch (e) { expect((e as QuoteApprovalError).code).toBe("E_WRONG_LEG"); }
    // finance acting as a configured fallback on the manager leg is allowed
    expect(() => assertCanActOnLeg({ ...base, actorId: "fb", actorRole: "finance", leg: "manager", fallbackId: "fb" })).not.toThrow();
  });
});

describe("quote_approval — isComplete", () => {
  it("all required legs APPROVED/AUTO_SATISFIED → complete", () => {
    expect(isComplete([{ status: "AUTO_SATISFIED" }, { status: "APPROVED" }])).toBe(true);
  });
  it("any live leg PENDING → not complete; SUPERSEDED rows ignored", () => {
    expect(isComplete([{ status: "APPROVED" }, { status: "PENDING" }])).toBe(false);
    expect(isComplete([{ status: "SUPERSEDED" }, { status: "APPROVED" }])).toBe(true);
    expect(isComplete([])).toBe(false);
  });
});
