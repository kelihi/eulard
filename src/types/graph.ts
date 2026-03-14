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

export interface FlowchartGraph {
  diagramType: "flowchart";
  direction: FlowchartDirection;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type DiagramGraph = FlowchartGraph;
