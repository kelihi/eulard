import { z } from "zod";

const SHAPE_VALUES = [
  "default",
  "decision",
  "stadium",
  "subroutine",
  "cylinder",
  "circle",
  "hexagon",
  "parallelogram",
  "trapezoid",
] as const;

const mermaidNodeType = z.enum(SHAPE_VALUES).optional().default("default");

const mermaidEdgeType = z
  .enum(["arrow", "dotted", "thick"])
  .optional()
  .default("arrow");

const styleObj = z
  .object({
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
    fontColor: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
  })
  .optional();

// --- Graph operation tools ---

export const addNodesSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().describe("Unique node ID (e.g., 'DB', 'auth_service')"),
      label: z.string().describe("Display label for the node"),
      type: mermaidNodeType.describe("Node shape type"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("Optional position for the node"),
      size: z
        .object({ width: z.number(), height: z.number() })
        .optional()
        .describe("Optional size for the node"),
      style: styleObj.describe("Optional per-node style overrides"),
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
      type: z.enum(SHAPE_VALUES).optional().describe("New shape type"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("New position for the node"),
      size: z
        .object({ width: z.number(), height: z.number() })
        .optional()
        .describe("New size for the node"),
      style: styleObj.describe("New per-node style overrides"),
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
