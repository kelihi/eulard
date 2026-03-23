import type { CSSProperties } from "react";

export type NodeStyle = Pick<
  CSSProperties,
  "backgroundColor" | "borderColor" | "borderWidth" | "color" | "fontSize"
>;

export type MermaidNodeType =
  | "default"
  | "decision"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle";

export type MermaidEdgeType = "arrow" | "dotted" | "thick";

export type FlowchartDirection = "TB" | "LR" | "BT" | "RL";

export interface GraphNode {
  id: string;
  label: string;
  type: MermaidNodeType;
  position: { x: number; y: number };
  style?: NodeStyle;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: MermaidEdgeType;
}

export interface GraphSubgraph {
  id: string;
  label: string;
  nodeIds: string[];
  parentSubgraph?: string;
}

export interface FlowchartGraph {
  diagramType: "flowchart";
  direction: FlowchartDirection;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs: GraphSubgraph[];
}

export type DiagramGraph = FlowchartGraph;

/** Style properties that can be applied to nodes */
export interface NodeStyleOverride {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

/** Style properties that can be applied to edges */
export interface EdgeStyleOverride {
  lineThickness?: number;
  lineColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
}

/** Global + per-object style overrides for a diagram */
export interface DiagramStyles {
  globalNode?: NodeStyleOverride;
  globalEdge?: EdgeStyleOverride;
  nodes?: Record<string, NodeStyleOverride>;
  edges?: Record<string, EdgeStyleOverride>;
}
