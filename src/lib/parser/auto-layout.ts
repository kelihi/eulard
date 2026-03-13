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
