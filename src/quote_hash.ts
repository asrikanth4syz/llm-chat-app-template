// ============================================================================
// Quotations (milestone 006) — canonicalization + SHA-256 hash chain helpers.
//
// The trust spine for immutable quote versions and the hash-chained audit trail.
// Pure except sha256Hex (WebCrypto). Unit-tested in test/quote_hash.test.ts with
// a known-answer digest.
//
// Authority: plans/active_milestones/006-quotations/data-model.md (Hashing).
// Preimages are domain-separated (account_id + quote_id + version/seq + salt) so
// a row cannot be transplanted across quotes/accounts and still verify.
// ============================================================================

/**
 * Deterministic canonical JSON (RFC 8785-compatible subset for our value space:
 * null / boolean / string / integer-number / array / plain object). Object keys
 * are sorted; no insignificant whitespace. Our money/rate payloads are all safe
 * integers, so JSON number formatting is already canonical.
 */
export function canonicalize(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("canonicalize: non-finite number");
    if (!Number.isInteger(v)) throw new Error("canonicalize: non-integer number (money must be integer paise)");
    return JSON.stringify(v);
  }
  if (typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((v as any)[k])).join(",") + "}";
  }
  throw new Error(`canonicalize: unsupported type ${typeof v}`);
}

/** Lowercase hex SHA-256 of a UTF-8 string (WebCrypto). */
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Immutable version content hash. `payloadCanonical` is the ALREADY-canonical
 * stored string (embedded as a string element — data-model: "exact stored
 * canonical string bytes"), domain-separated by account/quote/version/salt.
 */
export async function versionContentHash(
  accountId: string, quoteId: string, version: number, genesisSalt: string, payloadCanonical: string,
): Promise<string> {
  return sha256Hex(canonicalize([accountId, quoteId, version, genesisSalt, payloadCanonical]));
}

/** Hash-chained audit entry hash (length-prefixed JSON array, incl. account/quote/salt). */
export async function auditEntryHash(
  accountId: string, quoteId: string, seq: number, action: string, actorId: string,
  detailJson: string, prevHash: string | null, genesisSalt: string,
): Promise<string> {
  return sha256Hex(canonicalize([accountId, quoteId, seq, action, actorId, detailJson, prevHash, genesisSalt]));
}

export interface VersionChainRow {
  version: number;
  payload_canonical: string;
  content_hash: string;
  prev_hash: string | null;
}

/**
 * Recompute every version's content hash from its stored payload and check the
 * prev_hash linkage. Returns the first version whose hash or link is broken.
 */
export async function verifyQuoteChain(
  accountId: string, quoteId: string, genesisSalt: string, rows: VersionChainRow[],
): Promise<{ verified: boolean; first_broken_version: number | null }> {
  const sorted = [...rows].sort((a, b) => a.version - b.version);
  let prev: string | null = null;
  for (const r of sorted) {
    const expected = await versionContentHash(accountId, quoteId, r.version, genesisSalt, r.payload_canonical);
    if (expected !== r.content_hash || r.prev_hash !== prev) {
      return { verified: false, first_broken_version: r.version };
    }
    prev = r.content_hash;
  }
  return { verified: true, first_broken_version: null };
}

/** 16-byte random hex salt, minted once per quote at creation. */
export function newSalt(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
