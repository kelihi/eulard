import type {
  FlowchartGraph,
  FlowchartDirection,
  GraphNode,
  GraphEdge,
  MermaidNodeType,
  MermaidEdgeType,
} from "@/types/graph";

/**
 * Parse mermaid flowchart code into a graph model.
 * Only supports flowchart/graph diagram type.
 * Returns null if the code is not a flowchart.
 */
export function mermaidToGraph(code: string): FlowchartGraph | null {
  const lines = code.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Parse direction from first line
  const dirMatch = lines[0].match(
    /^(?:flowchart|graph)\s+(TB|BT|LR|RL|TD)\s*$/i
  );
  if (!dirMatch) return null;

  const rawDir = dirMatch[1].toUpperCase();
  const direction: FlowchartDirection = rawDir === "TD" ? "TB" : rawDir as FlowchartDirection;

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let edgeCounter = 0;

  // Process remaining lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments, subgraph, end, classDef, style, click directives
    if (
      line.startsWith("%%") ||
      line.startsWith("subgraph") ||
      line === "end" ||
      line.startsWith("classDef") ||
      line.startsWith("style") ||
      line.startsWith("click") ||
      line.startsWith("linkStyle")
    ) {
      continue;
    }

    // Try to parse as edge: A --> B, A -->|label| B, A -- label --> B, etc.
    const edgeResult = parseEdgeLine(line);
    if (edgeResult) {
      // Ensure source and target nodes exist
      ensureNode(nodes, edgeResult.source);
      ensureNode(nodes, edgeResult.target);
      edges.push({
        id: `e${edgeCounter++}`,
        source: edgeResult.source.id,
        target: edgeResult.target.id,
        label: edgeResult.label,
        type: edgeResult.edgeType,
      });
      continue;
    }

    // Try to parse as standalone node definition: A[Label], B{Decision}, etc.
    const nodeResult = parseNodeDef(line);
    if (nodeResult && !nodes.has(nodeResult.id)) {
      nodes.set(nodeResult.id, {
        ...nodeResult,
        position: { x: 0, y: 0 },
      });
    }
  }

  return {
    diagramType: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
  };
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
    // Update label if the node now has a richer definition
    const existing = nodes.get(def.id)!;
    if (existing.label === existing.id) {
      existing.label = def.label;
      existing.type = def.type;
    }
  }
}

/**
 * Parse a node definition like:
 *   A[Label]  A{Label}  A(Label)  A((Label))  A[[Label]]  A[(Label)]
 */
function parseNodeDef(text: string): ParsedNodeDef | null {
  text = text.trim();

  // Match node with shape: ID + shape delimiter + label + closing delimiter
  const patterns: Array<{
    regex: RegExp;
    type: MermaidNodeType;
  }> = [
    { regex: /^(\w+)\{\{(.+?)\}\}/, type: "default" }, // hexagon {{}}
    { regex: /^(\w+)\[\[(.+?)\]\]/, type: "subroutine" }, // subroutine [[]]
    { regex: /^(\w+)\[\((.+?)\)\]/, type: "cylinder" }, // cylinder [()]
    { regex: /^(\w+)\(\((.+?)\)\)/, type: "circle" }, // circle (())
    { regex: /^(\w+)\((.+?)\)/, type: "stadium" }, // stadium ()
    { regex: /^(\w+)\{(.+?)\}/, type: "decision" }, // diamond/decision {}
    { regex: /^(\w+)\[(.+?)\]/, type: "default" }, // rectangle []
  ];

  for (const { regex, type } of patterns) {
    const m = text.match(regex);
    if (m) {
      return { id: m[1], label: m[2].trim(), type };
    }
  }

  // Plain node ID with no shape
  const plainMatch = text.match(/^(\w+)$/);
  if (plainMatch) {
    return { id: plainMatch[1], label: plainMatch[1], type: "default" };
  }

  return null;
}

/**
 * Extract a node definition from the start of a string.
 * Returns the parsed node and the remaining string.
 */
function extractNode(text: string): { node: ParsedNodeDef; rest: string } | null {
  text = text.trim();

  // Try shaped nodes first
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

  // Plain ID — grab until arrow characters or whitespace
  const plainMatch = text.match(/^(\w+)/);
  if (plainMatch) {
    return {
      node: { id: plainMatch[1], label: plainMatch[1], type: "default" },
      rest: text.slice(plainMatch[0].length).trim(),
    };
  }

  return null;
}

/**
 * Parse an edge line like:
 *   A --> B
 *   A -->|label| B
 *   A -- label --> B
 *   A -.-> B
 *   A ==> B
 *   A --- B
 */
function parseEdgeLine(line: string): ParsedEdge | null {
  // Extract source node
  const sourceResult = extractNode(line);
  if (!sourceResult) return null;

  let rest = sourceResult.rest;
  if (!rest) return null;

  // Match arrow patterns
  // Dotted: -.-> or -..->
  // Thick: ==> or ===>
  // Normal: --> or ---> or ---
  // With text: -- text --> or -. text .-> or == text ==>
  // With pipe text: -->|text| or -.->|text| or ==>|text|

  let edgeType: MermaidEdgeType = "arrow";
  let label: string | undefined;

  // Pattern: -- text --> (text between dashes and arrow)
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
        // Arrow without inline text
        const arrowMatch = rest.match(/^(-\.+->|=+>|-+>|-+)/);
        if (!arrowMatch) return null;

        const arrow = arrowMatch[1];
        if (arrow.startsWith("-.") || arrow.startsWith("-..")) edgeType = "dotted";
        else if (arrow.startsWith("=")) edgeType = "thick";
        else edgeType = "arrow";

        rest = rest.slice(arrowMatch[0].length).trim();

        // Check for pipe label: |text|
        const pipeMatch = rest.match(/^\|(.+?)\|\s*/);
        if (pipeMatch) {
          label = pipeMatch[1];
          rest = rest.slice(pipeMatch[0].length).trim();
        }
      }
    }
  }

  // Extract target node
  const targetResult = extractNode(rest);
  if (!targetResult) return null;

  return {
    source: sourceResult.node,
    target: targetResult.node,
    label,
    edgeType,
  };
}
