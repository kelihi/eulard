import type { FlowchartGraph, GraphNode, GraphEdge } from "@/types/graph";

/**
 * Serialize a flowchart graph model back to mermaid code.
 */
export function graphToMermaid(graph: FlowchartGraph): string {
  const lines: string[] = [];

  lines.push(`flowchart ${graph.direction}`);

  // Emit node definitions (only for nodes that have labels or non-default types)
  for (const node of graph.nodes) {
    const def = nodeToMermaid(node);
    if (def !== node.id) {
      lines.push(`    ${def}`);
    }
  }

  // Emit edges
  for (const edge of graph.edges) {
    lines.push(`    ${edgeToMermaid(edge)}`);
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
    case "default":
    default:
      // Only use brackets if label differs from id
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
