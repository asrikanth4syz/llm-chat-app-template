import { describe, it, expect } from "vitest";
import { normName, normDc, clientNameMatches, reconcileDcImport } from "../src/zoho_dc_import";

describe("normName", () => {
  it("trims, collapses whitespace, lower-cases", () => {
    expect(normName("  ServiceNow   Software  Pvt Ltd ")).toBe("servicenow software pvt ltd");
  });
  it("empty for nullish", () => {
    expect(normName(null)).toBe("");
    expect(normName(undefined)).toBe("");
  });
});

describe("normDc", () => {
  it("drops whitespace and lower-cases", () => {
    expect(normDc(" DC 9001 ")).toBe("dc9001");
  });
  it("strips leading zeros for a numeric value", () => {
    expect(normDc("00012")).toBe("12");
    expect(normDc("0")).toBe("0");
  });
  it("keeps non-numeric strings as-is (minus spaces/case)", () => {
    expect(normDc("DC-0012")).toBe("dc-0012");
  });
});

describe("clientNameMatches", () => {
  it("matches normalized names", () => {
    expect(clientNameMatches("ServiceNow  Pvt  Ltd", "servicenow pvt ltd")).toBe(true);
  });
  it("does not match a blank or different name", () => {
    expect(clientNameMatches("", "acme")).toBe(false);
    expect(clientNameMatches("Acme", "Globex")).toBe(false);
  });
});

describe("reconcileDcImport", () => {
  const order = [
    { sku: "A", name: "Rice", qty_ordered: 60, delivered_so_far: 0 },
    { sku: "B", name: "Oil", qty_ordered: 120, delivered_so_far: 0 },
    { sku: "C", name: "Dal", qty_ordered: 100, delivered_so_far: 0 },
  ];

  it("matches by SKU and computes due/over", () => {
    const r = reconcileDcImport(order, [
      { sku: "A", qty: 60 },   // exact
      { sku: "B", qty: 160 },  // over by 40
      { sku: "C", qty: 40 },   // short (partial)
    ]);
    expect(r.verdict).toBe("warn"); // over present
    expect(r.totals.import_qty).toBe(260);
    expect(r.totals.over_qty).toBe(40);
    const b = r.lines.find(l => l.sku === "B")!;
    expect(b.status).toBe("over");
    expect(b.over).toBe(40);
    const c = r.lines.find(l => l.sku === "C")!;
    expect(c.status).toBe("matched");
    expect(c.due).toBe(100);
  });

  it("flags an unmatched SKU and never treats it as ordered", () => {
    const r = reconcileDcImport(order, [{ sku: "Z", name: "Ghost", qty: 10 }]);
    expect(r.has_unmatched).toBe(true);
    expect(r.totals.unmatched_lines).toBe(1);
    expect(r.totals.unmatched_qty).toBe(10);
    const z = r.lines[0];
    expect(z.matched).toBe(false);
    expect(z.status).toBe("unmatched");
    expect(z.ordered).toBe(0);
  });

  it("verdict ok when all matched and none over", () => {
    const r = reconcileDcImport(order, [{ sku: "A", qty: 60 }, { sku: "B", qty: 100 }]);
    expect(r.verdict).toBe("ok");
    expect(r.has_over).toBe(false);
  });

  it("verdict blocked when nothing matches", () => {
    const r = reconcileDcImport(order, [{ sku: "Z", qty: 5 }]);
    expect(r.verdict).toBe("blocked");
  });

  it("accounts for quantity already delivered when computing over", () => {
    const r = reconcileDcImport(
      [{ sku: "A", name: "Rice", qty_ordered: 60, delivered_so_far: 50 }],
      [{ sku: "A", qty: 20 }], // 50 + 20 = 70 > 60 → over 10
    );
    const a = r.lines[0];
    expect(a.due).toBe(10);
    expect(a.over).toBe(10);
    expect(a.status).toBe("over");
  });
});
