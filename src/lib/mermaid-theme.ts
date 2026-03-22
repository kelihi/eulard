/**
 * Shared mermaid theme configuration for light and dark modes.
 * Used by both the preview component and export utilities.
 */

export interface MermaidThemeConfig {
  theme: "base";
  themeVariables: Record<string, string>;
}

const lightTheme: MermaidThemeConfig = {
  theme: "base",
  themeVariables: {
    // Background & text
    primaryColor: "#f8fafc",
    primaryTextColor: "#1e293b",
    primaryBorderColor: "#e2e8f0",
    // Lines & edges
    lineColor: "#94a3b8",
    // Secondary (decision nodes, etc.)
    secondaryColor: "#f1f5f9",
    secondaryTextColor: "#1e293b",
    secondaryBorderColor: "#e2e8f0",
    // Tertiary
    tertiaryColor: "#f0f0ff",
    tertiaryTextColor: "#1e293b",
    tertiaryBorderColor: "#e2e8f0",
    // Fonts
    fontFamily: "var(--font-inter, system-ui, -apple-system, sans-serif)",
    fontSize: "14px",
    // Notes
    noteBkgColor: "#f8fafc",
    noteTextColor: "#1e293b",
    noteBorderColor: "#e2e8f0",
    // Flowchart specifics
    nodeBorder: "#e2e8f0",
    mainBkg: "#f8fafc",
    clusterBkg: "#f8fafc",
    clusterBorder: "#e2e8f0",
    titleColor: "#1e293b",
    edgeLabelBackground: "#ffffff",
    // Sequence diagram
    actorBkg: "#f8fafc",
    actorBorder: "#e2e8f0",
    actorTextColor: "#1e293b",
    signalColor: "#94a3b8",
    signalTextColor: "#1e293b",
    labelBoxBkgColor: "#f8fafc",
    labelBoxBorderColor: "#e2e8f0",
    labelTextColor: "#1e293b",
    loopTextColor: "#64748b",
    activationBorderColor: "#e2e8f0",
    activationBkgColor: "#f1f5f9",
    sequenceNumberColor: "#ffffff",
  },
};

const darkTheme: MermaidThemeConfig = {
  theme: "base",
  themeVariables: {
    // Background & text
    primaryColor: "#1e293b",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#334155",
    // Lines & edges
    lineColor: "#64748b",
    // Secondary
    secondaryColor: "#334155",
    secondaryTextColor: "#e2e8f0",
    secondaryBorderColor: "#475569",
    // Tertiary
    tertiaryColor: "#1e1b4b",
    tertiaryTextColor: "#e2e8f0",
    tertiaryBorderColor: "#334155",
    // Fonts
    fontFamily: "var(--font-inter, system-ui, -apple-system, sans-serif)",
    fontSize: "14px",
    // Notes
    noteBkgColor: "#1e293b",
    noteTextColor: "#e2e8f0",
    noteBorderColor: "#334155",
    // Flowchart specifics
    nodeBorder: "#334155",
    mainBkg: "#1e293b",
    clusterBkg: "#1e293b",
    clusterBorder: "#334155",
    titleColor: "#e2e8f0",
    edgeLabelBackground: "#0f172a",
    // Sequence diagram
    actorBkg: "#1e293b",
    actorBorder: "#334155",
    actorTextColor: "#e2e8f0",
    signalColor: "#64748b",
    signalTextColor: "#e2e8f0",
    labelBoxBkgColor: "#1e293b",
    labelBoxBorderColor: "#334155",
    labelTextColor: "#e2e8f0",
    loopTextColor: "#94a3b8",
    activationBorderColor: "#334155",
    activationBkgColor: "#334155",
    sequenceNumberColor: "#e2e8f0",
  },
};

/** Detect if the user prefers dark mode */
export function isDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Get the mermaid theme config for the current color scheme */
export function getMermaidThemeConfig(): MermaidThemeConfig {
  return isDarkMode() ? darkTheme : lightTheme;
}

/** Get the full mermaid.initialize() config */
export function getMermaidInitConfig() {
  const themeConfig = getMermaidThemeConfig();
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: themeConfig.theme,
    themeVariables: themeConfig.themeVariables,
    flowchart: {
      htmlLabels: true,
      useMaxWidth: false,
      curve: "basis" as const,
    },
  };
}
