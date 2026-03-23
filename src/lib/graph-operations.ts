import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  GraphSubgraph,
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

export interface SubgraphInput {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface SubgraphUpdate {
  id: string;
  label?: string;
  addNodeIds?: string[];
  removeNodeIds?: string[];
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
      subgraphs: graph.subgraphs
        .map((sg) => ({
          ...sg,
          nodeIds: sg.nodeIds.filter((nid) => !removeSet.has(nid)),
        }))
        .filter((sg) => sg.nodeIds.length > 0),
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

// --- Subgraph Operations ---

export function applyAddSubgraph(
  graph: FlowchartGraph,
  subgraph: SubgraphInput
): GraphResult {
  if (graph.subgraphs.some((sg) => sg.id === subgraph.id)) {
    return {
      ok: false,
      error: `Error: Subgraph "${subgraph.id}" already exists. Use updateSubgraph to modify it.`,
    };
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const nid of subgraph.nodeIds) {
    if (!nodeIds.has(nid)) {
      return {
        ok: false,
        error: `Error: Node "${nid}" not found. Add it first with addNodes.`,
      };
    }
  }

  const newSubgraph: GraphSubgraph = {
    id: subgraph.id,
    label: subgraph.label,
    nodeIds: subgraph.nodeIds,
  };

  return {
    ok: true,
    graph: {
      ...graph,
      subgraphs: [...graph.subgraphs, newSubgraph],
    },
  };
}

export function applyRemoveSubgraph(
  graph: FlowchartGraph,
  subgraphId: string
): GraphResult {
  if (!graph.subgraphs.some((sg) => sg.id === subgraphId)) {
    const available = graph.subgraphs.map((sg) => sg.id).join(", ");
    return {
      ok: false,
      error: `Error: Subgraph "${subgraphId}" not found. Current subgraphs: ${available || "(none)"}`,
    };
  }

  return {
    ok: true,
    graph: {
      ...graph,
      subgraphs: graph.subgraphs
        .filter((sg) => sg.id !== subgraphId)
        .map((sg) =>
          sg.parentSubgraph === subgraphId
            ? { ...sg, parentSubgraph: undefined }
            : sg
        ),
    },
  };
}

export function applyUpdateSubgraph(
  graph: FlowchartGraph,
  update: SubgraphUpdate
): GraphResult {
  const sgIndex = graph.subgraphs.findIndex((sg) => sg.id === update.id);
  if (sgIndex === -1) {
    const available = graph.subgraphs.map((sg) => sg.id).join(", ");
    return {
      ok: false,
      error: `Error: Subgraph "${update.id}" not found. Current subgraphs: ${available || "(none)"}`,
    };
  }

  if (update.addNodeIds) {
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const nid of update.addNodeIds) {
      if (!nodeIds.has(nid)) {
        return {
          ok: false,
          error: `Error: Node "${nid}" not found. Add it first with addNodes.`,
        };
      }
    }
  }

  const existing = graph.subgraphs[sgIndex];
  const currentNodeIds = new Set(existing.nodeIds);

  if (update.addNodeIds) {
    for (const nid of update.addNodeIds) currentNodeIds.add(nid);
  }
  if (update.removeNodeIds) {
    for (const nid of update.removeNodeIds) currentNodeIds.delete(nid);
  }

  const updated: GraphSubgraph = {
    ...existing,
    ...(update.label !== undefined && { label: update.label }),
    nodeIds: Array.from(currentNodeIds),
  };

  return {
    ok: true,
    graph: {
      ...graph,
      subgraphs: graph.subgraphs.map((sg) =>
        sg.id === update.id ? updated : sg
      ),
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
