import { describe, expect, it } from "vitest";
import { createGraceTokenCipher } from "./grace-token-cipher.js";
import { generateRefreshToken } from "./refresh-token.js";

const secret = "a-test-secret-with-at-least-32-characters";

describe("createGraceTokenCipher", () => {
  it("decrypts what it encrypted", () => {
    const cipher = createGraceTokenCipher(secret);
    const token = generateRefreshToken();

    expect(cipher.decrypt(cipher.encrypt(token))).toBe(token);
  });

  it("does not leave the token readable in the sealed value", () => {
    const cipher = createGraceTokenCipher(secret);
    const token = generateRefreshToken();

    expect(cipher.encrypt(token)).not.toContain(token);
  });

  it("seals the same token differently every time", () => {
    const cipher = createGraceTokenCipher(secret);
    const token = generateRefreshToken();

    expect(cipher.encrypt(token)).not.toBe(cipher.encrypt(token));
  });

  it("opens a value sealed by another instance with the same secret", () => {
    const sealed = createGraceTokenCipher(secret).encrypt("token");

    expect(createGraceTokenCipher(secret).decrypt(sealed)).toBe("token");
  });

  it("returns null for a value sealed with another secret", () => {
    const sealed = createGraceTokenCipher(secret).encrypt("token");

    expect(createGraceTokenCipher(`${secret}-rotated`).decrypt(sealed)).toBeNull();
  });

  it("returns null for a tampered value", () => {
    const cipher = createGraceTokenCipher(secret);
    const sealed = cipher.encrypt("token");
    const last = sealed.endsWith("A") ? "B" : "A";

    expect(cipher.decrypt(`${sealed.slice(0, -1)}${last}`)).toBeNull();
  });

  it("returns null for a value that is empty, too short or not base64", () => {
    const cipher = createGraceTokenCipher(secret);

    expect(cipher.decrypt("")).toBeNull();
    expect(cipher.decrypt("c2hvcnQ")).toBeNull();
    expect(cipher.decrypt("!!!")).toBeNull();
  });
});
