// ============================================================================
// Smart Paste Order (milestone 004) — PURE logic module.
//
// No DB / no `env` imports: everything here is a deterministic pure function so
// the whole parser + scorer surface is unit-tested in isolation
// (test/smart_paste.test.ts). The Worker handlers in src/index.ts import these.
//
// Authority: spec.md "Revisions from spec-validation r2" (R2-*) + plan-validation.
// ============================================================================

// ── Normalisation (PV-7: duplicated here, NOT moved out of index.ts, so Group 1
// stays parallel-safe). Mirrors src/index.ts:normNameForMatch exactly, including
// the inline "MRP <n>" strip, so scores match the reused matcher. ────────────
export function normNameForMatch(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[-–—]?\s*mrp\s*[-:]?\s*\d+(\.\d+)?/gi, " ") // drop "MRP 95" / "-MRP95"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenSet(s: unknown): Set<string> {
  const n = normNameForMatch(s);
  return new Set(n ? n.split(" ").filter(Boolean) : []);
}

// ── Unit vocabulary (R2-B3/C4). Case-insensitive, plural-tolerant (optional
// trailing "s"). A number is unit-bound only when a WHOLE unit token abuts it. ─
export const SMART_PASTE_UNITS = [
  "g", "kg", "mg", "ml", "l", "ltr", "litre", "pc", "pcs", "pack", "pkt",
  "case", "carton", "ctn", "box", "bag", "bottle", "btl", "tin", "jar",
  "strip", "bundle", "dozen", "nos", "no",
];
const UNIT_ALT = SMART_PASTE_UNITS.slice().sort((a, b) => b.length - a.length).join("|");
// number (optionally with thousands separators / trailing .0) bound to a unit,
// with word boundaries so "5 notebooks" does NOT bind "no"/"g".
const UNIT_BOUND_RE = new RegExp(
  `(?<![a-z0-9])\\d[\\d.,]*\\s?(?:${UNIT_ALT})(?![a-z0-9])`,
  "gi",
);
// a pack expression: <number>[unit] x <number>  e.g. "300ml x 24", "24x40".
const PACK_RE = new RegExp(
  `\\d[\\d.,]*\\s?(?:${UNIT_ALT})?\\s?[x×]\\s?\\d[\\d.,]*`,
  "gi",
);

export interface ParsedLine {
  line_no: number;          // 1-based index into the ORIGINAL newline-split text
  raw: string;
  product_text: string;
  quantity: number | null;  // integer; null when needs_qty
  needs_qty: boolean;
  unit_hint: string | null;
  parse_flags: string[];    // low_confidence_parse | coerced_decimal | rejected_fraction
}

// Parse one numeric token (after a line has been split). Returns the integer
// value plus flags, or null when the token is not a number.
// Accepts thousands separators (1,000 / 1,00,000) and trailing-zero decimals
// (2 / 2.0 / 2.00). A non-zero fraction is rejected (R2-D2/C5).
function parseQtyToken(tok: string): { value: number | null; flags: string[] } {
  const t = tok.trim();
  // thousands-grouped integer: 1,000 · 12,345 · 1,00,000 (Indian)
  if (/^\d{1,3}(,\d{2,3})+$/.test(t)) {
    return { value: parseInt(t.replace(/,/g, ""), 10), flags: [] };
  }
  // decimal
  const dec = t.match(/^(\d+)\.(\d+)$/);
  if (dec) {
    if (/^0+$/.test(dec[2])) return { value: parseInt(dec[1], 10), flags: ["coerced_decimal"] };
    return { value: null, flags: ["rejected_fraction"] };
  }
  if (/^\d+$/.test(t)) return { value: parseInt(t, 10), flags: [] };
  return { value: null, flags: [] };
}

// Mask pack expressions so their digits are never read as the quantity.
function maskRanges(s: string, re: RegExp): { masked: string; hits: Array<[number, number]> } {
  const hits: Array<[number, number]> = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) hits.push([m.index, m.index + m[0].length]);
  let masked = s;
  for (const [a, b] of hits) masked = masked.slice(0, a) + "\u0000".repeat(b - a) + masked.slice(b);
  return { masked, hits };
}

/**
 * Parse a pasted block into structured lines. Blank lines are skipped but
 * `line_no` preserves the original 1-based position (R2-D7).
 */
export function parsePasteText(text: string): ParsedLine[] {
  const rawLines = String(text ?? "").split(/\r\n|\r|\n/);
  const out: ParsedLine[] = [];
  rawLines.forEach((rawLine, i) => {
    if (!rawLine || !rawLine.trim()) return; // blank → skipped, not logged
    out.push(parseOneLine(rawLine, i + 1));
  });
  return out;
}

function parseOneLine(raw: string, lineNo: number): ParsedLine {
  const flags: string[] = [];
  let s = raw.replace(/\s+/g, " ").trim();
  let quantity: number | null = null;

  // 1. Leading list bullet (-, *, •).
  s = s.replace(/^[-*•]\s+/, "");
  // 2. Leading ordinal "N. " (digits discarded, never a quantity) — but NOT a
  //    decimal like "1.5" (dot must be followed by whitespace) (R2-B4/C5).
  s = s.replace(/^\d+\.\s+/, "");
  // 3. Leading multiplier "2x" / "2 x" / "2×" → that number IS the quantity.
  const lead = s.match(/^(\d+)\s*[x×]\s*(?=\S)/i);
  if (lead) {
    const q = parseQtyToken(lead[1]);
    if (q.value != null) { quantity = q.value; s = s.slice(lead[0].length).trim(); }
  }

  let productText = s;
  const unitHint = extractUnitHint(s);

  if (quantity == null) {
    // Mask pack expressions ("300ml x 24") so their digits can't be the qty.
    const { masked } = maskRanges(s, PACK_RE);

    // 4. Whitespace-flanked separator (-, :, |, tab) splits name from qty.
    //    Use the LAST such separator; qty = the lone numeric token after it.
    const sepRe = /\s+[-:|\t]\s+/g;
    const sepHits: number[] = [];
    let sm: RegExpExecArray | null;
    sepRe.lastIndex = 0;
    while ((sm = sepRe.exec(masked))) sepHits.push(sm.index + sm[0].length);
    if (sepHits.length) {
      const lastStart = sepHits[sepHits.length - 1];
      const tail = s.slice(lastStart).trim();
      const q = parseQtyToken(tail);
      if (q.value != null) {
        quantity = q.value;
        pushFlags(flags, q.flags);
        // product text = everything up to (and excluding) that last separator
        const sepMatch = [...s.matchAll(/\s+[-:|\t]\s+/g)];
        const cut = sepMatch[sepMatch.length - 1];
        productText = s.slice(0, cut!.index).trim();
      } else if (q.flags.length) {
        pushFlags(flags, q.flags); // rejected_fraction after a separator
      }
    }

    // 5. Trailing "x N" where x is NOT part of a pack (no digit/unit before it)
    //    → "times N" quantity. e.g. "Water x 5".
    if (quantity == null) {
      const tx = masked.match(/(^|[^0-9\u0000])[x×]\s*(\d+)\s*$/i);
      if (tx) {
        const q = parseQtyToken(tx[2]);
        if (q.value != null) {
          quantity = q.value;
          const idx = s.toLowerCase().lastIndexOf("x");
          productText = (idx > 0 ? s.slice(0, idx) : s).trim();
        }
      }
    }

    // 6. Otherwise: the LAST bare numeric token that is not unit-bound and not
    //    inside a pack expression (R2-C6 fallback). Strip it from product text.
    if (quantity == null) {
      const { masked: m2 } = maskRanges(masked, UNIT_BOUND_RE);
      const numRe = /(?<![a-z])\d[\d.,]*(?![a-z])/gi;
      let nm: RegExpExecArray | null; let last: RegExpExecArray | null = null;
      numRe.lastIndex = 0;
      while ((nm = numRe.exec(m2))) { if (!nm[0].includes("\u0000")) last = nm; }
      if (last) {
        const q = parseQtyToken(last[0]);
        if (q.value != null) {
          quantity = q.value;
          pushFlags(flags, q.flags);
          productText = (s.slice(0, last.index) + s.slice(last.index + last[0].length)).replace(/\s+/g, " ").trim();
        } else if (q.flags.includes("rejected_fraction")) {
          pushFlags(flags, q.flags);
        }
      }
    }

    // 7. Two or more bare numbers with no separator → ambiguous, flag it.
    const bareNums = (maskRanges(s, PACK_RE).masked.match(/(?<![a-z])\d[\d.,]*(?![a-z])/gi) || [])
      .filter(t => parseQtyToken(t).value != null);
    if (!sepHits.length && bareNums.length >= 2 && quantity != null) {
      pushFlags(flags, ["low_confidence_parse"]);
    }
  }

  // Tidy stray field-separator punctuation a comma/colon left behind
  // (e.g. "Water, 20" → product "Water"). Intra-name hyphens are untouched.
  productText = productText.replace(/^[\s,:|]+|[\s,:|]+$/g, "").trim();

  const needsQty = quantity == null;
  return {
    line_no: lineNo,
    raw,
    product_text: productText,
    quantity,
    needs_qty: needsQty,
    unit_hint: unitHint,
    parse_flags: [...new Set(flags)],
  };
}

function extractUnitHint(s: string): string | null {
  const m = s.match(new RegExp(`(?<![a-z0-9])(${UNIT_ALT})(?![a-z0-9])\\s*$`, "i"));
  return m ? m[1].toLowerCase() : null;
}
function pushFlags(acc: string[], add: string[]): void { for (const f of add) if (f) acc.push(f); }

// ── Scoring (R2-D1) ──────────────────────────────────────────────────────────
// Token-overlap Jaccard over normNameForMatch tokens. Pure.
export function scoreCandidate(inputText: string, candidateName: string): number {
  const a = tokenSet(inputText);
  const b = tokenSet(candidateName);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export type MatchTier = "exact" | "history" | "fuzzy" | "contains";

// Confidence: exact tier is always 100; fuzzy applies the bounded formula with
// an order-frequency boost (R2-D1/C2).
export function confidenceOf(score: number, orderCount: number, tier: MatchTier): number {
  if (tier === "exact") return 100;
  const boost = Math.min(15, Math.round(5 * Math.log(1 + Math.max(0, orderCount))));
  return Math.min(99, Math.round(score * 100) + boost);
}

export interface Candidate { sku: string; name: string; price: number | null; order_count?: number; }
export interface RankedCandidate extends Candidate {
  score: number; confidence: number; tier: MatchTier; why: string[];
}

/**
 * Rank a client's candidate pool against one parsed product string.
 * - Exact normalised-name match wins outright (confidence 100).
 * - Otherwise Jaccard ≥ matchMin; when ≥2 candidates clear matchMin the top must
 *   beat the runner-up by ≥ matchMargin; a sole qualifier auto-passes (R2-C1).
 * Returns the top `limit` ranked candidates (may be empty → caller marks unmatched).
 */
export function rankCandidates(
  productText: string,
  pool: Candidate[],
  opts: { matchMin?: number; matchMargin?: number; limit?: number } = {},
): RankedCandidate[] {
  const matchMin = opts.matchMin ?? 0.5;
  const matchMargin = opts.matchMargin ?? 0.05;
  const limit = opts.limit ?? 3;
  const normInput = normNameForMatch(productText);
  if (!normInput) return [];

  const scored = pool.map(c => {
    const exact = normNameForMatch(c.name) === normInput;
    const score = exact ? 1 : scoreCandidate(productText, c.name);
    const oc = c.order_count ?? 0;
    const tier: MatchTier = exact ? "exact" : oc > 0 ? "history" : "fuzzy";
    const why: string[] = [];
    if (exact) why.push("exact name match");
    if (oc > 0) why.push(`ordered ${oc}×`);
    return { ...c, score, tier, confidence: confidenceOf(score, oc, tier), why } as RankedCandidate;
  });

  // Rank: score desc, then order_count desc, then name asc (deterministic).
  scored.sort((a, b) =>
    b.score - a.score ||
    (b.order_count ?? 0) - (a.order_count ?? 0) ||
    a.name.localeCompare(b.name));

  const exactTop = scored.filter(c => c.tier === "exact");
  if (exactTop.length) return exactTop.slice(0, limit);

  const qualifiers = scored.filter(c => c.score >= matchMin);
  if (qualifiers.length === 0) return [];
  if (qualifiers.length >= 2 && (qualifiers[0].score - qualifiers[1].score) < matchMargin) {
    // Ambiguous top — still return candidates for the operator to pick, but the
    // caller treats a sub-margin top as "needs a human choice" (status stays
    // matched with candidates; UI shows them). We return them ranked.
    return qualifiers.slice(0, limit);
  }
  return qualifiers.slice(0, limit);
}

// ── Manual catalogue search (R2-C1 "manual SKU search") ──────────────────────
// The operator's search box is NOT the auto-matcher: a short query like "coke"
// or "coffee" almost never clears the Jaccard threshold against a multi-word
// product name, so rankCandidates returns nothing. A search box must be
// forgiving — substring/prefix first, token overlap as a fallback — so typing
// part of a name finds it. Pure + unit-tested.
//
// Tiers (highest first): exact (SKU or whole name) → contains (name/SKU contains
// the query, or query word is a prefix of a name word) → fuzzy (token overlap).
// Brand synonyms (e.g. "coke" → "Coca-Cola") are a V2 alias-learning concern and
// are deliberately out of scope here.
export function searchCandidates(
  query: string,
  pool: Candidate[],
  opts: { limit?: number } = {},
): RankedCandidate[] {
  const limit = opts.limit ?? 25;
  const qRaw = String(query ?? "").trim();
  if (!qRaw) return [];
  const qNorm = normNameForMatch(qRaw);
  const qCompact = qRaw.toLowerCase().replace(/\s+/g, " ").trim();
  const qTokens = [...tokenSet(qRaw)];

  const TIER_RANK: Record<string, number> = { exact: 3, contains: 2, fuzzy: 1 };

  const scored = pool.map(c => {
    const nameNorm = normNameForMatch(c.name);
    const nameLower = String(c.name ?? "").toLowerCase();
    const skuLower = String(c.sku ?? "").toLowerCase();
    const nameTokens = [...tokenSet(c.name)];

    let tier: MatchTier | null = null;
    let base = 0;
    if (skuLower === qCompact || (qNorm && nameNorm === qNorm)) { tier = "exact"; base = 100; }
    else if ((qNorm && nameNorm.includes(qNorm)) || nameLower.includes(qCompact) || skuLower.includes(qCompact)) { tier = "contains"; base = 85; }
    else if (qTokens.length && qTokens.every(qt => nameTokens.some(nt => nt.startsWith(qt) || qt.startsWith(nt)))) { tier = "contains"; base = 78; }
    else {
      const s = scoreCandidate(qRaw, c.name);
      if (s > 0) { tier = "fuzzy"; base = Math.round(s * 70); }
    }
    if (!tier) return null;

    const oc = c.order_count ?? 0;
    const boost = Math.min(10, Math.round(3 * Math.log(1 + Math.max(0, oc))));
    const why: string[] = [];
    if (oc > 0) why.push(`ordered ${oc}×`);
    return {
      ...c, tier,
      score: base / 100,
      confidence: tier === "exact" ? 100 : Math.min(99, base + boost),
      why,
      _rank: TIER_RANK[tier],
    } as RankedCandidate & { _rank: number };
  }).filter(Boolean) as (RankedCandidate & { _rank: number })[];

  scored.sort((a, b) =>
    b._rank - a._rank ||
    b.confidence - a.confidence ||
    (b.order_count ?? 0) - (a.order_count ?? 0) ||
    a.name.localeCompare(b.name));

  return scored.slice(0, limit).map(({ _rank, ...c }) => c);
}
