import type { Node } from "@xyflow/react";
import type { FlowchartGraph } from "@/types/graph";

/**
 * Update node positions in a flowchart graph from React Flow node state.
 * Preserves all other graph data (edges, labels, types, subgraphs, passthrough).
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
