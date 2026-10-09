// Pure-logic unit tests for Smart Paste Order (milestone 004, Task 1.B).
// The safety harness: parser + number grammar + scorer + confidence, isolated
// from the DB. Every r2 parsing fixture has an asserted output.
import { describe, it, expect } from "vitest";
import {
  parsePasteText, scoreCandidate, confidenceOf, rankCandidates,
  normNameForMatch,
} from "../src/smart_paste";

// Helper: parse a single line and return its one ParsedLine.
const one = (s: string) => parsePasteText(s)[0];

describe("parsePasteText — quantity extraction (R2-C4/C5/C6, R2-D2)", () => {
  it("separator tie-break: 'Goodday 100 - 10' → name 'Goodday 100', qty 10", () => {
    const l = one("Goodday 100 - 10");
    expect(l.product_text).toBe("Goodday 100");
    expect(l.quantity).toBe(10);
    expect(l.needs_qty).toBe(false);
  });

  it("trailing bare integer: 'Water 20' → 'Water', 20", () => {
    const l = one("Water 20");
    expect(l.product_text).toBe("Water");
    expect(l.quantity).toBe(20);
  });

  it("pack kept, separator qty: 'Coke 300ml x 24 - 5' → 'Coke 300ml x 24', 5", () => {
    const l = one("Coke 300ml x 24 - 5");
    expect(l.product_text).toBe("Coke 300ml x 24");
    expect(l.quantity).toBe(5);
  });

  it("leading multiplier no space: '2x Water' → 'Water', 2", () => {
    const l = one("2x Water");
    expect(l.product_text).toBe("Water");
    expect(l.quantity).toBe(2);
  });

  it("leading multiplier with space: '5 x Water' → 'Water', 5", () => {
    const l = one("5 x Water");
    expect(l.product_text).toBe("Water");
    expect(l.quantity).toBe(5);
  });

  it("trailing times-N (DECISION: qty): 'Water x 5' → 'Water', 5", () => {
    const l = one("Water x 5");
    expect(l.product_text).toBe("Water");
    expect(l.quantity).toBe(5);
  });

  it("unit-bound-only number → needs_qty (DECISION): 'Lays Classic 52g'", () => {
    const l = one("Lays Classic 52g");
    expect(l.quantity).toBeNull();
    expect(l.needs_qty).toBe(true);
    expect(l.product_text).toBe("Lays Classic 52g");
  });

  it("DECISION 'Sugar 5 kg' → needs_qty (measure-unit-bound, not a count)", () => {
    const l = one("Sugar 5 kg");
    expect(l.needs_qty).toBe(true);
    expect(l.quantity).toBeNull();
  });

  it("DECISION 'Milk 2 l' → needs_qty", () => {
    expect(one("Milk 2 l").needs_qty).toBe(true);
  });

  it("word-boundary units: '5 notebooks' → qty 5 (not 'no'/'g' bound)", () => {
    const l = one("5 notebooks");
    expect(l.quantity).toBe(5);
  });

  it("trailing-zero decimal coerces: 'Sugar 2.0' → 2 + coerced_decimal", () => {
    const l = one("Sugar 2.0");
    expect(l.quantity).toBe(2);
    expect(l.parse_flags).toContain("coerced_decimal");
  });
  it("'Sugar 2.00' → 2 coerced", () => { expect(one("Sugar 2.00").quantity).toBe(2); });

  it("non-zero fraction rejected: 'Milk 2.5' → needs_qty + rejected_fraction", () => {
    const l = one("Milk 2.5");
    expect(l.quantity).toBeNull();
    expect(l.needs_qty).toBe(true);
    expect(l.parse_flags).toContain("rejected_fraction");
  });

  it("thousands separators: 'Rice 1,000' → 1000", () => {
    expect(one("Rice 1,000").quantity).toBe(1000);
  });
  it("Indian grouping: 'Bags 1,00,000' → 100000", () => {
    expect(one("Bags 1,00,000").quantity).toBe(100000);
  });
  it("comma as field separator: 'Water, 20' → 'Water', 20", () => {
    const l = one("Water, 20");
    expect(l.product_text).toBe("Water");
    expect(l.quantity).toBe(20);
  });

  it("ordinal stripped first: '1. Sugar 10' → 'Sugar', 10", () => {
    const l = one("1. Sugar 10");
    expect(l.product_text).toBe("Sugar");
    expect(l.quantity).toBe(10);
  });
  it("leading decimal is NOT an ordinal: '1.5 kg Sugar' → needs_qty", () => {
    expect(one("1.5 kg Sugar").needs_qty).toBe(true);
  });

  it("intra-token hyphen kept: 'Coca-Cola 300ml - 5' → 'Coca-Cola 300ml', 5", () => {
    const l = one("Coca-Cola 300ml - 5");
    expect(l.product_text).toBe("Coca-Cola 300ml");
    expect(l.quantity).toBe(5);
  });

  it("trailing note after separator falls back to last bare int: 'Water 20 - organic' → qty 20", () => {
    const l = one("Water 20 - organic");
    expect(l.quantity).toBe(20);
    expect(l.needs_qty).toBe(false);
  });

  it("MRP strip (reused normalisation, PV-7): normNameForMatch drops 'MRP 95'", () => {
    expect(normNameForMatch("Mountain Dew MRP 95")).toBe("mountain dew");
  });

  it("two bare numbers, no separator → low_confidence_parse", () => {
    const l = one("Pens 12 5");
    expect(l.quantity).toBe(5);
    expect(l.parse_flags).toContain("low_confidence_parse");
  });

  it("number-only line after markers → empty product_text (handler flags unmatched)", () => {
    expect(one("- 5").product_text).toBe("");
    expect(one("- 5").quantity).toBe(5);
    expect(one("1. 20").product_text).toBe("");
    expect(one("1. 20").quantity).toBe(20);
  });
});

describe("parsePasteText — line numbering & blanks (R2-D7)", () => {
  it("skips blank lines but preserves original 1-based line_no", () => {
    const lines = parsePasteText("Water 20\n\n\nMilk 10");
    expect(lines).toHaveLength(2);
    expect(lines[0].line_no).toBe(1);
    expect(lines[1].line_no).toBe(4); // original index of "Milk 10"
  });
  it("splits on CRLF and CR as well as LF (R2 D6-rev)", () => {
    expect(parsePasteText("A 1\r\nB 2\rC 3")).toHaveLength(3);
  });
});

describe("scoreCandidate — token Jaccard (R2-D1)", () => {
  it("'Diet Coke 330' vs 'Diet Coke 330ml' → 0.5", () => {
    expect(scoreCandidate("Diet Coke 330", "Diet Coke 330ml")).toBeCloseTo(0.5, 5);
  });
  it("'Goodday 100' vs 'Britannia Good Day 100g' → 0 (honest unmatched)", () => {
    expect(scoreCandidate("Goodday 100", "Britannia Good Day 100g")).toBe(0);
  });
  it("empty token set → 0", () => {
    expect(scoreCandidate("", "anything")).toBe(0);
    expect(scoreCandidate("!!!", "anything")).toBe(0);
  });
});

describe("confidenceOf (R2-D1/C2)", () => {
  it("exact tier is always 100", () => {
    expect(confidenceOf(1, 0, "exact")).toBe(100);
    expect(confidenceOf(0.2, 99, "exact")).toBe(100);
  });
  it("fuzzy: score 0.6, order_count 8 → 71", () => {
    expect(confidenceOf(0.6, 8, "history")).toBe(71);
  });
  it("capped at 99 for fuzzy", () => {
    expect(confidenceOf(1, 1000, "history")).toBe(99);
  });
  it("no history boost when order_count 0", () => {
    expect(confidenceOf(0.6, 0, "fuzzy")).toBe(60);
  });
});

describe("rankCandidates (R2-C1/C2)", () => {
  const pool = [
    { sku: "A", name: "Diet Coke 330ml", price: 40, order_count: 8 },
    { sku: "B", name: "Coke 300ml", price: 38, order_count: 2 },
    { sku: "C", name: "Sprite 300ml", price: 38, order_count: 0 },
  ];

  it("exact normalised-name match wins at confidence 100", () => {
    const r = rankCandidates("coke 300ml", pool);
    expect(r[0].sku).toBe("B");
    expect(r[0].tier).toBe("exact");
    expect(r[0].confidence).toBe(100);
  });

  it("fuzzy history match surfaces with an 'ordered N×' reason", () => {
    const r = rankCandidates("Diet Coke 330", pool);
    expect(r[0].sku).toBe("A");
    expect(r[0].score).toBeCloseTo(0.5, 5);
    expect(r[0].why.some(w => w.startsWith("ordered"))).toBe(true);
  });

  it("sole qualifier with no runner-up auto-passes the margin", () => {
    const r = rankCandidates("Diet Coke 330", [pool[0]]);
    expect(r).toHaveLength(1);
    expect(r[0].sku).toBe("A");
  });

  it("irrelevant line matches nothing (unmatched)", () => {
    expect(rankCandidates("xyzzy widget", pool)).toHaveLength(0);
  });

  it("empty product text → no candidates", () => {
    expect(rankCandidates("", pool)).toHaveLength(0);
  });
});
