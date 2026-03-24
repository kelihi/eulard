import { z } from "zod";

const mermaidNodeType = z
  .enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"])
  .optional()
  .default("default");

const mermaidEdgeType = z
  .enum(["arrow", "dotted", "thick"])
  .optional()
  .default("arrow");

// --- Graph operation tools ---

export const addNodesSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().describe("Unique node ID (e.g., 'DB', 'auth_service')"),
      label: z.string().describe("Display label for the node"),
      type: mermaidNodeType.describe("Node shape type"),
    })
  ),
});

export const removeNodesSchema = z.object({
  nodeIds: z
    .array(z.string())
    .describe("IDs of nodes to remove — connected edges are auto-removed"),
});

export const updateNodesSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().describe("ID of the node to update"),
      label: z.string().optional().describe("New label"),
      type: z
        .enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"])
        .optional()
        .describe("New shape type"),
    })
  ),
});

export const addEdgesSchema = z.object({
  edges: z.array(
    z.object({
      source: z.string().describe("Source node ID"),
      target: z.string().describe("Target node ID"),
      label: z.string().optional().describe("Edge label"),
      type: mermaidEdgeType.describe("Edge style"),
    })
  ),
});

export const removeEdgesSchema = z.object({
  edges: z.array(
    z.object({
      source: z.string().describe("Source node ID"),
      target: z.string().describe("Target node ID"),
    })
  ),
});

export const updateEdgesSchema = z.object({
  updates: z.array(
    z.object({
      source: z.string().describe("Source node ID"),
      target: z.string().describe("Target node ID"),
      label: z.string().nullable().optional().describe("New label (null to remove)"),
      type: z
        .enum(["arrow", "dotted", "thick"])
        .optional()
        .describe("New edge style"),
    })
  ),
});

// --- Subgraph operation tools ---

export const addSubgraphSchema = z.object({
  id: z.string().describe("Unique subgraph ID (e.g., 'sg_backend', 'sg_frontend')"),
  label: z.string().describe("Display label for the subgraph group"),
  nodeIds: z.array(z.string()).describe("IDs of nodes to include in this subgraph"),
});

export const removeSubgraphSchema = z.object({
  subgraphId: z.string().describe("ID of the subgraph to remove (nodes are kept, only grouping is removed)"),
});

export const updateSubgraphSchema = z.object({
  id: z.string().describe("ID of the subgraph to update"),
  label: z.string().optional().describe("New label for the subgraph"),
  addNodeIds: z.array(z.string()).optional().describe("Node IDs to add to this subgraph"),
  removeNodeIds: z.array(z.string()).optional().describe("Node IDs to remove from this subgraph"),
});

// --- Fallback full-replacement tool ---

export const replaceDiagramSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(
      "Complete mermaid diagram code — use only for diagram type changes or complete restructuring"
    ),
});

// --- Metadata & export tools (unchanged) ---

export const updateMetadataSchema = z.object({
  title: z.string().min(1).max(200).optional().describe("New diagram title"),
  direction: z
    .enum(["TB", "LR", "BT", "RL"])
    .optional()
    .describe(
      "Flowchart direction: TB (top-bottom), LR (left-right), BT (bottom-top), RL (right-left)"
    ),
});

export const exportDiagramSchema = z.object({
  format: z
    .enum(["png", "svg", "mermaid"])
    .describe("Export format: png, svg, or mermaid code"),
});

// --- Client context tools (feedback system integration) ---

export const listClientsSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Search clients by name"),
  status: z
    .enum(["active", "ad-hoc", "churned"])
    .optional()
    .describe("Filter by client status"),
});

export const getClientContextSchema = z.object({
  clientId: z
    .string()
    .describe("UUID of the client to fetch full details for"),
});

// --- Inferred types ---

export type AddNodesParams = z.infer<typeof addNodesSchema>;
export type RemoveNodesParams = z.infer<typeof removeNodesSchema>;
export type UpdateNodesParams = z.infer<typeof updateNodesSchema>;
export type AddEdgesParams = z.infer<typeof addEdgesSchema>;
export type RemoveEdgesParams = z.infer<typeof removeEdgesSchema>;
export type UpdateEdgesParams = z.infer<typeof updateEdgesSchema>;
export type ReplaceDiagramParams = z.infer<typeof replaceDiagramSchema>;
export type UpdateMetadataParams = z.infer<typeof updateMetadataSchema>;
export type ExportDiagramParams = z.infer<typeof exportDiagramSchema>;
export type ListClientsParams = z.infer<typeof listClientsSchema>;
export type GetClientContextParams = z.infer<typeof getClientContextSchema>;
export type AddSubgraphParams = z.infer<typeof addSubgraphSchema>;
export type RemoveSubgraphParams = z.infer<typeof removeSubgraphSchema>;
export type UpdateSubgraphParams = z.infer<typeof updateSubgraphSchema>;
