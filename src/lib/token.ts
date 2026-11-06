import { randomBytes, createHash } from "crypto";

/**
 * Token primitives for email verification + password reset.
 *
 * Pattern: generate a random secret, send the plain token in the URL, store
 * only the SHA-256 hash in the DB. On submission, hash again and look up.
 * A DB leak gives an attacker hashes — they still can't use the links.
 */
export function generateToken(): { token: string; hash: string } {
  // 32 raw bytes => 43-char base64url; URL-safe, no padding needed.
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
