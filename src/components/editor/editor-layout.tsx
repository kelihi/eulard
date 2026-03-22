"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { CodeEditor } from "./code-editor";
import { MermaidPreview } from "./mermaid-preview";
import { StylePanel } from "./style-panel";
import { Maximize2, Minimize2, Paintbrush } from "lucide-react";

// Lazy-load React Flow canvas (heavy dependency)
const VisualCanvas = dynamic(
  () => import("./visual-canvas").then((m) => ({ default: m.VisualCanvas })),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">Loading canvas...</div> }
);

type ViewMode = "split" | "canvas";
type FullscreenPane = null | "code" | "preview" | "canvas";

interface EditorLayoutProps {
  codeHidden?: boolean;
}

export function EditorLayout({ codeHidden = false }: EditorLayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [splitPercent, setSplitPercent] = useState(50);
  const [fullscreenPane, setFullscreenPane] = useState<FullscreenPane>(null);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const toggleFullscreen = useCallback((pane: FullscreenPane) => {
    setFullscreenPane((current) => (current === pane ? null : pane));
  }, []);

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

  const fullscreenButton = (pane: NonNullable<FullscreenPane>, title: string) => (
    <button
      onClick={() => toggleFullscreen(pane)}
      className="absolute top-1 right-1 z-10 p-1 rounded bg-[var(--background)]/80 hover:bg-[var(--muted)] border border-[var(--border)] opacity-0 group-hover/pane:opacity-100 transition-opacity"
      title={fullscreenPane === pane ? `Exit fullscreen` : `Fullscreen ${title}`}
    >
      {fullscreenPane === pane ? (
        <Minimize2 className="w-3.5 h-3.5" />
      ) : (
        <Maximize2 className="w-3.5 h-3.5" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--muted)] shrink-0">
        <button
          onClick={() => { setViewMode("split"); setFullscreenPane(null); }}
          className={`px-3 py-1 text-xs rounded-md transition-all duration-150 ${
            viewMode === "split"
              ? "bg-[var(--background)] shadow-sm font-medium text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50"
          }`}
        >
          Code + Preview
        </button>
        <button
          onClick={() => { setViewMode("canvas"); setFullscreenPane(null); }}
          className={`px-3 py-1 text-xs rounded-md transition-all duration-150 ${
            viewMode === "canvas"
              ? "bg-[var(--background)] shadow-sm font-medium text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50"
          }`}
        >
          Visual Canvas
        </button>

        <div className="ml-auto flex items-center gap-1">
          {fullscreenPane && (
            <button
              onClick={() => setFullscreenPane(null)}
              className="px-2 py-0.5 text-xs rounded bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors flex items-center gap-1"
            >
              <Minimize2 className="w-3 h-3" />
              Exit Fullscreen
            </button>
          )}
          <button
            onClick={() => setStylePanelOpen(!stylePanelOpen)}
            className={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1 ${
              stylePanelOpen
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
            }`}
            title="Toggle style controls"
          >
            <Paintbrush className="w-3 h-3" />
            Styles
          </button>
        </div>
      </div>

      {/* Panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div className="flex flex-1 overflow-hidden min-w-0">
          {viewMode === "split" ? (
            <div ref={containerRef} className="flex flex-1 overflow-hidden">
              {!codeHidden && fullscreenPane !== "preview" && (
                <div
                  style={{ width: fullscreenPane === "code" ? "100%" : `${splitPercent}%` }}
                  className="h-full min-w-0 relative group/pane"
                >
                  {fullscreenButton("code", "Code Editor")}
                  <CodeEditor />
                </div>
              )}
              {!codeHidden && !fullscreenPane && (
                <div
                  onMouseDown={handleMouseDown}
                  className="w-px bg-[var(--border)] hover:w-0.5 hover:bg-[var(--primary)] cursor-col-resize transition-all duration-150 shrink-0"
                />
              )}
              {fullscreenPane !== "code" && (
                <div
                  style={{ width: codeHidden || fullscreenPane === "preview" ? "100%" : `${100 - splitPercent}%` }}
                  className="h-full min-w-0 bg-white dark:bg-[var(--muted)] relative group/pane"
                >
                  {fullscreenButton("preview", "Preview")}
                  <MermaidPreview />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {!codeHidden && fullscreenPane !== "canvas" && (
                <div
                  style={{ width: fullscreenPane === "code" ? "100%" : "35%" }}
                  className="h-full min-w-0 relative group/pane"
                >
                  {fullscreenButton("code", "Code Editor")}
                  <CodeEditor />
                </div>
              )}
              {!codeHidden && !fullscreenPane && (
                <div className="w-px bg-[var(--border)] shrink-0" />
              )}
              {fullscreenPane !== "code" && (
                <div
                  style={{ width: codeHidden || fullscreenPane === "canvas" ? "100%" : "65%" }}
                  className="h-full min-w-0 relative group/pane"
                >
                  {fullscreenButton("canvas", "Visual Canvas")}
                  <VisualCanvas />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Style panel sidebar */}
        {stylePanelOpen && (
          <>
            <div className="w-px bg-[var(--border)] shrink-0" />
            <div className="w-[260px] shrink-0 h-full bg-[var(--background)] border-l border-[var(--border)]">
              <StylePanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
