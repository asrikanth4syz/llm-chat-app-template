// Pure matching + reconciliation logic for importing a Zoho delivery challan (DC)
// into a SmartPantry order. No env / DB / network here, so it is unit-testable and
// is the single source of truth the import endpoints call at runtime.
//
// Decisions (see spec "Zoho → SmartPantry Delivery Challan Import"):
//  - Match a Zoho DC to an order by CLIENT NAME (normalized).
//  - Duplicate guard: the DC number must not already exist in SmartPantry, and the
//    zoho_dc_id must not already be linked.
//  - SKUs are identical across systems → exact SKU match; unmatched lines are flagged,
//    never auto-created.
//  - Over-delivery is allowed and flagged. Short is allowed.

// Normalize a name for comparison: trim, collapse internal whitespace, lower-case.
export function normName(s: unknown): string {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Normalize a DC number for duplicate comparison: trim, drop all whitespace, lower-case,
// and strip a leading run of zeros from a purely numeric value (display keeps the original).
export function normDc(s: unknown): string {
  const t = String(s ?? "").trim().replace(/\s+/g, "").toLowerCase();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t;
}

export function clientNameMatches(zohoCustomerName: unknown, smartpantryClientName: unknown): boolean {
  const a = normName(zohoCustomerName), b = normName(smartpantryClientName);
  return a !== "" && a === b;
}

export interface OrderLine { sku: string; name?: string; qty_ordered: number; delivered_so_far?: number; }
export interface ZohoLine { sku: string; name?: string; qty: number; }

export type ImportLineStatus = "matched" | "over" | "unmatched";

export interface ReconciledLine {
  sku: string;
  name: string;
  ordered: number;          // ordered qty on the order (0 if the SKU is not on the order)
  delivered_so_far: number; // already delivered against the order before this import
  due: number;              // remaining due before this import = max(0, ordered - delivered_so_far)
  import_qty: number;       // qty this Zoho DC delivers for the line
  over: number;             // surplus beyond the order after this import
  status: ImportLineStatus;
  matched: boolean;
}

export interface ReconResult {
  lines: ReconciledLine[];
  totals: {
    lines: number;          // total Zoho lines
    matched_lines: number;
    unmatched_lines: number;
    import_qty: number;      // sum of import_qty on matched lines
    over_qty: number;        // sum of over on matched lines
    unmatched_qty: number;   // sum of qty on unmatched lines
  };
  has_unmatched: boolean;
  has_over: boolean;
  verdict: "ok" | "warn" | "blocked"; // blocked when nothing matches; warn on over/unmatched; ok otherwise
}

// Reconcile a Zoho DC's lines against an order's lines. `orderLines` carries the
// ordered qty and anything already delivered; `zohoLines` is what the DC delivers.
export function reconcileDcImport(orderLines: OrderLine[], zohoLines: ZohoLine[]): ReconResult {
  const bySku = new Map<string, OrderLine>();
  for (const ol of orderLines || []) bySku.set(String(ol.sku), ol);

  const lines: ReconciledLine[] = (zohoLines || []).map(z => {
    const ol = bySku.get(String(z.sku));
    const importQty = Math.max(0, Number(z.qty) || 0);
    if (!ol) {
      return {
        sku: String(z.sku), name: String(z.name ?? z.sku), ordered: 0, delivered_so_far: 0,
        due: 0, import_qty: importQty, over: 0, status: "unmatched", matched: false,
      };
    }
    const ordered = Math.max(0, Number(ol.qty_ordered) || 0);
    const already = Math.max(0, Number(ol.delivered_so_far) || 0);
    const due = Math.max(0, ordered - already);
    const over = Math.max(0, already + importQty - ordered);
    return {
      sku: String(z.sku), name: String(z.name ?? ol.name ?? z.sku), ordered, delivered_so_far: already,
      due, import_qty: importQty, over, status: over > 0 ? "over" : "matched", matched: true,
    };
  });

  const matched = lines.filter(l => l.matched);
  const unmatched = lines.filter(l => !l.matched);
  const totals = {
    lines: lines.length,
    matched_lines: matched.length,
    unmatched_lines: unmatched.length,
    import_qty: matched.reduce((s, l) => s + l.import_qty, 0),
    over_qty: matched.reduce((s, l) => s + l.over, 0),
    unmatched_qty: unmatched.reduce((s, l) => s + l.import_qty, 0),
  };
  const has_unmatched = unmatched.length > 0;
  const has_over = totals.over_qty > 0;
  const verdict: ReconResult["verdict"] =
    matched.length === 0 ? "blocked" : (has_unmatched || has_over) ? "warn" : "ok";
  return { lines, totals, has_unmatched, has_over, verdict };
}
