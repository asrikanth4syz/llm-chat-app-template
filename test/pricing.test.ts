import { describe, it, expect } from "vitest";
import { pickEffectivePrice, priceSourceLabel } from "../src/pricing";

describe("pickEffectivePrice — effective-dated resolution", () => {
  const hist = [
    { price: 100, effective_from: "2026-01-01" },
    { price: 120, effective_from: "2026-06-01" },
    { price: 150, effective_from: "2027-03-01" }, // future relative to the Nov 2026 refs below
  ];
  it("uses the dated client price in effect on the reference date", () => {
    expect(pickEffectivePrice(hist, null, 200, "2026-11-26")).toMatchObject({ price: 120, source: "client", effective_from: "2026-06-01" });
  });
  it("ignores history dated after the reference date", () => {
    expect(pickEffectivePrice(hist, null, 200, "2026-03-15")).toMatchObject({ price: 100, effective_from: "2026-01-01" });
    // a price effective in the future never applies to an earlier order date
    expect(pickEffectivePrice(hist, null, 200, "2027-03-02").price).toBe(150);
  });
  it("falls back to the legacy undated catalog price when no history applies", () => {
    expect(pickEffectivePrice([], 90, 200, "2026-11-26")).toMatchObject({ price: 90, source: "client", effective_from: null });
    // history exists but is all in the future → catalog price is the fallback
    expect(pickEffectivePrice([{ price: 150, effective_from: "2027-01-01" }], 90, 200, "2026-11-26").price).toBe(90);
  });
  it("falls back to the standard price when there is no client price", () => {
    expect(pickEffectivePrice([], null, 200, "2026-11-26")).toMatchObject({ price: 200, source: "standard", known: true });
  });
  it("reports not-known when neither a client nor a standard price exists", () => {
    expect(pickEffectivePrice([], null, null, "2026-11-26")).toMatchObject({ source: "standard", known: false, price: 0 });
  });
});

describe("priceSourceLabel", () => {
  it("labels each source clearly", () => {
    expect(priceSourceLabel("client")).toBe("Client price");
    expect(priceSourceLabel("override")).toBe("Manual override");
    expect(priceSourceLabel("standard")).toContain("no agreed price for this client");
  });
});
