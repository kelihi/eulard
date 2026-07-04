/**
 * Shared mermaid theme configuration for light and dark modes.
 * Uses post-render CSS injection for guaranteed theme application.
 */

/** Detect if the user prefers dark mode */
export function isDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Get the mermaid.initialize() config (basic settings only — theme applied via CSS) */
export function getMermaidInitConfig() {
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: "neutral" as const,
    flowchart: {
      htmlLabels: true,
      useMaxWidth: false,
      curve: "basis" as const,
    },
  };
}

/**
 * Apply theme colors to a rendered mermaid SVG via CSS injection.
 * This overrides mermaid's built-in theme colors with our design system.
 * Called after every render, before any user style overrides.
 */
export function applyMermaidTheme(svgEl: SVGSVGElement): void {
  // Remove any previously injected theme
  const existing = svgEl.querySelector("style[data-eulard-theme]");
  if (existing) existing.remove();

  const dark = isDarkMode();

  // Color tokens
  const nodeBg = dark ? "#1f1f1f" : "#ffffff";
  const nodeText = dark ? "#e5e5e5" : "#1e293b";
  const nodeBorder = dark ? "#3a3a3a" : "#94a3b8";
  const edgeColor = dark ? "#555555" : "#94a3b8";
  const edgeLabelBg = dark ? "#111111" : "#ffffff";
  const clusterBg = dark ? "#1a1a1a" : "#f8fafc";
  const clusterBorder = dark ? "#2a2a2a" : "#cbd5e1";
  const fontFamily = "Inter, system-ui, -apple-system, sans-serif";

  const css = `
    /* === Eulard Theme (${dark ? "dark" : "light"}) === */

    /* Node shapes */
    .node rect,
    .node polygon,
    .node circle,
    .node ellipse,
    .node path,
    .node .basic.label-container {
      fill: ${nodeBg} !important;
      stroke: ${nodeBorder} !important;
      stroke-width: 1.5px !important;
      rx: 6 !important;
      ry: 6 !important;
    }

    /* Node text */
    .node .nodeLabel,
    .node .label,
    .node .label div,
    .node .label span,
    .node foreignObject div {
      color: ${nodeText} !important;
      fill: ${nodeText} !important;
      font-family: ${fontFamily} !important;
      font-size: 13px !important;
      font-weight: 500 !important;
    }

    /* Edge lines */
    .edgePath path.path,
    .edgePath path,
    .flowchart-link {
      stroke: ${edgeColor} !important;
      stroke-width: 1.5px !important;
    }

    /* Arrowheads */
    marker path,
    .arrowheadPath,
    marker[id*="arrow"] path,
    defs marker path {
      fill: ${edgeColor} !important;
      stroke: ${edgeColor} !important;
    }

    /* Edge labels */
    .edgeLabel,
    .edgeLabel rect,
    .edgeLabel .label {
      background-color: ${edgeLabelBg} !important;
      fill: ${edgeLabelBg} !important;
    }

    .edgeLabel span,
    .edgeLabel .label span {
      color: ${nodeText} !important;
      fill: ${nodeText} !important;
      font-family: ${fontFamily} !important;
      font-size: 12px !important;
      background: ${edgeLabelBg} !important;
    }

    /* Cluster/subgraph backgrounds */
    .cluster rect {
      fill: ${clusterBg} !important;
      stroke: ${clusterBorder} !important;
      stroke-width: 1px !important;
      rx: 8 !important;
      ry: 8 !important;
    }

    .cluster-label .nodeLabel,
    .cluster .label {
      color: ${nodeText} !important;
      fill: ${nodeText} !important;
      font-family: ${fontFamily} !important;
      font-weight: 600 !important;
    }

    /* Title */
    .titleText {
      fill: ${nodeText} !important;
      font-family: ${fontFamily} !important;
    }
  `;

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("data-eulard-theme", "true");
  styleEl.textContent = css;
  svgEl.prepend(styleEl);
}
