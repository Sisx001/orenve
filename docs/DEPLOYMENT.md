# Deployment guide

ORYNVE v2 is a single Next.js 15 application. `DEPLOY_TARGET` picks the build output:

| `DEPLOY_TARGET` | Output | Use for |
|---|---|---|
| `standalone` (default) | Self-contained `.next/standalone` bundle; `postbuild` copies `public/` and `.next/static` into it | Docker, Railway, PM2 on a VPS |
| `server` | Classic build served by `next start` (or `deploy/cpanel-server.js`) | cPanel / Passenger, shared hosts, simple VPS |
| `vercel` | Vercel-managed output | Vercel |

---

## Table of contents

1. [Vercel](#1-vercel)
2. [Railway](#2-railway)
3. [VPS — Ubuntu 22.04 / 24.04](#3-vps--ubuntu-2204--2404)
4. [Docker](#4-docker)
5. [cPanel shared hosting](#5-cpanel-shared-hosting)
6. [Any host — generic checklist](#6-any-host--generic-checklist)
7. [Post-deploy checklist](#7-post-deploy-checklist)

---

## 1. Vercel

Vercel's filesystem is ephemeral, so you must use a managed Postgres database and S3-compatible media storage.

### Prerequisites
- A Postgres database: [Neon](https://neon.tech), [Supabase](https://supabase.com), or Vercel Postgres (any will work).
- An S3-compatible bucket: Cloudflare R2 (recommended), AWS S3, or DigitalOcean Spaces.

### Steps

1. Import the repository into Vercel.

2. Set the following environment variables in the Vercel dashboard (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DEPLOY_TARGET` | `vercel` |
   | `APP_URL` | `https://yourdomain.com` |
   | `SESSION_SECRET` | 48-character random string |
   | `DATABASE_PROVIDER` | `postgresql` |
   | `DATABASE_URL` | Postgres connection string (with `?sslmode=require` for Neon/Supabase) |
   | `MEDIA_STORAGE` | `s3` |
   | `S3_ENDPOINT` | Your bucket endpoint (blank for AWS S3) |
   | `S3_REGION` | Bucket region (`auto` for R2) |
   | `S3_BUCKET` | Bucket name |
   | `S3_ACCESS_KEY_ID` | Access key |
   | `S3_SECRET_ACCESS_KEY` | Secret key |
   | `S3_PUBLIC_URL` | Public URL for objects, no trailing slash |
   | `SEED_ADMIN_EMAIL` | Your owner email |
   | `SEED_ADMIN_PASSWORD` | Strong password — change after first login |
   | `SEED_DEMO_DATA` | `false` for production |
   | Any payment / AI env vars | As needed |

3. Set the build command to `npm run build` (this is also the Vercel default for Next.js).

4. Add a `postinstall` script to run database migrations. Vercel runs `npm install` before each build, which triggers the `postinstall` hook (`node scripts/db-provider.mjs && prisma generate`). Add `prisma migrate deploy` to the build command instead:

   Build command: `prisma migrate deploy && npm run build`

   This runs migrations against your Postgres database before each production build. On the very first deploy, migrations create all tables; on subsequent deploys they apply only new migrations.

5. Deploy. Vercel detects Next.js automatically and sets `DEPLOY_TARGET=vercel` in the config if you set the variable; otherwise the output defaults to standalone (which works but is suboptimal on Vercel).

### Notes
- No cron job is needed. Database-backed rate limiting, session cleanup, and other scheduled tasks run lazily.
- The media API route `/api/media/[...path]` is not needed on Vercel because S3 objects are served directly from `S3_PUBLIC_URL`.
- Set `IMAGE_UNOPTIMIZED=false` (default) — Vercel provides image optimisation with sharp natively.

---

## 2. Railway

Railway can deploy via Dockerfile or Nixpacks. Using the provided Dockerfile is recommended because it gives a reproducible build with the correct Prisma binary.

### Steps

1. Create a new project in Railway. Add a **Postgres** plugin from the service menu — Railway sets `DATABASE_URL` automatically.

2. Connect your Git repository and select **Dockerfile** as the build method. Railway finds `Dockerfile` in the project root.

3. Set environment variables in Railway's service settings:

   | Variable | Value |
   |---|---|
   | `APP_URL` | `https://your-app.up.railway.app` |
   | `SESSION_SECRET` | 48-character random string |
   | `DATABASE_PROVIDER` | `postgresql` |
   | `DATABASE_URL` | Auto-set by the Postgres plugin |
   | `MEDIA_STORAGE` | `local` (mount a volume) or `s3` |
   | `SEED_ADMIN_EMAIL` | Your owner email |
   | `SEED_ADMIN_PASSWORD` | Strong password |
   | `SEED_DEMO_DATA` | `false` |
   | `PORT` | Railway sets `$PORT`; the Dockerfile reads it |

4. If using local media storage, add a volume in Railway mounted at `/app/public/uploads`. Alternatively set `UPLOAD_DIR=/data/uploads` and mount the volume at `/data`.

5. The Dockerfile entrypoint runs `prisma migrate deploy` (with fallback to `db push`) before starting the server. Tables are created on the first deploy.

6. Set the healthcheck path to `/api/health` in Railway's service settings (already in `railway.json`).

### Notes
- Railway automatically assigns a `PORT`. The standalone server (`node server.js`) reads `PORT` from the environment.
- For persistent SQLite, mount a volume at `/app/prisma/data` and set `DATABASE_URL=file:./data/orynve.db`.

---

## 3. VPS — Ubuntu 22.04 / 24.04

### 3.1 Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # should print v20.x.x
```

### 3.2 Install PM2 and Nginx

```bash
sudo npm install -g pm2
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3.3 Clone and build the app

```bash
cd /var/www
sudo git clone <repo-url> orynve
sudo chown -R $USER:$USER orynve
cd orynve
cp .env.example .env
# Edit .env with your values (nano .env)
npm ci
npm run build
```

### 3.4 Create the database and seed

```bash
npm run setup
```

### 3.5 Configure PM2

Copy `deploy/ecosystem.config.cjs` to the project root (it is already there) and start the app:

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable auto-start
```

The ecosystem file starts `start:standalone` (i.e. `node .next/standalone/server.js`) in fork mode. Edit the file to change `PORT`, `instances`, or add environment overrides.

### 3.6 Configure Nginx

Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/orynve` and adjust the `server_name` and paths:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/orynve
sudo nano /etc/nginx/sites-available/orynve   # edit server_name and root paths
sudo ln -s /etc/nginx/sites-available/orynve /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

The Nginx config:
- Proxies all requests to `127.0.0.1:3000`
- Serves `/uploads/` as static files with long-cache headers and supports HTTP Range (required for video streaming)
- Caches `/_next/static/` files (content-addressed)
- Sets `client_max_body_size 35m` to allow large media uploads (Next.js Server Action limit is 35 MB)
- Adds security headers

### 3.7 TLS with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot patches the Nginx config automatically and sets up auto-renewal.

### 3.8 Backups

Add a cron job to back up the database daily:

```bash
crontab -e
# Add:
0 2 * * * cd /var/www/orynve && /usr/bin/node scripts/backup.mjs >> /var/log/orynve-backup.log 2>&1
```

Backups are written to `/var/www/orynve/backups/`. The script keeps the 30 newest.

### 3.9 Deploying updates

```bash
cd /var/www/orynve
git pull
npm ci
npm run build
npm run db:migrate        # apply new migrations if any
pm2 restart orynve
```

---

## 4. Docker

Use `deploy/docker-compose.yml` which starts the app container and a Postgres 16 container.

### Steps

```bash
# 1. Copy and edit the env file
cp .env.example .env
# Set APP_URL, SESSION_SECRET, and any payment/AI vars.
# DATABASE_PROVIDER and DATABASE_URL are set in docker-compose.yml.

# 2. Build and start
docker compose -f deploy/docker-compose.yml up -d

# 3. Watch logs
docker compose -f deploy/docker-compose.yml logs -f app
```

The compose file:
- Mounts a named volume `pgdata` for the Postgres database
- Mounts a named volume `uploads` at `/app/public/uploads` for media files
- Exposes the app on port 3000 (change in the compose file)
- Runs a healthcheck against `/api/health`

On the first start, the entrypoint runs `prisma migrate deploy` which creates all tables.

### Build the image manually

```bash
docker build -t orynve:latest .
docker run -p 3000:3000 --env-file .env orynve:latest
```

---

## 5. cPanel shared hosting

cPanel hosts typically offer **Setup Node.js App** (Passenger-based). Node.js version must be 20.

### Prerequisites
- Node.js 20 available in cPanel's Node.js version selector
- A MySQL database created via cPanel (Database Wizard or MySQL Databases)
- Sufficient memory — at least 512 MB is recommended for the build step

### Steps

1. In cPanel → Setup Node.js App, create a new app:
   - **Node.js version**: 20.x
   - **Application mode**: Production
   - **Application root**: `/home/<user>/orynve` (or wherever you placed the project)
   - **Application startup file**: `deploy/cpanel-server.js`

2. Upload or clone the project files into the application root.

3. Set environment variables in the cPanel Node.js App interface or place them in `.env` in the application root:

   | Variable | Value |
   |---|---|
   | `APP_URL` | `https://yourdomain.com` |
   | `SESSION_SECRET` | 48-character random string |
   | `DATABASE_PROVIDER` | `mysql` |
   | `DATABASE_URL` | `mysql://user:pass@localhost:3306/dbname` |
   | `SEED_ADMIN_EMAIL` | Your owner email |
   | `SEED_ADMIN_PASSWORD` | Strong password |
   | `SEED_DEMO_DATA` | `false` |
   | `IMAGE_UNOPTIMIZED` | `true` (if `sharp` fails to install) |
   | `DEPLOY_TARGET` | `server` |

4. In the cPanel Node.js App interface, click **Run NPM Install**. This installs dependencies and triggers `postinstall` (`db-provider.mjs && prisma generate`).

5. Build the app. You may need to do this via SSH (most cPanel plans provide SSH access):

   ```bash
   cd ~/orynve
   DEPLOY_TARGET=server npm run build
   ```

   If the build runs out of memory, prefix with `NODE_OPTIONS=--max-old-space-size=512`. If the host blocks builds entirely, build on your laptop with the same Node major version and upload the `.next` folder together with the project.

6. Set up the database:

   ```bash
   npm run setup
   ```

7. In cPanel → Setup Node.js App, click **Restart** (or restart from the app interface).

### Startup file

`deploy/cpanel-server.js` is the Passenger entry point. It reads `PORT` from Passenger, loads `.env` if the host didn't inject variables, and starts Next.js programmatically (the same server `next start` uses, so CSS, images and uploads are all served). If that fails it tries the standalone bundle, then `npm start`.

### Notes
- Uploads are stored in `public/uploads/` within the app root. This directory is persistent on shared hosting.
- If `sharp` fails to compile (native bindings), set `IMAGE_UNOPTIMIZED=true`. Images will be served without resizing or WebP conversion.
- MySQL database credentials come from cPanel's MySQL Databases panel. The hostname is usually `localhost`.
- After deploying updates: re-run `npm run build` via SSH, then restart the Node.js app in cPanel.
- cPanel's Passenger may have memory limits. If the app crashes on startup, check the error log and reduce memory usage by setting `NODE_OPTIONS=--max-old-space-size=256`.

### Caveats
- Some cPanel plans restrict outbound internet connections (needed for SSLCommerz and Stripe). Check with your host.
- Node.js apps on Passenger do not support WebSocket upgrades on all hosts.
- The SQLite provider is not recommended on cPanel because many shared hosts do not preserve the file path across app restarts. MySQL is the correct choice.

---

## 6. Any host — generic checklist

- [ ] Node.js >= 20.9 installed
- [ ] `npm ci` run in the project directory
- [ ] `npm run build` completed with the right `DEPLOY_TARGET` (`standalone` for PM2/Docker, `server` for Passenger/`next start`)
- [ ] Database created and `npm run setup` or `npm run db:migrate` run
- [ ] `APP_URL` set to the public `https://` URL
- [ ] `SESSION_SECRET` set to a 32+ character random value
- [ ] A process manager (PM2, systemd, or Supervisor) configured to keep the app running and restart on crash
- [ ] A reverse proxy (Nginx, Apache, or the host's built-in proxy) forwarding port 80/443 to the Node.js port
- [ ] TLS certificate in place (Let's Encrypt or host-provided)
- [ ] Persistent storage for uploads (`public/uploads/` or a mounted volume), or `MEDIA_STORAGE=s3`
- [ ] Firewall: only ports 22, 80, and 443 open externally; Node.js port bound to `127.0.0.1`

---

## 7. Post-deploy checklist

After the first successful deployment, complete these steps in the studio (`/admin`):

- [ ] Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and change the password immediately
- [ ] Enable TOTP 2FA: Settings → My account → Two-factor authentication
- [ ] Settings → Brand: set brand name, logo, accent colour, and announcement text
- [ ] Settings → Contact: set WhatsApp number (E.164 without `+`, e.g. `8801XXXXXXXXX`), email, and address
- [ ] Settings → Checkout: set bKash and Nagad wallet numbers; configure which payment methods are active
- [ ] Settings → AI Concierge: configure provider and add Owner notes (or disable if not using)
- [ ] Settings → SEO: set site title, meta description, and OG image
- [ ] Add real product photos and publishing products (replace demo data or set `SEED_DEMO_DATA=false` before seeding on production)
- [ ] Settings → Site: add your business registration (DBID / trade licence) in the footer via Pages → Terms or brand settings
- [ ] Verify checkout end-to-end: place a test order for each enabled payment method
- [ ] Verify SSLCommerz sandbox with a test transaction before switching `SSLCOMMERZ_SANDBOX=false`
- [ ] Verify Stripe webhook by checking the webhook dashboard for a successful `checkout.session.completed` event
- [ ] Schedule database backups (`npm run db:backup` via cron or the studio Backup page)
