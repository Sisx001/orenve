export const ROLES = ["owner", "admin", "editor", "support"] as const;
export type Role = (typeof ROLES)[number];

/** Which roles may do what. Owner can do everything. */
export const PERMISSIONS: Record<string, Role[]> = {
  "settings.write": ["owner", "admin"],
  "users.manage": ["owner"],
  "products.write": ["owner", "admin", "editor"],
  "content.write": ["owner", "admin", "editor"],
  "orders.write": ["owner", "admin", "support"],
  "payments.verify": ["owner", "admin"],
  "customers.read": ["owner", "admin", "support"],
  "media.write": ["owner", "admin", "editor"],
  "ai.configure": ["owner", "admin"],
  "audit.read": ["owner", "admin"],
  "backup.run": ["owner"],
};

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_CHANNELS = ["website", "whatsapp", "messenger", "manual"] as const;
/**
 * cod            — cash on delivery
 * bkash / nagad  — manual Send-Money + TrxID (verified in the studio)
 * bkash_checkout — bKash Tokenized Checkout API (redirect)
 * nagad_checkout — Nagad Payment Gateway API (redirect)
 * sslcommerz / aamarpay / shurjopay — Bangladeshi aggregators (redirect)
 * stripe         — international cards
 */
export const PAYMENT_METHODS = ["cod", "bkash", "nagad", "bkash_checkout", "nagad_checkout", "sslcommerz", "aamarpay", "shurjopay", "stripe", "none"] as const;
export const COURIER_PROVIDERS = ["pathao", "steadfast", "redx", "paperfly", "manual"] as const;
export type CourierProvider = (typeof COURIER_PROVIDERS)[number];
export const SHIPMENT_STATUSES = ["booked", "picked", "in_transit", "delivered", "returned", "cancelled", "failed"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["unpaid", "pending_verification", "paid", "failed", "refunded"] as const;
export const COUPON_TYPES = ["percent", "fixed", "free_shipping"] as const;
export const BLOCK_TYPES = [
  "hero",
  "featured",
  "editorial",
  "lookbook",
  "arrivals",
  "manifesto",
  "marquee",
  "video",
  "testimonials",
  "collections",
  "newsletter",
  "custom",
] as const;

export const SUPPORTED_LOCALES = ["en", "bn"] as const;
export const DEFAULT_LOCALE = "en";

export const BD_DISTRICTS = [
  "Dhaka","Gazipur","Narayanganj","Tangail","Kishoreganj","Manikganj","Munshiganj","Narsingdi","Faridpur","Gopalganj","Madaripur","Rajbari","Shariatpur",
  "Chattogram","Cox's Bazar","Cumilla","Brahmanbaria","Chandpur","Feni","Khagrachhari","Lakshmipur","Noakhali","Rangamati","Bandarban",
  "Rajshahi","Bogura","Joypurhat","Naogaon","Natore","Chapainawabganj","Pabna","Sirajganj",
  "Khulna","Bagerhat","Chuadanga","Jashore","Jhenaidah","Kushtia","Magura","Meherpur","Narail","Satkhira",
  "Barishal","Barguna","Bhola","Jhalokati","Patuakhali","Pirojpur",
  "Sylhet","Habiganj","Moulvibazar","Sunamganj",
  "Rangpur","Dinajpur","Gaibandha","Kurigram","Lalmonirhat","Nilphamari","Panchagarh","Thakurgaon",
  "Mymensingh","Jamalpur","Netrokona","Sherpur",
] as const;

export const COOKIE_SESSION = "ory_session";
export const COOKIE_CSRF = "ory_csrf";
export const COOKIE_LOCALE = "ory_locale";
export const COOKIE_THEME = "ory_theme";
export const COOKIE_CURRENCY = "ory_currency";
export const COOKIE_AI_SESSION = "ory_ai";

export const SESSION_TTL_DAYS = 14;
export const ADMIN_PATH = "/admin";
