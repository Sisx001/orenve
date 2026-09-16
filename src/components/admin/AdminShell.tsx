"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutTemplate,
  Lock,
  LogOut,
  Mail,
  Menu,
  Moon,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Shield,
  Shirt,
  Star,
  Sun,
  SunMoon,
  Ticket,
  Truck,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { Monogram } from "@/components/brand/Logo";
import { CRUMB_LABELS, NAV, type NavItem } from "@/lib/admin/nav";
import { signOutAction } from "@/lib/admin/actions/auth";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { COOKIE_STUDIO_THEME } from "@/lib/constants";
import type { ShellCounts } from "@/lib/admin/queries";

// ─────────────────────── Icon map ─────────────────────────────────────────────
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  receipt: Receipt,
  shirt: Shirt,
  boxes: Boxes,
  users: Users,
  ticket: Ticket,
  truck: Truck,
  layers: Layers,
  "layout-template": LayoutTemplate,
  "file-text": FileText,
  image: ImageIcon,
  star: Star,
  mail: Mail,
  bot: Bot,
  settings: Settings,
  shield: Shield,
  "scroll-text": ScrollText,
  database: Database,
};

// Badge slots: which nav hrefs get which count field
const NAV_BADGES: Record<string, keyof ShellCounts> = {
  "/admin/orders": "pendingOrders",
  "/admin/messages": "newMessages",
  "/admin/concierge": "openConcierge",
};

export type ShellUser = { id: string; name: string; email: string; role: string; totpEnabled: boolean };

// ─────────────────────── Helpers ──────────────────────────────────────────────
function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function crumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const out: { href: string; label: string }[] = [];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    const label = CRUMB_LABELS[acc];
    if (label) out.push({ href: acc, label });
    else if (out.length > 0) out.push({ href: acc, label: p.length > 14 ? `${p.slice(0, 8)}…` : p });
  }
  if (out.length === 0) out.push({ href: "/admin", label: "Dashboard" });
  return out;
}

const SIDEBAR_COLLAPSED_KEY = "studio_sidebar_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

// ─────────────────────── Theme helpers ────────────────────────────────────────
type StudioThemePref = "light" | "dark" | "system";

function resolvedTheme(pref: StudioThemePref): "light" | "dark" {
  if (pref === "system") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  return pref;
}

function applyStudioTheme(pref: StudioThemePref) {
  const theme = resolvedTheme(pref);
  document.documentElement.dataset.studioTheme = theme;
  const expires = new Date(Date.now() + 365 * 86400_000).toUTCString();
  document.cookie = `${COOKIE_STUDIO_THEME}=${pref}; path=/; expires=${expires}; SameSite=Lax`;
}

function nextTheme(current: StudioThemePref): StudioThemePref {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

const THEME_ICONS: Record<StudioThemePref, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

// ─────────────────────── NavLinks ─────────────────────────────────────────────
function NavLinks({
  permissions,
  shellCounts,
  collapsed,
  onNavigate,
}: {
  permissions: Record<string, boolean>;
  shellCounts: ShellCounts;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Studio navigation" className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        // Show all items; locked items render differently but are never hidden
        const items = group.items;
        return (
          <div key={group.title} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="sidebar-section-title px-2.5 pb-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-bone/35">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge;
                const active = isActive(pathname, item);
                const showChildren = active && !collapsed && item.children && item.children.length > 0;
                const locked = item.permission ? permissions[item.permission] !== true : false;
                const badgeKey = NAV_BADGES[item.href];
                const badgeCount = badgeKey ? shellCounts[badgeKey] : 0;

                const itemContent = (
                  <>
                    {active && !locked && (
                      <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-oxide" />
                    )}
                    <Icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0",
                        locked
                          ? "text-bone/25"
                          : active
                          ? "text-oxide"
                          : "text-bone/45 group-hover:text-bone/70",
                      )}
                    />
                    {!collapsed && (
                      <span className={cn("sidebar-label truncate", locked && "text-bone/40")}>{item.label}</span>
                    )}
                    {!collapsed && locked && (
                      <Lock className="ml-auto h-3 w-3 shrink-0 text-bone/30" aria-label="Locked" />
                    )}
                    {!collapsed && !locked && badgeCount > 0 && (
                      <span className="nav-badge ml-auto">{badgeCount > 99 ? "99+" : badgeCount}</span>
                    )}
                    {collapsed && badgeCount > 0 && !locked && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-oxide" aria-hidden />
                    )}
                  </>
                );

                return (
                  <li key={item.href}>
                    {locked ? (
                      <span
                        className={cn(
                          "group relative flex items-center gap-2.5 px-2.5 py-1.5 text-[0.82rem] cursor-not-allowed",
                          "text-bone/30",
                          collapsed && "justify-center px-0",
                        )}
                        title="Ask the owner to enable this"
                        aria-label={`${item.label} — locked`}
                      >
                        {itemContent}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 px-2.5 py-1.5 text-[0.82rem] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-oxide/50",
                          active ? "bg-bone/10 text-bone" : "text-bone/65 hover:bg-bone/5 hover:text-bone",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        {itemContent}
                      </Link>
                    )}
                    {showChildren && (
                      <ul className="mb-1 ml-[1.6rem] mt-0.5 space-y-px border-l border-bone/10 pl-2.5">
                        {item.children!.map((c) => (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              onClick={onNavigate}
                              aria-current={pathname === c.href ? "page" : undefined}
                              className={cn(
                                "block py-1 text-[0.76rem] transition",
                                pathname === c.href ? "text-oxide" : "text-bone/50 hover:text-bone",
                              )}
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ─────────────────────── UserMenu ─────────────────────────────────────────────
function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-xs transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-oxide"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
      >
        <span className="flex h-5 w-5 items-center justify-center bg-ink text-[0.6rem] font-semibold text-paper">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{user.name}</span>
        <ChevronDown className="h-3 w-3 text-muted" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-1 w-60 border border-line bg-paper shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            <div className="border-b border-line px-3.5 py-3">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <span className="mt-1.5 inline-block border border-oxide/30 bg-oxide/10 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-oxide">
                {user.role}
              </span>
            </div>
            <Link href="/admin/profile" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-bone" role="menuitem">
              <UserIcon className="h-3.5 w-3.5 text-muted" />
              Your profile
            </Link>
            <Link href="/admin/profile#password" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-bone" role="menuitem">
              <KeyRound className="h-3.5 w-3.5 text-muted" />
              Change password
            </Link>
            <Link href="/admin/profile#twofa" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-bone" role="menuitem">
              <Shield className="h-3.5 w-3.5 text-muted" />
              {user.totpEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Link>
            <form action={signOutAction} className="border-t border-line">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-danger transition hover:bg-danger/5"
                role="menuitem"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────── ThemeToggle ──────────────────────────────────────────
function ThemeToggle({ pref, onToggle }: { pref: StudioThemePref; onToggle: () => void }) {
  const Icon = THEME_ICONS[pref];
  const labels: Record<StudioThemePref, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
  };
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Studio theme: ${labels[pref]} — click to cycle`}
      aria-label={`Studio theme: ${labels[pref]}`}
      className="flex items-center gap-1.5 border border-line p-1.5 text-muted transition hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-oxide"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ─────────────────────── Main shell ───────────────────────────────────────────
export function AdminShell({
  user,
  permissions,
  shellCounts,
  initialStudioTheme,
  children,
}: {
  user: ShellUser;
  permissions: Record<string, boolean>;
  shellCounts: ShellCounts;
  initialStudioTheme: "light" | "dark" | "system";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [studioThemePref, setStudioThemePref] = useState<StudioThemePref>(initialStudioTheme);

  // Load sidebar collapsed state from localStorage on mount
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  // Close drawer on navigation
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setStudioThemePref((current) => {
      const next = nextTheme(current);
      applyStudioTheme(next);
      return next;
    });
  }, []);

  const trail = crumbs(pathname);

  // ── Sidebar content ──────────────────────────────────────────────────────────
  const sidebar = (
    <div
      className={cn(
        "surface-dark flex h-full flex-col bg-ink text-bone transition-[width] duration-200",
        collapsed ? "sidebar-collapsed" : "",
      )}
    >
      {/* Brand mark */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-bone/10 px-4 py-3.5",
          collapsed && "justify-center px-2",
        )}
      >
        <Monogram size={22} className="shrink-0 text-bone" />
        {!collapsed && (
          <div className="sidebar-logo-text min-w-0">
            <p className="truncate text-[0.8rem] font-semibold tracking-[0.14em]">ORYNVE</p>
            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-bone/40">Studio</p>
          </div>
        )}
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setDrawer(false)}
          className="ml-auto p-1 text-bone/60 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <NavLinks
        permissions={permissions}
        shellCounts={shellCounts}
        collapsed={collapsed}
        onNavigate={() => setDrawer(false)}
      />

      {/* Footer */}
      <div className={cn("border-t border-bone/10 px-4 py-3", collapsed && "flex justify-center px-2")}>
        {!collapsed ? (
          <a
            href="/en"
            target="_blank"
            rel="noreferrer"
            className="sidebar-footer-text inline-flex items-center gap-1.5 text-[0.7rem] text-bone/55 transition hover:text-bone"
          >
            <ExternalLink className="h-3 w-3" />
            View storefront
          </a>
        ) : (
          <a
            href="/en"
            target="_blank"
            rel="noreferrer"
            title="View storefront"
            className="text-bone/55 transition hover:text-bone"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        permissions={permissions}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex min-h-[100dvh] bg-paper text-ink">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-[100dvh] shrink-0 overflow-hidden lg:flex lg:flex-col",
            collapsed ? "w-[3.5rem]" : "w-60",
            "transition-[width] duration-200",
          )}
        >
          {sidebar}
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute bottom-14 right-0 flex h-5 w-5 -translate-x-0 translate-y-0 items-center justify-center border border-bone/20 bg-ink text-bone/50 transition hover:text-bone"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <div className="fixed inset-0 z-[80] lg:hidden">
              <motion.div
                className="absolute inset-0 bg-ink/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawer(false)}
              />
              <motion.aside
                className="absolute inset-y-0 left-0 w-64 max-w-[85vw]"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {sidebar}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-paper/92 px-3 py-2.5 backdrop-blur sm:px-5">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="p-1.5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-xs">
                {trail.map((c, i) => (
                  <li key={c.href} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && <span aria-hidden className="text-line">/</span>}
                    {i === trail.length - 1 ? (
                      <span className="truncate font-medium">{c.label}</span>
                    ) : (
                      <Link href={c.href} className="truncate text-muted transition hover:text-ink">
                        {c.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Command palette button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-ink hover:text-ink sm:flex"
              aria-label="Open command palette"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <Search className="h-3 w-3" />
              <span className="hidden lg:inline">Search…</span>
              <span className="kbd hidden lg:inline-flex">⌘K</span>
            </button>

            {/* Storefront link */}
            <a
              href="/en"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-ink hover:text-ink sm:inline-flex"
            >
              <ExternalLink className="h-3 w-3" />
              Storefront
            </a>

            {/* Studio theme toggle */}
            <ThemeToggle pref={studioThemePref} onToggle={handleToggleTheme} />

            {/* User menu */}
            <UserMenu user={user} />
          </header>

          {/* Page content with route-change animation */}
          <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{ willChange: "opacity, transform" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}

export default AdminShell;
