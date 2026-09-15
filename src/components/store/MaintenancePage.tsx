"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { headlineLines } from "@/lib/store/richtext";
import { Wordmark } from "@/components/brand/Logo";
import { LocaleLink } from "@/components/store/LocaleLink";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { cn } from "@/lib/utils";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function remaining(target: number): Parts | null {
  const diff = target - Date.now();
  if (!Number.isFinite(target) || diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function MaintenancePage({ title, message, launchDate, image }: { title: string; message: string; launchDate: string; image: string }) {
  const t = useT();
  const { config } = useConfig();
  const target = launchDate ? new Date(launchDate).getTime() : NaN;
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    setParts(remaining(target));
    const id = setInterval(() => setParts(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const lines = headlineLines(title);
  const units: { value: number; label: string }[] = parts
    ? [
        { value: parts.days, label: t("maintenance.days") },
        { value: parts.hours, label: t("maintenance.hours") },
        { value: parts.minutes, label: t("maintenance.minutes") },
        { value: parts.seconds, label: t("maintenance.seconds") },
      ]
    : [];

  return (
    <section className="relative flex min-h-[80dvh] items-center overflow-hidden">
      {image && (
        <>
          <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-paper/85" />
        </>
      )}
      <div className="container-page relative py-24">
        <div className="max-w-2xl">
          <Wordmark name={config.brand.name} height={26} />
          <p className="eyebrow mt-10">{config.site.mode === "coming_soon" ? t("maintenance.comingSoonEyebrow") : t("maintenance.eyebrow")}</p>
          <h1 className="display mt-5 text-balance text-display-lg">
            {lines.map((l, i) => (
              <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
                {l}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-lg text-muted">{message}</p>

          {units.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-6" role="timer" aria-live="off">
              {units.map((u) => (
                <div key={u.label} className="min-w-[4.5rem]">
                  <p className="display text-display-sm tabular-nums">{String(u.value).padStart(2, "0")}</p>
                  <p className="eyebrow mt-1">{u.label}</p>
                </div>
              ))}
            </div>
          )}

          {config.features.newsletter && (
            <div className="mt-14 max-w-md">
              <NewsletterForm variant="stacked" />
            </div>
          )}

          <LocaleLink href="/contact" className="btn-ghost mt-10 text-oxide">
            {t("maintenance.contact")}
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}

/**
 * Replaces page content while the site is paused. The contact page stays
 * reachable so customers can still get hold of the studio.
 */
export function MaintenanceGate({
  title,
  message,
  launchDate,
  image,
  children,
}: {
  title: string;
  message: string;
  launchDate: string;
  image: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const allowed = /\/contact\/?$/.test(pathname);
  if (allowed) return <>{children}</>;
  return <MaintenancePage title={title} message={message} launchDate={launchDate} image={image} />;
}
