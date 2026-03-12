import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors.js";

function base64UrlEncode(input: Buffer | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(normalized, "base64");
}

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

export type SignedTokenPayload = {
  exp: number;
  iat: number;
  nonce: string;
  scope: "bootstrap" | "events";
  session_id: string;
  machine_id: string;
};

export function signToken(payload: SignedTokenPayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifyToken(token: string, secret: string): SignedTokenPayload {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new HttpError(401, "invalid_token", "Malformed session token.");
  }

  const expected = base64UrlEncode(createHmac("sha256", secret).update(encodedPayload).digest());
  if (!constantTimeEquals(encodedSignature, expected)) {
    throw new HttpError(401, "invalid_token", "Session token signature is invalid.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as Partial<SignedTokenPayload>;
  if (
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number" ||
    typeof payload.nonce !== "string" ||
    (payload.scope !== "bootstrap" && payload.scope !== "events") ||
    typeof payload.session_id !== "string" ||
    typeof payload.machine_id !== "string"
  ) {
    throw new HttpError(401, "invalid_token", "Session token payload is invalid.");
  }

  if (payload.exp <= Date.now()) {
    throw new HttpError(401, "expired_token", "Session token has expired.");
  }

  return payload as SignedTokenPayload;
}
