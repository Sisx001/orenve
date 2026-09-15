# ORYNVE v2

ORYNVE v2 is a production-ready e-commerce platform for a premium menswear brand in Bangladesh. It ships as a single Next.js 15 application: a bilingual (English / Bangla) storefront, a full-featured owner studio, and an AI-powered concierge — all deployable to Vercel, Railway, any VPS, or cPanel shared hosting.

---

## Feature overview

### Storefront
- Bilingual routes: `/en/...` and `/bn/...` with automatic browser-language detection and a language switcher
- Catalogue with categories, collections, product variants (size, colour), stock badges, a size guide, and photo/video galleries
- Shopping bag, wishlist, quick-view, product reviews (moderated)
- Guest checkout via the website, WhatsApp order message, or Messenger — no account required
- Order tracking at `/{locale}/track` (search by order number or 8-character tracking code + phone) and the order detail page `/{locale}/order/{trackingCode}`
- Coupon codes, multi-currency display (base BDT; display rates configurable in studio)
- Configurable homepage blocks: hero, marquee, featured products, editorial, collections, lookbook, arrivals, testimonials, manifesto, newsletter, custom
- PWA manifest, sitemap, SEO meta with OpenGraph support

### Studio (admin at `/admin`)
Dashboard, orders pipeline, manual order entry for WhatsApp/Messenger/phone orders, order tracking events visible to customers and the AI concierge, payment verification for bKash/Nagad TrxIDs, products and variants with inventory, customers, coupons, shipping zones, static pages, homepage blocks, media library, branding and theme editor, feature toggles, checkout settings, currencies, translations, AI concierge settings, users and roles with optional TOTP 2FA, audit log, and backup.

### AI concierge
On-site chat widget powered by any OpenAI-compatible API endpoint (DeepSeek, OpenAI, Groq, OpenRouter, Ollama, …). The concierge can look up a customer's own order (requires order number or tracking code + phone match) and search the product catalogue. All inference runs server-side; the model never sees API keys or other customers' data. See [docs/AI_CONCIERGE.md](docs/AI_CONCIERGE.md).

### Payments
| Method | Type |
|---|---|
| Cash on Delivery (COD) | Manual; confirmed by staff |
| bKash Send-Money | Manual MFS; TrxID verified in studio |
| Nagad Send-Money | Manual MFS; TrxID verified in studio |
| SSLCommerz | Hosted gateway (cards, bKash, Nagad, Rocket, net banking) |
| Stripe Checkout | International card payments |

Each method has an on/off toggle in the studio. See [docs/PAYMENTS.md](docs/PAYMENTS.md).

### i18n
English (`en`) and Bangla (`bn`) are built in. Content fields are stored as JSON `{"en":"…","bn":"…"}`. Per-key overrides are editable in the studio under Translations. Adding a locale requires three small changes — see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

### Security
scrypt password hashing, httpOnly sliding-window session cookies (14-day TTL), CSRF double-submit pattern (`ory_csrf` cookie + `x-csrf-token` header), database-backed rate limiting, RBAC (owner / admin / editor / support), optional TOTP 2FA, audit log, CSP and security headers. See [docs/SECURITY.md](docs/SECURITY.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, React 19) |
| Styling | Tailwind CSS 3, Framer Motion |
| Database | Prisma 6 — SQLite (default) / PostgreSQL / MySQL |
| Media | Local filesystem or any S3-compatible bucket (AWS, R2, MinIO, Spaces) |
| Payments | Custom adapters: COD, bKash/Nagad manual, SSLCommerz, Stripe |
| AI | Fetch-based OpenAI-compatible client (no SDK lock-in) |
| Auth | Custom scrypt + httpOnly cookies + TOTP (otplib) |
| Validation | Zod |

---

## Quick start

```bash
# 1. Clone and install
git clone <repo-url> orynve-v2 && cd orynve-v2
npm ci

# 2. Copy env and set the two required values
cp .env.example .env
# Edit .env: set APP_URL and SESSION_SECRET at minimum

# 3. Create the database and seed demo data
npm run setup

# 4. Start the dev server
npm run dev

# 5. Open the storefront and studio
# Storefront → http://localhost:3000  (redirects to /en or /bn)
# Studio     → http://localhost:3000/admin
# Default owner login: owner@orynve.com / ChangeMe!Immediately-2026
```

Change the owner password immediately after first login.

Demo order tracking (only present when `SEED_DEMO_DATA=true`): phone `01700000000`, codes `7KQ2MHT9`, `B4NDX8PL`, `Z9C3RWM6`.

---

## Configuration

Copy `.env.example` to `.env` (local dev) or set these variables in your host's dashboard (production).

### Required

| Variable | Description |
|---|---|
| `APP_URL` | Public URL of the site, no trailing slash. Must be `https://…` in production for secure cookies. Example: `https://orynve.com` |
| `SESSION_SECRET` | 32+ random characters used to sign session tokens. Generate: `openssl rand -base64 48` |
| `DATABASE_URL` | Connection string. SQLite default: `file:./data/orynve.db`. PostgreSQL: `postgresql://user:pass@host:5432/orynve`. MySQL: `mysql://user:pass@host:3306/orynve` |

### Database

| Variable | Values | Default |
|---|---|---|
| `DATABASE_PROVIDER` | `sqlite` \| `postgresql` \| `mysql` | Inferred from `DATABASE_URL`; falls back to `sqlite` |

The script `scripts/db-provider.mjs` rewrites the `provider` line in `prisma/schema.prisma` before every generate/push/migrate. This runs automatically via `predev`, `prebuild`, and `postinstall` hooks.

### Seed (first-run only)

| Variable | Default |
|---|---|
| `SEED_ADMIN_EMAIL` | `owner@orynve.com` |
| `SEED_ADMIN_PASSWORD` | `ChangeMe!Immediately-2026` |
| `SEED_DEMO_DATA` | `true` — set to `false` or remove to skip demo products and orders |

### Media

| Variable | Default | Notes |
|---|---|---|
| `MEDIA_STORAGE` | `local` | `local` writes to `public/uploads/` (needs a persistent disk). `s3` for S3-compatible buckets. **Vercel must use `s3`** — the filesystem is ephemeral. |
| `UPLOAD_DIR` | `{cwd}/public/uploads` | Override the local upload directory, e.g. `/data/uploads` on Railway |
| `S3_ENDPOINT` | — | Leave blank for AWS. Set for R2 (`https://<account>.r2.cloudflarestorage.com`), MinIO, Spaces, etc. |
| `S3_REGION` | `auto` | `auto` works for R2; use the bucket's AWS region for S3 |
| `S3_BUCKET` | — | Bucket name |
| `S3_ACCESS_KEY_ID` | — | |
| `S3_SECRET_ACCESS_KEY` | — | |
| `S3_PUBLIC_URL` | — | Public base URL for assets, no trailing slash. e.g. `https://cdn.orynve.com` |
| `IMAGE_UNOPTIMIZED` | `false` | Set `true` on hosts where `sharp` cannot be installed (some cPanel plans). Next.js image optimisation is disabled and original files are served. |

### Payments

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) from the Stripe dashboard |
| `STRIPE_PUBLISHABLE_KEY` | Not used server-side; kept here for reference |
| `SSLCOMMERZ_STORE_ID` | From the SSLCommerz merchant panel |
| `SSLCOMMERZ_STORE_PASSWORD` | From the SSLCommerz merchant panel |
| `SSLCOMMERZ_SANDBOX` | `true` for the sandbox, `false` for live |

bKash and Nagad operate via manual Send-Money; the wallet numbers are set in the studio under Settings → Checkout, not as env vars.

### AI concierge

| Variable | Default | Notes |
|---|---|---|
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | Any OpenAI-compatible base URL |
| `AI_API_KEY` | — | API key for the provider; leave blank for Ollama (no auth) |
| `AI_MODEL` | `deepseek-chat` | Model name as the provider expects it |

These can also be overridden in the studio under Settings → AI Concierge (studio values take precedence over env vars when set).

### Email

| Variable | Notes |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | Default `587` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address, e.g. `ORYNVE <hello@orynve.com>` |

### Deployment

| Variable | Values | Default |
|---|---|---|
| `DEPLOY_TARGET` | `standalone` \| `server` \| `vercel` | `standalone` |
| `PORT` | Any port number | `3000` |
| `TRUSTED_PROXY_HOPS` | Integer | `1` — increase if behind multiple reverse proxies to extract the correct client IP |

---

## Database options

| Provider | When to use |
|---|---|
| SQLite (`file:./data/orynve.db`) | Local dev, single-VPS deployments with a persistent disk, cPanel shared hosting. Zero configuration. Relative paths are always anchored at `prisma/` in the project root (so `prisma/data/orynve.db`) — for the CLI *and* the running server, including standalone/PM2 builds. Use an absolute path (`file:/var/lib/orynve/orynve.db`) to store it elsewhere. |
| PostgreSQL | Vercel (Neon, Supabase, Vercel Postgres), Railway (Postgres plugin), multi-instance deployments. |
| MySQL | cPanel shared hosting where a MySQL database is already provisioned. Set `DATABASE_PROVIDER=mysql`. |

After changing `DATABASE_PROVIDER`, run `npm run setup` on a fresh database or `npm run db:migrate` if you have existing migrations.

---

## Media storage

### Local (`MEDIA_STORAGE=local`)
Uploads are written under `public/uploads/` (or `UPLOAD_DIR`). The directory must survive restarts, meaning it cannot be on a read-only or ephemeral filesystem.

- VPS: the project folder is persistent by default.
- Railway: mount a volume at `/app/public/uploads` or set `UPLOAD_DIR=/data/uploads` with a volume at `/data`.
- cPanel: the app folder on a shared host is persistent.
- **Vercel: not supported.** Vercel's filesystem is ephemeral. Use `MEDIA_STORAGE=s3`.

Uploaded images are served both via Next.js static file serving (`/uploads/…`) and via the portable API route `/api/media/<key>` which supports HTTP Range requests (required for video streaming).

### S3-compatible (`MEDIA_STORAGE=s3`)
Set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL`. Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, and any compatible service.

The upload limit is 30 MB per file. Images are processed with `sharp` before storage (converted to WebP, max 2600 px wide). When `sharp` is unavailable, the original file is stored as-is.

---

## Payments setup

See [docs/PAYMENTS.md](docs/PAYMENTS.md) for full instructions. Brief summary:

- **COD**: always available; toggle in studio.
- **bKash / Nagad**: set wallet numbers in studio → Checkout; staff verify TrxIDs in the studio order view.
- **SSLCommerz**: set `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD`; use `SSLCOMMERZ_SANDBOX=true` for testing.
- **Stripe**: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; configure webhook endpoint `https://yoursite.com/api/payments/stripe/webhook` in the Stripe dashboard. Note: Stripe does not onboard Bangladesh-registered businesses directly — see [docs/PAYMENTS.md](docs/PAYMENTS.md) and [docs/MARKET_ANALYSIS.md](docs/MARKET_ANALYSIS.md) for options.

---

## AI concierge setup

The concierge requires any OpenAI-compatible endpoint. Set three env vars:

**DeepSeek (recommended for cost and quality):**
```bash
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat
```

**Ollama (self-hosted, free):**
```bash
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3.2
```

After setting env vars (or filling in the studio form under Settings → AI Concierge), click "Test connection" in the studio to verify.

### Writing good Owner notes

The "Owner notes" field in the studio (Settings → AI Concierge → Extra instructions) is appended to the system prompt. Write facts the model cannot know from the catalogue or policies:

```
Returns window is 10 days for Eid-season orders (ends 30 June 2026).
Our tailoring pieces run slim — advise customers to size up if between sizes.
Flagship store address: House 12, Road 5, Banani, Dhaka 1213. Walk-ins welcome Sat–Thu 11:00–19:00.
Do not mention competitors by name.
```

Keep notes factual. The model uses these as authoritative facts when answering customers.

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step guides. Brief per-host summary:

| Host | Guide section |
|---|---|
| Vercel | Set `DEPLOY_TARGET=vercel`, `DATABASE_URL` (Postgres), `MEDIA_STORAGE=s3`. Build command: `npm run build`. Run `prisma migrate deploy` in `postinstall`. |
| Railway | Use the Dockerfile. Add a Postgres plugin. Mount a volume for uploads or use S3. |
| VPS (Ubuntu 22/24) | Node 20 via NodeSource, PM2 with `deploy/ecosystem.config.cjs`, Nginx from `deploy/nginx.conf`, Let's Encrypt. |
| Docker | `docker compose up` with `deploy/docker-compose.yml`. |
| cPanel | Setup Node.js App panel, startup file `deploy/cpanel-server.js`, MySQL from cPanel, `IMAGE_UNOPTIMIZED=true` if sharp fails. |

---

## Project structure

```
orynve-v2/
├── prisma/
│   ├── schema.prisma          # Data model; provider rewritten by scripts/db-provider.mjs
│   ├── seed.ts                # Owner account, settings, shipping zones, pages, demo data
│   └── data/                  # SQLite database file (created at runtime)
├── public/
│   ├── uploads/               # Local media storage (persistent disk required)
│   └── brand/                 # Static brand assets
├── scripts/
│   ├── db-provider.mjs        # Rewrites prisma/schema.prisma provider line
│   └── backup.mjs             # Database backup (SQLite copy / pg_dump / mysqldump)
├── src/
│   ├── app/
│   │   ├── [locale]/          # Storefront routes (en / bn)
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── shop/          # Catalogue
│   │   │   ├── product/[slug]/
│   │   │   ├── track/         # Order tracking search
│   │   │   ├── order/[trackingCode]/
│   │   │   └── …
│   │   ├── admin/             # Studio (login at /admin/login)
│   │   └── api/
│   │       ├── ai/chat/       # AI concierge endpoint
│   │       ├── checkout/      # Order creation
│   │       ├── media/[...path]/ # Portable media server (Range-capable)
│   │       ├── payments/
│   │       │   ├── sslcommerz/callback/
│   │       │   ├── sslcommerz/ipn/
│   │       │   └── stripe/webhook/
│   │       ├── track/
│   │       └── health/
│   ├── lib/
│   │   ├── ai/                # Concierge client, prompt, tools, injection detection
│   │   ├── payments/          # COD, bKash/Nagad, SSLCommerz, Stripe adapters
│   │   ├── media/storage.ts   # Local / S3 adapters
│   │   ├── settings.ts        # Typed DB-backed settings (brand, checkout, AI, …)
│   │   ├── constants.ts       # Roles, locales, cookie names, order/payment statuses
│   │   └── …
│   └── middleware.ts          # i18n redirect, admin session guard
├── messages/
│   ├── en.json                # UI strings (English)
│   └── bn.json                # UI strings (Bangla)
├── deploy/
│   ├── docker-compose.yml
│   ├── ecosystem.config.cjs   # PM2
│   ├── nginx.conf
│   └── cpanel-server.js
├── docs/
│   ├── DEPLOYMENT.md
│   ├── ADMIN_GUIDE.md
│   ├── AI_CONCIERGE.md
│   ├── PAYMENTS.md
│   ├── SECURITY.md
│   ├── CONTRIBUTING.md
│   └── MARKET_ANALYSIS.md
├── Dockerfile
├── .dockerignore
├── railway.json
├── vercel.json
├── next.config.ts
└── .env.example
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| Setup (first run) | `npm run setup` | `db:push` then `db:seed` — creates tables and seeds owner account |
| Dev server | `npm run dev` | Runs `db-provider.mjs`, `prisma generate`, then `next dev` |
| Production build | `npm run build` | Runs `db-provider.mjs`, `prisma generate`, then `next build` |
| Start (standard) | `npm start` | `next start -p ${PORT:-3000}` |
| Start (standalone) | `npm run start:standalone` | `node .next/standalone/server.js` — for Docker / Railway / PM2 (`postbuild` copies static assets in). cPanel uses `DEPLOY_TARGET=server` + `deploy/cpanel-server.js` instead |
| DB push | `npm run db:push` | Apply schema without migrations (dev / SQLite) |
| DB migrate | `npm run db:migrate` | `prisma migrate deploy` — apply pending migrations (production) |
| DB migrate (dev) | `npm run db:migrate:dev` | `prisma migrate dev` — create a new migration |
| DB seed | `npm run db:seed` | Run `prisma/seed.ts` |
| DB studio | `npm run db:studio` | Open Prisma Studio on port 5555 |
| DB backup | `npm run db:backup` | Run `scripts/backup.mjs` |
| Type-check | `npm run typecheck` | `tsc --noEmit` |
| Lint | `npm run lint` | `next lint` |
| Format | `npm run format` | `prettier --write .` |

---

## Security notes

- Set `APP_URL` to `https://…` in production. The session cookie is set with `Secure` only when the URL scheme is `https`.
- Generate `SESSION_SECRET` with `openssl rand -base64 48` and keep it secret.
- CSRF protection uses a double-submit cookie (`ory_csrf`). Mutation API routes require the `x-csrf-token` header to match the cookie. A 403 response usually means the token is missing or expired.
- Admin routes are excluded from search engine indexing via `X-Robots-Tag: noindex, nofollow`.
- If your site is behind a load balancer or CDN, set `TRUSTED_PROXY_HOPS` to the number of proxy hops so the correct client IP is used for rate limiting.
- Enable TOTP 2FA for the owner account immediately after deployment (studio → Settings → My account).

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model and hardening checklist.

---

## Troubleshooting

**`Error: Cannot find module 'sharp'` or images not optimised**
`sharp` requires a native module that may not compile on some shared hosts. Set `IMAGE_UNOPTIMIZED=true` to disable Next.js image optimisation and serve original files. On a VPS you can install a compatible Node.js and rebuild: `npm rebuild sharp`.

**Prisma provider mismatch (`The provider … does not match the provider in your schema`)**
Run `npm run db:provider` (or `node scripts/db-provider.mjs`) to rewrite the schema, then `npm run db:migrate` or `npm run db:push`.

**Session cookie not set / always redirected to `/admin/login`**
`APP_URL` must start with `https://` in production. On HTTP the cookie is not sent because it is marked `Secure`. For local dev, `http://localhost:3000` works.

**Uploads disappear after redeploy (Vercel)**
Vercel's filesystem is ephemeral. Set `MEDIA_STORAGE=s3` and configure the S3 variables.

**403 on form submissions or API calls**
The CSRF double-submit check failed. Make sure your client-side code reads the `ory_csrf` cookie and sends its value as the `x-csrf-token` request header. Browser extensions that modify cookies can also cause this.

**`SSLCOMMERZ_SANDBOX` set but still hitting live gateway**
The env var must be the string `"false"` (not `false`) to switch to live. Any other value, including unset, defaults to sandbox.

---

## Roadmap

- Wishlist persistence across devices (server-side, linked to phone)
- Back-in-stock SMS/WhatsApp notification
- Bundled courier label printing (Pathao, Steadfast)
- Product import/export via CSV
- Gift wrapping and message option at checkout
- Multi-location inventory

---

## License

Proprietary — see [LICENSE](LICENSE). Copyright (c) 2026 ORYNVE. All rights reserved.
