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
function estimateNodeSize(label: string): { width: number; height: number } {
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
  const nodes: Node<FlowNodeData>[] = graph.nodes.map((n) => {
    const base = estimateNodeSize(n.label);
    let width = base.width;
    let height = base.height;
    if (n.type === "decision") {
      // Diamond needs more space: text area is roughly half the diamond dimensions
      width = Math.max(120, base.width * 1.6);
      height = Math.max(80, base.height * 1.6);
    } else if (n.type === "circle") {
      // Circle diameter should fit the content diagonally
      const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width * base.width + base.height * base.height) * 0.75));
      width = diameter;
      height = diameter;
    }
    return {
      id: n.id,
      type: n.type, // maps to custom nodeTypes
      position: n.position,
      width,
      height,
      data: {
        label: n.label,
        mermaidType: n.type,
        onRenameNode,
        isLocked,
      },
    };
  });

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
