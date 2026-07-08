import { describe, it, expect } from "vitest";
import { graphToMermaid } from "./graph-to-mermaid";
import type { FlowchartGraph } from "@/types/graph";

describe("graphToMermaid — annotation emission", () => {
  it("emits node directive when position is non-default", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [{ id: "A", label: "Start", type: "default", position: { x: 120, y: 40 } }],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("A[Start]");
    expect(code).toContain("%%@ node A pos=120,40");
  });

  it("does NOT emit directive when position is the origin (default)", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [{ id: "A", label: "Start", type: "default", position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(graphToMermaid(g)).not.toContain("%%@");
  });

  it("emits size and style for a styled, sized node", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        {
          id: "A",
          label: "Start",
          type: "default",
          position: { x: 0, y: 0 },
          size: { width: 200, height: 80 },
          style: { backgroundColor: "#fee" },
        },
      ],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("%%@ node A size=200x80 fill=#fee");
  });

  it("emits edge directive when edge has style", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 0, y: 0 } },
        { id: "B", label: "B", type: "default", position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: "e0", source: "A", target: "B", type: "arrow", style: { lineColor: "#10b981" } },
      ],
    };
    expect(graphToMermaid(g)).toContain("%%@ edge A->B color=#10b981");
  });

  it("emits annotations after the topology line they describe", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 10, y: 20 } },
        { id: "B", label: "B", type: "default", position: { x: 30, y: 40 } },
      ],
      edges: [],
    };
    const lines = graphToMermaid(g).split("\n");
    const aIdx = lines.findIndex((l) => l.includes("A[A]") || l.trim() === "A");
    const aAnnIdx = lines.findIndex((l) => l.includes("%%@ node A"));
    expect(aAnnIdx).toBeGreaterThan(aIdx);
  });

  it("emits positions for every node once any node is positioned", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 0, y: 0 } },
        { id: "B", label: "B", type: "default", position: { x: 12, y: 18 } },
      ],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("%%@ node A pos=0,0");
    expect(code).toContain("%%@ node B pos=12,18");
  });

  it("renders native Mermaid shapes for hexagon, parallelogram, and trapezoid", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        { id: "H", label: "Hex", type: "hexagon", position: { x: 0, y: 0 } },
        { id: "P", label: "Para", type: "parallelogram", position: { x: 0, y: 0 } },
        { id: "T", label: "Trap", type: "trapezoid", position: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("H{{Hex}}");
    expect(code).toContain("P[/Para/]");
    expect(code).toContain("T[/Trap\\]");
    expect(code).not.toContain("shape=");
  });
});

import { mermaidToGraph } from "./mermaid-to-graph";

describe("graphToMermaid → mermaidToGraph round trip", () => {
  it("preserves position, size, and style across a full round trip", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        {
          id: "A",
          label: "Start",
          type: "default",
          position: { x: 120, y: 40 },
          size: { width: 200, height: 80 },
          style: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
        },
        { id: "B", label: "B", type: "decision", position: { x: 300, y: 40 } },
      ],
      edges: [
        { id: "e0", source: "A", target: "B", type: "arrow", style: { lineColor: "#10b981", lineThickness: 3 } },
      ],
    };
    const code = graphToMermaid(g);
    const back = mermaidToGraph(code)!;
    const a = back.nodes.find((n) => n.id === "A")!;
    expect(a.position).toEqual({ x: 120, y: 40 });
    expect(a.size).toEqual({ width: 200, height: 80 });
    expect(a.style).toEqual({ backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" });
    expect(back.edges[0].style).toEqual({ lineColor: "#10b981", lineThickness: 3 });
  });

  it("preserves subgraphs, passthrough directives, and annotations in substance", () => {
    const code = `flowchart TB
    subgraph outer[Outer]
        subgraph inner[Inner]
            A[Start]
        end
        B[End]
    end
    A --> B
    %%@ node A pos=120,40
    %%@ edge A->B color=#10b981
    %%@ defaults node fill=#fef3c7
    classDef highlight fill:#fef3c7,stroke:#f59e0b
    class A highlight
    style B fill:#dbeafe,stroke:#3b82f6`;

    const once = graphToMermaid(mermaidToGraph(code)!);
    const twice = graphToMermaid(mermaidToGraph(once)!);

    expect(twice).toBe(once);
    expect((once.match(/%%@ node A pos=120,40/g) ?? []).length).toBe(1);
    expect((once.match(/%%@ edge A->B color=#10b981/g) ?? []).length).toBe(1);
    expect((once.match(/%%@ defaults node fill=#fef3c7/g) ?? []).length).toBe(1);
    expect((once.match(/subgraph outer\[Outer\]/g) ?? []).length).toBe(1);
    expect((once.match(/subgraph inner\[Inner\]/g) ?? []).length).toBe(1);
    expect((once.match(/classDef highlight fill:#fef3c7,stroke:#f59e0b/g) ?? []).length).toBe(1);
    expect((once.match(/style B fill:#dbeafe,stroke:#3b82f6/g) ?? []).length).toBe(1);
  });
});
