"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

let mermaidInstance: typeof import("mermaid") | null = null;
let renderCounter = 0;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

async function getMermaid() {
  if (!mermaidInstance) {
    mermaidInstance = await import("mermaid");
    mermaidInstance.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
      },
    });
  }
  return mermaidInstance.default;
}

interface SubgraphSection {
  id: string;
  label: string;
  visible: boolean;
}

/** Parse subgraph blocks from mermaid code */
function parseSubgraphs(code: string): SubgraphSection[] {
  const sections: SubgraphSection[] = [];
  const regex = /^\s*subgraph\s+(\S+?)(?:\s*\[(.+?)\])?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const id = match[1];
    const label = match[2] || id;
    sections.push({ id, label, visible: true });
  }
  return sections;
}

export function MermaidPreview() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setError = useDiagramStore((s) => s.setError);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const generationRef = useRef(0);

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Section toggle state
  const [sections, setSections] = useState<SubgraphSection[]>([]);
  const [sectionPanelOpen, setSectionPanelOpen] = useState(false);

  // Parse subgraphs whenever code changes
  const parsedSections = useMemo(() => parseSubgraphs(code), [code]);

  useEffect(() => {
    setSections((prev) => {
      return parsedSections.map((s) => {
        const existing = prev.find((p) => p.id === s.id);
        return existing ? { ...s, visible: existing.visible } : s;
      });
    });
  }, [parsedSections]);

  // Apply section visibility to SVG
  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    for (const section of sections) {
      // Mermaid renders subgraphs as <g> with class "cluster" and an id containing the subgraph id
      const groups = svgEl.querySelectorAll<SVGGElement>("g.cluster");
      for (const g of groups) {
        const gId = g.getAttribute("id") ?? "";
        const labelEl = g.querySelector(".cluster-label, .nodeLabel");
        const labelText = labelEl?.textContent?.trim() ?? "";
        if (
          gId.includes(section.id) ||
          labelText === section.label ||
          labelText === section.id
        ) {
          g.style.display = section.visible ? "" : "none";
        }
      }

      // Also hide individual nodes within hidden subgraphs by matching ids
      const nodeGroups = svgEl.querySelectorAll<SVGGElement>(
        `g[id*="${section.id}"]`
      );
      for (const ng of nodeGroups) {
        if (!ng.classList.contains("cluster")) {
          ng.style.display = section.visible ? "" : "none";
        }
      }
    }
  }, [sections]);

  // Mermaid render effect
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

        // Sanitize SVG -- DOMPurify loaded dynamically (client-only)
        const DOMPurify = (await import("dompurify")).default;
        const clean = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ["foreignObject"],
          HTML_INTEGRATION_POINTS: { foreignobject: true },
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

  // Zoom helpers
  const clampZoom = useCallback((z: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }, [clampZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - ZOOM_STEP));
  }, [clampZoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current || !viewportRef.current) return;
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    const viewportRect = viewportRef.current.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    // Use natural size (at zoom=1)
    const naturalWidth = svgRect.width / zoom;
    const naturalHeight = svgRect.height / zoom;

    if (naturalWidth === 0 || naturalHeight === 0) return;

    const padding = 32;
    const scaleX = (viewportRect.width - padding) / naturalWidth;
    const scaleY = (viewportRect.height - padding) / naturalHeight;
    const fitZoom = clampZoom(Math.min(scaleX, scaleY));

    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  }, [zoom, clampZoom]);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => clampZoom(z + delta));
      }
    },
    [clampZoom]
  );

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && zoom > 1)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOffset.current = { ...pan };
      }
    },
    [zoom, pan]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({
      x: panOffset.current.x + dx,
      y: panOffset.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Toggle section visibility
  const toggleSection = useCallback((sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      )
    );
  }, []);

  const toggleAllSections = useCallback((visible: boolean) => {
    setSections((prev) => prev.map((s) => ({ ...s, visible })));
  }, []);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--border)] bg-[var(--muted)] shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-[var(--muted-foreground)] min-w-[3rem] text-center tabular-nums select-none">
            {zoomPercent}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-[var(--border)] mx-1" />
          <button
            onClick={handleFitToView}
            className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Fit to view"
          >
            <Maximize size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {sections.length > 0 && (
          <button
            onClick={() => setSectionPanelOpen(!sectionPanelOpen)}
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Toggle sections"
          >
            {sectionPanelOpen ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            Sections ({sections.length})
          </button>
        )}
      </div>

      {/* Section toggle panel */}
      {sectionPanelOpen && sections.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Subgraph Sections
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleAllSections(true)}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Show all
              </button>
              <button
                onClick={() => toggleAllSections(false)}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Hide all
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => toggleSection(section.id)}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors ${
                  section.visible
                    ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] opacity-60"
                }`}
              >
                {section.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                {section.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {parseError && (
        <div className="px-3 py-2 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-900 shrink-0">
          {parseError}
        </div>
      )}

      {/* Zoomable/pannable viewport */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden relative"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor:
            zoom > 1
              ? isPanning.current
                ? "grabbing"
                : "grab"
              : "default",
        }}
      >
        <div
          ref={containerRef}
          className="mermaid-preview p-4 flex items-start justify-center origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center top",
            transition: isPanning.current
              ? "none"
              : "transform 0.15s ease-out",
            minHeight: "100%",
          }}
        />
      </div>

      {/* Zoom hint */}
      {zoom === 1 && (
        <div className="absolute bottom-2 right-2 text-[10px] text-[var(--muted-foreground)] opacity-50 pointer-events-none select-none">
          Ctrl + scroll to zoom
        </div>
      )}
    </div>
  );
}
