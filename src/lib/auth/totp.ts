import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

/**
 * TOTP (RFC 6238) two-factor authentication for studio staff.
 * A one-step window either side tolerates modest clock drift on phones.
 */
authenticator.options = { window: 1, step: 30, digits: 6 };

export const TOTP_ISSUER = "ORYNVE Studio";

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20);
}

export function totpKeyUri(email: string, secret: string, issuer = TOTP_ISSUER): string {
  return authenticator.keyuri(email, issuer, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  const clean = (token ?? "").replace(/\D/g, "");
  if (clean.length !== 6 || !secret) return false;
  try {
    return authenticator.check(clean, secret);
  } catch {
    return false;
  }
}

export async function totpQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { margin: 1, width: 240, color: { dark: "#0e0f0c", light: "#faf8f3" } });
}

/** Human-friendly grouping of the base32 secret for manual entry. */
export function formatSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ");
}

// ───────────────────── pending-2FA cookie (signed, short lived) ─────────────────────

const secret = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export const COOKIE_TOTP_PENDING = "ory_2fa";
export const PENDING_TTL_SEC = 300;

/** `userId.expiresAt.signature` — proves the password step already succeeded. */
export function signPendingToken(userId: string): string {
  const exp = Date.now() + PENDING_TTL_SEC * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readPendingToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
}
