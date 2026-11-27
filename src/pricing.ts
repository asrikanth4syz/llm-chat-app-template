// Single source of truth for resolving an order line's unit price for a client.
// Pure logic (no env/DB) so it can be unit-tested and reused everywhere a line gets
// a price: new order, quick reorder, provider-placed order, and amendment.
//
// Resolution order, as of a reference date (the order date, or the amendment date):
//   1. the client's dated agreed price in effect on that date (price history), else
//   2. the client's legacy undated agreed price (client_catalog.client_price), else
//   3. the universal / standard price (inventory.unit_price).

export type PriceSource = "client" | "standard" | "override";

export interface PriceHistoryRow { price: number; effective_from: string; } // effective_from = YYYY-MM-DD

export interface ResolvedPrice {
  price: number;
  source: Exclude<PriceSource, "override">; // "client" | "standard"
  effective_from: string | null;            // the dated history row used, if any
  known: boolean;                           // false when neither a client nor a standard price exists (e.g. ad-hoc SKU)
}

// Pick the client price in effect on `refDate` from dated history; else the legacy
// undated catalog price; else the standard price. `standardPrice`/`catalogPrice` are
// null when absent (e.g. an ad-hoc SKU not in inventory, or no agreed price).
export function pickEffectivePrice(
  history: PriceHistoryRow[] | null | undefined,
  catalogPrice: number | null,
  standardPrice: number | null,
  refDate: string,
): ResolvedPrice {
  const applicable = (history || [])
    .filter(h => h && typeof h.price === "number" && h.effective_from && h.effective_from <= refDate)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : a.effective_from > b.effective_from ? -1 : 0));
  if (applicable.length) return { price: applicable[0].price, source: "client", effective_from: applicable[0].effective_from, known: true };
  if (catalogPrice != null) return { price: catalogPrice, source: "client", effective_from: null, known: true };
  if (standardPrice != null) return { price: standardPrice, source: "standard", effective_from: null, known: true };
  return { price: 0, source: "standard", effective_from: null, known: false };
}

// Human label for a price source, shown on the line so an agreed price is never
// confused with a fallback.
export function priceSourceLabel(src: PriceSource): string {
  if (src === "client") return "Client price";
  if (src === "override") return "Manual override";
  return "Standard price (no agreed price for this client)";
}
