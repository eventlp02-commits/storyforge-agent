import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedCredential = {
  algorithm: "aes-256-gcm";
  iv: string;
  ciphertext: string;
  authTag: string;
  expiresAt: string;
};

function keyFromHex(encryptionKey: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    throw new Error("Credential encryption key must be 64 hexadecimal characters");
  }
  return Buffer.from(encryptionKey, "hex");
}

export function encryptCredential(
  plaintext: string,
  encryptionKey: string,
  expiresAt = new Date(Date.now() + 60 * 60 * 1000),
): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromHex(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    expiresAt: expiresAt.toISOString(),
  };
}

export function decryptCredential(payload: EncryptedCredential, encryptionKey: string): string {
  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error("Credential has expired");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromHex(encryptionKey),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
