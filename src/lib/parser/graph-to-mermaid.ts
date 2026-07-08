import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  GraphSubgraph,
  NodeStyleOverride,
  EdgeStyleOverride,
} from "@/types/graph";
import { serializeAnnotation } from "./annotations";
import type { NodeAnnotation, EdgeAnnotation } from "@/types/annotations";

/**
 * Serialize a flowchart graph model back to mermaid code.
 */
export function graphToMermaid(graph: FlowchartGraph): string {
  const lines: string[] = [];
  const emitPositions = graph.nodes.some(
    (n) => n.position.x !== 0 || n.position.y !== 0
  );

  lines.push(`flowchart ${graph.direction}`);

  const nodesInSubgraphs = new Set<string>();
  for (const sg of graph.subgraphs) {
    for (const nid of sg.nodeIds) {
      nodesInSubgraphs.add(nid);
    }
  }

  const edgesInSubgraphs = new Set<string>();
  for (const sg of graph.subgraphs) {
    const sgNodeSet = new Set(sg.nodeIds);
    for (const edge of graph.edges) {
      if (sgNodeSet.has(edge.source) && sgNodeSet.has(edge.target)) {
        edgesInSubgraphs.add(edge.id);
      }
    }
  }

  for (const node of graph.nodes) {
    if (nodesInSubgraphs.has(node.id)) continue;
    const def = nodeToMermaid(node);
    if (def !== node.id) {
      lines.push(`    ${def}`);
    }
  }

  const emittedSubgraphs = new Set<string>();
  function emitSubgraph(sg: GraphSubgraph, indent: string) {
    if (emittedSubgraphs.has(sg.id)) return;
    emittedSubgraphs.add(sg.id);

    const label = sg.label !== sg.id ? `${sg.id}[${sg.label}]` : sg.id;
    lines.push(`${indent}subgraph ${label}`);

    for (const child of graph.subgraphs) {
      if (child.parentSubgraph === sg.id) {
        emitSubgraph(child, indent + "    ");
      }
    }

    const sgNodeSet = new Set(sg.nodeIds);
    for (const node of graph.nodes) {
      if (!sgNodeSet.has(node.id)) continue;
      const def = nodeToMermaid(node);
      if (def !== node.id) {
        lines.push(`${indent}    ${def}`);
      }
    }

    for (const edge of graph.edges) {
      if (sgNodeSet.has(edge.source) && sgNodeSet.has(edge.target)) {
        lines.push(`${indent}    ${edgeToMermaid(edge)}`);
      }
    }

    lines.push(`${indent}end`);
  }

  for (const sg of graph.subgraphs) {
    if (!sg.parentSubgraph) {
      emitSubgraph(sg, "    ");
    }
  }

  for (const edge of graph.edges) {
    if (!edgesInSubgraphs.has(edge.id)) {
      lines.push(`    ${edgeToMermaid(edge)}`);
    }
  }

  const annotationLines: string[] = [];
  for (const node of graph.nodes) {
    const ann = nodeAnnotation(node, emitPositions);
    if (ann) annotationLines.push(`    ${serializeAnnotation(ann)}`);
  }
  for (const edge of graph.edges) {
    const ann = edgeAnnotation(edge);
    if (ann) annotationLines.push(`    ${serializeAnnotation(ann)}`);
  }
  if (annotationLines.length > 0) {
    lines.push(...annotationLines);
  }

  if (graph.passthrough?.length) {
    lines.push(...graph.passthrough);
  }

  return lines.join("\n");
}

function nodeToMermaid(node: GraphNode): string {
  const { id, label, type } = node;

  switch (type) {
    case "decision":
      return `${id}{${label}}`;
    case "stadium":
      return `${id}(${label})`;
    case "subroutine":
      return `${id}[[${label}]]`;
    case "cylinder":
      return `${id}[(${label})]`;
    case "circle":
      return `${id}((${label}))`;
    case "hexagon":
      return `${id}{{${label}}}`;
    case "parallelogram":
      return `${id}[/${label}/]`;
    case "trapezoid":
      return `${id}[/${label}\\]`;
    case "default":
    default:
      return label !== id ? `${id}[${label}]` : id;
  }
}

function edgeToMermaid(edge: GraphEdge): string {
  const arrow = edgeArrow(edge.type);

  if (edge.label) {
    return `${edge.source} ${arrow}|${edge.label}| ${edge.target}`;
  }
  return `${edge.source} ${arrow} ${edge.target}`;
}

function edgeArrow(type: GraphEdge["type"]): string {
  switch (type) {
    case "dotted":
      return "-.->";
    case "thick":
      return "==>";
    case "arrow":
    default:
      return "-->";
  }
}

function nodeAnnotation(
  node: GraphNode,
  emitPositions: boolean
): NodeAnnotation | null {
  const hasSize = !!node.size;
  const hasStyle = !!node.style && Object.values(node.style).some((v) => v != null && v !== "");

  if (!emitPositions && !hasSize && !hasStyle) return null;

  const ann: NodeAnnotation = { kind: "node", id: node.id };
  if (emitPositions) ann.position = node.position;
  if (hasSize) ann.size = node.size;
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
