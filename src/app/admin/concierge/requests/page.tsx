import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { RequestsClient } from "./RequestsClient";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export type RequestRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  type: string;
  details: string;
  status: string;
  locale: string;
  createdAt: string;
  resolvedAt: string | null;
};

export default async function ConciergeRequestsPage() {
  const user = await requireStudio("orders.write", "/admin/concierge/requests");
  const csrf = await csrfToken();
  const canWrite = can(user, "orders.write");

  const requests = await db.conciergeRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const rows: RequestRow[] = requests.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    type: r.type,
    details: r.details,
    status: r.status,
    locale: r.locale,
    createdAt: dt(r.createdAt),
    resolvedAt: r.resolvedAt ? dt(r.resolvedAt) : null,
  }));

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title="Concierge requests"
        description="Change requests submitted by customers through the AI concierge after verifying their order."
        actions={
          <Link href="/admin/settings/ai" className="btn-outline px-4 py-2.5 text-[0.65rem]">
            <Settings className="h-3.5 w-3.5" />
            Concierge settings
          </Link>
        }
      />

      {/* Navigation tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/concierge"
          className="border border-line px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-ink hover:text-ink"
        >
          Conversations
        </Link>
        <Link
          href="/admin/concierge/requests"
          className="border border-ink bg-ink px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-paper"
        >
          Requests
        </Link>
        <Link
          href="/admin/concierge/test"
          className="border border-line px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-ink hover:text-ink"
        >
          Test console
        </Link>
      </div>

      <RequestsClient rows={rows} csrf={csrf} canWrite={canWrite} />
    </div>
  );
}
