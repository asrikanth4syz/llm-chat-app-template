import { describe, it, expect } from "vitest";
import { accountLabel, clientDisplayLabel, resolveDefaultLocationId } from "../src/client_account";

describe("accountLabel", () => {
  it("prefers display_name, then legal_name, then name", () => {
    expect(accountLabel({ name: "N", legal_name: "L", display_name: "D" })).toBe("D");
    expect(accountLabel({ name: "N", legal_name: "L" })).toBe("L");
    expect(accountLabel({ name: "N" })).toBe("N");
    expect(accountLabel({})).toBe("");
    expect(accountLabel(null)).toBe("");
  });
  it("ignores blank/whitespace values", () => {
    expect(accountLabel({ name: "N", display_name: "   " })).toBe("N");
  });
});

describe("clientDisplayLabel", () => {
  it("joins account and location with a middot", () => {
    expect(clientDisplayLabel({ display_name: "ServiceNow" }, { display_name: "Manyata EGL" }))
      .toBe("ServiceNow · Manyata EGL");
  });
  it("drops the location part when blank or equal to the account", () => {
    expect(clientDisplayLabel({ name: "Acme" })).toBe("Acme");
    expect(clientDisplayLabel({ name: "Acme" }, { display_name: "" })).toBe("Acme");
    expect(clientDisplayLabel({ display_name: "Acme" }, { display_name: "Acme" })).toBe("Acme");
  });
});

describe("resolveDefaultLocationId", () => {
  it("returns the flagged default", () => {
    expect(resolveDefaultLocationId([{ id: "a" }, { id: "b", is_default: 1 }])).toBe("b");
  });
  it("falls back to the first location", () => {
    expect(resolveDefaultLocationId([{ id: "a" }, { id: "b" }])).toBe("a");
  });
  it("null when none", () => {
    expect(resolveDefaultLocationId([])).toBe(null);
  });
});
