import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Seals the successor refresh token on the rotated session row for the grace
 * window, so a retried refresh gets the same pair back (ADR-005 point 6). The
 * row outlives the window only until the caller clears it.
 *
 * AES-256-GCM: the auth tag makes a tampered or foreign value fail loudly
 * instead of decrypting to garbage. Layout: base64url(iv | tag | ciphertext).
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CONTEXT = "refresh-grace-window";

export interface GraceTokenCipher {
  encrypt(token: string): string;
  /** Returns null when the value was not sealed with this key or was altered. */
  decrypt(sealed: string): string | null;
}

/**
 * The only place the key comes from. HKDF gives it its own context, so it is
 * unrelated to the JWT signing key; moving to a dedicated secret later means
 * changing this function and nothing else.
 */
function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", CONTEXT, 32));
}

export function createGraceTokenCipher(secret: string): GraceTokenCipher {
  const key = deriveKey(secret);

  return {
    encrypt(token) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);

      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
    },

    decrypt(sealed) {
      const raw = Buffer.from(sealed, "base64url");

      if (raw.length <= IV_BYTES + TAG_BYTES) {
        return null;
      }

      try {
        const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
        decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
        const body = raw.subarray(IV_BYTES + TAG_BYTES);

        return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
      } catch {
        return null;
      }
    },
  };
}
