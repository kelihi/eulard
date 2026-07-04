import { describe, it, expect } from "vitest";
import { mermaidToGraph } from "./mermaid-to-graph";

describe("mermaidToGraph — annotation merging", () => {
  it("populates node position from %%@ node directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A pos=120,40
    A --> B`;
    const g = mermaidToGraph(code)!;
    const a = g.nodes.find((n) => n.id === "A")!;
    expect(a.position).toEqual({ x: 120, y: 40 });
  });

  it("populates node size from directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A size=200x80
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.size).toEqual({
      width: 200,
      height: 80,
    });
  });

  it("populates node style from directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A fill=#e0f2fe stroke=#0ea5e9
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.style).toEqual({
      backgroundColor: "#e0f2fe",
      borderColor: "#0ea5e9",
    });
  });

  it("annotation `shape` overrides bracket-derived type", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A shape=hexagon
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.type).toBe("hexagon");
  });

  it("parses native Mermaid hexagon, parallelogram, and trapezoid shapes", () => {
    const code = `flowchart TB
    H{{Hex}}
    P[/Para/]
    T[/Trap\\]
    H --> P --> T`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "H")!.type).toBe("hexagon");
    expect(g.nodes.find((n) => n.id === "P")!.type).toBe("parallelogram");
    expect(g.nodes.find((n) => n.id === "T")!.type).toBe("trapezoid");
  });

  it("captures defaults annotations as render-only graph styles", () => {
    const code = `flowchart TB
    A[Start]
    %%@ defaults node fill=#e0f2fe stroke=#0ea5e9
    %%@ defaults edge lineColor=#10b981`;
    const g = mermaidToGraph(code)!;
    expect(g.globalNodeStyle).toEqual({
      backgroundColor: "#e0f2fe",
      borderColor: "#0ea5e9",
    });
    expect(g.globalEdgeStyle).toEqual({
      lineColor: "#10b981",
    });
  });

  it("populates edge style from directive", () => {
    const code = `flowchart TB
    A --> B
    %%@ edge A->B color=#10b981 width=3`;
    const g = mermaidToGraph(code)!;
    expect(g.edges[0].style).toEqual({
      lineColor: "#10b981",
      lineThickness: 3,
    });
  });

  it("falls back gracefully when annotations reference unknown nodes/edges", () => {
    const code = `flowchart TB
    A --> B
    %%@ node Z pos=0,0
    %%@ edge X->Y color=#fff`;
    const g = mermaidToGraph(code);
    expect(g).not.toBeNull(); // does not throw
    expect(g!.nodes).toHaveLength(2); // A, B only
  });
});
