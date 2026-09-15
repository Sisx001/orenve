"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_CHILDREN } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Settings sections">
      {SETTINGS_CHILDREN.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.13em] transition",
            pathname === item.href ? "border-oxide text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default SettingsNav;
