// NFR-03 field-encryption proof. Run: npm test (node --test, strips TS types).
// Proves AES-GCM round-trips, hides plaintext, uses a fresh IV each time, tolerates
// legacy plaintext, and fails closed on a wrong key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptField, decryptField, isEncrypted } from "../src/fieldcrypto.ts";

// 32-byte key, base64 (as FIELD_ENC_KEY would hold).
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

test("encrypt → decrypt round-trips and the ciphertext hides the plaintext", async () => {
  const ct = await encryptField("ABCDE1234F", KEY);
  assert.ok(ct && ct.startsWith("v1:"));
  assert.equal(ct!.includes("ABCDE1234F"), false);
  assert.equal(await decryptField(ct, KEY), "ABCDE1234F");
});

test("same value encrypts differently each time (random IV)", async () => {
  const a = await encryptField("1234567890", KEY);
  const b = await encryptField("1234567890", KEY);
  assert.notEqual(a, b);
  assert.equal(await decryptField(a, KEY), "1234567890");
  assert.equal(await decryptField(b, KEY), "1234567890");
});

test("decrypt tolerates legacy plaintext (no v1: prefix) and needs no key for it", async () => {
  assert.equal(isEncrypted("ABCDE1234F"), false);
  assert.equal(await decryptField("ABCDE1234F", undefined), "ABCDE1234F"); // scaffold seed
  assert.equal(await decryptField(null, KEY), null);
});

test("null/empty are preserved on encrypt", async () => {
  assert.equal(await encryptField(null, KEY), null);
  assert.equal(await encryptField("", KEY), "");
});

test("a wrong key fails to decrypt (GCM authentication)", async () => {
  const ct = await encryptField("secret", KEY);
  const WRONG = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
  await assert.rejects(() => decryptField(ct, WRONG));
});

test("an encrypted value with no key throws rather than leaking", async () => {
  const ct = await encryptField("secret", KEY);
  await assert.rejects(() => decryptField(ct, undefined));
});
