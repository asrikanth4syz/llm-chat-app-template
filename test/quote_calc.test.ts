// Pure-logic unit tests for the Quotations calc engine (milestone 006, Slice 1).
// The acceptance gate: the 18 frozen vectors (calc-vectors.md →
// fixtures/quote_calc_vectors.json) matched byte-exact, plus I0 integer/no-float
// guards, the loader consistency invariant, and the validation (422) surface.
import { describe, it, expect } from "vitest";
import {
  computeQuote, roundHalfAwayFromZero, applyBp, roundToRupee,
  QuoteCalcError, GST_SLAB_BP, MAX_PAISE,
  type QuoteCalcInput,
} from "../src/quote_calc";
import vectors from "./fixtures/quote_calc_vectors.json";

type Vec = {
  name: string;
  desc: string;
  finance_required?: boolean;
  input: QuoteCalcInput;
  expected: {
    lines: Record<string, number>[];
    totals: Record<string, number | boolean>;
    itc_claimable_all: boolean;
  };
};
const VECTORS = vectors as unknown as Vec[];

const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);

describe("quote_calc — the 18 frozen vectors (byte-exact oracle)", () => {
  it("fixtures hold at least 18 named vectors (calc-spec §9 CI gate)", () => {
    expect(VECTORS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(VECTORS.map((v) => v.name)).size).toBe(VECTORS.length);
  });

  for (const v of VECTORS) {
    it(`${v.name}: ${v.desc}`, () => {
      const r = computeQuote(v.input);
      // byte-exact lines
      expect(r.lines).toEqual(v.expected.lines);
      // byte-exact totals
      expect(r.totals).toEqual(v.expected.totals);
      expect(r.itc_claimable_all).toBe(v.expected.itc_claimable_all);

      // I0-a: every returned numeric field is an integer
      for (const line of r.lines) for (const k of Object.keys(line)) {
        expect(isInt((line as any)[k]), `${v.name} line.${k} integer`).toBe(true);
      }
      for (const k of ["subtotal_paise","cgst_total","sgst_total","igst_total","grand_total_paise","round_off_paise","weighted_margin_bp"]) {
        expect(isInt((r.totals as any)[k]), `${v.name} totals.${k} integer`).toBe(true);
      }

      // Loader invariant (calc-vectors.md): grand == subtotal + taxes + round_off, and grand % 100 == 0.
      const t = r.totals;
      expect(t.grand_total_paise).toBe(t.subtotal_paise + t.cgst_total + t.sgst_total + t.igst_total + t.round_off_paise);
      expect(t.grand_total_paise % 100).toBe(0);
      // cgst + sgst == igst-or-line-gst per line (intra: split sums to gst; inter: igst == gst)
      for (const line of r.lines) {
        expect(line.cgst_paise + line.sgst_paise + line.igst_paise).toBe(line.line_gst_paise);
        expect(line.cgst_paise).toBeGreaterThanOrEqual(0);
        expect(line.sgst_paise).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe("quote_calc — rounding primitive (BigInt, exact)", () => {
  it("roundHalfAwayFromZero: ties round away from zero", () => {
    expect(roundHalfAwayFromZero(5, 2)).toBe(3);   // 2.5 -> 3
    expect(roundHalfAwayFromZero(-5, 2)).toBe(-3);  // -2.5 -> -3
    expect(roundHalfAwayFromZero(4, 2)).toBe(2);
    expect(roundHalfAwayFromZero(1, 3)).toBe(0);    // 0.333 -> 0
    expect(roundHalfAwayFromZero(2, 3)).toBe(1);    // 0.666 -> 1
  });
  it("applyBp: 18% of 3006p = 541p (V8 line-gst)", () => {
    expect(applyBp(3006, 1800)).toBe(541);
    expect(applyBp(12000, 1800)).toBe(2160);
    expect(applyBp(10000, 4000)).toBe(4000);
  });
  it("roundToRupee: nearest 100 paise, 50-tie up", () => {
    expect(roundToRupee(3547)).toBe(3500);
    expect(roundToRupee(10050)).toBe(10100);
    expect(roundToRupee(10049)).toBe(10000);
  });
  it("exact for crore-scale operands (no float drift)", () => {
    // applyBp(1e9, 1800) must be exactly 1.8e8, not off-by-one
    expect(applyBp(1_000_000_000, 1800)).toBe(180_000_000);
  });
});

describe("quote_calc — validation surface (422)", () => {
  const base = (over: any): QuoteCalcInput => ({
    place_of_supply: "KL", seller_state_code: "KL",
    lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 0, sale_gst_bp: 1800, itc_claimable: true, ...over }],
  });
  const throws = (input: QuoteCalcInput, code: string) => {
    try { computeQuote(input); } catch (e) {
      expect(e).toBeInstanceOf(QuoteCalcError);
      expect((e as QuoteCalcError).code).toBe(code);
      return;
    }
    throw new Error(`expected ${code} to throw`);
  };

  it("missing seller state", () => throws({ ...base({}), seller_state_code: "" }, "E_SELLER_STATE_UNSET"));
  it("empty lines", () => throws({ place_of_supply: "KL", seller_state_code: "KL", lines: [] }, "E_VALIDATION"));
  it("qty <= 0", () => throws(base({ qty: 0 }), "E_VALIDATION"));
  it("non-integer qty", () => throws(base({ qty: 1.5 }), "E_VALIDATION"));
  it("purchase_margin_bp > 10000", () => throws(base({ pricing_mode: "mrp_discount", mrp_paise: 5000, purchase_margin_bp: 10001 }), "E_VALIDATION"));
  it("gst slab not allowed (3% = 300bp)", () => throws(base({ sale_gst_bp: 300 }), "E_UNSUPPORTED_GST_SLAB"));
  it("money over cap", () => throws(base({ purchase_cost_paise: MAX_PAISE + 1 }), "E_VALIDATION"));
  it("GST slab set is exactly {0,500,1200,1800,2800,4000}", () => {
    expect([...GST_SLAB_BP]).toEqual([0, 500, 1200, 1800, 2800, 4000]);
  });
});
describe("quote_calc — unified selling-margin model (operator worked examples)", () => {
  // Worked example 1 (MRP): MRP 1000 incl 18%, purchase margin 25%, selling margin
  // 10%, branding 10 → buying cost ex 635.59; selling ex 699.15; final 709.15.
  it("MRP: buying cost = ex-MRP less purchase margin; sale = cost × (1+selling margin) + branding/transport", () => {
    const r = computeQuote({
      place_of_supply: "KL", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "mrp_discount", mrp_paise: 100000, purchase_margin_bp: 2500, markup_bp: 1000, branding_cost_paise: 1000, sale_gst_bp: 1800, itc_claimable: true }],
    });
    expect(r.lines[0].buying_cost_paise).toBe(63559);     // 750 ÷ 1.18 = 635.59
    expect(r.lines[0].unit_price_paise).toBe(70915);      // 635.59 × 1.10 = 699.15, + 10 branding = 709.15
    expect(r.lines[0].line_taxable_paise).toBe(70915);
  });
  // Worked example 2 (net): net cost 1000 incl 18%, selling margin 10%, branding 10,
  // transport 10 → buying cost ex 847.46; selling ex 932.20; final 952.20.
  it("net_rate: gross cost stripped; sale = cost × (1+selling margin) + branding/transport (rounds once)", () => {
    const r = computeQuote({
      place_of_supply: "KL", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "net_rate", net_rate_paise: 100000, markup_bp: 1000, branding_cost_paise: 1000, freight_alloc_paise: 1000, sale_gst_bp: 1800, purchase_gst_bp: 1800, itc_claimable: true }],
    });
    expect(r.lines[0].buying_cost_paise).toBe(84746);     // 1000 ÷ 1.18 = 847.46
    expect(r.lines[0].unit_price_paise).toBe(95220);      // 847.46 × 1.10 = 932.20 (once), + 10 + 10 = 952.20
    expect(r.lines[0].line_taxable_paise).toBe(95220);
  });
  it("cost_markup: selling margin marks up the ex-GST buying cost; no branding/transport → unchanged", () => {
    const r = computeQuote({
      place_of_supply: "TN", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 0, sale_gst_bp: 1800, itc_claimable: true }],
    });
    expect(r.lines[0].unit_price_paise).toBe(10000);
    expect(r.totals.grand_total_paise).toBe(11800);       // 10000 + 18%
  });
  it("branding + transport pass through onto the sale at cost (margin stays the selling markup)", () => {
    const r = computeQuote({
      place_of_supply: "KL", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, freight_alloc_paise: 300, branding_cost_paise: 200, sale_gst_bp: 1800, itc_claimable: true }],
    });
    expect(r.lines[0].unit_price_paise).toBe(12500);      // 10000 × 1.20 = 12000, + 300 + 200 = 12500
    expect(r.lines[0].landed_cost_paise).toBe(10500);     // sellable cost = 10000 + 300 + 200
    expect(r.lines[0].line_margin_paise).toBe(2000);      // 12500 − 10500 = the 20% selling markup
  });
  it("net_rate: zero selling margin → sale = ex-GST cost; MRP zero margins → sale = ex-MRP", () => {
    const net = computeQuote({ place_of_supply: "KL", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "net_rate", net_rate_paise: 11800, markup_bp: 0, sale_gst_bp: 1800, purchase_gst_bp: 1800, itc_claimable: true }] });
    expect(net.lines[0].buying_cost_paise).toBe(10000);
    expect(net.lines[0].unit_price_paise).toBe(10000);
    const mrp = computeQuote({ place_of_supply: "KL", seller_state_code: "KL",
      lines: [{ sku: null, qty: 1, pricing_mode: "mrp_discount", mrp_paise: 11800, purchase_margin_bp: 0, markup_bp: 0, sale_gst_bp: 1800, itc_claimable: true }] });
    expect(mrp.lines[0].buying_cost_paise).toBe(10000);
    expect(mrp.lines[0].unit_price_paise).toBe(10000);
  });
});
// I0-b (no float math in the engine source) is a STATIC grep enforced in
// test/smoke.mjs (plain Node with fs access; the Workers vitest pool sandboxes
// file reads). I0-a (every returned value is an integer) is asserted above on
// all 18 vectors + the rounding tests.

describe("quote_calc — header discount (apportioned) + charges", () => {
  const base = (over = {}) => ({ place_of_supply: "KL", seller_state_code: "KL", ...over });
  it("apportions a 10% header discount pro-rata and charges GST on the net", () => {
    const r = computeQuote(base({
      header_discount_bp: 1000,
      lines: [
        { sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: true },
        { sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 20000, markup_bp: 0, sale_gst_bp: 1800, itc_claimable: true },
      ],
    }));
    expect(r.lines[0].line_discount_paise).toBe(1200);
    expect(r.lines[1].line_discount_paise).toBe(2000);
    expect(r.lines[0].line_taxable_paise).toBe(10800);
    expect(r.lines[1].line_taxable_paise).toBe(18000);
    expect(r.lines[0].line_gst_paise).toBe(1944);
    expect(r.lines[1].line_gst_paise).toBe(3240);
    expect(r.totals.gross_subtotal_paise).toBe(32000);
    expect(r.totals.discount_total_paise).toBe(3200);
    expect(r.totals.subtotal_paise).toBe(28800);
    expect(r.totals.cgst_total).toBe(2592);
    expect(r.totals.sgst_total).toBe(2592);
    expect(r.totals.grand_total_paise).toBe(34000);
    expect(r.totals.round_off_paise).toBe(16);
    // sum of apportioned discounts is exact
    expect((r.lines[0].line_discount_paise || 0) + (r.lines[1].line_discount_paise || 0)).toBe(3200);
  });
  it("adds a taxable charge as revenue at its own GST rate", () => {
    const r = computeQuote(base({
      charges: [{ label: "Installation", amount_paise: 5000, gst_bp: 1800 }],
      lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 0, sale_gst_bp: 1800, itc_claimable: true }],
    }));
    expect(r.charges).toBeDefined();
    expect(r.charges![0]).toMatchObject({ label: "Installation", amount_paise: 5000, gst_bp: 1800, gst_paise: 900, cgst_paise: 450, sgst_paise: 450, igst_paise: 0 });
    expect(r.totals.charges_total_paise).toBe(5000);
    expect(r.totals.subtotal_paise).toBe(15000);     // 10000 line + 5000 charge
    expect(r.totals.cgst_total).toBe(1350);
    expect(r.totals.grand_total_paise).toBe(17700);
    // charge is full margin (zero cost): line margin 0 + charge 5000
    expect(r.totals.weighted_margin_bp).toBe(3333);
  });
  it("no discount / no charges leaves the new fields absent (frozen-vector shape)", () => {
    const r = computeQuote(base({
      lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 1000, sale_gst_bp: 1800, itc_claimable: true }],
    }));
    expect(r.totals.discount_total_paise).toBeUndefined();
    expect(r.totals.charges_total_paise).toBeUndefined();
    expect(r.charges).toBeUndefined();
    expect(r.lines[0].line_discount_paise).toBeUndefined();
  });
});
