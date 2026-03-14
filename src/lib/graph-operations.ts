import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  MermaidNodeType,
  MermaidEdgeType,
} from "@/types/graph";

// --- Result type ---

export type GraphResult =
  | { ok: true; graph: FlowchartGraph }
  | { ok: false; error: string };

// --- Input types ---

export interface NodeInput {
  id: string;
  label: string;
  type?: MermaidNodeType;
}

export interface NodeUpdate {
  id: string;
  label?: string;
  type?: MermaidNodeType;
}

export interface EdgeInput {
  source: string;
  target: string;
  label?: string;
  type?: MermaidEdgeType;
}

export interface EdgeIdentifier {
  source: string;
  target: string;
}

export interface EdgeUpdate {
  source: string;
  target: string;
  label?: string | null;
  type?: MermaidEdgeType;
}

// --- Operations ---

let edgeIdCounter = 0;

function nextEdgeId(): string {
  return `e_new_${edgeIdCounter++}`;
}

export function applyAddNodes(
  graph: FlowchartGraph,
  nodes: NodeInput[]
): GraphResult {
  for (const node of nodes) {
    if (graph.nodes.some((n) => n.id === node.id)) {
      return {
        ok: false,
        error: `Error: Node "${node.id}" already exists. Use updateNodes to modify it.`,
      };
    }
  }

  const newNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    type: n.type ?? "default",
    position: { x: 0, y: 0 },
  }));

  return {
    ok: true,
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...newNodes],
    },
  };
}

export function applyRemoveNodes(
  graph: FlowchartGraph,
  nodeIds: string[]
): GraphResult {
  const existingIds = new Set(graph.nodes.map((n) => n.id));
  for (const id of nodeIds) {
    if (!existingIds.has(id)) {
      const available = graph.nodes.map((n) => n.id).join(", ");
      return {
        ok: false,
        error: `Error: Node "${id}" not found. Current nodes: ${available}`,
      };
    }
  }

  const removeSet = new Set(nodeIds);
  return {
    ok: true,
    graph: {
      ...graph,
      nodes: graph.nodes.filter((n) => !removeSet.has(n.id)),
      edges: graph.edges.filter(
        (e) => !removeSet.has(e.source) && !removeSet.has(e.target)
      ),
    },
  };
}

export function applyUpdateNodes(
  graph: FlowchartGraph,
  updates: NodeUpdate[]
): GraphResult {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const update of updates) {
    if (!nodeMap.has(update.id)) {
      const available = graph.nodes.map((n) => n.id).join(", ");
      return {
        ok: false,
        error: `Error: Node "${update.id}" not found. Current nodes: ${available}`,
      };
    }
  }

  const updateMap = new Map(updates.map((u) => [u.id, u]));

  return {
    ok: true,
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const update = updateMap.get(node.id);
        if (!update) return node;
        return {
          ...node,
          ...(update.label !== undefined && { label: update.label }),
          ...(update.type !== undefined && { type: update.type }),
        };
      }),
    },
  };
}

export function applyAddEdges(
  graph: FlowchartGraph,
  edges: EdgeInput[]
): GraphResult {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      return {
        ok: false,
        error: `Error: Node "${edge.source}" not found. Add it first with addNodes.`,
      };
    }
    if (!nodeIds.has(edge.target)) {
      return {
        ok: false,
        error: `Error: Node "${edge.target}" not found. Add it first with addNodes.`,
      };
    }
  }

  const newEdges: GraphEdge[] = edges.map((e) => ({
    id: nextEdgeId(),
    source: e.source,
    target: e.target,
    label: e.label,
    type: e.type ?? "arrow",
  }));

  return {
    ok: true,
    graph: {
      ...graph,
      edges: [...graph.edges, ...newEdges],
    },
  };
}

export function applyRemoveEdges(
  graph: FlowchartGraph,
  edgePairs: EdgeIdentifier[]
): GraphResult {
  const removeSet = new Set(
    edgePairs.map((e) => `${e.source}->${e.target}`)
  );

  const newEdges = graph.edges.filter(
    (e) => !removeSet.has(`${e.source}->${e.target}`)
  );

  return {
    ok: true,
    graph: {
      ...graph,
      edges: newEdges,
    },
  };
}

export function applyUpdateEdges(
  graph: FlowchartGraph,
  updates: EdgeUpdate[]
): GraphResult {
  const edgeMap = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    const key = `${edge.source}->${edge.target}`;
    edgeMap.set(key, edge);
  }

  for (const update of updates) {
    const key = `${update.source}->${update.target}`;
    if (!edgeMap.has(key)) {
      return {
        ok: false,
        error: `Error: Edge from "${update.source}" to "${update.target}" not found.`,
      };
    }
  }

  const updateMap = new Map(
    updates.map((u) => [`${u.source}->${u.target}`, u])
  );

  return {
    ok: true,
    graph: {
      ...graph,
      edges: graph.edges.map((edge) => {
        const key = `${edge.source}->${edge.target}`;
        const update = updateMap.get(key);
        if (!update) return edge;
        return {
          ...edge,
          ...(update.label !== undefined && {
            label: update.label === null ? undefined : update.label,
          }),
          ...(update.type !== undefined && { type: update.type }),
        };
      }),
    },
  };
}
