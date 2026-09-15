import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt — no native add-ons, so it
 * installs identically on Vercel, Railway, a VPS and cPanel.
 * Format: scrypt$N$r$p$saltB64$hashB64
 */
const N = 1 << 15; // 32768
const r = 8;
const p = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, n, rr, pp, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const key = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(rr),
      p: Number(pp),
      maxmem: 128 * Number(n) * Number(rr) * 2,
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; issues: string[] } {
  const issues: string[] = [];
  if (pw.length < 12) issues.push("min_length");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) issues.push("mixed_case");
  if (!/\d/.test(pw)) issues.push("number");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("symbol");
  const score = Math.max(0, 4 - issues.length) as 0 | 1 | 2 | 3 | 4;
  return { score, issues };
}
