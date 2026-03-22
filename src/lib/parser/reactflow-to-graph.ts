import type { Node } from "@xyflow/react";
import type { FlowchartGraph, FlowchartDirection, MermaidNodeType } from "@/types/graph";
import type { FlowNodeData } from "./graph-to-reactflow";

/**
 * Update node positions in a flowchart graph from React Flow node state.
 * Preserves all other graph data (edges, labels, types, subgraphs).
 */
export function updateGraphPositions(
  graph: FlowchartGraph,
  rfNodes: Node[]
): FlowchartGraph {
  const positionMap = new Map(
    rfNodes.map((n) => [n.id, n.position])
  );

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: positionMap.get(node.id) ?? node.position,
    })),
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
    nodes: rfNodes
      .filter((n) => !(n.data as FlowNodeData)?.isSubgraph)
      .map((n) => ({
        id: n.id,
        label: (n.data?.label as string) ?? n.id,
        type: ((n.data?.mermaidType as string) ?? "default") as MermaidNodeType,
        position: n.position,
      })),
    edges: [], // edges are preserved from the existing graph
    subgraphs: [], // subgraphs are preserved from the existing graph
  };
}
