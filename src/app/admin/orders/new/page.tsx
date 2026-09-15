import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { ManualOrderForm } from "./ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewManualOrderPage() {
  await requireStudio("orders.write", "/admin/orders/new");
  const csrf = await csrfToken();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="New manual order"
        description="For orders that arrive over WhatsApp, Messenger or the phone. The customer still gets a tracking code."
        actions={
          <Link href="/admin/orders" className="btn-ghost text-[0.65rem] text-muted">
            Back to orders
          </Link>
        }
      />
      <ManualOrderForm csrf={csrf} />
    </div>
  );
}
