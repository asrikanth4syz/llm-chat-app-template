# Calc Spec: 006-quotations pricing / GST / landed-cost / rounding

> Resolves spec-validation r1 findings: `calc-vectors-not-inlined`, `rounding-policy-underspecified`,
> `seller-state-origin-missing`, `itc-landed-cost-fold-formula`, `weighted-margin-undefined`,
> `gst-rate-authority`, `calc-input-validation-422`, `money-stored-as-real-float`, `itc-per-quote-mixed-basket`.
> This document is authoritative for `src/quote_calc.ts`. The engine is pure (no I/O). **All money is
> integer paise** inside the engine and in storage; rupee strings are presentation only.

## 0. Money representation (resolves `money-stored-as-real-float`)
- Every monetary value is an **integer number of paise** (`₹1 = 100`). No `REAL`/float arithmetic anywhere
  in the engine or in `quote_*` money columns (data-model stores INTEGER paise).
- Percentages (`markup_pct`, `discount_pct`, `gst_rate`) are decimals with up to 2dp, passed as
  **basis-points integers** internally (`18% → 1800`) to avoid float drift.
- Rounding helper: `roundHalfAwayFromZero(numeratorPaise, denominator)` → integer paise; ties (exact .5)
  round away from zero. This is the only rounding primitive; "half-up" everywhere means this.

## 1. Inputs
```
QuoteCalcInput {
  place_of_supply: string          // state code, e.g. "KL"
  seller_state_code: string        // from quote.settings.seller_state_code (GSTIN-derived); REQUIRED
  lines: Line[]                     // >=1
}
Line {
  sku: string|null
  qty: integer                     // > 0
  pricing_mode: "cost_markup" | "mrp_discount"
  purchase_cost_paise?: integer    // required if cost_markup; >= 0
  markup_pct?: number              // required if cost_markup; >= 0 (no upper bound)
  mrp_paise?: integer              // required if mrp_discount; >= 0
  discount_pct?: number            // required if mrp_discount; 0..100
  freight_alloc_paise: integer     // >= 0, default 0
  branding_cost_paise: integer     // >= 0, default 0
  sale_gst_rate: number            // one of {0,5,12,18,28}; see §6 authority rule
  purchase_gst_rate: number        // one of {0,5,12,18,28}; defaults to sale_gst_rate if omitted
  itc_claimable: boolean           // PER LINE (resolves itc-per-quote-mixed-basket)
}
```
`itc_claimable` is **per line**, not per quote. The quote-level flag used for the Finance-leg trigger is
derived: `quote.itc_claimable_all := lines.every(l => l.itc_claimable)` and the Finance leg fires when
`!itc_claimable_all` (i.e. any line is non-claimable) — see api-contracts §lifecycle.

## 2. Intra- vs inter-state (resolves `seller-state-origin-missing`)
```
intraState := (place_of_supply == seller_state_code)   // case-insensitive, trimmed
```
- `intraState == true`  → tax splits into **CGST + SGST** (half each).
- `intraState == false` → tax is a single **IGST** leg; CGST = SGST = 0.
- If `seller_state_code` is empty/unset → the engine throws `E_SELLER_STATE_UNSET` (surfaced as **422**).

## 3. Per-line landed cost (resolves `itc-landed-cost-fold-formula`)
```
base_cost_paise :=
   pricing_mode == "cost_markup" ? purchase_cost_paise
 : /* mrp_discount */             mrp_paise - round(mrp_paise * discount_pct/100)   // the net purchase basis
input_gst_paise := round(base_cost_paise * purchase_gst_rate / 100)
landed_cost_paise := base_cost_paise
                   + freight_alloc_paise
                   + branding_cost_paise
                   + (itc_claimable ? 0 : input_gst_paise)   // non-claimable GST folds into cost
```
- Freight and branding are treated as **cost inputs already inclusive of any their own GST** (no extra GST
  computed on them); this is stated so the engine is deterministic. If a future rule needs their GST, it is
  a new field, not an implicit behavior.
- When `itc_claimable == true`, input GST is recoverable and is **excluded** from landed cost.

## 4. Per-line sell price, taxable value, output GST
```
// cost_markup: sell is cost + markup; mrp_discount: sell is MRP less discount
unit_price_paise :=
   pricing_mode == "cost_markup" ? base_cost_paise + round(base_cost_paise * markup_pct/100)
 : /* mrp_discount */             mrp_paise - round(mrp_paise * discount_pct/100)
line_taxable_paise := unit_price_paise * qty                      // exact (integer * integer)
line_gst_paise     := round(line_taxable_paise * sale_gst_rate / 100)
cgst_paise := intraState ? ceilHalf(line_gst_paise) : 0           // odd paisa to CGST
sgst_paise := intraState ? (line_gst_paise - cgst_paise) : 0
igst_paise := intraState ? 0 : line_gst_paise
line_total_paise := line_taxable_paise + line_gst_paise
```
`ceilHalf(x) := (x + 1) >> 0` when x odd else x/2 — i.e. `Math.ceil(x/2)`, so CGST gets the odd paisa and
`cgst + sgst == line_gst` always (resolves the CGST+SGST≠IGST concern).

## 5. Quote totals, round-off, weighted margin (resolves `rounding-policy-underspecified`, `weighted-margin-undefined`)
```
subtotal_paise := Σ line_taxable_paise
cgst_total     := Σ cgst_paise
sgst_total     := Σ sgst_paise
igst_total     := Σ igst_paise
tax_total      := cgst_total + sgst_total + igst_total           // == Σ line_gst_paise
pre_round_grand_paise := subtotal_paise + tax_total
grand_total_paise := roundToRupee(pre_round_grand_paise)         // nearest rupee, ties up
round_off_paise   := grand_total_paise - pre_round_grand_paise   // signed; surfaced as a named line
```
`roundToRupee(p)` → nearest 100 paise; exact 50-paise ties round **up** (toward +∞).
```
line_margin_paise := line_taxable_paise - (landed_cost_paise * qty)
weighted_margin_pct := subtotal_paise == 0 ? 0
                     : round2( (Σ line_margin_paise) / subtotal_paise * 100 )   // revenue-weighted, 2dp
negative_margin := (Σ line_margin_paise) < 0        // boolean; also per-line line_margin_paise < 0
```
`round2(x)` is half-away-from-zero to 2 decimal places (percentage display only; not money).

## 6. GST-rate authority (resolves `gst-rate-authority`)
- For a line with a non-null `sku` that exists in the catalogue: `sale_gst_rate` and `purchase_gst_rate`
  are **server-resolved** from `inventory`/`client_catalog.gst_rate`; any client-supplied value is ignored
  (or validated-equal and 422 on mismatch). The handler fills these before calling the pure engine.
- For an ad-hoc line (`sku == null`): the client supplies `sale_gst_rate`, constrained to {0,5,12,18,28};
  `purchase_gst_rate` defaults to it.

## 7. Input validation (resolves `calc-input-validation-422`)
The handler validates **before** calling the engine; any violation → **422** with `{field, code}` (the pure
engine also asserts and throws, never returns NaN/Infinity):
- `lines` non-empty; a configurable max of **200 lines** per quote (resolves `unbounded-lines`).
- `qty` integer `> 0`.
- `cost_markup`: `purchase_cost_paise >= 0`, `markup_pct >= 0`.
- `mrp_discount`: `mrp_paise >= 0`, `0 <= discount_pct <= 100`.
- `freight_alloc_paise >= 0`, `branding_cost_paise >= 0`.
- `sale_gst_rate`/`purchase_gst_rate` ∈ {0,5,12,18,28}.
- `seller_state_code` set (else `E_SELLER_STATE_UNSET`).
- Max magnitude: any money value `<= 10^12` paise (₹10 crore) to stay within safe integer range.

## 8. Worked example vector (V1 — canonical, computed from the algorithm above)
Seller state `KL`, `place_of_supply = KL` (intra-state), two lines:

| Line | mode | inputs | landed (p) | unit_price (p) | taxable (p) | gst_rate | line_gst (p) | cgst (p) | sgst (p) |
|---|---|---|---|---|---|---|---|---|---|
| L1 | cost_markup | cost=10000, markup=20%, freight=500, brand=0, purch_gst=18, itc=Y | 10500 | 12000 | 12000 | 18 | 2160 | 1080 | 1080 |
| L2 | mrp_discount | mrp=5000, disc=10%, freight=0, brand=0, purch_gst=12, itc=N | 5040 | 4500 | 4500 | 12 | 540 | 270 | 270 |

`qty = 1` each. Totals: subtotal `16500`p, tax `2700`p, pre-round grand `19200`p →
`grand_total 19200`p (already whole rupees, `round_off 0`). L1 margin `12000-10500=1500`p; L2 margin
`4500-5040=-540`p; Σ margin `960`p; `weighted_margin_pct = round2(960/16500*100) = 5.82`;
`negative_margin = false` (quote) but L2 is flagged line-negative.
_(Inter-state variant V1b: same inputs with `place_of_supply=TN` → igst L1=2160, L2=540, cgst=sgst=0.)_

## 9. The 18 named vectors (acceptance gate)
`test/quote_calc.test.mjs` loads a fixtures file `test/fixtures/quote_calc_vectors.json` holding **18 named
vectors V1..V18**, each `{name, input: QuoteCalcInput, expected: {lines:[{landed_cost_paise, unit_price_paise,
line_taxable_paise, line_gst_paise, cgst_paise, sgst_paise, igst_paise}], totals:{subtotal_paise, cgst_total,
sgst_total, igst_total, grand_total_paise, round_off_paise, weighted_margin_pct, negative_margin}}}`.
Acceptance = **byte-exact** match per vector; CI fails if `< 18` vectors are present. The 18 must cover:
`V1` intra two-line mixed (§8); `V2` inter-state (IGST); `V3` cost_markup only; `V4` mrp_discount only;
`V5` itc=Yes vs `V6` itc=No same inputs (landed-cost delta); `V7` multi-rate basket (5/12/18/28 lines);
`V8` odd-paisa CGST/SGST split; `V9` round-off up (ties); `V10` round-off down; `V11` freight+branding;
`V12` 0% GST line; `V13` 100% discount → unit_price 0; `V14` large (₹-crore) magnitude; `V15` weighted
margin across differing-margin lines; `V16` negative-margin line + flag; `V17` boundary grand_total
= 500000 (Finance-leg); `V18` 499999 / 500001 boundary pair. The concrete expected numbers are derived by
applying §1–§5 (this doc is the oracle); values that also appear in PRD §pricing must match the PRD, and any
discrepancy is escalated to the user, not silently resolved.
