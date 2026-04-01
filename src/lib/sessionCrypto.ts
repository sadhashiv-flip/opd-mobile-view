/**
 * Session payload protection for localStorage.
 * - **AES-GCM** when `globalThis.crypto.subtle` exists (https or localhost).
 * - **XOR obfuscation** fallback when SubtleCrypto is missing (e.g. http://192.168.x.x).
 *
 * Note: VITE_* secret is still in the bundle; prefer httpOnly cookies for high assurance.
 */

const encoder = new TextEncoder();
const IV_LEN = 12;
const PREFIX_AES = "aes1:";
const PREFIX_XOR = "xor1:";

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCodePoint(b);
  });
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.codePointAt(i) ?? 0;
  }
  return out;
}

function hasSubtleCrypto(): boolean {
  return Boolean(globalThis.crypto?.subtle?.digest);
}

async function deriveKey(
  subtle: SubtleCrypto,
  secret: string,
): Promise<CryptoKey> {
  const hash = await subtle.digest("SHA-256", encoder.encode(secret));
  return subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** XOR is self-inverse; same as "decrypt" for this stream. */
function xorWithSecret(data: Uint8Array, secret: string): Uint8Array {
  const key = encoder.encode(secret);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ key[i % key.length];
  }
  return out;
}

function xorEncryptToPayload(secret: string, json: string): string {
  const plain = encoder.encode(json);
  const obfuscated = xorWithSecret(plain, secret);
  return PREFIX_XOR + bytesToB64(obfuscated);
}

function xorDecryptFromPayload(secret: string, b64Cipher: string): string {
  const obfuscated = b64ToBytes(b64Cipher);
  const plain = xorWithSecret(obfuscated, secret);
  return new TextDecoder().decode(plain);
}

async function aesEncryptPayload(secret: string, json: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(subtle, secret);
  const plain = encoder.encode(json);
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const ct = new Uint8Array(cipher);
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv);
  combined.set(ct, iv.length);
  return PREFIX_AES + bytesToB64(combined);
}

async function aesDecryptPayload<T>(secret: string, b64Combined: string): Promise<T> {
  const subtle = globalThis.crypto.subtle;
  const combined = b64ToBytes(b64Combined);
  const iv = combined.slice(0, IV_LEN);
  const data = combined.slice(IV_LEN);
  const key = await deriveKey(subtle, secret);
  const plain = await subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function encryptJson(secret: string, value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  if (!hasSubtleCrypto()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[auth] Web Crypto SubtleCrypto is unavailable (use https:// or localhost). Using XOR fallback for session storage.",
      );
    }
    return xorEncryptToPayload(secret, json);
  }
  return aesEncryptPayload(secret, json);
}

export async function decryptJson<T>(secret: string, ciphertext: string): Promise<T> {
  if (ciphertext.startsWith(PREFIX_XOR)) {
    const inner = ciphertext.slice(PREFIX_XOR.length);
    const json = xorDecryptFromPayload(secret, inner);
    return JSON.parse(json) as T;
  }
  if (ciphertext.startsWith(PREFIX_AES)) {
    const inner = ciphertext.slice(PREFIX_AES.length);
    return aesDecryptPayload<T>(secret, inner);
  }
  /* Legacy: raw base64 IV+ciphertext (AES) before prefixes existed */
  return aesDecryptPayload<T>(secret, ciphertext);
}
