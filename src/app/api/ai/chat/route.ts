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
import { authenticateRequest } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import {
  createChatSession,
  getChatSession,
  createChatMessage,
  touchChatSession,
  updateChatSessionTitle,
  canAccessDiagram,
} from "@/lib/db";

function getApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return null;
}

const AI_MODEL = "claude-sonnet-4-20250514";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const log = logger.apiRequest("POST", "/api/ai/chat", { requestId });
  const start = Date.now();

  const user = await authenticateRequest(request);
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

  const { messages, currentCode, sessionId, diagramId, userContext } = await request.json();

  // Resolve or create chat session
  let resolvedSessionId: string | null = sessionId ?? null;

  if (resolvedSessionId) {
    const session = await getChatSession(resolvedSessionId);
    if (!session || session.userId !== user.id) {
      resolvedSessionId = null;
    }
  }

  if (!resolvedSessionId && diagramId) {
    const access = await canAccessDiagram(diagramId, user.id, user.email);
    if (access.access) {
      resolvedSessionId = generateId();
      await createChatSession(resolvedSessionId, diagramId, user.id);
    }
  }

  // Persist user message (last message in the array is the new one from the client)
  const userMessage = messages[messages.length - 1];
  if (resolvedSessionId && userMessage?.role === "user") {
    const userContent = typeof userMessage.content === "string"
      ? userMessage.content
      : JSON.stringify(userMessage.content);
    await createChatMessage(generateId(), resolvedSessionId, "user", userContent);

    // Auto-title session from first user message
    const session = await getChatSession(resolvedSessionId);
    if (session && !session.title) {
      const title = userContent.length > 80
        ? userContent.substring(0, 77) + "..."
        : userContent;
      await updateChatSessionTitle(resolvedSessionId, title);
    }
  }

  // Load custom AI settings from the database
  const [customPrompt, customModel] = await Promise.all([
    getSetting("ai_system_prompt"),
    getSetting("ai_model"),
  ]);

  const modelId = customModel || AI_MODEL;

  logger.info("ai-chat-started", {
    requestId,
    userId: user.id,
    model: modelId,
    messageCount: messages?.length ?? 0,
    hasCurrentCode: !!currentCode,
  });

  const anthropic = createAnthropic({ apiKey });

  const capturedSessionId = resolvedSessionId;

  const result = streamText({
    model: anthropic(modelId),
    system: buildSystemPrompt(currentCode || "", customPrompt, userContext),
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
    experimental_telemetry: { isEnabled: true },
    onFinish: async ({ text, toolCalls, usage, finishReason, steps }) => {
      // Log telemetry
      const allToolCalls = steps?.flatMap((s) => s.toolCalls ?? []) ?? [];
      logger.info("ai-chat-completed", {
        requestId,
        userId: user.id,
        model: modelId,
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
        finishReason,
        toolCallCount: allToolCalls.length,
        toolNames: allToolCalls.map((tc) => tc.toolName),
        stepCount: steps?.length ?? 0,
        durationMs: Date.now() - start,
        messageCount: messages?.length ?? 0,
      });

      // Persist assistant message to chat session
      if (capturedSessionId) {
        try {
          await createChatMessage(
            generateId(),
            capturedSessionId,
            "assistant",
            text || "",
            {
              toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
              tokensUsed: usage?.totalTokens,
            }
          );
          await touchChatSession(capturedSessionId);
        } catch (err) {
          logger.error("failed to persist assistant message", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
  });

  const response = result.toDataStreamResponse();

  // Attach sessionId as a response header so the client can track it
  if (capturedSessionId) {
    response.headers.set("X-Session-Id", capturedSessionId);
  }

  return response;
}
