import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  updateDiagramSchema,
  updateMetadataSchema,
  exportDiagramSchema,
} from "@/lib/ai/tools";

export async function POST(request: Request) {
  const { messages, currentCode } = await request.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(currentCode || ""),
    messages,
    tools: {
      updateDiagram: tool({
        description:
          "Replace the current mermaid diagram code with new valid mermaid syntax. Use this when the user asks to create, modify, or update the diagram.",
        parameters: updateDiagramSchema,
      }),
      updateMetadata: tool({
        description:
          "Update the diagram title or change the flowchart direction. Use when the user asks to rename the diagram or change its layout direction.",
        parameters: updateMetadataSchema,
      }),
      exportDiagram: tool({
        description:
          "Export the current diagram as PNG, SVG, or raw mermaid code file. Use when the user asks to download or export the diagram.",
        parameters: exportDiagramSchema,
      }),
    },
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
