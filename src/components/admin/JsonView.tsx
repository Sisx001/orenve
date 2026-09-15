import { cn } from "@/lib/utils";

/** Pretty-printed JSON for audit meta / webhook payloads. */
export function JsonView({ value, className, max = 4000 }: { value: unknown; className?: string; max?: number }) {
  let text: string;
  try {
    text =
      typeof value === "string"
        ? JSON.stringify(JSON.parse(value), null, 2)
        : JSON.stringify(value ?? null, null, 2);
  } catch {
    text = String(value ?? "");
  }
  if (text.length > max) text = `${text.slice(0, max)}\n… truncated`;
  return (
    <pre className={cn("max-h-72 overflow-auto border border-line bg-bone/60 p-3 font-mono text-[0.68rem] leading-relaxed", className)}>
      {text}
    </pre>
  );
}

export default JsonView;
