import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { csrfToken } from "@/lib/admin/csrf";
import { Monogram } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — ORYNVE Studio", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "";
  const next = rawNext.startsWith("/admin") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const user = await getCurrentUser();
  if (user) redirect(next);

  const csrf = await csrfToken();

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink px-10 py-12 text-bone lg:flex">
        <div className="flex items-center gap-3">
          <Monogram size={28} className="text-bone" />
          <span className="text-sm font-semibold tracking-[0.2em]">ORYNVE</span>
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.24em] text-bone/40">Owner studio</p>
          <h1 className="display mt-4 max-w-md text-4xl leading-[1.05]">
            Everything the storefront knows, in one quiet room.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-bone/55">
            Orders, inventory, content, payments and the concierge — managed from a single place, built for the way you
            actually sell.
          </p>
        </div>
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-bone/30">Dhaka · Bangladesh</p>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Monogram size={26} />
          </div>
          <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted">ORYNVE Studio</p>
          <h2 className="display mt-2 text-3xl">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Staff access only. All sign-ins are recorded.</p>
          <div className="mt-8">
            <LoginForm csrf={csrf} next={next} />
          </div>
          <p className="mt-8 border-t border-line pt-5 text-xs text-muted">
            Lost access? Ask the brand owner to reset your password from Studio → Users.
          </p>
        </div>
      </div>
    </div>
  );
}
