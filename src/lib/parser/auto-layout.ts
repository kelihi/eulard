import dagre from "dagre";
import type { FlowchartGraph, FlowchartDirection } from "@/types/graph";

const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 50;

/**
 * Split a label on <br/>, <br>, or <br /> tags and return an array of lines.
 */
function splitLabel(label: string): string[] {
  return label.split(/<br\s*\/?>/gi);
}

/**
 * Estimate node dimensions based on label text.
 * Accounts for <br/> line breaks.
 */
function estimateNodeSize(label: string): { width: number; height: number } {
  const lines = splitLabel(label);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(DEFAULT_NODE_WIDTH, longestLine * 9 + 40);
  const height = Math.max(DEFAULT_NODE_HEIGHT, lines.length * 22 + 20);
  return { width, height };
}

/**
 * Apply dagre auto-layout to position nodes in a flowchart graph.
 * Used when nodes have no positions (freshly parsed from code).
 */
export function autoLayout(graph: FlowchartGraph): FlowchartGraph {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const rankdir = directionToRankdir(graph.direction);
  g.setGraph({ rankdir, nodesep: 50, ranksep: 60 });

  const nodeSizes = new Map<string, { width: number; height: number }>();
  for (const node of graph.nodes) {
    const size = estimateNodeSize(node.label);
    nodeSizes.set(node.id, size);
    g.setNode(node.id, { width: size.width, height: size.height });
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const dagreNode = g.node(node.id);
      const size = nodeSizes.get(node.id) ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
      return {
        ...node,
        position: {
          x: dagreNode.x - size.width / 2,
          y: dagreNode.y - size.height / 2,
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
