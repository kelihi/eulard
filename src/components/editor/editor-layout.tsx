"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { CodeEditor } from "./code-editor";
import { MermaidPreview } from "./mermaid-preview";

// Lazy-load React Flow canvas (heavy dependency)
const VisualCanvas = dynamic(
  () => import("./visual-canvas").then((m) => ({ default: m.VisualCanvas })),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">Loading canvas...</div> }
);

type ViewMode = "split" | "canvas";

export function EditorLayout() {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [splitPercent, setSplitPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border)] bg-[var(--muted)] shrink-0">
        <button
          onClick={() => setViewMode("split")}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            viewMode === "split"
              ? "bg-[var(--background)] shadow-sm font-medium"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Code + Preview
        </button>
        <button
          onClick={() => setViewMode("canvas")}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            viewMode === "canvas"
              ? "bg-[var(--background)] shadow-sm font-medium"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Visual Canvas
        </button>
      </div>

      {/* Panes */}
      {viewMode === "split" ? (
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          <div style={{ width: `${splitPercent}%` }} className="h-full min-w-0">
            <CodeEditor />
          </div>
          <div
            onMouseDown={handleMouseDown}
            className="w-1 bg-[var(--border)] hover:bg-[var(--primary)] cursor-col-resize transition-colors shrink-0"
          />
          <div
            style={{ width: `${100 - splitPercent}%` }}
            className="h-full min-w-0 bg-white dark:bg-[var(--muted)]"
          >
            <MermaidPreview />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div style={{ width: "35%" }} className="h-full min-w-0">
            <CodeEditor />
          </div>
          <div className="w-1 bg-[var(--border)] shrink-0" />
          <div style={{ width: "65%" }} className="h-full min-w-0">
            <VisualCanvas />
          </div>
        </div>
      )}
    </div>
  );
}
