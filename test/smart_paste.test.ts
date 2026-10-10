// Pure-logic unit tests for Smart Paste Order (milestone 004, Task 1.B).
// The safety harness: parser + number grammar + scorer + confidence, isolated
// from the DB. Every r2 parsing fixture has an asserted output.
import { describe, it, expect } from "vitest";
import {
  parsePasteText, scoreCandidate, confidenceOf, rankCandidates, searchCandidates,
  normNameForMatch, learnedConfidence, rankLine,
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

describe("searchCandidates — forgiving manual catalogue lookup", () => {
  const pool = [
    { sku: "A", name: "Diet Coke 330ml", price: 40, order_count: 8 },
    { sku: "B", name: "Coke Zero 300ml", price: 38, order_count: 2 },
    { sku: "C", name: "Premium Coffee Beans", price: 850, order_count: 0 },
    { sku: "D", name: "Sprite 300ml", price: 38, order_count: 0 },
  ];

  it("a short substring query finds every product containing it (the bug fix)", () => {
    // "coke" clears NOTHING under the strict Jaccard matcher…
    expect(rankCandidates("coke", pool)).toHaveLength(0);
    // …but search finds both Coke products by substring.
    const r = searchCandidates("coke", pool);
    const skus = r.map(c => c.sku);
    expect(skus).toContain("A");
    expect(skus).toContain("B");
    expect(skus).not.toContain("C");
    expect(skus).not.toContain("D");
  });

  it("partial single word matches ('coffee' → Premium Coffee Beans)", () => {
    const r = searchCandidates("coffee", pool);
    expect(r[0].sku).toBe("C");
    expect(r[0].tier).toBe("contains");
  });

  it("case-insensitive and ranks history higher among equal tiers", () => {
    const r = searchCandidates("COKE", pool);
    expect(r[0].sku).toBe("A"); // order_count 8 > 2, both 'contains'
    expect(r[0].why.some(w => w.startsWith("ordered"))).toBe(true);
  });

  it("exact SKU or whole-name query scores 100", () => {
    expect(searchCandidates("A", pool)[0].confidence).toBe(100);
    expect(searchCandidates("Sprite 300ml", pool)[0].sku).toBe("D");
    expect(searchCandidates("Sprite 300ml", pool)[0].confidence).toBe(100);
  });

  it("prefix-of-token matches ('bean' → Premium Coffee Beans)", () => {
    expect(searchCandidates("bean", pool)[0].sku).toBe("C");
  });

  it("no match and empty query return nothing", () => {
    expect(searchCandidates("xyzzy", pool)).toHaveLength(0);
    expect(searchCandidates("", pool)).toHaveLength(0);
    expect(searchCandidates("   ", pool)).toHaveLength(0);
  });
});

describe("learnedConfidence (V2-M3)", () => {
  it("rises with hits, starts at 88 (1), caps below 100", () => {
    expect(learnedConfidence(1)).toBe(88);
    expect(learnedConfidence(3)).toBe(92);
    expect(learnedConfidence(10)).toBe(97);
    expect(learnedConfidence(100000)).toBe(99); // saturates below 100
    expect(learnedConfidence(0)).toBe(85);
  });
});

describe("rankLine — catalogue + learned aliases (V2-M2/M3/M5)", () => {
  const pool = [
    { sku: "GD", name: "Britannia Good Day 100g", price: 42, order_count: 0 },
    { sku: "COF", name: "Premium Coffee Beans", price: 850, order_count: 8 },
    { sku: "TEA", name: "Green Tea Sachets", price: 320, order_count: 2 },
  ];

  it("a qualifying learned alias surfaces with an honest 'learned from N' reason", () => {
    // "goodday 100" cannot be token-matched to "Britannia Good Day 100g" (V1 honest 0)
    expect(rankCandidates("goodday 100", pool)).toHaveLength(0);
    const r = rankLine("goodday 100", pool, new Map([["GD", 3]]), { minHits: 2 });
    expect(r[0].sku).toBe("GD");
    expect(r[0].tier).toBe("learned");
    expect(r[0].confidence).toBe(92);
    expect(r[0].why.some(w => w.startsWith("learned from 3"))).toBe(true);
  });

  it("an exact catalogue match still outranks a learned alias to a different sku", () => {
    const r = rankLine("Green Tea Sachets", pool, new Map([["GD", 9]]), { minHits: 2 });
    expect(r[0].sku).toBe("TEA");
    expect(r[0].tier).toBe("exact");
    expect(r[0].confidence).toBe(100);
  });

  it("a 1-hit (sub-threshold) alias is advisory (≤70) and never outranks a strong history match", () => {
    // Paste text that history-fuzzy-matches COF strongly, plus a 1-hit alias to GD.
    const r = rankLine("Premium Coffee", pool, new Map([["GD", 1]]), { minHits: 2 });
    expect(r[0].sku).toBe("COF");              // history beats the advisory alias
    const gd = r.find(c => c.sku === "GD");
    expect(gd && gd.confidence).toBeLessThanOrEqual(70);
  });

  it("a learned alias whose sku is not in the pool is dropped (dead-SKU guard)", () => {
    expect(rankLine("whatever", pool, new Map([["GONE", 5]])).some(c => c.sku === "GONE")).toBe(false);
  });

  it("deterministic: full ties break by sku asc; limit honoured", () => {
    const flat = [
      { sku: "B", name: "Item B", price: 1, order_count: 0 },
      { sku: "A", name: "Item A", price: 1, order_count: 0 },
      { sku: "C", name: "Item C", price: 1, order_count: 0 },
    ];
    const r = rankLine("", flat, new Map([["B", 3], ["A", 3], ["C", 3]]), { minHits: 2, limit: 2 });
    expect(r).toHaveLength(2);
    // all learned, equal hits/confidence/order_count → final tie-break sku asc
    expect(r.map(c => c.sku)).toEqual(["A", "B"]);
  });
});
