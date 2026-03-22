import type { FlowchartGraph, GraphNode, GraphEdge, GraphSubgraph } from "@/types/graph";

/**
 * Serialize a flowchart graph model back to mermaid code.
 */
export function graphToMermaid(graph: FlowchartGraph): string {
  const lines: string[] = [];

  lines.push(`flowchart ${graph.direction}`);

  // Build a set of node IDs that belong to any subgraph
  const nodesInSubgraphs = new Set<string>();
  for (const sg of graph.subgraphs) {
    for (const nid of sg.nodeIds) {
      nodesInSubgraphs.add(nid);
    }
  }

  // Build a set of edges that belong inside subgraphs (both endpoints in same subgraph)
  const edgesInSubgraphs = new Set<string>();
  for (const sg of graph.subgraphs) {
    const sgNodeSet = new Set(sg.nodeIds);
    for (const edge of graph.edges) {
      if (sgNodeSet.has(edge.source) && sgNodeSet.has(edge.target)) {
        edgesInSubgraphs.add(edge.id);
      }
    }
  }

  // Emit top-level node definitions (nodes not in any subgraph)
  for (const node of graph.nodes) {
    if (nodesInSubgraphs.has(node.id)) continue;
    const def = nodeToMermaid(node);
    if (def !== node.id) {
      lines.push(`    ${def}`);
    }
  }

  // Emit subgraph blocks
  const emittedSubgraphs = new Set<string>();
  function emitSubgraph(sg: GraphSubgraph, indent: string) {
    if (emittedSubgraphs.has(sg.id)) return;
    emittedSubgraphs.add(sg.id);

    const label = sg.label !== sg.id ? `${sg.id}[${sg.label}]` : sg.id;
    lines.push(`${indent}subgraph ${label}`);

    // Emit child subgraphs first (nested)
    for (const child of graph.subgraphs) {
      if (child.parentSubgraph === sg.id) {
        emitSubgraph(child, indent + "    ");
      }
    }

    // Emit node definitions inside this subgraph
    const sgNodeSet = new Set(sg.nodeIds);
    for (const node of graph.nodes) {
      if (!sgNodeSet.has(node.id)) continue;
      const def = nodeToMermaid(node);
      if (def !== node.id) {
        lines.push(`${indent}    ${def}`);
      }
    }

    // Emit edges where both endpoints are in this subgraph
    for (const edge of graph.edges) {
      if (sgNodeSet.has(edge.source) && sgNodeSet.has(edge.target)) {
        lines.push(`${indent}    ${edgeToMermaid(edge)}`);
      }
    }

    lines.push(`${indent}end`);
  }

  // Emit top-level subgraphs (those without a parent)
  for (const sg of graph.subgraphs) {
    if (!sg.parentSubgraph) {
      emitSubgraph(sg, "    ");
    }
  }

  // Emit edges not inside any subgraph (cross-subgraph or top-level edges)
  for (const edge of graph.edges) {
    if (!edgesInSubgraphs.has(edge.id)) {
      lines.push(`    ${edgeToMermaid(edge)}`);
    }
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
