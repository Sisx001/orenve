import { Wordmark } from "@/components/brand/Logo";

/** Brand loading state — a drawn wordmark rather than a spinner. */
export default function Loading() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6" role="status" aria-live="polite">
      <Wordmark animated height={30} />
      <span className="h-px w-24 overflow-hidden bg-line">
        <span className="block h-px w-1/2 animate-shimmer bg-oxide" />
      </span>
    </div>
  );
}
