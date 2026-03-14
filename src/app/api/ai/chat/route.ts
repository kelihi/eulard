import { streamText, tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  addNodesSchema,
  removeNodesSchema,
  updateNodesSchema,
  addEdgesSchema,
  removeEdgesSchema,
  updateEdgesSchema,
  replaceDiagramSchema,
  updateMetadataSchema,
  exportDiagramSchema,
} from "@/lib/ai/tools";
import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

function getApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return null;
}

export async function POST(request: Request) {
  const log = logger.apiRequest("POST", "/api/ai/chat");
  const user = await getRequiredUser();
  if (!user) {
    log.done(401, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    log.done(401, "no API key configured", { userId: user.id });
    return NextResponse.json(
      { error: "No API key configured. Set ANTHROPIC_API_KEY environment variable." },
      { status: 401 }
    );
  }
  log.done(200, "streaming AI response", { userId: user.id });

  const { messages, currentCode } = await request.json();

  const anthropic = createAnthropic({ apiKey });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(currentCode || ""),
    messages,
    tools: {
      addNodes: tool({
        description:
          "Add one or more nodes to the flowchart diagram. Use when the user asks to add new elements.",
        parameters: addNodesSchema,
      }),
      removeNodes: tool({
        description:
          "Remove nodes from the diagram by ID. Connected edges are automatically removed. Use when the user asks to delete or remove elements.",
        parameters: removeNodesSchema,
      }),
      updateNodes: tool({
        description:
          "Update existing node properties (label, type/shape). Use when the user asks to rename, restyle, or modify existing nodes.",
        parameters: updateNodesSchema,
      }),
      addEdges: tool({
        description:
          "Add connections between existing nodes. Use when the user asks to connect, link, or add arrows between elements.",
        parameters: addEdgesSchema,
      }),
      removeEdges: tool({
        description:
          "Remove connections between nodes. Use when the user asks to disconnect or remove arrows.",
        parameters: removeEdgesSchema,
      }),
      updateEdges: tool({
        description:
          "Update edge properties (label, type/style). Use when the user asks to change arrow labels or styles.",
        parameters: updateEdgesSchema,
      }),
      replaceDiagram: tool({
        description:
          "Replace the entire diagram code. Use ONLY for non-flowchart diagrams (sequence, class, state, ER) or major restructuring where granular operations would be more complex.",
        parameters: replaceDiagramSchema,
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
    maxSteps: 15,
  });

  return result.toDataStreamResponse();
}
