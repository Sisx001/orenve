"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { CartLine } from "@/types";

/**
 * Tiny persistent store (no extra dependency). Cart, wishlist and UI flags are
 * kept in localStorage and synced across tabs. Prices are re-validated on the
 * server at checkout, so nothing here is trusted.
 */
type State = {
  lines: CartLine[];
  wishlist: string[]; // product ids
  couponCode: string;
  cartOpen: boolean;
  searchOpen: boolean;
  quickView: string | null; // product slug
};

const KEY = "orynve.cart.v2";
const listeners = new Set<() => void>();
let state: State = { lines: [], wishlist: [], couponCode: "", cartOpen: false, searchOpen: false, quickView: null };
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved) state = { ...state, lines: saved.lines ?? [], wishlist: saved.wishlist ?? [], couponCode: saved.couponCode ?? "" };
  } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        const saved = JSON.parse(e.newValue);
        state = { ...state, lines: saved.lines ?? [], wishlist: saved.wishlist ?? [], couponCode: saved.couponCode ?? "" };
        emit();
      } catch {}
    }
  });
}

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    localStorage.setItem(KEY, JSON.stringify({ lines: state.lines, wishlist: state.wishlist, couponCode: state.couponCode }));
  } catch {}
  emit();
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => state;
const serverSnapshot: State = { lines: [], wishlist: [], couponCode: "", cartOpen: false, searchOpen: false, quickView: null };
const getServerSnapshot = () => serverSnapshot;

export const cartStore = {
  set,
  add(line: Omit<CartLine, "key">, quantity = 1) {
    set((s) => {
      const existing = s.lines.find((l) => l.variantId === line.variantId);
      const nextQty = Math.min((existing?.quantity ?? 0) + quantity, line.maxStock, 20);
      if (existing) return { lines: s.lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity: nextQty, maxStock: line.maxStock } : l)), cartOpen: true };
      return { lines: [...s.lines, { ...line, key: line.variantId, quantity: nextQty }], cartOpen: true };
    });
  },
  update(variantId: string, quantity: number) {
    set((s) => ({ lines: quantity <= 0 ? s.lines.filter((l) => l.variantId !== variantId) : s.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, l.maxStock, 20) } : l)) }));
  },
  remove(variantId: string) {
    set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) }));
  },
  clear() {
    set({ lines: [], couponCode: "" });
  },
  toggleWish(productId: string) {
    set((s) => ({ wishlist: s.wishlist.includes(productId) ? s.wishlist.filter((x) => x !== productId) : [...s.wishlist, productId] }));
  },
  setCoupon(code: string) {
    set({ couponCode: code });
  },
  openCart(open = true) {
    set({ cartOpen: open });
  },
  openSearch(open = true) {
    set({ searchOpen: open });
  },
  setQuickView(slug: string | null) {
    set({ quickView: slug });
  },
};

export function useCart() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = s.lines.reduce((a, l) => a + l.quantity, 0);
  const subtotal = s.lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const isWished = useCallback((id: string) => s.wishlist.includes(id), [s.wishlist]);
  return { ...s, count, subtotal, isWished, ...cartStore };
}
