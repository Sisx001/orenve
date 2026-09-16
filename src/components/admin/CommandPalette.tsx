"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Boxes,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  Loader2,
  Mail,
  Plus,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Shield,
  Shirt,
  Star,
  Sun,
  Ticket,
  Truck,
  Users,
} from "lucide-react";
import { NAV, type NavItem } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

// ─────────────────────── icon map (matches AdminShell) ────────────────────────
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge, receipt: Receipt, shirt: Shirt, boxes: Boxes, users: Users,
  ticket: Ticket, truck: Truck, layers: Layers, "layout-template": LayoutTemplate,
  "file-text": FileText, image: ImageIcon, star: Star, mail: Mail, bot: Bot,
  settings: Settings, shield: Shield, "scroll-text": ScrollText, database: Database,
};

// ─────────────────────── fuzzy match ─────────────────────────────────────────
function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─────────────────────── types ────────────────────────────────────────────────
type QuickAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
};

type LiveResult = {
  type: "order" | "product" | "customer";
  id: string;
  label: string;
  meta: string;
  href: string;
};

type RecentItem = { id: string; label: string; href: string; ts: number };

const RECENT_KEY = "studio_cmd_recent";
const MAX_RECENT = 8;

function loadRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

function saveRecent(item: RecentItem) {
  try {
    const items = loadRecent().filter((r) => r.href !== item.href);
    items.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // silently ignore
  }
}

// ─────────────────────── props ────────────────────────────────────────────────
export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  permissions: Record<string, boolean>;
  onToggleTheme: () => void;
}

// ─────────────────────── component ────────────────────────────────────────────
export function CommandPalette({ open, onClose, permissions, onToggleTheme }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  // Load recent on open
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQuery("");
      setSelectedIdx(0);
      setLiveResults([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setLiveResults([]);
      return;
    }
    setLiveLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json() as {
          ok: boolean;
          orders: { id: string; number: string; customerName: string; status: string }[];
          products: { id: string; name: string; slug: string; status: string }[];
          customers: { id: string; name: string; email: string | null; phone: string | null }[];
        };
        const results: LiveResult[] = [
          ...data.orders.map((o) => ({
            type: "order" as const,
            id: o.id,
            label: o.number,
            meta: o.customerName,
            href: `/admin/orders/${o.id}`,
          })),
          ...data.products.map((p) => ({
            type: "product" as const,
            id: p.id,
            label: p.name,
            meta: p.status,
            href: `/admin/products/${p.id}`,
          })),
          ...data.customers.map((c) => ({
            type: "customer" as const,
            id: c.id,
            label: c.name,
            meta: c.email ?? c.phone ?? "",
            href: `/admin/customers/${c.id}`,
          })),
        ];
        setLiveResults(results);
      } catch {
        setLiveResults([]);
      } finally {
        setLiveLoading(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Quick actions (always shown, filtered by query)
  const quickActions = useMemo<QuickAction[]>(
    () => [
      { id: "new-product", label: "New product", icon: Plus, href: "/admin/products/new" },
      { id: "new-order", label: "New manual order", icon: Receipt, href: "/admin/orders/new" },
      { id: "new-page", label: "New page", icon: FileText, href: "/admin/pages/new" },
      { id: "storefront", label: "Open storefront", icon: ExternalLink, href: "/en" },
      { id: "toggle-theme", label: "Toggle studio theme (light / dark)", icon: Sun, action: () => { onToggleTheme(); onClose(); } },
    ],
    [onToggleTheme, onClose],
  );

  // Flat nav items for search (all, not filtered by permission)
  const navItems = useMemo(() => {
    const items: Array<{ item: NavItem; group: string; isChild?: boolean }> = [];
    for (const group of NAV) {
      for (const item of group.items) {
        items.push({ item, group: group.title });
        if (item.children) {
          for (const child of item.children) {
            items.push({
              item: { href: child.href, label: child.label, icon: "settings" },
              group: "Settings",
              isChild: true,
            });
          }
        }
      }
    }
    return items;
  }, []);

  // Build the flat list of items we'll display
  type Section = {
    title: string;
    items: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      href?: string;
      action?: () => void;
      locked?: boolean;
      meta?: string;
    }>;
  };

  const sections = useMemo<Section[]>(() => {
    const permitted = (p?: string) => (p ? permissions[p] === true : true);
    const q = query.trim();

    if (!q) {
      // No query: show recent + quick actions
      const out: Section[] = [];
      if (recent.length > 0) {
        out.push({
          title: "Recent",
          items: recent.slice(0, 5).map((r) => ({
            id: `recent-${r.href}`,
            label: r.label,
            icon: Clock,
            href: r.href,
          })),
        });
      }
      out.push({
        title: "Quick actions",
        items: quickActions.map((a) => ({ id: a.id, label: a.label, icon: a.icon, href: a.href, action: a.action })),
      });
      return out;
    }

    // With query: filter nav + quick actions + live results
    const filteredNav = navItems.filter(({ item }) => fuzzyMatch(q, item.label));
    const filteredActions = quickActions.filter((a) => fuzzyMatch(q, a.label));

    const out: Section[] = [];

    if (filteredNav.length > 0) {
      out.push({
        title: "Navigation",
        items: filteredNav.slice(0, 8).map(({ item }) => {
          const Icon = ICONS[item.icon] ?? Gauge;
          const locked = item.permission ? !permitted(item.permission) : false;
          return {
            id: `nav-${item.href}`,
            label: item.label,
            icon: locked ? Lock : Icon,
            href: locked ? undefined : item.href,
            locked,
          };
        }),
      });
    }

    if (filteredActions.length > 0) {
      out.push({
        title: "Actions",
        items: filteredActions.map((a) => ({ id: a.id, label: a.label, icon: a.icon, href: a.href, action: a.action })),
      });
    }

    if (liveResults.length > 0) {
      const liveIcon = (type: LiveResult["type"]) =>
        type === "order" ? Receipt : type === "product" ? Shirt : Users;
      out.push({
        title: "Results",
        items: liveResults.map((r) => ({
          id: `live-${r.type}-${r.id}`,
          label: r.label,
          icon: liveIcon(r.type),
          href: r.href,
          meta: r.meta,
        })),
      });
    }

    return out;
  }, [query, navItems, quickActions, liveResults, recent, permissions]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Clamp selectedIdx
  useEffect(() => {
    setSelectedIdx((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[selectedIdx];
        if (!item || item.locked) return;
        if (item.action) { item.action(); return; }
        if (item.href) {
          const recentItem: RecentItem = { id: item.id, label: item.label, href: item.href, ts: Date.now() };
          saveRecent(recentItem);
          setRecent(loadRecent());
          if (item.href.startsWith("/en") || item.href.startsWith("http")) {
            window.open(item.href, "_blank");
          } else {
            router.push(item.href);
          }
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatItems, selectedIdx, router, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Reset index on query change
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Count flat index per section for proper idx assignment
  let flatIdx = 0;

  const handleItemClick = useCallback(
    (item: Section["items"][number]) => {
      if (item.locked) return;
      if (item.action) { item.action(); return; }
      if (item.href) {
        const recentItem: RecentItem = { id: item.id, label: item.label, href: item.href, ts: Date.now() };
        saveRecent(recentItem);
        setRecent(loadRecent());
        if (item.href.startsWith("/en") || item.href.startsWith("http")) {
          window.open(item.href, "_blank");
        } else {
          router.push(item.href);
        }
        onClose();
      }
    },
    [router, onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            className="cmdk-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input row */}
            <div className="cmdk-input-row">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="Search pages, products, orders…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-autocomplete="list"
                spellCheck={false}
              />
              {liveLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />}
              <span className="kbd">Esc</span>
            </div>

            {/* Results */}
            <div className="cmdk-results" ref={listRef}>
              {flatItems.length === 0 && !liveLoading && (
                <div className="cmdk-empty">
                  {query.length >= 2 ? "No results found." : "Type to search or pick a quick action."}
                </div>
              )}

              {sections.map((section) => (
                <div key={section.title} className="cmdk-group">
                  <p className="cmdk-group-label">{section.title}</p>
                  {section.items.map((item) => {
                    const idx = flatIdx++;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        data-idx={idx}
                        className={cn("cmdk-item", item.locked && "cmdk-item--locked")}
                        aria-selected={selectedIdx === idx}
                        title={item.locked ? "Ask the owner to enable this" : undefined}
                        onMouseEnter={() => !item.locked && setSelectedIdx(idx)}
                        onClick={() => handleItemClick(item)}
                        role="option"
                      >
                        <span className="cmdk-item-icon">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="cmdk-item-label">{item.label}</span>
                        {item.meta && <span className="cmdk-item-meta">{item.meta}</span>}
                        {item.locked && <Lock className="h-3 w-3 shrink-0 text-muted" aria-label="Locked" />}
                        {!item.locked && !item.action && (
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hints */}
            <div className="cmdk-footer">
              <span className="flex items-center gap-1"><span className="kbd">↑↓</span> navigate</span>
              <span className="flex items-center gap-1"><span className="kbd">↵</span> open</span>
              <span className="flex items-center gap-1"><span className="kbd">Esc</span> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
