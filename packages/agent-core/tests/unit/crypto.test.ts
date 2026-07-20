import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "../../src/credential-crypto";

describe("credential encryption", () => {
  it("round-trips with AES-GCM without storing plaintext", () => {
    const secret = "sk-test-value";
    const encrypted = encryptCredential(secret, "a".repeat(64));
    expect(JSON.stringify(encrypted)).not.toContain(secret);
    expect(decryptCredential(encrypted, "a".repeat(64))).toBe(secret);
  });

  it("rejects expired credentials", () => {
    const encrypted = encryptCredential("sk-test", "b".repeat(64), new Date(0));
    expect(() => decryptCredential(encrypted, "b".repeat(64))).toThrow(/expired/i);
  });
});
