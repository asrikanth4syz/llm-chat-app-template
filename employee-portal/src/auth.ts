// R0 identity helpers — JWT (HMAC-SHA256) over Web Crypto, plus a dev password
// check. This realm is SEPARATE from SmartPantry (its own users table + its own
// JWT_SECRET, DEC-02). SSO and DLT mobile-OTP replace the dev checks in R0 build.

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlJson(obj: unknown): string {
  return b64url(enc.encode(JSON.stringify(obj)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signJwt(payload: Record<string, unknown>, secret: string, ttlSec = 3600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttlSec, ...payload };
  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const data = `${head}.${b64urlJson(body)}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  let ok = false;
  try {
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, enc.encode(data));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Dev-only password check. Stored form is "SEED:<plaintext>"; replace with a
// real hash (scrypt/argon2) + SSO before go-live. Constant-time comparison.
export function checkPassword(stored: string, provided: string): boolean {
  if (!stored.startsWith("SEED:")) return false;
  return safeEqual(stored.slice(5), provided);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
