"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[studio]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <span aria-hidden className="display text-5xl text-line">O/</span>
      <h1 className="display mt-6 text-2xl">Something went wrong in the studio</h1>
      <p className="mt-3 text-sm text-muted">
        Nothing was saved. Try again — if it keeps happening, the server log has the detail.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">ref {error.digest}</p>}
      <div className="mt-8 flex gap-2">
        <button type="button" onClick={reset} className="btn px-4 py-2.5 text-[0.65rem]">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
        <Link href="/admin" className="btn-outline px-4 py-2.5 text-[0.65rem]">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
