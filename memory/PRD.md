# ORYNVE — Product Requirements & Handover

## Original request
"Build a landing page: Create a complete, production-ready, premium fashion e-commerce website for the clothing brand **ORYNVE**."

The original brief describes an entire digital fashion brand: cinematic first-visit wordmark, editorial hero, restrained site-wide motion, custom cursor, responsive navigation/mega menu, modular homepage, curated products and collections, search/filter/sort/views, high-resolution product galleries/zoom/lightbox/video, size guides/variant availability, wishlist/quick view/cart, product and bag-level WhatsApp message preparation, configurable contact channels, public pages/policies, hidden protected owner CMS, persistent media manager, branding/navigation/footer management, Draft → Preview → Publish, revisions/revert, feature controls, maintenance/coming-soon modes, responsive/accessibility/error states, SEO controls, and real connected functionality rather than a visual mockup. No customer accounts or traditional checkout.

Additional explicit direction: Awwwards-level craft; bold cohesive art direction; kinetic masked hero; real photography; numbered manifesto chapters; one slow marquee; framer-motion + Lenis; parallax hero; prioritize purposeful motion and wow-factor.

## Explicit user choices
- Menswear.
- BDT as base currency, with multi-currency display.
- Owner will add business WhatsApp number later in the admin.
- Generate secure initial owner credentials.
- Create ORYNVE text wordmark and select premium fashion photography.

## Implementation / architecture
- React 19 storefront, React Router, Framer Motion 11, Lenis 1.3.26, Shadcn/Radix dialogs, Sonner.
- FastAPI backend on supervisor-managed port 8001. MongoDB exclusively uses original MONGO_URL / DB_NAME.
- Frontend API origin exclusively from REACT_APP_BACKEND_URL.
- Lazy-loaded owner studio at `/admin`; not linked from public customer navigation. No customer registration/accounts.
- MongoDB `sites` document holds complete `draft` and `published` snapshots. Version checks prevent stale overwrites; publish snapshots the preceding public version to `revisions`. Preview tokens reference frozen draft snapshots, hashed in DB, expire after two hours.
- Public store filters out unpublished products, collections, pages. Maintenance prevents ordering; owner studio remains available; authorized preview bypasses maintenance.
- `users`, `sessions`, `login_attempts`, `previews`, `revisions`, `inquiries`, `contacts`, `subscribers`, `media`, `rate_events` collections.
- Auth: bcrypt, signed access/refresh JWT cookies, 15-minute/7-day expiry, DB sessions, rotating refresh, logout revocation, 5-failure login lockout. Idempotent owner seed from environment. No secrets in frontend.
- Origin security: finite allowlist of FRONTEND_URL and TRUSTED_PROXY_ORIGIN, both backend env. Proxy rewrites legitimate public Origin to configured internal origin; evil/missing origins are rejected. Never trust arbitrary forwarded headers. See `/app/auth_testing.md`.
- Uploads: verified persistent object storage proxy, canonical storage paths in MongoDB, JPEG/PNG/WebP/MP4/WebM validation, 30 MB limit, image decoding, no local upload storage. Assets served via `/api/media/{id}`. Metadata updates, folders, focal point/alt text; soft deletion, reference protection.
- WhatsApp: server revalidates published product/size/color/quantity and computes prices from catalog, not client input. Aggregated size inventory checked. Persisted inquiry with `prepared` status; encoded wa.me link only if number configured. Messages are never silently sent; purchase confirmation happens with the team.
- Currency display is admin-maintained indicative conversion from BDT, not a live exchange-rate feed. BDT remains enabled at rate 1.
- Shopping bag, wishlist, recent searches, currency locally persisted. Newsletter/contact records persisted server-side and viewable/exportable from studio.

## Visual system
- "Quiet rebellion": warm off-white, deep olive/charcoal, restrained rust accent, high-contrast studio portraits, large Manrope typography and italic Cormorant Garamond.
- First-session short wordmark intro with skip and reduced-motion bypass. Masked hero lines, gradual parallax, cursor labels, image hover swaps/zoom, numbered chapters, one slow editorial marquee, subtle reveals.
- Mobile-specific navigation, two-column catalog, touch gallery scroll-snap, lightbox zoom/pinch/drag, purchase actions, responsive admin sidebar. Verified no horizontal overflow on main desktop/tablet/mobile routes.
- Styling in App.css + refinements.css; owner studio styles separately scoped in pages/admin.

## Implemented features
### Storefront
- Homepage editable hero/CTAs/media/focal point/overlay, selected products, editorial story, shoppable lookbook, new arrivals, manifesto, newsletter, footer.
- Six initial photographed menswear pieces and three populated collections, editable pricing/content/variants/stock/media/details/SEO.
- Shop categories, collection/size/color/price/stock filtering, sort, grid/list/editorial layouts, wishlist-only filter.
- Search product/category/collection metadata, previews, suggested and recent searches, keyboard navigation, empty state.
- Product detail: high-resolution source gallery, mouse-follow lens, fullscreen image viewer, zoom controls, drag/double-tap/pinch, mobile swipe, optional product video. XS–XXL stock selector, low-stock state, cm/in size guide, material/fit/care/shipping/returns.
- Quick view, image swaps, wishlist, cart persistence, quantities/removal/subtotals, product/bag ordering, notes, optional shipping fields, reference ID, copy summary, contact fallback.
- Collections, About, Lookbook, Contact, FAQ, Shipping, Returns, Size Guide, Privacy, Terms and owner-created pages.
- Structured Product JSON-LD, editable page metadata, canonical URLs, static initial social metadata, favicon, `/api/sitemap.xml`, `/api/robots.txt`, public `/robots.txt`.

### Owner studio
- Dashboard counts/status/inventory notices, products create/edit/duplicate/draft/publish/archive/delete, collection assignment/reordering, editable pages/policies.
- Visual recursive form editors (not JSON-only) for hero, section enable/reorder/duplicate/delete, navigation, footer groups, branding, SEO, contact, checkout, currencies, feature switches, site mode, coming-soon content/countdown.
- Media library upload/preview/metadata/folder/filter/copy/delete and image-field library picker.
- Explicit save-draft indicator and publish confirmation; frozen preview links, individual-page preview, desktop/tablet/mobile widths, live/draft comparison, revision restore to draft, discard draft.
- Iframe readiness handshake plus loading/retry/new-tab recovery, instead of unexplained blank preview frames.
- Inquiry status changes, contact records, subscribers, CSV exports with formula injection protection.

## Initial content / configuration status
- Site is LIVE with original "Quiet\nrebellion." headline, 6 pieces, 3 collections. Draft and published content match after test restoration.
- WhatsApp number intentionally EMPTY. Number must be configured in Owner Studio → Contact channels and published before conversation redirection is possible. Order summaries/copy/contact form already work.
- Contact email/phone/social accounts and live chat provider are configurable but initially unset. No chat service is impersonated.
- Newsletter and contact forms SAVE submissions; outbound email delivery/campaign automation is not connected. Owner can view/export or use email reply links for contact submissions.
- Product imagery is curated stock photography; initial materials, stock, prices, fit charts and policies must be reviewed against the owner's real catalog before taking real orders.
- Credentials: `/app/memory/test_credentials.md`; owner email `owner@orynve.com`. Do not copy passwords into public files.

## Testing and fixes
- Initial report iteration_1 exposed ingress Origin rewrite and wishlist image hit-target issues. Fixed explicit trusted proxy origin, verified wrong/missing origins stay forbidden; isolated wishlist layering.
- Dev visual-edit Babel recursion fixed in Fields.jsx by using createElement for the recursive ObjectEditor boundary. Both dev and optimized builds work.
- Iteration_2: 20/20 backend regression tests passed; browser owner login/CMS/product/catalog/media/preview/cart/contact/newsletter flows exercised. Temporary snapshots restored after tests.
- Final production bundle compiles; latest full regression 20/20 passed (`test_reports/final-build.log`, `test_reports/final-regression.log`).
- Final browser checks verified real owner login, draft readiness loading removal, visible live/draft comparison, mobile-width preview, wishlist click, product size/add, order preparation, and contact fallback dismissing all overlays.
- Unique IDs and clean collection/page slugs now validated on draft save, preventing duplicate catalog keys. Renaming collection slugs preserves product assignment in studio.
- Stock validation aggregates same-size quantities across colors. Currency and prices authoritative server-side.
- Screenshots: `/app/home-final-framing.jpg`, `/app/admin-dashboard-verified.jpg`, `/app/preview-comparison-final.jpg`, `/app/contact-handoff-final.jpg`; earlier screenshots under test_reports/artifacts.

## Prioritized remaining work
### P0 — Owner launch setup
1. Add actual WhatsApp number and contact email/socials; save draft, preview, publish.
2. Replace/review initial product descriptions, prices, inventory, measurement charts and campaign photography against real ORYNVE inventory.
3. Confirm shipping/returns/privacy/terms, support address/hours and indicative currency rates.
### P1 — Broader original-brief extensions (not exposed as fake working controls)
- Dedicated 360° product media, verified customer reviews, publish scheduling.
- Full media cropping/replacement UI and per-color/per-size inventory matrix (current stock is shared per size).
- More advanced font/logo-file/button/spacing controls and freeform homepage section layouts beyond the supported five editorial section types.
- Server-rendered page-specific social cards/metadata for non-JavaScript crawlers; current SPA metadata updates client-side and initial social tags are static.
- Dedicated provider integration for real embedded live chat / outbound email, if owner chooses one. Current chat link is a configurable external provider URL.
- Shared-element page transitions and richer horizontal storytelling can be developed further; current transitions/reveals/parallax are working.
- CMS compare is visual side-by-side, not a semantic content diff. Revisions captured on publish rather than every field change.
### P2 — Scale and insight
- Normalize large catalogs out of whole-store snapshots, cursor-pagination/server search, automated responsive derivatives/CDN cache invalidation, storage video Range streaming, richer inquiry analytics.
- Additional media/variant accessibility audits and broader real-device testing.

## Next action
Handover secure owner access. Guide owner to Contact channels → WhatsApp, review actual catalog, preview, then publish. Recommend original ORYNVE campaign imagery as the most valuable brand-distinction enhancement.