# ─── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc compatibility for Prisma and sharp binaries on Alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDeps needed for build)
RUN npm ci

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Rewrite prisma/schema.prisma to the correct provider and generate the client
ENV DATABASE_PROVIDER=postgresql
ENV DEPLOY_TARGET=standalone
ENV NEXT_TELEMETRY_DISABLED=1

RUN node scripts/db-provider.mjs && npx prisma generate
RUN npm run build

# ─── Stage 3: Runtime image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public assets (static brand files, etc.) — uploads are written to the volume
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema and scripts (needed at runtime for db-provider and migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Prisma client binaries (generated in builder)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI for runtime schema sync (same version as the generated client)
RUN npm install -g "prisma@$(node -p "require('/app/node_modules/@prisma/client/package.json').version")" \
    && npm cache clean --force

# Create the uploads directory (will be overridden by a volume mount in compose)
RUN mkdir -p /app/public/uploads /app/prisma/data && chown -R nextjs:nodejs /app/public/uploads /app/prisma

USER nextjs

EXPOSE 3000

# On startup: rewrite the prisma provider from the runtime DATABASE_PROVIDER,
# sync the schema (migrate deploy when a migrations folder exists, else db push),
# then start the standalone Next.js server.
CMD ["sh", "-c", "node scripts/db-provider.mjs && (prisma migrate deploy 2>/dev/null || prisma db push --skip-generate) && node server.js"]

VOLUME ["/app/public/uploads"]
