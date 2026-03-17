import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(size = 32): string {
  return base64UrlEncode(randomBytes(size));
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashWithSalt(value: string, salt: string): string {
  return sha256Hex(`${salt}:${value}`);
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function encrypt(plaintext: string, key: string): string {
  const { createCipheriv } = require("node:crypto") as typeof import("node:crypto");
  const iv = randomBytes(16);
  const keyHash = createHash("sha256").update(key).digest();
  const cipher = createCipheriv("aes-256-gcm", keyHash, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string, key: string): string {
  const { createDecipheriv } = require("node:crypto") as typeof import("node:crypto");
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid ciphertext format");
  }
  const keyHash = createHash("sha256").update(key).digest();
  const decipher = createDecipheriv("aes-256-gcm", keyHash, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(encryptedHex, "hex", "utf8") + decipher.final("utf8");
}
