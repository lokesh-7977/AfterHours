import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt } from "node:crypto";
import { getEnv } from "./env";

const keyCache = new Map<string, Buffer>();

/**
 * Purpose-bound keys derived from BETTER_AUTH_SECRET with HKDF, so a key used
 * for one purpose (e.g. attendance-code hashing) is useless for another.
 */
function deriveKey(purpose: string): Buffer {
  const cached = keyCache.get(purpose);
  if (cached) return cached;
  const key = Buffer.from(hkdfSync("sha256", getEnv().BETTER_AUTH_SECRET, "events-platform", purpose, 32));
  keyCache.set(purpose, key);
  return key;
}

/** URL-safe random token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Keyed hash for low-entropy secrets (attendance codes) so a database leak cannot be brute-forced offline. */
export function keyedHash(purpose: string, value: string): string {
  return createHmac("sha256", deriveKey(`hmac:${purpose}`)).update(value).digest("hex");
}

/** AES-256-GCM authenticated encryption. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(purpose: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(`enc:${purpose}`), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(purpose: string, payload: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(`enc:${purpose}`), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L ambiguity

/** Human-enterable attendance code, e.g. "K7QM-3XPA" (~40 bits of entropy). */
export function generateHumanCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function normalizeHumanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
