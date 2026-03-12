import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { updateDiagramSchema } from "@/lib/ai/tools";

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
    },
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
