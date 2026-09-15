"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { SubmitButton, ToggleRow } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { saveFeaturesAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";

/** One line of plain-English guidance per flag, grouped the way an owner thinks. */
const GROUPS: { title: string; keys: [string, string, string][] }[] = [
  {
    title: "Shopping",
    keys: [
      ["cart", "Cart", "Let visitors collect several pieces before checking out."],
      ["wishlist", "Wishlist", "A saved list, kept in the browser."],
      ["search", "Search", "Search box in the header and on the shop page."],
      ["quickView", "Quick view", "Open a product in a drawer without leaving the grid."],
      ["coupons", "Coupon codes", "Show the discount code field at checkout."],
      ["sizeGuide", "Size guide", "Show the measurements drawer on product pages."],
      ["stockBadges", "Stock badges", "“Only 2 left” style urgency on product cards."],
      ["backInStockNotify", "Back-in-stock alerts", "Collect emails for sold-out variants."],
      ["orderTracking", "Order tracking page", "Public /track page using the order code and phone."],
    ],
  },
  {
    title: "Storytelling",
    keys: [
      ["intro", "First-visit intro", "A brief brand curtain the first time someone lands."],
      ["animations", "Motion", "Scroll reveals and page transitions."],
      ["customCursor", "Custom cursor", "The oxide dot cursor on desktop."],
      ["productVideo", "Product video", "Play video in the product gallery."],
      ["socialProof", "Social proof", "Recent-order and review counts."],
      ["reviews", "Reviews", "Show approved reviews and the review form."],
      ["newsletter", "Newsletter", "Email capture in the footer and homepage band."],
    ],
  },
  {
    title: "Visitor controls",
    keys: [
      ["darkModeToggle", "Dark mode toggle", "Let visitors switch theme themselves."],
      ["languageSwitcher", "Language switcher", "English / বাংলা toggle in the header."],
      ["currencySwitcher", "Currency switcher", "Show indicative prices in other currencies."],
      ["aiConcierge", "AI concierge", "The chat bubble. Configure it under Settings → AI concierge."],
      ["pwa", "Install as an app", "Service worker and manifest so the site installs on a phone."],
    ],
  },
];

export function FeaturesForm({ values, csrf }: { values: Record<string, boolean>; csrf: string }) {
  const [state, action] = useActionState(saveFeaturesAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const known = new Set(GROUPS.flatMap((g) => g.keys.map(([k]) => k)));
  const extras = Object.keys(values).filter((k) => !known.has(k));

  return (
    <form action={action} className="space-y-5">
      <CsrfInput value={csrf} />
      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            <div className="divide-y divide-line/70">
              {group.keys.map(([key, label, hint]) => (
                <ToggleRow key={key} name={key} label={label} hint={hint} defaultChecked={Boolean(values[key])} />
              ))}
            </div>
          </Section>
        ))}
        {extras.length > 0 && (
          <Section title="Other">
            <div className="divide-y divide-line/70">
              {extras.map((key) => (
                <ToggleRow key={key} name={key} label={key} defaultChecked={Boolean(values[key])} />
              ))}
            </div>
          </Section>
        )}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          Save features
        </SubmitButton>
      </div>
    </form>
  );
}

export default FeaturesForm;
