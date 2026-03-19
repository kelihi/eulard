"use client";

import { useState } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { downloadPng, downloadSvg, downloadMermaidCode } from "@/lib/export";
import { Download, Image, FileCode, FileText } from "lucide-react";

export function Toolbar() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const title = useDiagramStore((s) => s.diagram?.title ?? "diagram");
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: "png" | "svg" | "mermaid") => {
    setExporting(true);
    setShowMenu(false);
    try {
      const filename = title.replace(/[^a-zA-Z0-9-_]/g, "_") || "diagram";
      switch (format) {
        case "png":
          await downloadPng(code, filename);
          break;
        case "svg":
          await downloadSvg(code, filename);
          break;
        case "mermaid":
          downloadMermaidCode(code, filename);
          break;
      }
    } catch (err) {
      console.error("Export failed:", err instanceof Error ? err.message : String(err));
    }
    setExporting(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting || !code.trim()}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--muted)] disabled:opacity-30 transition-all"
        title="Export diagram"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{exporting ? "Exporting..." : "Export"}</span>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-30 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => handleExport("png")}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              <Image className="w-3.5 h-3.5" />
              PNG
            </button>
            <button
              onClick={() => handleExport("svg")}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              <FileCode className="w-3.5 h-3.5" />
              SVG
            </button>
            <button
              onClick={() => handleExport("mermaid")}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Mermaid Code
            </button>
          </div>
        </>
      )}
    </div>
  );
}
