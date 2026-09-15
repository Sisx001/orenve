"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Boxes,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Shirt,
  Star,
  Ticket,
  Truck,
  User as UserIcon,
  Users,
  X,
  KeyRound,
} from "lucide-react";
import { Monogram } from "@/components/brand/Logo";
import { CRUMB_LABELS, NAV, type NavItem } from "@/lib/admin/nav";
import { signOutAction } from "@/lib/admin/actions/auth";
import { cn } from "@/lib/utils";

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

export type ShellUser = { id: string; name: string; email: string; role: string; totpEnabled: boolean };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function crumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean); // ["admin", ...]
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

function NavLinks({ permitted, onNavigate }: { permitted: (p?: string) => boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const items = group.items.filter((i) => permitted(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.title} className="mb-4 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-bone/35">{group.title}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge;
                const active = isActive(pathname, item);
                const showChildren = active && item.children && item.children.length > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-2.5 px-2.5 py-1.5 text-[0.82rem] transition",
                        active ? "bg-bone/10 text-bone" : "text-bone/65 hover:bg-bone/5 hover:text-bone",
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-oxide" />}
                      <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-oxide" : "text-bone/45 group-hover:text-bone/70")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    {showChildren && (
                      <ul className="mb-1 ml-[1.6rem] mt-0.5 space-y-px border-l border-bone/10 pl-2.5">
                        {item.children!.map((c) => (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              onClick={onNavigate}
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-xs transition hover:border-ink"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-5 w-5 items-center justify-center bg-ink text-[0.6rem] font-semibold text-paper">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{user.name}</span>
        <ChevronDown className="h-3 w-3 text-muted" />
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
              <p className="mt-1.5 text-[0.58rem] uppercase tracking-[0.16em] text-oxide">{user.role}</p>
            </div>
            <Link href="/admin/profile" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-bone" role="menuitem">
              <UserIcon className="h-3.5 w-3.5 text-muted" />
              Your profile
            </Link>
            <Link href="/admin/profile#password" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-bone" role="menuitem">
              <KeyRound className="h-3.5 w-3.5 text-muted" />
              Change password
            </Link>
            <Link href="/admin/profile#twofa" className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-bone" role="menuitem">
              <Shield className="h-3.5 w-3.5 text-muted" />
              {user.totpEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Link>
            <form action={signOutAction} className="border-t border-line">
              <button type="submit" className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-danger hover:bg-danger/5" role="menuitem">
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

export function AdminShell({
  user,
  permissions,
  children,
}: {
  user: ShellUser;
  /** permission key → allowed, computed server-side */
  permissions: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const permitted = (p?: string) => (p ? permissions[p] === true : true);
  const trail = crumbs(pathname);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-bone">
      <div className="flex items-center gap-2.5 border-b border-bone/10 px-4 py-3.5">
        <Monogram size={22} className="text-bone" />
        <div className="min-w-0">
          <p className="truncate text-[0.8rem] font-semibold tracking-[0.14em]">ORYNVE</p>
          <p className="text-[0.55rem] uppercase tracking-[0.2em] text-bone/40">Studio</p>
        </div>
        <button type="button" onClick={() => setDrawer(false)} className="ml-auto p-1 text-bone/60 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <NavLinks permitted={permitted} onNavigate={() => setDrawer(false)} />
      <div className="border-t border-bone/10 px-4 py-3">
        <a
          href="/en"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.7rem] text-bone/55 transition hover:text-bone"
        >
          <ExternalLink className="h-3 w-3" />
          View storefront
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] bg-paper text-ink">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-paper/92 px-3 py-2.5 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setDrawer(true)} className="p-1.5 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-xs">
              {trail.map((c, i) => (
                <li key={c.href} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-line">/</span>}
                  {i === trail.length - 1 ? (
                    <span className="truncate font-medium">{c.label}</span>
                  ) : (
                    <Link href={c.href} className="truncate text-muted hover:text-ink">
                      {c.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <a
            href="/en"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-ink hover:text-ink sm:inline-flex"
          >
            <ExternalLink className="h-3 w-3" />
            Storefront
          </a>
          <UserMenu user={user} />
        </header>
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-7">{children}</main>
      </div>
    </div>
  );
}

export default AdminShell;
