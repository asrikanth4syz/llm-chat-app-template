# Calc Spec: 006-quotations pricing / GST / landed-cost / rounding

> **r3 pricing-model revision (operator-requested).** Three pricing methods now exist and the
> freight/branding treatment changed:
> - **Methods:** `cost_markup` (sale = buying cost × (1+markup), markup on the **buying cost only**),
>   `net_rate` (sale rate entered **GST-inclusive**, auto-stripped; plus an optional per-line `adjust_paise`
>   (≥0) added to the line sale total), `mrp_discount` (MRP entered **GST-inclusive**, auto-stripped, then
>   discount). There is no "is this inclusive?" toggle any more — net rate and MRP are always inclusive,
>   cost is always ex-GST.
> - **Branding + freight are COSTS, never added to the sale price in any method.** They fold into the
>   **sellable cost** (`landed = buying cost + freight + branding + non-ITC purchase GST`) and therefore
>   reduce margin (`margin = net taxable − sellable cost`). Previously they were passed through onto the
>   sale price (netting to ~zero margin); that is removed.
> - `purchase_cost_paise` is the **buying cost in every method** (the margin basis), never the sale price.
> - Affected frozen vectors re-derived: V1, V2, V4, V11, V16 (V13 unchanged); V19, V20 added for `net_rate`.

> Resolves spec-validation r1 findings: `calc-vectors-not-inlined`, `rounding-policy-underspecified`,
> `seller-state-origin-missing`, `itc-landed-cost-fold-formula`, `weighted-margin-undefined`,
> `gst-rate-authority`, `calc-input-validation-422`, `money-stored-as-real-float`, `itc-per-quote-mixed-basket`.
> This document is authoritative for `src/quote_calc.ts`. The engine is pure (no I/O). **All money is
> integer paise** inside the engine and in storage; rupee strings are presentation only.

## 0. Money representation — integer paise only (resolves `money-stored-as-real-float`, `rates-stored-as-real-drift`, `round-primitive-and-rate-representation`)

**Invariant (I0): no IEEE float (`REAL`, JS `number` used as a fraction) ever participates in a monetary
computation, is stored in a money/rate column, or appears in any value that is hashed.** Every number that
feeds the engine, the totals, `payload_json`, or a `content_hash` is an **integer** (paise or basis points).
This is the single most load-bearing rule in the engine; the test suite asserts it (see I0-test below).

- **Money = integer paise.** `₹1 = 100` paise. All amounts — inputs, intermediates, outputs, stored columns
  — are JS safe integers of paise. Rupee/decimal strings are produced only at the presentation edge
  (`fmtPaise(p) = `₹${(p/100)}`-style formatting in the SPA), never read back into a computation.
- **Rates = basis-point integers (`_bp`).** `markup_pct`, `discount_pct`, `sale_gst_rate`,
  `purchase_gst_rate` are carried and stored as **integer basis points**: `18% → 1800`, `2.5% → 250`,
  `0% → 0`. There is **no `REAL`/float percent** anywhere in the engine, the API payloads, `payload_json`,
  or the `quote_lines` columns (data-model names them `markup_bp`, `discount_bp`, `sale_gst_bp`,
  `purchase_gst_bp`, all `INTEGER`). The API accepts a human percent at the boundary and converts to bp
  with `pctToBp(p) = Math.round(p * 100)` once, rejecting any percent with >2dp (422) so the conversion is
  lossless; everything downstream is bp integers.
- **The one rounding primitive.** `roundHalfAwayFromZero(numerator: int, denominator: int) -> int` is the
  **only** rounding operation in the engine, and **its division is done in `BigInt`, never IEEE float**
  (resolves `round-primitive-float-division`): `q = ((|n|*2n + d) / (2n*d))` in BigInt (exact integer
  division; BigInt is integral so it is exempt from the no-float rule), then re-signed and converted back to
  a `Number` asserted `Number.isSafeInteger`. BigInt makes it exact for every operand within the cap, where a
  plain `Math.trunc(n/d)` on a double can be off by one near 2^53. Rate application uses it over integers,
  never `x * rate / 100`:
  - `applyBp(base_paise, rate_bp) := roundHalfAwayFromZero(base_paise * rate_bp, 10000)`.
  - `weighted_margin_bp` takes the same BigInt path (`roundHalfAwayFromZero(Σmargin*10000, subtotal)`), so it
    is exact to the full 10^12-paise cap — no separate lower cap, no 422 on the metric (resolves
    `weighted-margin-cap-vs-money-cap`).
  "half-up" / "round" everywhere means `roundHalfAwayFromZero`; a bare `/` never appears in a money path.
- **I0-test (acceptance):** `test/quote_calc.test.mjs` includes a guard that (a) every numeric field the
  engine returns is `Number.isInteger(x) === true`, and (b) a grep/AST check fails if `src/quote_calc.ts`
  contains **any `/` or `%` applied to a `Number`** (bare division banned outright — the only division is
  BigInt inside the primitive), or `parseFloat`, or a non-`_bp`/non-`_paise` numeric field.
  `tsc` types model money as a branded `Paise = number & {__paise}` and rates as `Bp = number & {__bp}` so a
  raw float cannot be assigned into a money/rate position.

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
  purchase_cost_paise?: Paise       // required if cost_markup; >= 0 (integer paise)
  markup_bp?: Bp                    // required if cost_markup; integer basis points; >= 0, <= markup cap (§7)
  mrp_paise?: Paise                 // required if mrp_discount; >= 0 (integer paise)
  discount_bp?: Bp                  // required if mrp_discount; integer basis points; 0..10000 (0..100%)
  freight_alloc_paise: Paise        // >= 0, default 0 (integer paise; PER UNIT)
  branding_cost_paise: Paise        // >= 0, default 0 (integer paise; PER UNIT)
  sale_gst_bp: Bp                   // basis points; one of {0,500,1200,1800,2800,4000}; see §6 authority rule
  purchase_gst_bp: Bp               // basis points; defaults to sale_gst_bp if omitted
  itc_claimable: boolean            // PER LINE (resolves itc-per-quote-mixed-basket)
}
// Paise and Bp are branded integer types; no float ever occupies these positions (see §0 I0).
// The API boundary converts human percent → Bp once via pctToBp (reject >2dp → 422); the engine only sees Bp.
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
// All arithmetic is integer; applyBp(base_paise, rate_bp) := roundHalfAwayFromZero(base_paise * rate_bp, 10000)
base_cost_paise :=
   pricing_mode == "cost_markup" ? purchase_cost_paise
 : /* mrp_discount */             purchase_cost_paise   // SEPARATE cost input (NOT the discounted MRP) — see §4/r2 fix
input_gst_paise := applyBp(base_cost_paise, purchase_gst_bp)              // integer paise
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
// cost_markup: sell is cost + markup; mrp_discount: sell is MRP less discount (cost basis is purchase_cost_paise, §3)
// Freight + branding are PASSED THROUGH to the client: added per-unit on top of the
// marked-up / discounted base, so they are part of the taxable value (GST applies) and,
// since they also sit in landed cost (§3), they net to zero in margin — a clean recovery.
// (If price_inclusive_gst, base_cost/MRP is first stripped to ex-GST before markup/discount.)
unit_price_paise :=
   ( pricing_mode == "cost_markup" ? base_cost_paise + applyBp(base_cost_paise, markup_bp)
   : /* mrp_discount */             mrp_paise - applyBp(mrp_paise, discount_bp) )
   + freight_alloc_paise + branding_cost_paise
line_taxable_paise := unit_price_paise * qty                      // exact (integer * integer)
line_gst_paise     := applyBp(line_taxable_paise, sale_gst_bp)    // integer paise
cgst_paise := intraState ? ceilHalf(line_gst_paise) : 0           // odd paisa to CGST
sgst_paise := intraState ? (line_gst_paise - cgst_paise) : 0
igst_paise := intraState ? 0 : line_gst_paise
line_total_paise := line_taxable_paise + line_gst_paise
```
`ceilHalf(x) := (x + (x & 1)) / 2` — pure integer arithmetic (odd x → (x+1)/2, even x → x/2; **no bitshift**,
so it is safe for ₹-crore `line_gst` beyond 2^31). CGST gets the odd paisa and `cgst + sgst == line_gst`
always (resolves the CGST+SGST≠IGST concern). Example: `line_gst=541 → cgst=271, sgst=270`.

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
// margin as INTEGER basis points (no float): revenue-weighted over pre-GST subtotal
weighted_margin_bp := subtotal_paise == 0 ? 0
                    : roundHalfAwayFromZero((Σ line_margin_paise) * 10000, subtotal_paise)   // e.g. 582 = 5.82%
negative_margin := (Σ line_margin_paise) < 0        // boolean; also per-line line_margin_paise < 0
```
`weighted_margin_bp` is an integer basis-point figure (582 → 5.82%); the SPA renders it as a percent string
at the edge. **No float percent is computed or stored** (upholds §0 I0). All operands above are integers.

## 6. GST-rate authority (resolves `gst-rate-authority`)
- For a line with a non-null `sku` that exists in the catalogue: `sale_gst_bp` and `purchase_gst_bp` are
  **server-resolved** from `inventory`/`client_catalog.gst_rate` (converted to bp via `pctToBp` once); a
  client-supplied rate on a catalogued SKU is **ignored** (server value authoritative). The handler fills
  these as bp integers before calling the pure engine.
- **Slab check applies to server-resolved rates too** (resolves `catalogue-rate-off-slab`): if a catalogued
  SKU's stored `gst_rate` converts to a bp value **not** in the allowed set (§7), the calc/create request
  returns **422 `E_UNSUPPORTED_GST_SLAB`** naming the SKU — surfaced, never silently bypassed — until that
  slab is added to the set. This keeps the whitelist honest for every line rather than exempting catalogue lines.
- **Null / unknown SKU** (resolves `catalogue-null-or-unknown-sku-gst`): a catalogued SKU whose stored
  `gst_rate` is **NULL/absent/non-numeric** → **422 `E_CATALOGUE_RATE_MISSING`** naming the SKU — never
  coerced to 0 (which would silently tax at 0%). A **non-null `sku` that is not found** in the catalogue →
  **422 `E_UNKNOWN_SKU`**; it never falls through to the ad-hoc client-supplied-rate path. Only `sku === null`
  uses the client-supplied `sale_gst_bp` (constrained to the slab set).
- For an ad-hoc line (`sku == null`): the client supplies `sale_gst_bp`, constrained to the allowed slab set
  `{0,500,1200,1800,2800,4000}` bp (§7);
  `purchase_gst_bp` defaults to it.

## 7. Input validation (resolves `calc-input-validation-422`)
The handler validates **before** calling the engine; any violation → **422** with `{field, code}` (the pure
engine also asserts and throws, never returns NaN/Infinity). Every monetary/rate input must already be an
integer (§0 I0) — a non-integer `*_paise`/`*_bp` is itself a 422.
- `lines` non-empty; a configurable max of **200 lines** per quote (resolves `unbounded-lines`).
- `qty` integer `> 0`, `qty <= 1_000_000` (bounds computed magnitude — see below).
- `cost_markup`: `purchase_cost_paise >= 0` (integer), `0 <= markup_bp <= 1_000_000` (0..10000%).
- `mrp_discount`: `mrp_paise >= 0` (integer), `purchase_cost_paise >= 0` (integer — the cost basis, §3),
  `0 <= discount_bp <= 10000` (0..100%).
- `freight_alloc_paise >= 0`, `branding_cost_paise >= 0` (integers; per unit).
- `sale_gst_bp`/`purchase_gst_bp` ∈ the allowed GST-slab set in bp: **{0, 500, 1200, 1800, 2800, 4000}**
  (= 0/5/12/18/28/40%). Other slabs (3%, 0.25%, cess, etc.) are deferred — add to this set when needed.
- `seller_state_code` set (else `E_SELLER_STATE_UNSET`).
- **Magnitude (input and computed):** the single money cap is **10^12 paise (= ₹1,000 crore)**. Every input
  money value is `≤ 10^12`, AND the engine asserts every **computed money** value — `unit_price_paise`,
  `line_taxable_paise`, all totals — is `≤ 10^12` and `Number.isSafeInteger(...)`; a breach is a **422**,
  never silent precision loss (closes `unbounded-markup-qty-overflow`). The **weighted-margin numerator does
  not need a separate cap**: it is computed in BigInt (§0) and only its final small `_bp` result returns to
  `Number`, so there is no sub-₹450cr effective limit — one consistent cap (resolves
  `weighted-margin-cap-vs-money-cap`). A boundary vector sits near 10^12 paise.

## 8. Worked example vector (V1 — canonical, all integer paise / bp)
Seller state `KL`, `place_of_supply = KL` (intra-state), `qty = 1` each. All rates are bp integers.

| Line | mode | inputs (paise / bp) | landed_p | unit_price_p | taxable_p | sale_gst_bp | line_gst_p | cgst_p | sgst_p | margin_p |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | cost_markup | purchase_cost=10000, markup_bp=2000, freight=500, brand=0, purch_gst_bp=1800, itc=Y | 10500 | 12000 | 12000 | 1800 | 2160 | 1080 | 1080 | 1500 |
| L2 | mrp_discount | purchase_cost=3500, mrp=5000, discount_bp=1000, freight=0, brand=0, purch_gst_bp=1200, itc=N | 3920 | 4500 | 4500 | 1200 | 540 | 270 | 270 | 580 |

Derivation (integer only): L1 `applyBp(10000,2000)=2000` → unit 12000; `applyBp(12000,1800)=2160`; itc=Y so
input GST not folded → landed `10000+500=10500`; margin `12000−10500=1500`. L2 base_cost = purchase_cost 3500;
`input_gst=applyBp(3500,1200)=420`, itc=N so folded → landed `3500+420=3920`; unit `5000−applyBp(5000,1000)=5000−500=4500`;
`applyBp(4500,1200)=540`; margin `4500−3920=580`.
Totals: `subtotal 16500`, `tax 2700`, `pre_round_grand 19200` → `grand_total_paise 19200` (whole rupees,
`round_off_paise 0`). Σmargin `2080`; `weighted_margin_bp = roundHalfAwayFromZero(2080*10000, 16500) = 1261`
(12.61%); `negative_margin false`.
_(Inter-state variant V1b: `place_of_supply=TN` → `igst_p` L1=2160, L2=540, cgst=sgst=0.)_

## 9. The 18 named vectors (acceptance gate)
`test/quote_calc.test.mjs` loads `test/fixtures/quote_calc_vectors.json` holding **18 named vectors V1..V18**,
each `{name, input: QuoteCalcInput, expected: {lines:[{landed_cost_paise, unit_price_paise, line_taxable_paise,
line_gst_paise, cgst_paise, sgst_paise, igst_paise, line_margin_paise}], totals:{subtotal_paise, cgst_total,
sgst_total, igst_total, grand_total_paise, round_off_paise, weighted_margin_bp, negative_margin}}}`. **Every
numeric value is an integer** (paise or bp) — the I0-test (§0) rejects any non-integer in a vector.
Acceptance = **byte-exact** per vector; CI fails if `< 18` vectors present. The expected objects are
**hand-computed and frozen in `calc-vectors.md` (V1..V18) — NOT generated by running the engine**; the
fixtures file must reproduce that doc exactly. (Resolves `calc-vectors-not-inlined`.) Coverage:
`V1` intra two-line mixed (§8); `V2` inter-state (IGST); `V3` cost_markup only; `V4` profitable mrp_discount
(purchase_cost < discounted MRP); `V5` itc=Yes vs `V6` itc=No same inputs (landed-cost delta); `V7` multi-rate
basket (500/1200/1800/2800/4000 bp lines); `V8` odd-paisa split (`line_gst=541 → cgst 271 / sgst 270`); `V9`
round-off up (50-paisa tie → up); `V10` round-off down; `V11` freight+branding with `qty>1` (pins per-unit
freight); `V12` 0-bp GST line; `V13` `discount_bp=10000` → unit_price 0; `V14` ₹-crore magnitude (asserts
safe-integer); `V15` weighted margin across differing-margin lines; `V16` negative-margin line + flag;
`V17` `grand_total_paise = 50000000` (Finance-leg boundary, asserted in the submit/lifecycle test, not here);
`V18` `49999900 / 50000100` boundary pair. Values that also appear in PRD §pricing must match the PRD; any
discrepancy is escalated to the user, not silently resolved.
