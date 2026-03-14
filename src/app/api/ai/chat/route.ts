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
import path from "path";
import fs from "fs";

function getApiKey(): string | null {
  // Check env var first, then settings file
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const settingsPath = path.join(process.cwd(), "data", "settings.json");
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    return settings.anthropicApiKey || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Go to Settings to add your Anthropic API key." },
      { status: 401 }
    );
  }

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
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
