import { z } from "zod";

export const updateDiagramSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe("Valid mermaid diagram syntax to replace the current diagram"),
});

export type UpdateDiagramParams = z.infer<typeof updateDiagramSchema>;
