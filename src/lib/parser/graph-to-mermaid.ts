import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  NodeStyleOverride,
  EdgeStyleOverride,
} from "@/types/graph";
import { serializeAnnotation } from "./annotations";
import type { NodeAnnotation, EdgeAnnotation } from "@/types/annotations";

export function graphToMermaid(graph: FlowchartGraph): string {
  const lines: string[] = [];
  lines.push(`flowchart ${graph.direction}`);

  for (const node of graph.nodes) {
    lines.push(`    ${nodeToMermaid(node)}`);
    const ann = nodeAnnotation(node);
    if (ann) lines.push(`    ${serializeAnnotation(ann)}`);
  }

  for (const edge of graph.edges) {
    lines.push(`    ${edgeToMermaid(edge)}`);
    const ann = edgeAnnotation(edge);
    if (ann) lines.push(`    ${serializeAnnotation(ann)}`);
  }

  return lines.join("\n");
}

function nodeToMermaid(node: GraphNode): string {
  const { id, label, type } = node;
  switch (type) {
    case "decision":      return `${id}{${label}}`;
    case "stadium":       return `${id}(${label})`;
    case "subroutine":    return `${id}[[${label}]]`;
    case "cylinder":      return `${id}[(${label})]`;
    case "circle":        return `${id}((${label}))`;
    // hexagon/parallelogram/trapezoid have no native bracket form — emit
    // as default rectangle and rely on the `shape=` annotation for the real shape.
    case "hexagon":
    case "parallelogram":
    case "trapezoid":
    case "default":
    default:
      return label !== id ? `${id}[${label}]` : id;
  }
}

function edgeToMermaid(edge: GraphEdge): string {
  const arrow = edgeArrow(edge.type);
  if (edge.label) return `${edge.source} ${arrow}|${edge.label}| ${edge.target}`;
  return `${edge.source} ${arrow} ${edge.target}`;
}

function edgeArrow(type: GraphEdge["type"]): string {
  switch (type) {
    case "dotted": return "-.->";
    case "thick":  return "==>";
    default:       return "-->";
  }
}

const NON_NATIVE_SHAPES = new Set(["hexagon", "parallelogram", "trapezoid"]);

function nodeAnnotation(node: GraphNode): NodeAnnotation | null {
  const hasPosition = node.position.x !== 0 || node.position.y !== 0;
  const hasSize = !!node.size;
  const hasStyle = !!node.style && Object.values(node.style).some((v) => v != null && v !== "");
  const needsShape = NON_NATIVE_SHAPES.has(node.type);

  if (!hasPosition && !hasSize && !hasStyle && !needsShape) return null;

  const ann: NodeAnnotation = { kind: "node", id: node.id };
  if (hasPosition) ann.position = node.position;
  if (hasSize) ann.size = node.size;
  if (needsShape) ann.shape = node.type;
  if (hasStyle) ann.style = node.style as NodeStyleOverride;
  return ann;
}

function edgeAnnotation(edge: GraphEdge): EdgeAnnotation | null {
  if (!edge.style) return null;
  const hasStyle = Object.values(edge.style).some((v) => v != null && v !== "");
  if (!hasStyle) return null;
  return {
    kind: "edge",
    source: edge.source,
    target: edge.target,
    style: edge.style as EdgeStyleOverride,
  };
}
