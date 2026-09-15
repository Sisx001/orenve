import type { ReactNode } from "react";

/**
 * Markdown-lite renderer for owner-authored CMS copy.
 * Deliberately tiny and safe: no HTML parsing, no dangerouslySetInnerHTML.
 *
 * Supported:
 *   - blank line          → new paragraph
 *   - lines "- item"      → unordered list
 *   - "## Heading"        → h2, "### Heading" → h3
 *   - **bold**            → <strong>
 *   - single newline      → <br />
 */

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string };

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  segments.forEach((seg, i) => {
    if (!seg) return;
    if (seg.length > 4 && seg.startsWith("**") && seg.endsWith("**")) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold">
          {seg.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(<span key={`${keyBase}-t${i}`}>{seg}</span>);
    }
  });
  return out;
}

function withBreaks(lines: string[], keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyBase}-br${i}`} />);
    out.push(...inline(line, `${keyBase}-l${i}`));
  });
  return out;
}

export function parseRichText(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const raw = chunk.trim();
    if (!raw) continue;
    const lines = raw.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ kind: "ul", items: lines.map((l) => l.slice(2).trim()) });
      continue;
    }
    if (lines.length === 1 && lines[0].startsWith("### ")) {
      blocks.push({ kind: "h3", text: lines[0].slice(4).trim() });
      continue;
    }
    if (lines.length === 1 && lines[0].startsWith("## ")) {
      blocks.push({ kind: "h2", text: lines[0].slice(3).trim() });
      continue;
    }
    blocks.push({ kind: "p", lines });
  }
  return blocks;
}

/** Renders markdown-lite copy. Server-safe (no hooks, no client boundary). */
export function RichText({ body, className }: { body: string; className?: string }) {
  const blocks = parseRichText(body);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "ul") {
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `b${i}-i${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "h2") return <h2 key={i}>{inline(b.text, `b${i}`)}</h2>;
        if (b.kind === "h3") return <h3 key={i}>{inline(b.text, `b${i}`)}</h3>;
        return <p key={i}>{withBreaks(b.lines, `b${i}`)}</p>;
      })}
    </div>
  );
}

/** Splits a display headline on "\n" so alternating lines can be italicised. */
export function headlineLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
}
