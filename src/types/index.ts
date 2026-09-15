import type { I18nString } from "@/lib/json";

export type OptionValue = { value: string; hex?: string; label?: I18nString };

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  images: { url: string; alt: string; colorName: string | null }[];
  colors: OptionValue[];
  sizes: string[];
  inStock: boolean;
  totalStock: number;
  featured: boolean;
  category: string | null;
  tags: string[];
};

export type ProductDetail = ProductCard & {
  description: string;
  details: { material?: string; fit?: string; care?: string; shipping?: string; returns?: string };
  options: { name: string; values: OptionValue[] }[];
  variants: {
    id: string;
    sku: string | null;
    title: string;
    options: Record<string, string>;
    price: number;
    stock: number;
    lowStockAt: number;
    imageUrl: string | null;
  }[];
  video: string | null;
  sizeGuide: { unit: "cm" | "in"; labels: string[]; rows: string[][]; notes?: string } | null;
  reviews: { id: string; customerName: string; rating: number; title: string | null; body: string; createdAt: string }[];
  rating: { average: number; count: number };
  seoTitle: string;
  seoDescription: string;
  collections: { slug: string; name: string }[];
};

export type CartLine = {
  key: string; // variantId
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantTitle: string;
  options: Record<string, string>;
  unitPrice: number;
  quantity: number;
  image: string | null;
  maxStock: number;
};

export type ShippingAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  district: string;
  postalCode?: string;
  country: string;
};

export type PublicOrderView = {
  number: string;
  trackingCode: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  channel: string;
  placedAt: string;
  total: number;
  subtotal: number;
  shipping: number;
  codFee: number;
  discount: number;
  currency: string;
  customerName: string;
  phoneMasked: string;
  courier: string | null;
  courierTracking: string | null;
  courierUrl: string | null;
  items: { name: string; variantTitle: string | null; quantity: number; unitPrice: number; image: string | null }[];
  events: { type: string; title: string; message: string | null; createdAt: string }[];
};
