import type { Node } from "@xyflow/react";
import type { FlowchartGraph, FlowchartDirection, MermaidNodeType } from "@/types/graph";
import type { FlowNodeData } from "./graph-to-reactflow";

/**
 * Compute the absolute position of a React Flow node by traversing the
 * parent chain.  Child nodes store positions relative to their parent,
 * so we need to accumulate offsets up to the root.
 */
function absolutePosition(
  node: Node,
  nodeMap: Map<string, Node>
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
  while (current.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

/**
 * Update node positions in a flowchart graph from React Flow node state.
 * Preserves all other graph data (edges, labels, types, subgraphs).
 *
 * React Flow stores child-node positions relative to their parent, but
 * the internal graph model always uses absolute canvas coordinates.
 * This function converts back to absolute before storing.
 */
export function updateGraphPositions(
  graph: FlowchartGraph,
  rfNodes: Node[]
): FlowchartGraph {
  const nodeMap = new Map(rfNodes.map((n) => [n.id, n]));

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const rfNode = nodeMap.get(node.id);
      if (!rfNode) return node;
      return {
        ...node,
        position: absolutePosition(rfNode, nodeMap),
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
  const nodeMap = new Map(rfNodes.map((n) => [n.id, n]));

  return {
    diagramType: "flowchart",
    direction,
    nodes: rfNodes
      .filter((n) => !(n.data as FlowNodeData)?.isSubgraph)
      .map((n) => ({
        id: n.id,
        label: (n.data?.label as string) ?? n.id,
        type: ((n.data?.mermaidType as string) ?? "default") as MermaidNodeType,
        position: absolutePosition(n, nodeMap),
      })),
    edges: [], // edges are preserved from the existing graph
    subgraphs: [], // subgraphs are preserved from the existing graph
  };
}
