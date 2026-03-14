import dagre from "dagre";
import type { FlowchartGraph, FlowchartDirection } from "@/types/graph";

const NODE_WIDTH = 172;
const NODE_HEIGHT = 50;

/**
 * Apply dagre auto-layout to position nodes in a flowchart graph.
 * Used when nodes have no positions (freshly parsed from code).
 */
export function autoLayout(graph: FlowchartGraph): FlowchartGraph {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const rankdir = directionToRankdir(graph.direction);
  g.setGraph({ rankdir, nodesep: 50, ranksep: 60 });

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const dagreNode = g.node(node.id);
      return {
        ...node,
        position: {
          x: dagreNode.x - NODE_WIDTH / 2,
          y: dagreNode.y - NODE_HEIGHT / 2,
        },
      };
    }),
  };
}

/**
 * Incremental layout: position only new nodes via dagre while preserving
 * existing node positions. Used by AI graph operations.
 */
export function incrementalLayout(
  graph: FlowchartGraph,
  newNodeIds: string[]
): FlowchartGraph {
  if (newNodeIds.length === 0) return graph;

  // Run full dagre layout on a copy to get ideal positions for new nodes
  const layoutCopy: FlowchartGraph = {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n, position: { ...n.position } })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
  const fullLayout = autoLayout(layoutCopy);

  // For existing nodes: keep current positions
  // For new nodes: use dagre's computed positions
  const newIdSet = new Set(newNodeIds);
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (newIdSet.has(node.id)) {
        const laid = fullLayout.nodes.find((n) => n.id === node.id);
        return laid ? { ...node, position: laid.position } : node;
      }
      return node;
    }),
  };
}

function directionToRankdir(direction: FlowchartDirection): string {
  switch (direction) {
    case "TB":
      return "TB";
    case "BT":
      return "BT";
    case "LR":
      return "LR";
    case "RL":
      return "RL";
    default:
      return "TB";
  }
}
