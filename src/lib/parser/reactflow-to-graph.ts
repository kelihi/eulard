import type { Node } from "@xyflow/react";
import type { FlowchartGraph, FlowchartDirection, MermaidNodeType } from "@/types/graph";
import type { FlowNodeData } from "./graph-to-reactflow";

/**
 * Update node positions in a flowchart graph from React Flow node state.
 * Preserves all other graph data (edges, labels, types).
 */
export function updateGraphPositions(
  graph: FlowchartGraph,
  rfNodes: Node[]
): FlowchartGraph {
  const byId = new Map(rfNodes.map((n) => [n.id, n]));
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const rf = byId.get(node.id);
      if (!rf) return node;
      return {
        ...node,
        position: rf.position,
        size:
          typeof rf.width === "number" && typeof rf.height === "number"
            ? { width: rf.width, height: rf.height }
            : node.size,
      };
    }),
  };
}

/**
 * Build a full FlowchartGraph from React Flow state.
 * Used when React Flow is the source of truth (e.g., after drag).
 */
export function reactFlowToGraph(
  rfNodes: Node<FlowNodeData>[],
  direction: FlowchartDirection
): FlowchartGraph {
  return {
    diagramType: "flowchart",
    direction,
    nodes: rfNodes.map((n) => ({
      id: n.id,
      label: (n.data?.label as string) ?? n.id,
      type: ((n.data?.mermaidType as string) ?? "default") as MermaidNodeType,
      position: n.position,
    })),
    edges: [], // edges are preserved from the existing graph
  };
}
