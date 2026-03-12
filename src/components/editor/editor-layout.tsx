"use client";

import { useState, useRef, useCallback } from "react";
import { CodeEditor } from "./code-editor";
import { MermaidPreview } from "./mermaid-preview";

export function EditorLayout() {
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
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Code Editor Pane */}
      <div style={{ width: `${splitPercent}%` }} className="h-full min-w-0">
        <CodeEditor />
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-[var(--border)] hover:bg-[var(--primary)] cursor-col-resize transition-colors shrink-0"
      />

      {/* Preview Pane */}
      <div
        style={{ width: `${100 - splitPercent}%` }}
        className="h-full min-w-0 bg-white dark:bg-[var(--muted)]"
      >
        <MermaidPreview />
      </div>
    </div>
  );
}
