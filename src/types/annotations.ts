import type { NodeStyleOverride, EdgeStyleOverride } from "@/types/graph";

export interface NodeAnnotation {
  kind: "node";
  id: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  shape?: string; // overrides the bracket-derived shape
  style?: NodeStyleOverride;
  /** Unknown key=value pairs preserved verbatim for lossless round-trip. */
  extra?: Record<string, string>;
}

export interface EdgeAnnotation {
  kind: "edge";
  source: string;
  target: string;
  style?: EdgeStyleOverride;
  extra?: Record<string, string>;
}

export interface DefaultsAnnotation {
  kind: "defaults";
  scope: "node" | "edge";
  style: NodeStyleOverride | EdgeStyleOverride;
  extra?: Record<string, string>;
}

export type Annotation = NodeAnnotation | EdgeAnnotation | DefaultsAnnotation;

export interface AnnotationParseResult {
  annotations: Annotation[];
  /** Lines that started with `%%@` but failed to parse — kept so we can warn. */
  malformed: { lineNumber: number; raw: string; reason: string }[];
}
