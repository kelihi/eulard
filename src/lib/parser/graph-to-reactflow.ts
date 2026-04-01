import type { Node, Edge } from "@xyflow/react";
import type { FlowchartGraph } from "@/types/graph";

/**
 * Split a label on <br/>, <br>, or <br /> tags and return an array of lines.
 */
function splitLabel(label: string): string[] {
  return label.split(/<br\s*\/?>/gi);
}

/**
 * Estimate node dimensions based on label text.
 */
export function estimateNodeSize(label: string): { width: number; height: number } {
  const lines = splitLabel(label);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(100, longestLine * 10 + 48);
  const height = Math.max(40, lines.length * 24 + 20);
  return { width, height };
}

export interface FlowNodeData {
  label: string;
  mermaidType: string;
  onRenameNode?: (nodeId: string, newLabel: string) => void;
  isLocked?: boolean;
  isSubgraph?: boolean;
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
export function graphToReactFlow(
  graph: FlowchartGraph,
  onRenameNode?: (nodeId: string, newLabel: string) => void,
  isLocked?: boolean
): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
} {
  // Build a lookup: nodeId -> subgraphId (direct parent)
  const nodeToSubgraph = new Map<string, string>();
  for (const sg of graph.subgraphs) {
    for (const nid of sg.nodeIds) {
      // Only set if not already assigned (innermost subgraph wins for nested)
      // We'll re-assign below for nested subgraphs
      nodeToSubgraph.set(nid, sg.id);
    }
  }
  // For nested subgraphs, child nodes should belong to the most specific (innermost) subgraph.
  // Since subgraphs are parsed bottom-up (children first), re-iterate to assign to innermost.
  // Actually, our parser emits children before parents, so the last assignment is the parent.
  // We need to re-assign: for each node, find the subgraph with the smallest nodeIds set that contains it.
  if (graph.subgraphs.length > 1) {
    for (const [nid] of nodeToSubgraph) {
      let bestSg: string | undefined;
      let bestSize = Infinity;
      for (const sg of graph.subgraphs) {
        if (sg.nodeIds.includes(nid) && sg.nodeIds.length < bestSize) {
          bestSize = sg.nodeIds.length;
          bestSg = sg.id;
        }
      }
      if (bestSg) nodeToSubgraph.set(nid, bestSg);
    }
  }

  const nodes: Node<FlowNodeData>[] = [];

  // Collect regular node info for subgraph bounds computation
  const nodeSizeMap = new Map<string, { width: number; height: number }>();
  const nodePositionMap = new Map<string, { x: number; y: number }>();

  for (const n of graph.nodes) {
    const base = estimateNodeSize(n.label);
    let width = base.width;
    let height = base.height;
    if (n.type === "decision") {
      width = Math.max(120, base.width * 1.6);
      height = Math.max(80, base.height * 1.6);
    } else if (n.type === "circle") {
      const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width * base.width + base.height * base.height) * 0.75));
      width = diameter;
      height = diameter;
    }
    nodeSizeMap.set(n.id, { width, height });
    nodePositionMap.set(n.id, n.position);
  }

  // Compute subgraph bounds from child node positions, then create group nodes
  const PADDING = 30;
  const LABEL_HEIGHT = 32;

  for (const sg of graph.subgraphs) {
    // Compute bounding box of child nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nid of sg.nodeIds) {
      // Only include direct children (nodes assigned to this subgraph)
      if (nodeToSubgraph.get(nid) !== sg.id) continue;
      const pos = nodePositionMap.get(nid);
      const size = nodeSizeMap.get(nid);
      if (pos && size) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + size.width);
        maxY = Math.max(maxY, pos.y + size.height);
      }
    }

    const hasBounds = minX !== Infinity;
    // Estimate title width: ~7.5px per uppercase character + tracking + padding
    const titleWidth = sg.label.length * 7.5 + PADDING * 2 + 24;
    const childBoundsWidth = hasBounds ? maxX - minX + PADDING * 2 : 300;
    const sgWidth = Math.max(childBoundsWidth, titleWidth);
    const sgHeight = hasBounds ? maxY - minY + PADDING * 2 + LABEL_HEIGHT : 200;
    const sgX = hasBounds ? minX - PADDING : 0;
    const sgY = hasBounds ? minY - PADDING - LABEL_HEIGHT : 0;

    // When nodes have a parent, their positions become relative to the parent.
    // Adjust child node positions to be relative to the subgraph origin.
    if (hasBounds) {
      for (const nid of sg.nodeIds) {
        if (nodeToSubgraph.get(nid) !== sg.id) continue;
        const pos = nodePositionMap.get(nid);
        if (pos) {
          nodePositionMap.set(nid, {
            x: pos.x - sgX,
            y: pos.y - sgY,
          });
        }
      }
    }

    const parentSg = sg.parentSubgraph;
    nodes.push({
      id: sg.id,
      type: "subgraph",
      position: { x: sgX, y: sgY },
      zIndex: -1,
      data: {
        label: sg.label,
        mermaidType: "subgraph",
        onRenameNode,
        isLocked,
        isSubgraph: true,
      },
      ...(parentSg ? { parentId: parentSg } : {}),
      style: {
        width: sgWidth,
        height: sgHeight,
      },
    });
  }

  // Create regular nodes (using adjusted positions for those inside subgraphs)
  for (const n of graph.nodes) {
    const size = nodeSizeMap.get(n.id) ?? { width: 100, height: 40 };
    const position = nodePositionMap.get(n.id) ?? n.position;
    const parentSgId = nodeToSubgraph.get(n.id);
    nodes.push({
      id: n.id,
      type: n.type,
      position,
      width: size.width,
      height: size.height,
      data: {
        label: n.label,
        mermaidType: n.type,
        onRenameNode,
        isLocked,
      },
      ...(parentSgId ? { parentId: parentSgId, extent: "parent" as const } : {}),
    });
  }

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
