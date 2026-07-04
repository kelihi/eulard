import type { CSSProperties } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { FlowchartGraph, NodeStyleOverride, EdgeStyleOverride } from "@/types/graph";

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
  style?: NodeStyleOverride;
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

function nodeStyleToCss(style?: NodeStyleOverride): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.borderColor) css.borderColor = style.borderColor;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.fontColor) css.color = style.fontColor;
  return css;
}

function edgeStyleToCss(style?: EdgeStyleOverride): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.lineColor) css.stroke = style.lineColor;
  if (style.lineThickness) css.strokeWidth = style.lineThickness;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.fontColor) css.color = style.fontColor;
  return css;
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
    let width: number;
    let height: number;

    if (n.size) {
      width = n.size.width;
      height = n.size.height;
    } else {
      const base = estimateNodeSize(n.label);
      width = base.width;
      height = base.height;
      if (n.type === "decision") {
        width = Math.max(120, base.width * 1.6);
        height = Math.max(80, base.height * 1.6);
      } else if (n.type === "circle") {
        const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width * base.width + base.height * base.height) * 0.75));
        width = diameter;
        height = diameter;
      }
    }

    return {
      id: n.id,
      type: n.type,
      position: n.position,
      width,
      height,
      style: nodeStyleToCss({ ...graph.globalNodeStyle, ...n.style }),
      data: {
        label: n.label,
        mermaidType: n.type,
        style: {
          ...graph.globalNodeStyle,
          ...n.style,
        },
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
    style: {
      ...(e.type === "thick" ? { strokeWidth: 3 } : {}),
      ...edgeStyleToCss(graph.globalEdgeStyle),
      ...edgeStyleToCss(e.style),
    },
    data: {
      edgeLabel: e.label ?? "",
      edgeId: e.id,
      mermaidEdgeType: e.type,
    } satisfies FlowEdgeData,
  }));

  return { nodes, edges };
}
