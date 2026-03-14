"use client";

import { useEffect, useRef, useState } from "react";
import { useDiagramStore } from "@/stores/diagram-store";

let mermaidInstance: typeof import("mermaid") | null = null;
let renderCounter = 0;

async function getMermaid() {
  if (!mermaidInstance) {
    mermaidInstance = await import("mermaid");
    mermaidInstance.default.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "default",
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
      },
    });
  }
  return mermaidInstance.default;
}

export function MermaidPreview() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setError = useDiagramStore((s) => s.setError);
  const containerRef = useRef<HTMLDivElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;

    const timer = setTimeout(async () => {
      if (!code.trim() || !containerRef.current) return;
      if (generation !== generationRef.current) return;

      try {
        const mermaid = await getMermaid();
        await mermaid.parse(code);

        if (generation !== generationRef.current) return;

        const id = `mermaid-${++renderCounter}`;
        const { svg } = await mermaid.render(id, code);

        if (generation !== generationRef.current) return;

        // Sanitize SVG — DOMPurify loaded dynamically (client-only)
        const DOMPurify = (await import("dompurify")).default;
        const clean = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ["foreignObject", "style"],
          FORBID_TAGS: ["script", "iframe"],
          FORBID_ATTR: [
            "onclick",
            "onload",
            "onerror",
            "onmouseover",
            "onfocus",
            "onblur",
          ],
        });

        if (containerRef.current && generation === generationRef.current) {
          containerRef.current.innerHTML = clean;
          setParseError(null);
          setError(null);
        }
      } catch (err) {
        if (generation !== generationRef.current) return;
        const message =
          err instanceof Error ? err.message : "Invalid mermaid syntax";
        setParseError(message);
        setError(message);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [code, setError]);

  return (
    <div className="h-full flex flex-col">
      {parseError && (
        <div className="px-3 py-2 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-900 shrink-0">
          {parseError}
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-preview flex-1 overflow-auto p-4 flex items-start justify-center"
      />
    </div>
  );
}
