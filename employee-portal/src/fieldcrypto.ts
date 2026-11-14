// NFR-03 — field-level encryption for sensitive PII (bank account, PAN, Aadhaar).
// AES-256-GCM via Web Crypto. Stored form: "v1:<base64 iv>:<base64 ciphertext>".
//
// decryptField tolerates LEGACY PLAINTEXT (values without the v1: prefix) so the
// scaffold seed stays readable while new writes are encrypted — a plaintext value
// needs no key at all. The key is a Worker secret (FIELD_ENC_KEY: base64 of 32
// random bytes, e.g. `openssl rand -base64 32`). This module is pure given a key,
// so it is unit-tested directly.

const enc = new TextEncoder();
const dec = new TextDecoder();
const PREFIX = "v1:";

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length); // fresh ArrayBuffer-backed (BufferSource)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64);
  if (raw.length !== 32) throw new Error("FIELD_ENC_KEY must be the base64 of exactly 32 bytes");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** True when a stored value is in the encrypted envelope (vs legacy plaintext). */
export function isEncrypted(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

/** Encrypt a plaintext field for storage. null stays null; "" stays "". */
export async function encryptField(plain: string | null | undefined, keyB64: string): Promise<string | null> {
  if (plain == null) return null;
  if (plain === "") return "";
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  return `${PREFIX}${b64(iv)}:${b64(ct)}`;
}

/** Decrypt a stored field. Plaintext (no v1: prefix) is returned as-is and needs
 *  no key; an encrypted value needs the key and fails closed on a wrong key. */
export async function decryptField(stored: string | null | undefined, keyB64: string | undefined): Promise<string | null> {
  if (stored == null) return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext (scaffold seed)
  if (!keyB64) throw new Error("encrypted value present but FIELD_ENC_KEY is not set");
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 2) throw new Error("malformed ciphertext envelope");
  const key = await importKey(keyB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(parts[0]) }, key, unb64(parts[1]));
  return dec.decode(pt);
}
