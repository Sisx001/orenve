import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/admin/StatusBadge";
import { AddressBook, CustomerDetailsForm, DeleteCustomer, type AddressRow } from "./CustomerForms";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudio("customers.read", `/admin/customers/${id}`);
  const csrf = await csrfToken();

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { orderBy: { placedAt: "desc" }, include: { _count: { select: { items: true } } } },
    },
  });
  if (!customer) notFound();

  const active = customer.orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const lifetime = active.reduce((a, o) => a + o.total, 0);
  const tags = parseJson<string[]>(customer.tags, []);

  const addresses: AddressRow[] = customer.addresses.map((a) => ({
    id: a.id,
    label: a.label ?? "",
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    district: a.district,
    postalCode: a.postalCode ?? "",
    country: a.country,
    isDefault: a.isDefault,
  }));

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title={customer.name}
        description={`${customer.orders.length} order${customer.orders.length === 1 ? "" : "s"} · ${formatMoney(lifetime)} lifetime value · joined ${customer.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
        actions={
          <Link href="/admin/customers" className="btn-ghost text-[0.65rem] text-muted">
            All customers
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Order history">
            {customer.orders.length === 0 ? (
              <p className="py-4 text-sm text-muted">No orders yet.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-[0.6rem] uppercase tracking-[0.14em] text-muted">
                      <th className="px-4 py-2 text-left font-semibold sm:px-5">Order</th>
                      <th className="px-3 py-2 text-right font-semibold">Items</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2 text-left font-semibold">Payment</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-4 py-2 text-right font-semibold sm:px-5">Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-bone/50">
                        <td className="px-4 py-2.5 sm:px-5">
                          <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs underline-offset-4 hover:underline">
                            {o.number}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{o._count.items}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                        <td className="px-3 py-2.5">
                          <PaymentBadge status={o.paymentStatus} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted sm:px-5">
                          {o.placedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Addresses">
            <AddressBook csrf={csrf} customerId={customer.id} addresses={addresses} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Details">
            <CustomerDetailsForm
              csrf={csrf}
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone ?? "",
                email: customer.email ?? "",
                locale: customer.locale,
                notes: customer.notes ?? "",
                tags: tags.join(", "),
              }}
            />
          </Section>

          <Section title="At a glance">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Orders</dt>
                <dd className="tabular-nums">{customer.orders.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Lifetime value</dt>
                <dd className="tabular-nums">{formatMoney(lifetime)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Average order</dt>
                <dd className="tabular-nums">{formatMoney(active.length ? Math.round(lifetime / active.length) : 0)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Cancelled</dt>
                <dd className="tabular-nums">{customer.orders.length - active.length}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              <DeleteCustomer csrf={csrf} customerId={customer.id} orders={customer.orders.length} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
