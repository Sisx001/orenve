import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { TestConsoleClient } from "./TestConsoleClient";

export const dynamic = "force-dynamic";

export default async function TestConsolePage() {
  await requireStudio("ai.configure", "/admin/concierge/test");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Test console"
        description="Chat with the concierge directly, inspect tool calls and tokens, and run the jailbreak test suite."
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
          className="border border-line px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-ink hover:text-ink"
        >
          Requests
        </Link>
        <Link
          href="/admin/concierge/test"
          className="border border-ink bg-ink px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-paper"
        >
          Test console
        </Link>
      </div>

      <TestConsoleClient />
    </div>
  );
}
