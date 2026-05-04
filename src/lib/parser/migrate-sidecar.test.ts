import { describe, it, expect } from "vitest";
import { migrateSidecarToCode } from "./migrate-sidecar";

describe("migrateSidecarToCode", () => {
  it("returns code unchanged when sidecars are empty", () => {
    const code = `flowchart TB
    A --> B`;
    expect(migrateSidecarToCode({ code, positions: null, styleOverrides: null })).toBe(code);
  });

  it("bakes positions JSON into %%@ annotations", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: JSON.stringify({ A: { x: 10, y: 20 }, B: { x: 30, y: 40 } }),
      styleOverrides: null,
    });
    expect(out).toContain("%%@ node A pos=10,20");
    expect(out).toContain("%%@ node B pos=30,40");
  });

  it("bakes per-node style overrides into annotations", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: null,
      styleOverrides: JSON.stringify({
        nodes: { A: { backgroundColor: "#fee", fontColor: "#333" } },
      }),
    });
    expect(out).toContain("%%@ node A fill=#fee color=#333");
  });

  it("bakes global defaults into a defaults directive", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: null,
      styleOverrides: JSON.stringify({
        globalNode: { fontFamily: "Arial", fontSize: 14 },
        globalEdge: { lineColor: "#888" },
      }),
    });
    expect(out).toContain("%%@ defaults node font=Arial size=14");
    expect(out).toContain("%%@ defaults edge lineColor=#888");
  });

  it("is idempotent — re-running on already-migrated code is a no-op", () => {
    const code = `flowchart TB
    A --> B`;
    const once = migrateSidecarToCode({
      code,
      positions: JSON.stringify({ A: { x: 10, y: 20 } }),
      styleOverrides: null,
    });
    const twice = migrateSidecarToCode({ code: once, positions: null, styleOverrides: null });
    expect(twice).toBe(once);
  });
});
