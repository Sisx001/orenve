/**
 * Client IP derivation that cannot be spoofed by the client.
 * TRUSTED_PROXY_HOPS = number of reverse proxies in front of the app
 * (Vercel/Railway/Cloudflare/Nginx each add one X-Forwarded-For entry).
 * We take the entry that many hops from the END of the list, never the first.
 */
export function getClientIp(h: Headers | { get(name: string): string | null }): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const direct = h.get("x-real-ip") ?? h.get("cf-connecting-ip");
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = Math.max(0, parts.length - hops);
    return parts[idx] ?? parts[parts.length - 1] ?? "0.0.0.0";
  }
  return direct ?? "0.0.0.0";
}
