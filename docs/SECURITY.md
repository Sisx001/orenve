# Security

## Threat model summary

The primary risks for an independent menswear e-commerce site are:

| Threat | Mitigations in place |
|---|---|
| Account takeover (admin) | scrypt hashing, rate-limited login, TOTP 2FA, session expiry |
| Session hijacking | httpOnly + Secure + SameSite=Lax cookies, 14-day sliding TTL |
| CSRF | Double-submit cookie (`ory_csrf` + `x-csrf-token` header) on all mutation routes |
| Brute-force login | DB-backed lockout (`LoginAttempt` table): threshold exceeded → locked until timestamp |
| Injection / XSS | React JSX escaping, CSP header, no `dangerouslySetInnerHTML` with user content |
| Prompt injection (AI) | User input wrapped in `<customer_message>`, pre-filter regex, output sanitiser, scope enforcement |
| Data exfiltration via AI | Model only sees public order data after phone + reference match; admin data never in context |
| File upload abuse | Magic-byte MIME sniffing, allowlist of MIME types, 30 MB limit, no executable extensions |
| Clickjacking | `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'` in CSP |
| Information leakage | `poweredByHeader: false`, no stack traces in production API responses |
| Incorrect client IP (behind proxy) | `TRUSTED_PROXY_HOPS` env var controls how many `X-Forwarded-For` hops to trust |

---

## Authentication

- Passwords are hashed with **scrypt** (N=32768, r=8, p=1, 64-byte key) using Node's built-in `crypto.scrypt`. No native binary dependencies.
- Session tokens are random bytes stored as a SHA-256 hash in the `Session` table. The plaintext token travels only in the httpOnly cookie.
- Sessions expire after **14 days** (sliding: refreshed on each request that uses the session).
- The session cookie is named `ory_session` and is set with `httpOnly: true`, `sameSite: "lax"`, and `secure: true` when `APP_URL` starts with `https://`.

---

## CSRF protection

All Server Actions and API routes that mutate data require a CSRF token. The scheme:

1. On first visit, the server sets a random `ory_csrf` cookie (`httpOnly: false`, `sameSite: "strict"`).
2. Client-side JavaScript reads this cookie and sends its value as the `x-csrf-token` request header.
3. The server compares the header value to the cookie value. A mismatch returns 403.

This protects against cross-site requests because a foreign origin cannot read the `ory_csrf` cookie value (same-origin policy).

---

## Rate limiting

Rate limiting is implemented in the `RateEvent` and `LoginAttempt` tables. No Redis or external service is required.

| Scope | Default limit |
|---|---|
| Login attempts per IP | Configurable; exceeded → account locked for a cooling period |
| AI chat requests per IP per hour | 60 (configurable in studio) |
| General API routes | Configurable per route |

Set `TRUSTED_PROXY_HOPS` to the number of reverse proxy hops in front of the app so the correct client IP is extracted from `X-Forwarded-For`.

---

## RBAC

Four roles are enforced at the API and server-action level:

| Role | Permissions |
|---|---|
| `owner` | All permissions including user management, backups, all settings |
| `admin` | All permissions except `users.manage` |
| `editor` | `products.write`, `content.write`, `media.write` |
| `support` | `orders.write`, `customers.read`, `payments.verify` |

Permission checks use the `PERMISSIONS` map in `src/lib/constants.ts`. Every server action and API route that modifies data checks the caller's role.

---

## Security headers

Set in `next.config.ts` for all routes in production:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` |
| `X-DNS-Prefetch-Control` | `on` |
| `Content-Security-Policy` | See below |

### CSP

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' data: https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
media-src 'self' blob: https:;
connect-src 'self' https://api.stripe.com https://*.sslcommerz.com;
frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://*.sslcommerz.com;
frame-ancestors 'self';
base-uri 'self';
form-action 'self' https://*.sslcommerz.com https://checkout.stripe.com;
object-src 'none';
upgrade-insecure-requests;
```

`'unsafe-inline'` for scripts is required by Next.js for its inline hydration scripts and by Stripe's JS. This is a known trade-off with Next.js 15. The `frame-ancestors 'self'` directive prevents embedding the site in foreign iframes.

---

## Media upload security

- MIME type is determined by **magic-byte sniffing** (`sniffMime()` in `src/lib/media/storage.ts`), not the file extension or the `Content-Type` header.
- Allowed MIME types: JPEG, PNG, WebP, AVIF, GIF, SVG (with script-tag check), MP4, WebM.
- SVG uploads are checked for `<script` and `on*=` attributes and rejected if found.
- Maximum upload size: 30 MB (enforced server-side; Next.js Server Action body limit is 35 MB).
- Files are stored with a random 8-byte hex name to prevent enumeration.

---

## AI concierge security

See [AI_CONCIERGE.md](AI_CONCIERGE.md) for the full security model. Key points:

- The AI client runs server-only; API keys never reach the browser.
- User input is wrapped in `<customer_message>` tags and treated as data.
- `lookup_order` enforces a phone + reference match in SQL; the model cannot bypass it.
- Output is sanitised to strip API key patterns and prompt scaffold content.
- Conversations with detected injection attempts are flagged in the database for review.

---

## Hardening checklist

### Before going live

- [ ] `APP_URL` set to `https://…` — required for `Secure` cookies
- [ ] `SESSION_SECRET` generated with `openssl rand -base64 48` — never use the default
- [ ] `SEED_ADMIN_PASSWORD` changed to a strong password; the seed default must not be used in production
- [ ] Owner account 2FA enabled (studio → Settings → My account)
- [ ] `SEED_DEMO_DATA=false` in production so demo orders with known tracking codes are not created
- [ ] Database not exposed to the internet; `DATABASE_URL` uses `localhost` or a private network address
- [ ] Firewall: only ports 80 and 443 open externally; Node.js port (`3000`) bound to `127.0.0.1`
- [ ] TLS certificate in place; HTTP redirects to HTTPS
- [ ] `TRUSTED_PROXY_HOPS` set correctly if behind a load balancer or CDN
- [ ] Nginx (or other proxy) `client_max_body_size` set to `35m` to allow large uploads while blocking larger payloads

### Ongoing

- [ ] Rotate `SESSION_SECRET` annually (invalidates all sessions; users must log in again)
- [ ] Review the audit log periodically for unexpected admin actions
- [ ] Check flagged AI conversations in the studio for patterns of abuse
- [ ] Keep Node.js on a current LTS release (20.x → 22.x as available)
- [ ] Keep npm dependencies up to date (`npm audit`); Prisma and Next.js release security patches regularly
- [ ] Run `npm run db:backup` daily and test restoring backups periodically

### Optional hardening

- Restrict admin access by IP using Nginx or a firewall rule if your team has a static IP.
- Enable Cloudflare (or similar CDN/WAF) in front of the origin for DDoS mitigation and an additional WAF layer.
- Set up log shipping from PM2 / Docker to a centralised log system for anomaly detection.
