"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { normalizeBdPhone } from "@/lib/orders/service";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { customerSchema, readList } from "@/lib/admin/schemas";

export async function saveCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const input = customerSchema.parse({
      id: String(fd.get("id") ?? "") || undefined,
      name: fd.get("name"),
      phone: fd.get("phone") ?? "",
      email: fd.get("email") ?? "",
      locale: String(fd.get("locale") ?? "en"),
      notes: fd.get("notes") ?? "",
      tags: readList(fd, "tags"),
    });

    const data = {
      name: input.name,
      phone: input.phone ? normalizeBdPhone(input.phone) : null,
      email: input.email || null,
      locale: input.locale,
      notes: input.notes || null,
      tags: input.tags.length ? toJson(input.tags) : null,
    };

    const row = input.id
      ? await db.customer.update({ where: { id: input.id }, data })
      : await db.customer.create({ data });

    await audit(user.id, input.id ? "customer.update" : "customer.create", "customer", row.id, { name: row.name });
    revalidateStudio("/admin/customers", `/admin/customers/${row.id}`);
    return succeed("Customer saved.", { id: row.id });
  });
}

export async function deleteCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const id = String(fd.get("customerId") ?? "");
    const row = await db.customer.findUnique({ where: { id }, select: { name: true, _count: { select: { orders: true } } } });
    if (!row) return fail("That customer no longer exists.");
    if (row._count.orders > 0) return fail("This customer has orders — delete the orders first, or keep the record for your history.");
    await db.customer.delete({ where: { id } });
    await audit(user.id, "customer.delete", "customer", id, { name: row.name });
    revalidateStudio("/admin/customers");
    return succeed("Customer deleted.");
  });
}

export async function saveAddressAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const customerId = String(fd.get("customerId") ?? "");
    const id = String(fd.get("addressId") ?? "");
    if (!customerId) return fail("Missing customer.");

    const data = {
      label: String(fd.get("label") ?? "").trim() || null,
      name: String(fd.get("name") ?? "").trim(),
      phone: normalizeBdPhone(String(fd.get("phone") ?? "")),
      line1: String(fd.get("line1") ?? "").trim(),
      line2: String(fd.get("line2") ?? "").trim() || null,
      city: String(fd.get("city") ?? "").trim(),
      district: String(fd.get("district") ?? "").trim(),
      postalCode: String(fd.get("postalCode") ?? "").trim() || null,
      country: String(fd.get("country") ?? "BD").slice(0, 2) || "BD",
      isDefault: fd.get("isDefault") === "on",
    };
    if (!data.name || !data.line1 || !data.city || !data.district) return fail("Name, address, city and district are required.");

    if (data.isDefault) await db.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    const row = id ? await db.address.update({ where: { id }, data }) : await db.address.create({ data: { ...data, customerId } });

    await audit(user.id, id ? "address.update" : "address.create", "customer", customerId, { addressId: row.id });
    revalidateStudio(`/admin/customers/${customerId}`);
    return succeed("Address saved.");
  });
}

export async function deleteAddressAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("customers.read", fd);
    const id = String(fd.get("addressId") ?? "");
    const row = await db.address.findUnique({ where: { id }, select: { customerId: true } });
    if (!row) return fail("That address no longer exists.");
    await db.address.delete({ where: { id } });
    await audit(user.id, "address.delete", "customer", row.customerId, { addressId: id });
    revalidateStudio(`/admin/customers/${row.customerId}`);
    return succeed("Address removed.");
  });
}
