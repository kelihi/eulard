import { describe, expect, it } from "vitest";
import { graphToReactFlow } from "./graph-to-reactflow";
import type { FlowchartGraph } from "@/types/graph";

describe("graphToReactFlow", () => {
  it("layers global defaults beneath per-node and per-edge styles", () => {
    const graph: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      globalNodeStyle: {
        backgroundColor: "#e0f2fe",
        borderColor: "#0ea5e9",
        fontColor: "#075985",
      },
      globalEdgeStyle: {
        lineColor: "#10b981",
      },
      nodes: [
        {
          id: "A",
          label: "Start",
          type: "default",
          position: { x: 0, y: 0 },
          style: { borderColor: "#f59e0b" },
        },
      ],
      edges: [
        {
          id: "e-thick",
          source: "A",
          target: "A",
          type: "thick",
        },
        {
          id: "e0",
          source: "A",
          target: "A",
          type: "arrow",
          style: { lineThickness: 5 },
        },
      ],
    };

    const { nodes, edges } = graphToReactFlow(graph);

    expect(nodes[0].data.style).toEqual({
      backgroundColor: "#e0f2fe",
      borderColor: "#f59e0b",
      fontColor: "#075985",
    });
    expect(nodes[0].style).toMatchObject({
      backgroundColor: "#e0f2fe",
      borderColor: "#f59e0b",
      color: "#075985",
    });
    expect(edges[0].style).toMatchObject({
      strokeWidth: 3,
    });
    expect(edges[1].style).toMatchObject({
      stroke: "#10b981",
      strokeWidth: 5,
    });
  });

  it("lets explicit thick-edge thickness override the default", () => {
    const graph: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      subgraphs: [],
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 0, y: 0 } },
        { id: "B", label: "B", type: "default", position: { x: 0, y: 0 } },
      ],
      edges: [
        {
          id: "e0",
          source: "A",
          target: "B",
          type: "thick",
          style: { lineThickness: 6 },
        },
      ],
    };

    const { edges } = graphToReactFlow(graph);
    expect(edges[0].style).toMatchObject({ strokeWidth: 6 });
  });
});
