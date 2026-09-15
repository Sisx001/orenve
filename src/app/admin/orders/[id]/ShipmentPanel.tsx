"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ShipmentRow = {
  id: string;
  provider: string;
  consignmentId: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  status: string;
  rawStatus: string | null;
  codAmount: number;
  deliveryFee: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

const LABEL: Record<string, string> = { pathao: "Pathao", steadfast: "Steadfast", redx: "RedX", paperfly: "Paperfly", manual: "Manual / other courier" };
const TONE: Record<string, string> = {
  booked: "border-line bg-bone text-ink",
  picked: "border-brass/40 bg-brass/10 text-ink",
  in_transit: "border-warning/40 bg-warning/10 text-warning",
  delivered: "border-success/40 bg-success/10 text-success",
  returned: "border-danger/40 bg-danger/10 text-danger",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
  failed: "border-danger/40 bg-danger/10 text-danger",
};

/**
 * Book a consignment (API courier or manual entry) and sync its status.
 * Each action writes a public timeline event the customer and concierge can see.
 */
export function ShipmentPanel({ orderId, shipments, manualCouriers, canBook }: { orderId: string; shipments: ShipmentRow[]; manualCouriers: string[]; canBook: boolean }) {
  const [couriers, setCouriers] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>("manual");
  const [busy, setBusy] = useState<string | null>(null);
  const [manual, setManual] = useState({ courierName: manualCouriers[0] ?? "", trackingCode: "", trackingUrl: "" });
  const [loc, setLoc] = useState({ cityId: "", zoneId: "", areaId: "", areaName: "" });
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("0.5");

  useEffect(() => {
    apiFetch<{ couriers: string[] }>("/api/admin/shipments")
      .then((r) => {
        setCouriers(r.couriers);
        if (r.couriers.length && r.couriers[0] !== "manual") setProvider(r.couriers[0]);
      })
      .catch(() => setCouriers(["manual"]));
  }, []);

  const book = async () => {
    setBusy("book");
    try {
      await apiFetch("/api/admin/shipments", {
        method: "POST",
        json: {
          orderId,
          provider,
          note: note || undefined,
          weightKg: Number(weight) || undefined,
          providerLocation: provider === "pathao" ? { cityId: loc.cityId, zoneId: loc.zoneId, areaId: loc.areaId } : provider === "redx" ? { areaId: loc.areaId, areaName: loc.areaName } : undefined,
          manual: provider === "manual" ? manual : undefined,
        },
      });
      toast.success("Consignment booked. The customer's timeline was updated.");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Booking failed");
    } finally {
      setBusy(null);
    }
  };

  const sync = async (id: string) => {
    setBusy(id);
    try {
      const r = await apiFetch<{ shipment: ShipmentRow }>(`/api/admin/shipments/${id}/sync`, { method: "POST", json: {} });
      toast.success(`Status: ${r.shipment.rawStatus ?? r.shipment.status}`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {shipments.length > 0 && (
        <ul className="divide-y divide-line/70">
          {shipments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{LABEL[s.provider] ?? s.provider}</span>
                  <span className={cn("border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em]", TONE[s.status] ?? TONE.booked)}>{s.status.replace("_", " ")}</span>
                  {s.rawStatus && s.rawStatus !== s.status && <span className="text-[0.62rem] text-muted">{s.rawStatus}</span>}
                </div>
                <p className="mt-1 font-mono text-xs text-muted">
                  {s.trackingCode ?? s.consignmentId ?? "—"}
                  {s.codAmount > 0 && ` · COD ${formatMoney(s.codAmount)}`}
                  {s.deliveryFee != null && ` · fee ${formatMoney(s.deliveryFee)}`}
                </p>
                <p className="text-[0.62rem] text-muted">Booked {s.createdAt}{s.lastSyncedAt ? ` · synced ${s.lastSyncedAt}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.trackingUrl && (
                  <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline">
                    Track <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {s.provider !== "manual" && (
                  <button type="button" onClick={() => sync(s.id)} disabled={busy === s.id} className="inline-flex items-center gap-1 border border-line px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50">
                    <RefreshCw className={cn("h-3 w-3", busy === s.id && "animate-spin")} /> Sync
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canBook && (
        <div className={cn("space-y-3", shipments.length > 0 && "border-t border-line pt-4")}>
          <label className="block">
            <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Courier</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="field-box">
              {(couriers.length ? couriers : ["manual"]).map((c) => (
                <option key={c} value={c}>
                  {LABEL[c] ?? c}
                  {c !== "manual" ? " (API)" : ""}
                </option>
              ))}
            </select>
          </label>

          {provider === "manual" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Courier name</span>
                <input list="manual-couriers" value={manual.courierName} onChange={(e) => setManual({ ...manual, courierName: e.target.value })} className="field-box" />
                <datalist id="manual-couriers">
                  {manualCouriers.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Tracking code</span>
                <input value={manual.trackingCode} onChange={(e) => setManual({ ...manual, trackingCode: e.target.value })} className="field-box font-mono" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Tracking URL</span>
                <input value={manual.trackingUrl} onChange={(e) => setManual({ ...manual, trackingUrl: e.target.value })} placeholder="https://" className="field-box" />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Weight (kg)</span>
                <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className="field-box" />
              </label>
              {provider === "pathao" && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Pathao city / zone / area ids</span>
                    <div className="flex gap-2">
                      <input value={loc.cityId} onChange={(e) => setLoc({ ...loc, cityId: e.target.value })} placeholder="city" className="field-box" />
                      <input value={loc.zoneId} onChange={(e) => setLoc({ ...loc, zoneId: e.target.value })} placeholder="zone" className="field-box" />
                      <input value={loc.areaId} onChange={(e) => setLoc({ ...loc, areaId: e.target.value })} placeholder="area" className="field-box" />
                    </div>
                  </label>
                </>
              )}
              {provider === "redx" && (
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">RedX area id / name</span>
                  <div className="flex gap-2">
                    <input value={loc.areaId} onChange={(e) => setLoc({ ...loc, areaId: e.target.value })} placeholder="area id" className="field-box" />
                    <input value={loc.areaName} onChange={(e) => setLoc({ ...loc, areaName: e.target.value })} placeholder="area name" className="field-box" />
                  </div>
                </label>
              )}
              <label className="block sm:col-span-3">
                <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Instruction for the rider</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="field-box" />
              </label>
            </div>
          )}

          <button type="button" onClick={book} disabled={busy === "book"} className="btn px-4 py-2.5 text-[0.65rem]">
            {provider === "manual" ? <PackageCheck className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
            {busy === "book" ? "Booking…" : provider === "manual" ? "Record shipment" : `Book with ${LABEL[provider] ?? provider}`}
          </button>
        </div>
      )}
    </div>
  );
}
