import type { Node, Edge } from "@xyflow/react";
import type { FlowchartGraph } from "@/types/graph";

export interface FlowNodeData {
  label: string;
  mermaidType: string;
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
    label: e.label,
    type: "default",
    animated: e.type === "dotted",
    style: e.type === "thick" ? { strokeWidth: 3 } : undefined,
  }));

  return { nodes, edges };
}
