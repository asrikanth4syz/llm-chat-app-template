// Unit tests for the Quotations canonicalization + hash-chain helpers
// (milestone 006, Slice 3). Known-answer SHA-256, canonical determinism,
// domain separation, and chain verification / tamper detection.
import { describe, it, expect } from "vitest";
import {
  canonicalize, sha256Hex, versionContentHash, auditEntryHash, verifyQuoteChain, newSalt,
  type VersionChainRow,
} from "../src/quote_hash";

describe("quote_hash — canonicalize", () => {
  it("sorts object keys recursively (order-independent)", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ a: 2, b: 1 })).toBe(canonicalize({ b: 1, a: 2 }));
    expect(canonicalize({ x: { d: 1, c: 2 }, y: [3, 2, 1] })).toBe('{"x":{"c":2,"d":1},"y":[3,2,1]}');
  });
  it("preserves array order and handles null/bool/string", () => {
    expect(canonicalize([null, true, "a"])).toBe('[null,true,"a"]');
    expect(canonicalize(undefined)).toBe("null");
  });
  it("rejects non-integer / non-finite numbers (money must be integer paise)", () => {
    expect(() => canonicalize(1.5)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
  });
});

describe("quote_hash — sha256Hex (known answer)", () => {
  it('sha256("abc") matches the published digest', async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it('sha256("") matches the published digest', async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("quote_hash — domain separation", () => {
  it("same payload under different quote/account/version → different hashes", async () => {
    const p = canonicalize({ grand_total_paise: 19200 });
    const h1 = await versionContentHash("acct", "qA", 1, "salt", p);
    const h2 = await versionContentHash("acct", "qB", 1, "salt", p); // different quote
    const h3 = await versionContentHash("acct", "qA", 2, "salt", p); // different version
    const h4 = await versionContentHash("acct2", "qA", 1, "salt", p); // different account
    const h5 = await versionContentHash("acct", "qA", 1, "salt2", p); // different salt
    expect(new Set([h1, h2, h3, h4, h5]).size).toBe(5);
  });
  it("audit entry hash includes quote_id + salt (no delimiter injection)", async () => {
    const a = await auditEntryHash("acct", "q1", 1, "created", "u1", '{"k":"v"}', null, "salt");
    const b = await auditEntryHash("acct", "q1", 1, "created", "u1", '{"k":"v"}', null, "salt");
    const c = await auditEntryHash("acct", "q2", 1, "created", "u1", '{"k":"v"}', null, "salt");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("quote_hash — verifyQuoteChain", () => {
  async function chain(): Promise<VersionChainRow[]> {
    const acct = "acct", q = "q1", salt = "s";
    const p1 = canonicalize({ v: 1 });
    const h1 = await versionContentHash(acct, q, 1, salt, p1);
    const p2 = canonicalize({ v: 2 });
    const h2 = await versionContentHash(acct, q, 2, salt, p2);
    return [
      { version: 1, payload_canonical: p1, content_hash: h1, prev_hash: null },
      { version: 2, payload_canonical: p2, content_hash: h2, prev_hash: h1 },
    ];
  }
  it("a well-formed chain verifies", async () => {
    expect(await verifyQuoteChain("acct", "q1", "s", await chain())).toEqual({ verified: true, first_broken_version: null });
  });
  it("tampering a payload breaks that version", async () => {
    const rows = await chain();
    rows[1] = { ...rows[1], payload_canonical: canonicalize({ v: 999 }) }; // content no longer hashes to stored content_hash
    expect(await verifyQuoteChain("acct", "q1", "s", rows)).toEqual({ verified: false, first_broken_version: 2 });
  });
  it("a broken prev_hash link is detected", async () => {
    const rows = await chain();
    rows[1] = { ...rows[1], prev_hash: "deadbeef" };
    expect(await verifyQuoteChain("acct", "q1", "s", rows)).toEqual({ verified: false, first_broken_version: 2 });
  });
  it("a transplanted row (wrong quote salt) fails verification", async () => {
    const rows = await chain();
    expect((await verifyQuoteChain("acct", "q1", "WRONG-salt", rows)).verified).toBe(false);
  });
});

describe("quote_hash — newSalt", () => {
  it("returns a 32-hex-char random salt", () => {
    const s = newSalt();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(s).not.toBe(newSalt());
  });
});
