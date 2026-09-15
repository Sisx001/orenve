import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { AiForm } from "./AiForm";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requireStudio("ai.configure", "/admin/settings/ai");
  const [ai, csrf] = await Promise.all([getSetting("ai"), csrfToken()]);

  return (
    <div>
      <PageHeader
        title="AI concierge"
        description="A support assistant grounded in your own catalogue, orders and policies. It never invents stock, prices or delivery promises."
      />
      <AiForm
        csrf={csrf}
        values={{
          enabled: ai.enabled,
          baseUrl: ai.baseUrl,
          model: ai.model,
          // the key itself never leaves the server
          hasKey: Boolean(ai.apiKey),
          envKey: Boolean(process.env.AI_API_KEY),
          temperature: ai.temperature,
          maxTokens: ai.maxTokens,
          assistantNameEn: ai.assistantName.en ?? "",
          assistantNameBn: ai.assistantName.bn ?? "",
          greetingEn: ai.greeting.en ?? "",
          greetingBn: ai.greeting.bn ?? "",
          extraInstructions: ai.extraInstructions,
          allowProductSearch: ai.allowProductSearch,
          allowOrderLookup: ai.allowOrderLookup,
          requirePhoneForOrder: ai.requirePhoneForOrder,
          maxMessagesPerSession: ai.maxMessagesPerSession,
          rateLimitPerHour: ai.rateLimitPerHour,
          logConversations: ai.logConversations,
          handoffWhatsapp: ai.handoffWhatsapp,
        }}
      />
    </div>
  );
}
