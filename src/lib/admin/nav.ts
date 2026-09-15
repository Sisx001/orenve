/**
 * Studio navigation model. Plain data (no JSX) so it can be imported from both
 * server and client components; the sidebar maps `icon` keys to lucide icons.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission?: string;
  /** exact match only (otherwise a prefix match marks the item active) */
  exact?: boolean;
  children?: { href: string; label: string }[];
};

export type NavGroup = { title: string; items: NavItem[] };

export const SETTINGS_CHILDREN = [
  { href: "/admin/settings/brand", label: "Brand & theme" },
  { href: "/admin/settings/features", label: "Features" },
  { href: "/admin/settings/checkout", label: "Checkout & payments" },
  { href: "/admin/settings/currency", label: "Currencies & locales" },
  { href: "/admin/settings/seo", label: "SEO" },
  { href: "/admin/settings/site", label: "Site mode" },
  { href: "/admin/settings/contact", label: "Contact channels" },
  { href: "/admin/settings/ai", label: "AI concierge" },
  { href: "/admin/settings/translations", label: "Translations" },
];

export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "gauge", exact: true }],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "receipt", permission: "orders.write" },
      { href: "/admin/products", label: "Products", icon: "shirt", permission: "products.write" },
      { href: "/admin/inventory", label: "Inventory", icon: "boxes", permission: "products.write" },
      { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers.read" },
      { href: "/admin/coupons", label: "Coupons", icon: "ticket", permission: "products.write" },
      { href: "/admin/shipping", label: "Shipping", icon: "truck", permission: "settings.write" },
      { href: "/admin/catalog", label: "Collections & categories", icon: "layers", permission: "products.write" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: "layout-template", permission: "content.write" },
      { href: "/admin/pages", label: "Pages", icon: "file-text", permission: "content.write" },
      { href: "/admin/media", label: "Media", icon: "image", permission: "media.write" },
      { href: "/admin/reviews", label: "Reviews", icon: "star", permission: "content.write" },
      { href: "/admin/messages", label: "Messages", icon: "mail", permission: "customers.read" },
      { href: "/admin/concierge", label: "Concierge", icon: "bot", permission: "ai.configure" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings.write", children: SETTINGS_CHILDREN },
      { href: "/admin/users", label: "Users", icon: "shield", permission: "users.manage" },
      { href: "/admin/audit", label: "Audit log", icon: "scroll-text", permission: "audit.read" },
      { href: "/admin/backups", label: "Backups", icon: "database", permission: "backup.run" },
    ],
  },
];

/** Breadcrumb labels for the topbar, resolved longest-prefix-first. */
export const CRUMB_LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/orders": "Orders",
  "/admin/orders/new": "New manual order",
  "/admin/products": "Products",
  "/admin/products/new": "New product",
  "/admin/inventory": "Inventory",
  "/admin/customers": "Customers",
  "/admin/coupons": "Coupons",
  "/admin/shipping": "Shipping zones",
  "/admin/catalog": "Collections & categories",
  "/admin/homepage": "Homepage",
  "/admin/pages": "Pages",
  "/admin/media": "Media library",
  "/admin/reviews": "Reviews",
  "/admin/messages": "Messages",
  "/admin/concierge": "Concierge",
  "/admin/profile": "Your profile",
  "/admin/settings": "Settings",
  "/admin/settings/brand": "Brand & theme",
  "/admin/settings/features": "Features",
  "/admin/settings/checkout": "Checkout & payments",
  "/admin/settings/currency": "Currencies & locales",
  "/admin/settings/seo": "SEO",
  "/admin/settings/site": "Site mode",
  "/admin/settings/contact": "Contact channels",
  "/admin/settings/ai": "AI concierge",
  "/admin/settings/translations": "Translations",
  "/admin/users": "Users",
  "/admin/audit": "Audit log",
  "/admin/backups": "Backups",
};
