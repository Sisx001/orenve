/**
 * Edge/Web-Crypto compatible CSRF token minting — produces tokens identical to
 * src/lib/auth/csrf.ts (`raw.base64url(HMAC_SHA256(secret, raw))`) so the
 * middleware can guarantee the cookie exists on the very first page load.
 */
function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function mintCsrfTokenEdge(secret: string): Promise<string> {
  const rawBytes = new Uint8Array(24);
  crypto.getRandomValues(rawBytes);
  const raw = base64url(rawBytes);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return `${raw}.${base64url(new Uint8Array(sig))}`;
}

export function looksLikeCsrfToken(v: string | undefined | null): boolean {
  return !!v && /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{40,}$/.test(v);
}
