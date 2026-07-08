import { mermaidToGraph } from "./mermaid-to-graph";
import { graphToMermaid } from "./graph-to-mermaid";
import { serializeAnnotation } from "./annotations";
import type { DiagramStyles } from "@/types/graph";

interface SidecarInputs {
  code: string;
  positions: string | null;
  styleOverrides: string | null;
}

export function migrateSidecarToCode({
  code,
  positions,
  styleOverrides,
}: SidecarInputs): string {
  const graph = mermaidToGraph(code);
  if (!graph) return code;

  let mutated = false;
  const passthrough = [...(graph.passthrough ?? [])];

  if (positions) {
    try {
      const map = JSON.parse(positions) as Record<string, { x: number; y: number }>;
      for (const node of graph.nodes) {
        const p = map[node.id];
        if (p && node.position.x === 0 && node.position.y === 0) {
          node.position = { x: p.x, y: p.y };
          mutated = true;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  if (styleOverrides) {
    try {
      const styles = JSON.parse(styleOverrides) as DiagramStyles;
      if (styles.nodes) {
        for (const [id, ns] of Object.entries(styles.nodes)) {
          const node = graph.nodes.find((n) => n.id === id);
          if (node) {
            node.style = { ...node.style, ...ns };
            mutated = true;
          }
        }
      }
      if (styles.edges) {
        for (const [edgeId, es] of Object.entries(styles.edges)) {
          const edge = graph.edges.find((e) => e.id === edgeId);
          if (edge) {
            edge.style = { ...edge.style, ...es };
            mutated = true;
          }
        }
      }
      if (styles.globalNode) {
        passthrough.push(
          `    ${serializeAnnotation({ kind: "defaults", scope: "node", style: styles.globalNode })}`
        );
        mutated = true;
      }
      if (styles.globalEdge) {
        passthrough.push(
          `    ${serializeAnnotation({ kind: "defaults", scope: "edge", style: styles.globalEdge })}`
        );
        mutated = true;
      }
    } catch {
      // ignore
    }
  }

  if (!mutated) return code;

  return graphToMermaid({
    ...graph,
    passthrough,
  });
}
