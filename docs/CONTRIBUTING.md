# Contributing

This document describes the development workflow and how to extend the platform.

---

## Development setup

```bash
git clone <repo-url> orynve-v2
cd orynve-v2
npm ci
cp .env.example .env
# Edit .env — the defaults work for local development with SQLite
npm run setup    # creates prisma/data/orynve.db and seeds demo data
npm run dev
```

The dev server starts at `http://localhost:3000`. The studio is at `http://localhost:3000/admin`.

### Useful dev commands

```bash
npm run typecheck       # TypeScript type check (no emit)
npm run lint            # ESLint via next lint
npm run format          # Prettier write
npm run db:studio       # Prisma Studio at localhost:5555
npm run db:migrate:dev  # Create a new migration after schema changes
```

---

## Code style

- **TypeScript**: strict mode; no `any` except in tightly bounded adapter code (e.g. AI provider response parsing).
- **Formatting**: Prettier with `prettier-plugin-tailwindcss`. Run `npm run format` before committing.
- **Linting**: ESLint via `eslint-config-next`. Fix all errors; warnings are tolerated only when the rule conflicts with a framework requirement.
- **Imports**: Use `@/` path alias for `src/`. Keep third-party imports at the top, internal imports below.
- **Server-only**: Any module that reads the database, env vars, or sensitive settings must start with `import "server-only"`. This causes a build error if the module is accidentally imported in a client component.
- **Money**: Prices are stored as integers in BDT paisa (minor units). Do not use floats for money. Use `formatMoney()` from `src/lib/money.ts` for display.
- **i18n content**: Multi-language content fields are stored as JSON: `{"en":"…","bn":"…"}`. Use `i18nText(field, locale)` from `src/lib/json.ts` to extract the correct language.
- **Zod**: Validate all external input (API request bodies, webhook payloads, form data) with Zod schemas before using the data.

---

## How to add a locale

1. **Add the message file**: copy `messages/en.json` to `messages/<code>.json` and translate all values. Do not translate JSON keys.

2. **Register the locale in constants**: edit `src/lib/constants.ts`:
   ```ts
   export const SUPPORTED_LOCALES = ["en", "bn", "<code>"] as const;
   ```

3. **Add locale metadata**: edit `src/lib/i18n/index.ts` and add an entry to the `localeMeta` map with the locale's display name and `dir` ("ltr" or "rtl").

4. **Translate content**: for bilingual content stored in the database (product names, page bodies, etc.), go to the studio → Translations and add per-key overrides, or update the seed data.

5. **Test**: visit `http://localhost:3000/<code>/` and verify the UI renders correctly.

---

## How to add a homepage block type

1. **Add the type to constants**: add the new type string to `BLOCK_TYPES` in `src/lib/constants.ts`.

2. **Define a data schema**: create or extend a Zod schema for the block's data structure. All text fields should be i18n: `z.record(z.string())` or `z.object({en: z.string(), bn: z.string()})`.

3. **Create the storefront component**: add a React component in `src/app/[locale]/_blocks/` that accepts `data` (the parsed JSON) and `locale`. The component renders on the storefront homepage.

4. **Register the renderer**: in `src/app/[locale]/page.tsx` (or wherever blocks are rendered), add a case for the new type that renders the new component.

5. **Create the studio editor**: add a form component in `src/app/admin/_blocks/` for editing the block's data in the studio. The form produces a JSON object matching the data schema.

6. **Register the editor**: add a case for the new type in the studio blocks editor switch.

---

## How to add a payment provider

1. **Create a provider file**: add `src/lib/payments/<name>.ts` implementing the `PaymentProvider` interface from `types.ts`:
   ```ts
   export interface PaymentProvider {
     method: PaymentMethod;
     isConfigured(): Promise<boolean>;
     init(order: OrderForPayment): Promise<PaymentInitResult>;
   }
   ```

2. **Register the provider**: add it to the `providers` map in `src/lib/payments/index.ts`.

3. **Add the method to constants**: add the method string to `PAYMENT_METHODS` in `src/lib/constants.ts` and the `PaymentMethod` union type.

4. **Update the schema**: add the method to `ORDER_STATUSES` / `PAYMENT_METHODS` validation in `prisma/schema.prisma` comments and relevant Zod schemas.

5. **Add a checkout toggle**: add a boolean field for the new method in `checkoutSchema` in `src/lib/settings.ts`.

6. **Handle webhooks if applicable**: create `src/app/api/payments/<name>/webhook/route.ts` following the pattern in `src/app/api/payments/stripe/webhook/route.ts`. Validate the provider's signature before trusting the payload.

7. **Add studio support**: add the method toggle to the checkout settings form in the studio.

---

## How to add a setting group

1. **Define a Zod schema**: add a new schema (e.g. `invoiceSchema`) in `src/lib/settings.ts` following the pattern of existing schemas.

2. **Register it**: add an entry to `SETTING_SCHEMAS`:
   ```ts
   export const SETTING_SCHEMAS = {
     // existing…
     invoice: invoiceSchema,
   } as const;
   ```

3. **Seed a default**: add a default entry in `prisma/seed.ts` in the `settings` object.

4. **Add a studio page**: create `src/app/admin/settings/invoice/page.tsx` with a form that reads the current value via `getSetting("invoice")` and saves via `saveSetting("invoice", formData)`.

5. **Add navigation**: add the new settings page to the studio sidebar nav.

---

## Database migrations

After changing `prisma/schema.prisma`:

```bash
# Development (creates a new migration file in prisma/migrations/)
npm run db:migrate:dev -- --name describe-the-change

# Production (applies pending migrations)
npm run db:migrate
```

Always run `npm run db:provider` (or the `predev`/`prebuild` hook) before generating or migrating, as it rewrites the `provider` line based on `DATABASE_PROVIDER`.

**Portability rules** (enforced throughout the schema):
- No Prisma `enum` types — use `String` columns validated by Zod constants
- No `Json` column type — use `String` holding JSON, parsed by helpers
- Money stored as `Int` in BDT paisa (minor units)

These rules ensure the schema works identically with SQLite, PostgreSQL, and MySQL.

---

## Testing

There is no automated test suite in this repository. Before merging significant changes:

1. Run `npm run typecheck` and fix all TypeScript errors.
2. Run `npm run lint` and fix all ESLint errors.
3. Test the changed flows manually in dev mode with SQLite.
4. Test the production build: `npm run build && npm run start:standalone`.
5. Test checkout end-to-end with each enabled payment method using sandbox/test credentials.

A ready-made GitHub Actions workflow lives at `deploy/github-ci.yml`. Copy it to `.github/workflows/ci.yml` to run typecheck, lint, and build automatically on every push (it is shipped under `deploy/` because the token used to publish the `v2` branch cannot write workflow files).
