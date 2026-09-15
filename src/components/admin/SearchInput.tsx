"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Debounced search that writes to a URL query param (server-rendered lists). */
export function SearchInput({
  param = "q",
  placeholder = "Search…",
  className,
  delay = 350,
}: {
  param?: string;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [value, setValue] = useState(search.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams(search.toString());
      if (value) sp.set(param, value);
      else sp.delete(param);
      sp.delete("page");
      const q = sp.toString();
      startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-box pl-9 pr-9"
      />
      {pending ? (
        <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted" />
      ) : value ? (
        <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Small select that pushes its value into a URL param. */
export function FilterSelect({
  param,
  options,
  label,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = search.get(param) ?? "";

  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      {label && <span className="whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>}
      <select
        value={current}
        onChange={(e) => {
          const sp = new URLSearchParams(search.toString());
          if (e.target.value) sp.set(param, e.target.value);
          else sp.delete(param);
          sp.delete("page");
          const q = sp.toString();
          router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
        }}
        className="field-box py-2 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default SearchInput;
