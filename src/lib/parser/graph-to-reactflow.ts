import type { Node, Edge } from "@xyflow/react";
import type { FlowchartGraph } from "@/types/graph";

export interface FlowNodeData {
  label: string;
  mermaidType: string;
  [key: string]: unknown;
}

export interface FlowEdgeData {
  edgeLabel: string;
  edgeId: string;
  mermaidEdgeType: string;
  onRenameEdge?: (edgeId: string, newLabel: string) => void;
  [key: string]: unknown;
}

/**
 * Convert a flowchart graph to React Flow nodes and edges.
 */
export function graphToReactFlow(graph: FlowchartGraph): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<FlowNodeData>[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type, // maps to custom nodeTypes
    position: n.position,
    data: {
      label: n.label,
      mermaidType: n.type,
    },
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "custom",
    animated: e.type === "dotted",
    style: e.type === "thick" ? { strokeWidth: 3 } : undefined,
    data: {
      edgeLabel: e.label ?? "",
      edgeId: e.id,
      mermaidEdgeType: e.type,
    } satisfies FlowEdgeData,
  }));

  return { nodes, edges };
}
