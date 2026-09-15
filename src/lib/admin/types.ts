/** Shapes shared between studio route handlers and client components. */

export type MediaRow = {
  id: string;
  url: string;
  name: string;
  alt: string | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string;
  createdAt: string;
};

export type MediaListResponse = {
  ok: true;
  items: MediaRow[];
  total: number;
  folders: string[];
};

export type VariantPick = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  stock: number;
  isActive: boolean;
};

export type ProductPick = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  variants: VariantPick[];
};

export type CustomerPick = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orders: number;
  address: {
    line1: string;
    line2: string;
    city: string;
    district: string;
    postalCode: string;
    country: string;
  } | null;
};
