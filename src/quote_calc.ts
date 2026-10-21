// ============================================================================
// Quotations (milestone 006) — PURE pricing / GST / landed-cost / rounding engine.
//
// No DB / no `env`: every function here is deterministic and unit-tested in
// isolation (test/quote_calc.test.ts) against the frozen oracle V1..V18 in
// plans/active_milestones/006-quotations/calc-vectors.md.
//
// Authority: plans/active_milestones/006-quotations/calc-spec.md.
//
// INVARIANT I0 (calc-spec §0): money is INTEGER paise, rates are INTEGER basis
// points (bp); nothing float is computed or returned. The ONLY division in this
// file is BigInt division inside `roundHalfAwayFromZero` / `weightedMarginBp`
// (BigInt is integral, so it is exempt from the no-float rule). The I0-test
// greps this source to enforce that no bare `/`/`%`/parseFloat touches a Number.
// ============================================================================

/** Allowed GST slabs in basis points: 0/5/12/18/28/40 %. Other slabs deferred. */
export const GST_SLAB_BP: readonly number[] = [0, 500, 1200, 1800, 2800, 4000];
/** Money magnitude cap: 10^12 paise = ₹1,000 crore (calc-spec §7). */
export const MAX_PAISE = 1_000_000_000_000;
const MAX_QTY = 1_000_000;
const MAX_MARKUP_BP = 1_000_000; // 0..10000 %

export type PricingMode = "cost_markup" | "net_rate" | "mrp_discount";

export interface QuoteCalcLine {
  sku: string | null;
  qty: number;
  pricing_mode: PricingMode;
  // purchase_cost_paise is the ex-GST BUYING COST in every mode — the basis for
  // sellable cost + margin (never the sale price).
  purchase_cost_paise?: number;
  markup_bp?: number;           // cost_markup: markup applied to the buying cost
  net_rate_paise?: number;      // net_rate: the sale rate per unit, GST-INCLUSIVE
  adjust_paise?: number;        // net_rate: per-line amount (>=0) added to the sale total
  mrp_paise?: number;           // mrp_discount: the MRP, GST-INCLUSIVE
  discount_bp?: number;         // mrp_discount: sale discount off the MRP
  purchase_margin_bp?: number;  // mrp_discount: trade margin off ex-MRP → DERIVES the buying cost
  freight_alloc_paise?: number; // per unit, a COST (not added to the sale price), default 0
  branding_cost_paise?: number; // per unit, a COST (not added to the sale price), default 0
  sale_gst_bp: number;
  purchase_gst_bp?: number;     // defaults to sale_gst_bp
  itc_claimable: boolean;       // PER LINE
}

/** A header-level charge (installation, delivery, handling…): taxable revenue at
 *  its own GST rate, added on top of the line items. */
export interface QuoteCalcCharge {
  label?: string;
  amount_paise: number;
  gst_bp: number;
}

export interface QuoteCalcInput {
  place_of_supply: string;
  seller_state_code: string;
  lines: QuoteCalcLine[];
  // Optional header-level concession + charges (both default to none).
  header_discount_paise?: number;  // flat ₹ discount in paise
  header_discount_bp?: number;     // percent-of-line-subtotal discount, bp
  charges?: QuoteCalcCharge[];
}

export interface QuoteCalcLineOut {
  landed_cost_paise: number;
  buying_cost_paise: number;       // ex-GST buying cost per unit (the margin basis; derived for MRP / net_rate)
  unit_price_paise: number;
  line_taxable_paise: number;      // NET of any apportioned header discount
  line_gst_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  line_margin_paise: number;
  line_discount_paise?: number;    // apportioned header discount (present only when > 0)
}

export interface QuoteCalcChargeOut {
  label: string;
  amount_paise: number;
  gst_bp: number;
  gst_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
}

export interface QuoteCalcTotals {
  subtotal_paise: number;          // taxable base = net line items + charges
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total_paise: number;
  round_off_paise: number;
  weighted_margin_bp: number;
  negative_margin: boolean;
  gross_subtotal_paise?: number;   // line items before header discount (present only when discounted)
  discount_total_paise?: number;   // total header discount (present only when > 0)
  charges_total_paise?: number;    // sum of charge amounts (present only when charges exist)
}

export interface QuoteCalcResult {
  lines: QuoteCalcLineOut[];
  totals: QuoteCalcTotals;
  itc_claimable_all: boolean;
  charges?: QuoteCalcChargeOut[];  // present only when charges exist
}

/** Validation / calc error → HTTP 422 at the handler boundary. */
export class QuoteCalcError extends Error {
  code: string;
  field?: string;
  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "QuoteCalcError";
    this.code = code;
    this.field = field;
  }
}

// ── The one rounding primitive (calc-spec §0). Exact half-away-from-zero over
// integers, division done in BigInt so it is exact for every operand within the
// magnitude cap (plain Math.trunc(n/d) could be off-by-one near 2^53). ────────
export function roundHalfAwayFromZero(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new QuoteCalcError("E_CALC", "roundHalfAwayFromZero requires integer args");
  }
  if (denominator <= 0) {
    throw new QuoteCalcError("E_CALC", "roundHalfAwayFromZero denominator must be > 0");
  }
  const n = BigInt(Math.abs(numerator));
  const d = BigInt(denominator);
  const q = (n * 2n + d) / (2n * d); // BigInt floor; |n|>=0 so floor == trunc == half-away-from-zero
  const signed = numerator < 0 ? -q : q;
  const out = Number(signed);
  if (!Number.isSafeInteger(out)) {
    throw new QuoteCalcError("E_OVERFLOW", "rounding result exceeds safe integer range");
  }
  return out;
}

/** Apply a basis-point rate to a paise base → integer paise (half-away-from-zero). */
export function applyBp(basePaise: number, rateBp: number): number {
  const product = basePaise * rateBp;
  if (!Number.isSafeInteger(product)) {
    throw new QuoteCalcError("E_OVERFLOW", "applyBp product exceeds safe integer range");
  }
  return roundHalfAwayFromZero(product, 10000);
}

/** Nearest rupee (100 paise), 50-paisa ties round up (toward +∞ for p>=0). */
export function roundToRupee(paise: number): number {
  return roundHalfAwayFromZero(paise, 100) * 100;
}

/** Strip GST out of a tax-inclusive ("net") price → the ex-GST (taxable) base.
 *  ex = incl * 10000 / (10000 + gst_bp), half-away-from-zero. Done entirely in
 *  BigInt so the intermediate never loses precision near the magnitude cap. */
export function exclGstPaise(inclPaise: number, gstBp: number): number {
  if (!Number.isInteger(inclPaise) || !Number.isInteger(gstBp) || inclPaise < 0 || gstBp < 0) {
    throw new QuoteCalcError("E_CALC", "exclGstPaise requires non-negative integers");
  }
  const n = BigInt(inclPaise) * 10000n;
  const d = BigInt(10000 + gstBp);
  const q = (n * 2n + d) / (2n * d);
  const out = Number(q);
  if (!Number.isSafeInteger(out)) {
    throw new QuoteCalcError("E_OVERFLOW", "ex-GST base exceeds safe integer range");
  }
  return out;
}

/** Half-away-from-zero of a BigInt ratio num/den (den > 0) → safe integer paise.
 *  Lets a multi-step price chain (×margin, ÷(1+gst)) round ONCE at the end, matching
 *  a spreadsheet that keeps full precision until the final figure. */
export function roundDivBig(num: bigint, den: bigint): number {
  if (den <= 0n) throw new QuoteCalcError("E_CALC", "roundDivBig denominator must be > 0");
  const neg = num < 0n;
  const n = neg ? -num : num;
  const q = (n * 2n + den) / (2n * den);
  const out = Number(neg ? -q : q);
  if (!Number.isSafeInteger(out)) throw new QuoteCalcError("E_OVERFLOW", "price chain exceeds safe integer range");
  return out;
}

/** CGST = ceil(line_gst / 2); the odd paisa goes to CGST. Pure integer via the primitive. */
function cgstHalf(lineGst: number): number {
  return roundHalfAwayFromZero(lineGst, 2); // round(x/2) half-up == ceil(x/2) for integer x
}

/** Revenue-weighted margin in bp, computed entirely in BigInt (exact to the cap). */
function weightedMarginBp(sumMarginPaise: number, subtotalPaise: number): number {
  if (subtotalPaise === 0) return 0;
  const neg = sumMarginPaise < 0;
  const n = BigInt(Math.abs(sumMarginPaise)) * 10000n;
  const d = BigInt(subtotalPaise);
  const q = (n * 2n + d) / (2n * d);
  const out = Number(neg ? -q : q);
  if (!Number.isSafeInteger(out)) {
    throw new QuoteCalcError("E_OVERFLOW", "weighted margin exceeds safe integer range");
  }
  return out;
}

function assertInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new QuoteCalcError("E_VALIDATION", `${field} must be an integer`, field);
  }
  return v;
}
function assertPaiseInRange(v: number, field: string): number {
  if (v < 0 || v > MAX_PAISE) {
    throw new QuoteCalcError("E_VALIDATION", `${field} out of range [0, ${MAX_PAISE}]`, field);
  }
  return v;
}
function assertSlab(bp: number, field: string): number {
  assertInt(bp, field);
  if (!GST_SLAB_BP.includes(bp)) {
    throw new QuoteCalcError("E_UNSUPPORTED_GST_SLAB", `${field}=${bp} is not an allowed GST slab`, field);
  }
  return bp;
}

// ── The engine (calc-spec §1–§5). Validates (§7), computes, asserts magnitude. ─
export function computeQuote(input: QuoteCalcInput): QuoteCalcResult {
  if (!input || typeof input !== "object") {
    throw new QuoteCalcError("E_VALIDATION", "input required");
  }
  const seller = String(input.seller_state_code ?? "").trim();
  if (!seller) {
    throw new QuoteCalcError("E_SELLER_STATE_UNSET", "seller_state_code is required");
  }
  const pos = String(input.place_of_supply ?? "").trim();
  if (!pos) {
    throw new QuoteCalcError("E_VALIDATION", "place_of_supply is required", "place_of_supply");
  }
  const intraState = pos.toLowerCase() === seller.toLowerCase();

  const lines = input.lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new QuoteCalcError("E_VALIDATION", "lines must be a non-empty array", "lines");
  }
  if (lines.length > 200) {
    throw new QuoteCalcError("E_VALIDATION", "a quote may have at most 200 lines", "lines");
  }

  // Header-level inputs (optional): a pro-rata discount and taxable charges.
  const headerDiscountFlat = assertPaiseInRange(assertInt(input.header_discount_paise ?? 0, "header_discount_paise"), "header_discount_paise");
  const headerDiscountBp = assertInt(input.header_discount_bp ?? 0, "header_discount_bp");
  if (headerDiscountBp < 0 || headerDiscountBp > 10000) {
    throw new QuoteCalcError("E_VALIDATION", "header_discount_bp must be in 0..10000", "header_discount_bp");
  }
  const charges = Array.isArray(input.charges) ? input.charges : [];
  if (charges.length > 20) {
    throw new QuoteCalcError("E_VALIDATION", "a quote may have at most 20 charges", "charges");
  }

  // Pass 1 collects each line's GROSS taxable + landed cost; the GST split and
  // margin are computed in pass 2 (after the header discount is apportioned).
  const out: QuoteCalcLineOut[] = [];
  const aux: { grossTaxable: number; saleBp: number; landedTotal: number }[] = [];
  let grossSubtotal = 0;
  let itcAll = true;

  lines.forEach((ln, i) => {
    const f = (name: string) => `lines[${i}].${name}`;
    const qty = assertInt(ln.qty, f("qty"));
    if (qty <= 0 || qty > MAX_QTY) {
      throw new QuoteCalcError("E_VALIDATION", `${f("qty")} must be in 1..${MAX_QTY}`, f("qty"));
    }
    if (ln.pricing_mode !== "cost_markup" && ln.pricing_mode !== "net_rate" && ln.pricing_mode !== "mrp_discount") {
      throw new QuoteCalcError("E_VALIDATION", `${f("pricing_mode")} invalid`, f("pricing_mode"));
    }
    const saleBp = assertSlab(ln.sale_gst_bp, f("sale_gst_bp"));
    const purchaseBp = ln.purchase_gst_bp === undefined
      ? saleBp
      : assertSlab(ln.purchase_gst_bp, f("purchase_gst_bp"));
    const freight = assertPaiseInRange(assertInt(ln.freight_alloc_paise ?? 0, f("freight_alloc_paise")), f("freight_alloc_paise"));
    const branding = assertPaiseInRange(assertInt(ln.branding_cost_paise ?? 0, f("branding_cost_paise")), f("branding_cost_paise"));

    // Pricing model (worked examples, agreed with the operator). Per unit:
    //   buying cost EX-GST (baseCost) derived per method →
    //   selling price EX-GST = baseCost × (1 + selling margin %)  [markup_bp] →
    //   final sale EX-GST (unitPrice) = selling price + branding + transport.
    // The ×margin / ÷(1+gst) chain is rounded ONCE (roundDivBig) to match the sheet.
    // baseCost per method:
    //   cost_markup: purchase_cost_paise, entered ex-GST.
    //   net_rate:    net_rate_paise, the GROSS (incl-GST) purchase cost; strip purchase GST.
    //   mrp_discount: ex-MRP × (1 − purchase margin), i.e. (MRP × (1 − pm)) ÷ (1 + sale GST).
    const sellBp = assertInt(ln.markup_bp ?? 0, f("markup_bp"));   // the SELLING margin (markup on ex-cost), all methods
    if (sellBp < 0 || sellBp > MAX_MARKUP_BP) {
      throw new QuoteCalcError("E_VALIDATION", `${f("markup_bp")} must be in 0..${MAX_MARKUP_BP}`, f("markup_bp"));
    }
    let baseCost: number;
    let sellingExcl: number;   // selling price ex-GST, before branding/transport
    if (ln.pricing_mode === "cost_markup") {
      baseCost = assertPaiseInRange(assertInt(ln.purchase_cost_paise ?? 0, f("purchase_cost_paise")), f("purchase_cost_paise"));
      sellingExcl = roundDivBig(BigInt(baseCost) * BigInt(10000 + sellBp), 10000n);
    } else if (ln.pricing_mode === "net_rate") {
      const grossCost = assertPaiseInRange(assertInt(ln.net_rate_paise ?? 0, f("net_rate_paise")), f("net_rate_paise"));
      baseCost = exclGstPaise(grossCost, purchaseBp);                // gross cost → ex-GST
      sellingExcl = roundDivBig(BigInt(grossCost) * BigInt(10000 + sellBp), BigInt(10000 + purchaseBp));
    } else {
      const mrpIncl = assertPaiseInRange(assertInt(ln.mrp_paise ?? 0, f("mrp_paise")), f("mrp_paise"));
      const pmBp = assertInt(ln.purchase_margin_bp ?? 0, f("purchase_margin_bp"));
      if (pmBp < 0 || pmBp > 10000) {
        throw new QuoteCalcError("E_VALIDATION", `${f("purchase_margin_bp")} must be in 0..10000`, f("purchase_margin_bp"));
      }
      // buying cost ex = MRP × (1 − pm) ÷ (1 + saleGst); selling = that × (1 + sellBp), rounded once.
      baseCost = roundDivBig(BigInt(mrpIncl) * BigInt(10000 - pmBp), BigInt(10000 + saleBp));
      sellingExcl = roundDivBig(BigInt(mrpIncl) * BigInt(10000 - pmBp) * BigInt(10000 + sellBp), BigInt(10000 + saleBp) * 10000n);
    }
    // Branding + transport pass through onto the sale at cost (added to the price AND
    // to the sellable cost, so they net to zero in margin — margin is the selling markup).
    const unitPrice = sellingExcl + branding + freight;   // final sale price EX-GST per unit
    if (unitPrice < 0) {
      throw new QuoteCalcError("E_VALIDATION", `${f("unit_price")} computed negative`, f("unit_price"));
    }

    // Sellable cost = buying cost + branding + transport (+ non-ITC purchase GST).
    const inputGst = applyBp(baseCost, purchaseBp);
    const landed = baseCost + freight + branding + (ln.itc_claimable ? 0 : inputGst);

    const taxable = unitPrice * qty;                 // gross sale (pre header-discount)
    if (!Number.isSafeInteger(taxable) || taxable > MAX_PAISE) {
      throw new QuoteCalcError("E_OVERFLOW", `${f("line_taxable")} exceeds cap`, f("line_taxable"));
    }
    const landedTotal = landed * qty;
    if (!Number.isSafeInteger(landedTotal)) {
      throw new QuoteCalcError("E_OVERFLOW", `${f("landed_total")} exceeds safe integer`, f("landed_total"));
    }
    if (!ln.itc_claimable) itcAll = false;
    grossSubtotal += taxable;
    aux.push({ grossTaxable: taxable, saleBp, landedTotal });
    out.push({
      landed_cost_paise: landed,
      buying_cost_paise: baseCost,
      unit_price_paise: unitPrice,
      line_taxable_paise: taxable,  // net is set in pass 2
      line_gst_paise: 0, cgst_paise: 0, sgst_paise: 0, igst_paise: 0, line_margin_paise: 0,
    });
  });

  if (!Number.isSafeInteger(grossSubtotal) || grossSubtotal > MAX_PAISE) {
    throw new QuoteCalcError("E_OVERFLOW", "subtotal exceeds cap", "subtotal");
  }

  // Header discount — flat + percent-of-line-subtotal, never below a zero taxable.
  const discountPct = grossSubtotal > 0 ? applyBp(grossSubtotal, headerDiscountBp) : 0;
  let discountTotal = headerDiscountFlat + discountPct;
  if (discountTotal > grossSubtotal) discountTotal = grossSubtotal;
  const hasDiscount = discountTotal > 0;

  // Pass 2 — apportion the discount pro-rata to each line's gross taxable (GST is
  // then charged on the NET), so the per-line tax is correct for a mixed-rate quote.
  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, sumMargin = 0;
  let allocated = 0;
  const lastIdx = aux.length - 1;
  aux.forEach((a, i) => {
    let disc = 0;
    if (hasDiscount && grossSubtotal > 0) {
      if (i === lastIdx) disc = discountTotal - allocated;          // remainder → exact sum
      else {
        const den = BigInt(grossSubtotal);
        disc = Number((BigInt(discountTotal) * BigInt(a.grossTaxable) * 2n + den) / (2n * den));
        allocated += disc;
      }
    }
    const netTaxable = a.grossTaxable - disc;
    const lineGst = applyBp(netTaxable, a.saleBp);
    const cgst = intraState ? cgstHalf(lineGst) : 0;
    const sgst = intraState ? lineGst - cgst : 0;
    const igst = intraState ? 0 : lineGst;
    const margin = netTaxable - a.landedTotal;
    subtotal += netTaxable; cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst; sumMargin += margin;
    const o = out[i];
    o.line_taxable_paise = netTaxable;
    o.line_gst_paise = lineGst;
    o.cgst_paise = cgst; o.sgst_paise = sgst; o.igst_paise = igst;
    o.line_margin_paise = margin;
    if (disc > 0) o.line_discount_paise = disc;
  });

  // Charges — each is taxable revenue at its own GST rate (zero cost → full margin).
  const chargesOut: QuoteCalcChargeOut[] = [];
  charges.forEach((c, i) => {
    const amount = assertPaiseInRange(assertInt(c.amount_paise ?? 0, `charges[${i}].amount_paise`), `charges[${i}].amount_paise`);
    const gbp = assertSlab(assertInt(c.gst_bp, `charges[${i}].gst_bp`), `charges[${i}].gst_bp`);
    const g = applyBp(amount, gbp);
    const cgst = intraState ? cgstHalf(g) : 0;
    const sgst = intraState ? g - cgst : 0;
    const igst = intraState ? 0 : g;
    subtotal += amount; cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst; sumMargin += amount;
    chargesOut.push({ label: (typeof c.label === "string" ? c.label : "").slice(0, 120), amount_paise: amount, gst_bp: gbp, gst_paise: g, cgst_paise: cgst, sgst_paise: sgst, igst_paise: igst });
  });

  if (!Number.isSafeInteger(subtotal) || subtotal > MAX_PAISE) {
    throw new QuoteCalcError("E_OVERFLOW", "subtotal exceeds cap", "subtotal");
  }
  const taxTotal = cgstTotal + sgstTotal + igstTotal;
  const preRound = subtotal + taxTotal;
  if (!Number.isSafeInteger(preRound) || preRound > MAX_PAISE) {
    throw new QuoteCalcError("E_OVERFLOW", "grand total exceeds cap", "grand_total");
  }
  const grand = roundToRupee(preRound);
  const roundOff = grand - preRound;

  const totals: QuoteCalcTotals = {
    subtotal_paise: subtotal,
    cgst_total: cgstTotal,
    sgst_total: sgstTotal,
    igst_total: igstTotal,
    grand_total_paise: grand,
    round_off_paise: roundOff,
    weighted_margin_bp: weightedMarginBp(sumMargin, subtotal),
    negative_margin: sumMargin < 0,
  };
  if (hasDiscount) { totals.gross_subtotal_paise = grossSubtotal; totals.discount_total_paise = discountTotal; }
  if (chargesOut.length) totals.charges_total_paise = chargesOut.reduce((s, c) => s + c.amount_paise, 0);

  const result: QuoteCalcResult = { lines: out, itc_claimable_all: itcAll, totals };
  if (chargesOut.length) result.charges = chargesOut;
  return result;
}
