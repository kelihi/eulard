import { z } from "zod";

export const updateDiagramSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe("Valid mermaid diagram syntax to replace the current diagram"),
});

export const updateMetadataSchema = z.object({
  title: z.string().min(1).max(200).optional().describe("New diagram title"),
  direction: z
    .enum(["TB", "LR", "BT", "RL"])
    .optional()
    .describe("Flowchart direction: TB (top-bottom), LR (left-right), BT (bottom-top), RL (right-left)"),
});

export const exportDiagramSchema = z.object({
  format: z
    .enum(["png", "svg", "mermaid"])
    .describe("Export format: png, svg, or mermaid code"),
});

export type UpdateDiagramParams = z.infer<typeof updateDiagramSchema>;
export type UpdateMetadataParams = z.infer<typeof updateMetadataSchema>;
export type ExportDiagramParams = z.infer<typeof exportDiagramSchema>;
