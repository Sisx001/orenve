import { PageHeader, Section } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { BD_GEO } from "@/lib/geo/bd";
import { AddressSettingsForm, GeoOverrides } from "./AddressForms";

export const dynamic = "force-dynamic";

export default async function AddressSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/address");
  const [geo, csrf, overrides] = await Promise.all([getSetting("geo"), csrfToken(), db.geoOverride.findMany({ orderBy: { createdAt: "desc" } })]);
  const districts = BD_GEO.districts.map((d) => ({ id: d.id, en: d.en, bn: d.bn, divisionId: d.divisionId })).sort((a, b) => a.en.localeCompare(b.en));
  const divisions = BD_GEO.divisions.map((d) => ({ id: d.id, en: d.en }));

  return (
    <div>
      <PageHeader
        title="Address & delivery areas"
        description={`Checkout uses the bundled Bangladesh dataset (${BD_GEO.divisions.length} divisions · ${BD_GEO.districts.length} districts · ${BD_GEO.upazilas.length} upazilas · ${BD_GEO.postcodes.length} post offices · ${BD_GEO.dhakaAreas.length} Dhaka areas). Add your own areas or hide entries here.`}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Checkout address fields">
          <AddressSettingsForm csrf={csrf} values={{ levels: geo.addressLevels, autoDetect: geo.autoDetect, requirePostcode: geo.requirePostcode, allowCustomArea: geo.allowCustomArea, internationalShipping: geo.internationalShipping }} />
        </Section>
        <Section title="Custom areas, upazilas & postcodes" description="Entries added here appear in the picker immediately; hidden bundled entries disappear from it.">
          <GeoOverrides
            csrf={csrf}
            divisions={divisions}
            districts={districts}
            overrides={overrides.map((o) => ({ id: o.id, level: o.level, parentId: o.parentId, en: o.en, bn: o.bn, code: o.code, isHidden: o.isHidden, targetKey: o.targetKey }))}
          />
        </Section>
      </div>
    </div>
  );
}
