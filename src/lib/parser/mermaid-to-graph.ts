import type {
  FlowchartGraph,
  FlowchartDirection,
  GraphNode,
  GraphEdge,
  GraphSubgraph,
  MermaidNodeType,
  MermaidEdgeType,
} from "@/types/graph";
import { parseAnnotations } from "./annotations";

/**
 * Parse mermaid flowchart code into a graph model.
 * Only supports flowchart/graph diagram type.
 * Returns null if the code is not a flowchart.
 */
export function mermaidToGraph(code: string): FlowchartGraph | null {
  const rawLines = code.split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const dirMatch = lines[0].match(
    /^(?:flowchart|graph)\s+(TB|BT|LR|RL|TD)\s*$/i
  );
  if (!dirMatch) return null;

  const rawDir = dirMatch[1].toUpperCase();
  const direction: FlowchartDirection = rawDir === "TD" ? "TB" : (rawDir as FlowchartDirection);

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const subgraphs: GraphSubgraph[] = [];
  const passthrough: string[] = [];
  let edgeCounter = 0;

  const subgraphStack: {
    id: string;
    label: string;
    nodeIds: string[];
    parentId?: string;
  }[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();
    if (!line) continue;

    const subgraphMatch = line.match(/^subgraph\s+(\S+?)(?:\s*\[(.+?)\])?\s*$/);
    if (subgraphMatch) {
      const sgId = subgraphMatch[1];
      const sgLabel = subgraphMatch[2] ?? sgId;
      const parentId = subgraphStack.length > 0
        ? subgraphStack[subgraphStack.length - 1].id
        : undefined;
      subgraphStack.push({ id: sgId, label: sgLabel, nodeIds: [], parentId });
      continue;
    }

    if (line === "end") {
      const completed = subgraphStack.pop();
      if (completed) {
        subgraphs.push({
          id: completed.id,
          label: completed.label,
          nodeIds: completed.nodeIds,
          parentSubgraph: completed.parentId,
        });
      }
      continue;
    }

    const edgeResult = parseEdgeLine(line);
    if (edgeResult) {
      ensureNode(nodes, edgeResult.source);
      ensureNode(nodes, edgeResult.target);
      edges.push({
        id: `e${edgeCounter++}`,
        source: edgeResult.source.id,
        target: edgeResult.target.id,
        label: edgeResult.label,
        type: edgeResult.edgeType,
      });
      if (subgraphStack.length > 0) {
        const current = subgraphStack[subgraphStack.length - 1];
        if (!current.nodeIds.includes(edgeResult.source.id)) {
          current.nodeIds.push(edgeResult.source.id);
        }
        if (!current.nodeIds.includes(edgeResult.target.id)) {
          current.nodeIds.push(edgeResult.target.id);
        }
      }
      continue;
    }

    const nodeResult = parseNodeDef(line);
    if (nodeResult) {
      if (!nodes.has(nodeResult.id)) {
        nodes.set(nodeResult.id, {
          ...nodeResult,
          position: { x: 0, y: 0 },
        });
      }
      if (subgraphStack.length > 0) {
        const current = subgraphStack[subgraphStack.length - 1];
        if (!current.nodeIds.includes(nodeResult.id)) {
          current.nodeIds.push(nodeResult.id);
        }
      }
      continue;
    }

    if (line.startsWith("%%@")) {
      if (/^(?:%%@\s+(?:node|edge)\b)/i.test(line)) {
        continue;
      }
      passthrough.push(rawLine);
      continue;
    }

    if (
      line.startsWith("%%") ||
      line.startsWith("classDef") ||
      line.startsWith("class ") ||
      line.startsWith("style ") ||
      line.startsWith("click ") ||
      line.startsWith("linkStyle")
    ) {
      passthrough.push(rawLine);
      continue;
    }

    passthrough.push(rawLine);
  }

  const { annotations } = parseAnnotations(code);
  applyAnnotations(nodes, edges, annotations);

  return {
    diagramType: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
    passthrough,
  };
}

function applyAnnotations(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  annotations: ReturnType<typeof parseAnnotations>["annotations"]
) {
  for (const ann of annotations) {
    if (ann.kind === "node") {
      const node = nodes.get(ann.id);
      if (!node) continue;
      if (ann.position) node.position = ann.position;
      if (ann.size) node.size = ann.size;
      if (ann.style) node.style = { ...node.style, ...ann.style };
      if (ann.shape && isMermaidNodeType(ann.shape)) node.type = ann.shape;
    } else if (ann.kind === "edge") {
      const edge = edges.find(
        (e) => e.source === ann.source && e.target === ann.target
      );
      if (!edge) continue;
      if (ann.style) edge.style = { ...edge.style, ...ann.style };
    }
  }
}

const VALID_SHAPES: ReadonlySet<string> = new Set([
  "default",
  "decision",
  "stadium",
  "subroutine",
  "cylinder",
  "circle",
  "hexagon",
  "parallelogram",
  "trapezoid",
]);

function isMermaidNodeType(value: string): value is MermaidNodeType {
  return VALID_SHAPES.has(value);
}

interface ParsedNodeDef {
  id: string;
  label: string;
  type: MermaidNodeType;
}

interface ParsedEdge {
  source: ParsedNodeDef;
  target: ParsedNodeDef;
  label?: string;
  edgeType: MermaidEdgeType;
}

function ensureNode(nodes: Map<string, GraphNode>, def: ParsedNodeDef) {
  if (!nodes.has(def.id)) {
    nodes.set(def.id, { ...def, position: { x: 0, y: 0 } });
  } else if (def.label !== def.id) {
    const existing = nodes.get(def.id)!;
    if (existing.label === existing.id) {
      existing.label = def.label;
      existing.type = def.type;
    }
  }
}

function parseNodeDef(text: string): ParsedNodeDef | null {
  text = text.trim();

  const patterns: Array<{
    regex: RegExp;
    type: MermaidNodeType;
  }> = [
    { regex: /^(\w+)\{\{(.+?)\}\}/, type: "default" },
    { regex: /^(\w+)\[\[(.+?)\]\]/, type: "subroutine" },
    { regex: /^(\w+)\[\((.+?)\)\]/, type: "cylinder" },
    { regex: /^(\w+)\(\((.+?)\)\)/, type: "circle" },
    { regex: /^(\w+)\((.+?)\)/, type: "stadium" },
    { regex: /^(\w+)\{(.+?)\}/, type: "decision" },
    { regex: /^(\w+)\[(.+?)\]/, type: "default" },
  ];

  for (const { regex, type } of patterns) {
    const m = text.match(regex);
    if (m) {
      return { id: m[1], label: m[2].trim(), type };
    }
  }

  const plainMatch = text.match(/^(\w+)$/);
  if (plainMatch) {
    return { id: plainMatch[1], label: plainMatch[1], type: "default" };
  }

  return null;
}

function extractNode(text: string): { node: ParsedNodeDef; rest: string } | null {
  text = text.trim();

  const patterns: Array<{
    regex: RegExp;
    type: MermaidNodeType;
  }> = [
    { regex: /^(\w+)\{\{(.+?)\}\}/, type: "default" },
    { regex: /^(\w+)\[\[(.+?)\]\]/, type: "subroutine" },
    { regex: /^(\w+)\[\((.+?)\)\]/, type: "cylinder" },
    { regex: /^(\w+)\(\((.+?)\)\)/, type: "circle" },
    { regex: /^(\w+)\((.+?)\)/, type: "stadium" },
    { regex: /^(\w+)\{(.+?)\}/, type: "decision" },
    { regex: /^(\w+)\[(.+?)\]/, type: "default" },
  ];

  for (const { regex, type } of patterns) {
    const m = text.match(regex);
    if (m) {
      return {
        node: { id: m[1], label: m[2].trim(), type },
        rest: text.slice(m[0].length).trim(),
      };
    }
  }

  const plainMatch = text.match(/^(\w+)/);
  if (plainMatch) {
    return {
      node: { id: plainMatch[1], label: plainMatch[1], type: "default" },
      rest: text.slice(plainMatch[0].length).trim(),
    };
  }

  return null;
}

function parseEdgeLine(line: string): ParsedEdge | null {
  const sourceResult = extractNode(line);
  if (!sourceResult) return null;

  let rest = sourceResult.rest;
  if (!rest) return null;

  let edgeType: MermaidEdgeType = "arrow";
  let label: string | undefined;

  const textArrowMatch = rest.match(/^--\s+(.+?)\s+-->/);
  if (textArrowMatch) {
    label = textArrowMatch[1];
    rest = rest.slice(textArrowMatch[0].length).trim();
  } else {
    const dottedTextMatch = rest.match(/^-\.\s+(.+?)\s+\.->/);
    if (dottedTextMatch) {
      edgeType = "dotted";
      label = dottedTextMatch[1];
      rest = rest.slice(dottedTextMatch[0].length).trim();
    } else {
      const thickTextMatch = rest.match(/^==\s+(.+?)\s+==>/);
      if (thickTextMatch) {
        edgeType = "thick";
        label = thickTextMatch[1];
        rest = rest.slice(thickTextMatch[0].length).trim();
      } else {
        const arrowMatch = rest.match(/^(-\.+->|=+>|-+>|-+)/);
        if (!arrowMatch) return null;

        const arrow = arrowMatch[1];
        if (arrow.startsWith("-.") || arrow.startsWith("-..")) edgeType = "dotted";
        else if (arrow.startsWith("=")) edgeType = "thick";
        else edgeType = "arrow";

        rest = rest.slice(arrowMatch[0].length).trim();

        const pipeMatch = rest.match(/^\|(.+?)\|\s*/);
        if (pipeMatch) {
          label = pipeMatch[1];
          rest = rest.slice(pipeMatch[0].length).trim();
        }
      }
    }
  }

  const targetResult = extractNode(rest);
  if (!targetResult) return null;

  return {
    source: sourceResult.node,
    target: targetResult.node,
    label,
    edgeType,
  };
}
