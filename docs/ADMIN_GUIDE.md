# Admin (studio) guide

The studio lives at `/admin` (login at `/admin/login`). It is excluded from search engine indexing. All actions are protected by RBAC — the role granted to your account determines which sections you can access.

## Roles

| Role | What they can do |
|---|---|
| `owner` | Everything, including user management, backups, and all settings |
| `admin` | Everything except user management |
| `editor` | Products, content (pages, blocks), media |
| `support` | Orders (read + write), customers (read), payment verification |

---

## Dashboard

The dashboard shows pending orders, low-stock variants, and recent activity. Click any card to navigate to the relevant section.

---

## Products

### Adding a product

1. Studio → Products → New product.
2. Fill in the product name in both English and Bangla.
3. Set the status to **Draft** while working, **Published** when ready to appear on the storefront.
4. Set a price (in BDT). Optionally set a compare-at price (shown as strikethrough) and a cost price (for margin tracking only; never shown to customers).
5. Assign a category and optionally link to one or more collections.
6. Write a description (Markdown is supported) in both languages. Fill in the Details tabs: Material, Fit, Care, Shipping, Returns — these appear in the product detail accordion.
7. Add a size guide (JSON object with `unit`, `labels`, `rows`, `notes`).

### Adding product options and variants

1. Under **Options**, add your option groups. Typical options: **Size** (values: S, M, L, XL, XXL) and **Color** (values with hex codes: `{"value":"Sand","hex":"#b09a82"}`).
2. Click **Generate variants** to create all size × colour combinations automatically.
3. Set the stock count for each variant. Mark variants as inactive if not being offered.
4. Optionally set a per-variant SKU and override price.

### Uploading product photos

1. In the product editor, go to the **Images** tab.
2. Upload images (JPEG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM; max 30 MB per file).
3. Drag to reorder — the first image is the gallery cover.
4. Optionally link an image to a colour option value so the gallery switches when a customer selects that colour.
5. Images are processed by sharp (converted to WebP, max 2600 px wide) when sharp is available. If not, the original is stored.

### Collections

Collections group products across categories (e.g. "Eid Edit", "Collection 001"). Studio → Collections → New collection. Add products to a collection from the product editor or the collection editor.

---

## Orders

### Order pipeline

Orders move through these statuses: **pending → confirmed → processing → shipped → delivered**. Cancelled and refunded are terminal states.

To change status: open an order → Status dropdown → select new status → Save. Each status change creates a public order event visible to the customer on the tracking page and to the AI concierge.

### Manual order entry (WhatsApp / Messenger / phone)

For orders taken outside the website:

1. Studio → Orders → New order.
2. Select channel: `whatsapp`, `messenger`, or `manual`.
3. Enter customer name, phone, and shipping address.
4. Add items by searching the catalogue.
5. Set the payment method (`cod`, `bkash`, `nagad`, etc.) and initial payment status.
6. Save. The order is assigned an order number (`ORY-YYYY-NNNNNN`) and a tracking code.
7. Share the tracking code with the customer so they can check progress on `/{locale}/track` or `/{locale}/order/{trackingCode}`.

### Adding tracking events

Tracking events are the public timeline shown on the order tracking page and sent to the AI concierge. To add an event:

1. Open the order.
2. Scroll to **Order events** → Add event.
3. Select the event type: `status`, `payment`, `shipping`, `note`, `message`, or `system`.
4. Write the title and optional message in both languages.
5. Toggle **Public** — public events are visible to the customer and the AI; private events (e.g. internal notes) are staff-only.
6. Save.

When the order is handed to a courier, add a shipping event and fill in the Courier name, courier tracking number, and tracking URL. These appear on the customer's tracking page.

### Verifying a bKash or Nagad TrxID

1. Open the order.
2. Go to the **Payments** tab.
3. Find the pending payment and click **Verify**.
4. The staff member enters the TrxID the customer provided and the sender wallet number.
5. After manual verification (compare against the bKash/Nagad Business account or agent app), click **Mark as paid**.
6. This records the verifier's name and timestamp in the audit log and updates the order payment status to `paid`. A payment event is added to the public timeline.

---

## Customers

Studio → Customers. Shows a list of all customers with their order count and total spend. Click a customer to see their order history, addresses, and notes. Tags can be added for segmentation.

---

## Coupons

Studio → Coupons → New coupon.

| Field | Notes |
|---|---|
| Code | Uppercase alphanumeric, e.g. `WELCOME10` |
| Type | `percent` (e.g. 10%), `fixed` (amount in BDT), or `free_shipping` |
| Value | Percentage (0–100) or BDT amount |
| Minimum subtotal | Minimum order value to apply the coupon |
| Maximum uses | Leave blank for unlimited |
| Per-customer limit | Maximum times one customer can use this code |
| Start / end date | Optional validity window |

---

## Shipping zones

Studio → Shipping. Zones are matched by district. Use `["*"]` in the districts field to create a catch-all zone (applied when no other zone matches).

Fields: Name (bilingual), districts (JSON array of district names), rate (BDT paisa — e.g. `8000` = ৳80), free above (BDT paisa threshold for free shipping), estimated delivery days (min/max).

---

## Pages

Studio → Pages. The following pages are created by the seed script: about, shipping, returns, size-guide, faq, privacy, terms.

To edit a page: click the page, edit the title and body (Markdown) in both languages, toggle Published. The **Show in footer** checkbox controls whether the page appears in the site footer navigation.

To add a new page: New page → set a slug (used as the URL `/en/{slug}`), title, and body.

---

## Homepage blocks

Studio → Homepage → Blocks. Blocks are rendered in order by their position. Each block type has its own data schema:

| Type | Purpose |
|---|---|
| `hero` | Full-screen hero with images/video, headline, and CTAs |
| `marquee` | Scrolling text banner |
| `featured` | Grid of featured products |
| `editorial` | Large image + text panel |
| `collections` | Collection cards |
| `lookbook` | Campaign frames linked to products |
| `arrivals` | Newest products grid |
| `testimonials` | Customer quotes |
| `manifesto` | Brand statement with CTA |
| `newsletter` | Email subscribe form |
| `video` | Full-width video section |
| `custom` | Raw HTML block (owner only) |

To reorder blocks, drag the grip handle. To edit a block, click it and update the JSON data field. All text fields support i18n: `{"en":"…","bn":"…"}`.

---

## Media library

Studio → Media. Browse and manage uploaded files by folder. Supported types: JPEG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM (max 30 MB).

Upload directly from the media library or from within a product or block editor. Images can be organised into folders.

---

## Branding and theme

Studio → Settings → Brand.

- Brand name, tagline (bilingual), logo (upload an SVG or raster)
- Accent colour (hex) and brass accent colour
- Display font (default: Fraunces), sans font (default: Space Grotesk), Bangla font (default: Hind Siliguri)
- Theme: light / dark / system
- Border radius
- Announcement bar text, link, and toggle

---

## Feature toggles

Studio → Settings → Features. Each feature can be toggled without a code deployment:

- Cart, wishlist, search, quick-view, size guide, product video, stock badges, back-in-stock notify, reviews
- Language switcher, currency switcher, dark mode toggle
- AI concierge, order tracking, coupons
- Newsletter, social proof
- Animations, custom cursor, brand intro, PWA

---

## Checkout settings

Studio → Settings → Checkout.

- Enable/disable website checkout, WhatsApp, and Messenger order channels
- Enable/disable each payment method: COD, bKash, Nagad, SSLCommerz, Stripe
- Set bKash and Nagad wallet numbers and MFS instructions (bilingual)
- Configure the WhatsApp order message template
- Minimum order value, guest checkout, notes field, auto-confirm COD

---

## Currencies

Studio → Settings → Currency. The base currency is always BDT. Enable or disable display currencies (USD, EUR, GBP, INR) and set exchange rates. Displayed prices are converted client-side; the order is always stored in BDT.

---

## Translations

Studio → Translations. Per-key overrides for the UI string files (`messages/en.json`, `messages/bn.json`). Changes here take effect without a redeploy because they are loaded from the database at runtime.

---

## AI concierge settings

Studio → Settings → AI Concierge.

| Field | Notes |
|---|---|
| Enabled | Master on/off switch |
| Base URL | OpenAI-compatible endpoint, e.g. `https://api.deepseek.com/v1` |
| API key | Stored in the database (never sent to the client) |
| Model | e.g. `deepseek-chat`, `gpt-4o-mini`, `llama3.2` |
| Temperature | 0 (most deterministic) to 1 (most creative). Default 0.2 |
| Max tokens | Maximum tokens per response. Default 600 |
| Assistant name | Bilingual name shown in the chat widget |
| Greeting | First message shown to the customer |
| Owner notes | Extra instructions appended to the system prompt (brand facts, policies, tone) |
| Allow order lookup | Toggle the `lookup_order` tool on/off |
| Allow product search | Toggle the `search_products` tool on/off |
| Require phone for order lookup | Always recommended: `true` |
| Max messages per session | Hard limit before the customer is directed to WhatsApp |
| Rate limit (per hour) | Max AI requests per IP per hour |
| Log conversations | Store chat history in the database for review |
| WhatsApp handoff | Show a "Talk to us on WhatsApp" link when the concierge cannot help |

Click **Test connection** to verify the provider is reachable.

---

## Users and roles

Studio → Settings → Users (owner only).

- Invite a new staff member by email — they receive an email with a temporary password.
- Change a user's role or deactivate their account.
- View active sessions for any user.
- Reset TOTP 2FA for a user who has lost their authenticator.

### Two-factor authentication

Each user can enable TOTP 2FA under Settings → My account. Scan the QR code with an authenticator app (Google Authenticator, Aegis, etc.). Store the backup codes in a safe place.

---

## Audit log

Studio → Audit log (owner/admin only). Records every significant action: logins, order status changes, payment verifications, settings changes, user management. Includes actor, timestamp, IP address, and the entity affected.

---

## Backups

Studio → Backups (owner only). Click **Run backup** to trigger `scripts/backup.mjs`. Backups are stored in `backups/` in the project root. The page lists recent backups with timestamps and file sizes.

The script keeps the 30 newest backups and deletes older ones. Schedule automatic backups via cron — see [DEPLOYMENT.md](DEPLOYMENT.md).

To restore a SQLite backup, stop the app, replace `prisma/data/orynve.db` with the backup file, and restart. For PostgreSQL, use `psql < backup.sql` or your provider's restore interface.
