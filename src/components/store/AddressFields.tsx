"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Loader2, Search } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Bangladesh address picker: Division → District → Upazila/Thana → Area → Postcode,
 * with free-text search across all levels and GPS/IP auto-detect. Levels shown
 * are controlled by the studio (config.geo.addressLevels). Emits a flat value
 * compatible with the checkout schema (district is always required).
 */
export type AddressValue = {
  divisionId?: string;
  division?: string;
  districtId?: string;
  district: string;
  upazila?: string;
  area?: string;
  postalCode?: string;
  city: string; // kept for the existing schema: mirrors area || upazila
};

type Item = { id: string; en: string; bn: string; divisionId?: string; districtId?: string };
type Postcode = { office: string; code: string; upazila: string };

async function geo<T>(qs: string): Promise<T> {
  const r = await fetch(`/api/geo?${qs}`, { cache: "force-cache" });
  const j = await r.json();
  return (j.items ?? j.results ?? []) as T;
}

export function AddressFields({
  value,
  onChange,
  levels = ["district", "upazila", "area", "postcode"],
  autoDetect = true,
  allowCustomArea = true,
  requirePostcode = false,
  errors = {},
  boxed = true,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  levels?: ("division" | "district" | "upazila" | "area" | "postcode")[];
  autoDetect?: boolean;
  allowCustomArea?: boolean;
  requirePostcode?: boolean;
  errors?: Partial<Record<keyof AddressValue, string>>;
  boxed?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const name = (i: { en: string; bn: string }) => (locale === "bn" && i.bn ? i.bn : i.en);

  const [divisions, setDivisions] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [upazilas, setUpazilas] = useState<Item[]>([]);
  const [areas, setAreas] = useState<Item[]>([]);
  const [postcodes, setPostcodes] = useState<Postcode[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ type: string; label: string; bn: string; districtId?: string; divisionId?: string; code?: string }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDivision = levels.includes("division");
  const showUpazila = levels.includes("upazila");
  const showArea = levels.includes("area");
  const showPostcode = levels.includes("postcode");

  useEffect(() => {
    geo<Item[]>("level=divisions").then(setDivisions).catch(() => {});
    geo<Item[]>("level=districts").then(setDistricts).catch(() => {});
  }, []);
  useEffect(() => {
    if (!value.districtId) {
      setUpazilas([]);
      setAreas([]);
      setPostcodes([]);
      return;
    }
    if (showUpazila) geo<Item[]>(`level=upazilas&district=${value.districtId}`).then(setUpazilas).catch(() => {});
    if (showArea) geo<Item[]>(`level=areas&district=${value.districtId}`).then(setAreas).catch(() => {});
    if (showPostcode) geo<Postcode[]>(`level=postcodes&district=${value.districtId}${value.upazila ? `&upazila=${encodeURIComponent(value.upazila)}` : ""}`).then(setPostcodes).catch(() => {});
  }, [value.districtId, value.upazila, showUpazila, showArea, showPostcode]);

  const visibleDistricts = useMemo(() => (showDivision && value.divisionId ? districts.filter((d) => d.divisionId === value.divisionId) : districts), [districts, showDivision, value.divisionId]);

  const setDistrict = useCallback(
    (d: Item | undefined) => {
      onChange({ ...value, divisionId: d?.divisionId ?? value.divisionId, districtId: d?.id, district: d?.en ?? "", upazila: undefined, area: undefined, postalCode: undefined, city: "" });
    },
    [onChange, value],
  );

  const detect = useCallback(async () => {
    setDetecting(true);
    setDetectMsg(t("checkout.detecting"));
    const apply = (det: any) => {
      if (det?.districtId) {
        const d = districts.find((x) => x.id === det.districtId);
        if (d) setDistrict(d);
        setDetectMsg(t("checkout.detected", { district: d ? name(d) : det.district }));
        return true;
      }
      return false;
    };
    const viaIp = async () => {
      try {
        const r = await fetch("/api/geo/detect").then((x) => x.json());
        return apply(r.detected);
      } catch {
        return false;
      }
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch("/api/geo/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) }).then((x) => x.json());
            if (!apply(r.detected) && !(await viaIp())) setDetectMsg(t("checkout.detectFailed"));
          } finally {
            setDetecting(false);
          }
        },
        async () => {
          if (!(await viaIp())) setDetectMsg(t("checkout.detectFailed"));
          setDetecting(false);
        },
        { timeout: 6000, maximumAge: 600_000 },
      );
    } else {
      if (!(await viaIp())) setDetectMsg(t("checkout.detectFailed"));
      setDetecting(false);
    }
  }, [districts, setDistrict, t, name]);

  const onSearch = (text: string) => {
    setQ(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      geo<typeof results>(`q=${encodeURIComponent(text)}`).then(setResults).catch(() => setResults([]));
    }, 180);
  };
  const pickResult = (r: (typeof results)[number]) => {
    const d = districts.find((x) => x.id === r.districtId);
    const next: AddressValue = { ...value, divisionId: d?.divisionId ?? r.divisionId, districtId: d?.id, district: d?.en ?? value.district, city: value.city };
    if (r.type === "upazila") next.upazila = r.label;
    if (r.type === "area") {
      next.area = r.label;
      next.city = r.label;
    }
    if (r.type === "postcode") next.postalCode = r.code;
    onChange(next);
    setQ("");
    setResults([]);
  };

  const opt = (items: Item[]) => [{ value: "", label: "—" }, ...items.map((i) => ({ value: i.id, label: name(i) }))];

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center gap-2 border-b border-line focus-within:border-oxide">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder={t("checkout.searchArea")} className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted/70" aria-label={t("checkout.searchArea")} />
          {autoDetect && (
            <button type="button" onClick={detect} disabled={detecting} className="flex shrink-0 items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-oxide disabled:opacity-50">
              {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <LocateFixed className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">{t("checkout.detectLocation")}</span>
            </button>
          )}
        </div>
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-line bg-paper shadow-xl" role="listbox">
            {results.map((r, i) => (
              <li key={`${r.type}-${r.label}-${i}`}>
                <button type="button" onClick={() => pickResult(r)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bone">
                  <span>{locale === "bn" && r.bn ? r.bn : r.label}</span>
                  <span className="eyebrow text-[0.55rem]">{r.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {detectMsg && <p className="mt-2 text-xs text-muted">{detectMsg}</p>}
      </div>

      <div className={cn("grid gap-4", showDivision ? "sm:grid-cols-2" : "")}>
        {showDivision && (
          <Select boxed={boxed} label={t("checkout.division")} value={value.divisionId ?? ""} options={opt(divisions)} onChange={(e) => onChange({ ...value, divisionId: e.target.value || undefined, districtId: undefined, district: "", upazila: undefined, area: undefined, postalCode: undefined, city: "" })} />
        )}
        <Select boxed={boxed} label={t("checkout.district")} required value={value.districtId ?? ""} error={errors.district} options={opt(visibleDistricts)} onChange={(e) => setDistrict(visibleDistricts.find((d) => d.id === e.target.value))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showUpazila && (
          <Select boxed={boxed} label={t("checkout.upazila")} value={value.upazila ?? ""} disabled={!value.districtId} options={[{ value: "", label: "—" }, ...upazilas.map((u) => ({ value: u.en, label: name(u) }))]} onChange={(e) => onChange({ ...value, upazila: e.target.value || undefined, postalCode: undefined, city: value.area ?? e.target.value })} />
        )}
        {showArea &&
          (areas.length > 0 && !allowCustomArea ? (
            <Select boxed={boxed} label={t("checkout.area")} value={value.area ?? ""} options={[{ value: "", label: "—" }, ...areas.map((a) => ({ value: a.en, label: name(a) }))]} onChange={(e) => onChange({ ...value, area: e.target.value || undefined, city: e.target.value || value.upazila || "" })} />
          ) : (
            <Input boxed={boxed} label={t("checkout.area")} list="orynve-areas" value={value.area ?? ""} error={errors.city} onChange={(e) => onChange({ ...value, area: e.target.value || undefined, city: e.target.value || value.upazila || "" })} placeholder={areas.length ? name(areas[0]) : ""} />
          ))}
        {showArea && areas.length > 0 && allowCustomArea && (
          <datalist id="orynve-areas">
            {areas.map((a) => (
              <option key={a.en} value={a.en}>
                {name(a)}
              </option>
            ))}
          </datalist>
        )}
      </div>

      {showPostcode && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input boxed={boxed} label={t("checkout.postalCode")} required={requirePostcode} list="orynve-postcodes" inputMode="numeric" maxLength={4} value={value.postalCode ?? ""} error={errors.postalCode} onChange={(e) => onChange({ ...value, postalCode: e.target.value.replace(/\D/g, "") || undefined })} />
          <datalist id="orynve-postcodes">
            {postcodes.map((p) => (
              <option key={`${p.code}-${p.office}`} value={p.code}>
                {p.office} · {p.upazila}
              </option>
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
