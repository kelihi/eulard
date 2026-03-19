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
  listClientsSchema,
  getClientContextSchema,
} from "@/lib/ai/tools";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  getSetting,
  getFolder,
  createChatSession,
  getChatSession,
  createChatMessage,
  touchChatSession,
  updateChatSessionTitle,
  canAccessDiagram,
} from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import {
  listClients,
  getClient,
  isConfigured as isFeedbackSystemConfigured,
} from "@/lib/feedback-system";
import type { ClientResponse } from "@/lib/feedback-system";

export const maxDuration = 60;

function getApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return null;
}

/**
 * Format a client response into a concise text summary for the AI.
 */
function formatClientContext(client: ClientResponse): string {
  const lines: string[] = [
    `Client: ${client.name} (ID: ${client.id})`,
    `Status: ${client.status}`,
  ];

  if (client.industry) lines.push(`Industry: ${client.industry}`);
  if (client.engagement_type) lines.push(`Engagement: ${client.engagement_type}`);
  if (client.account_owner) lines.push(`Account Owner: ${client.account_owner.name}`);
  if (client.start_date) lines.push(`Start Date: ${client.start_date}`);
  if (client.contract_start_date) lines.push(`Contract Start: ${client.contract_start_date}`);
  if (client.contract_end_date) lines.push(`Contract End: ${client.contract_end_date}`);

  // Integration links
  if (client.clickup_folder_id)
    lines.push(`ClickUp Folder ID: ${client.clickup_folder_id}`);
  if (client.notion_page_url)
    lines.push(`Notion Page: ${client.notion_page_url}`);
  if (client.internal_slack_channel_id)
    lines.push(`Internal Slack Channel: ${client.internal_slack_channel_id}`);
  if (client.external_slack_channel_id)
    lines.push(`External Slack Channel: ${client.external_slack_channel_id}`);

  // Team members
  if (client.team_members.length > 0) {
    lines.push(`\nTeam Members (${client.team_members.length}):`);
    for (const member of client.team_members) {
      lines.push(`  - ${member.name}${member.email ? ` (${member.email})` : ""}`);
    }
  }

  // Tools
  if (client.tools.length > 0) {
    lines.push(`\nTools (${client.tools.length}):`);
    for (const t of client.tools) {
      lines.push(`  - ${t.name}${t.category ? ` [${t.category}]` : ""}`);
    }
  }

  // Domains
  if (client.domains.length > 0) {
    lines.push(`\nDomains: ${client.domains.map((d) => d.name).join(", ")}`);
  }

  // Source systems
  if (client.source_systems.length > 0) {
    lines.push(`\nSource Systems:`);
    for (const ss of client.source_systems) {
      lines.push(`  - ${ss.name}${ss.description ? ` (${ss.description})` : ""}`);
    }
  }

  return lines.join("\n");
}


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

  const { messages, currentCode, folderId, sessionId, diagramId, selectedNodeIds, selectedEdgeIds, maxSteps: clientMaxSteps, model: clientModel, userContext } = await request.json();

  // If the diagram is in a folder with a bound client, pre-fetch context
  let folderClientContext: string | null = null;
  if (folderId && isFeedbackSystemConfigured()) {
    try {
      const folder = await getFolder(folderId, user.id);
      if (folder?.clientId) {
        const client = await getClient(folder.clientId);
        folderClientContext = formatClientContext(client);
      }
    } catch {
      // Non-fatal: folder client context is best-effort
    }
  }

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

  const allowedModels = [
    "claude-sonnet-4-6",
    "claude-opus-4-6",
  ];
  const modelId = allowedModels.includes(clientModel)
    ? clientModel
    : "claude-sonnet-4-6";
  const maxSteps = typeof clientMaxSteps === "number"
    ? Math.max(1, Math.min(100, clientMaxSteps))
    : 15;

  // Load custom system prompt from the database
  const customPrompt = await getSetting("ai_system_prompt");

  logger.info("ai-chat-started", {
    requestId,
    userId: user.id,
    model: modelId,
    messageCount: messages?.length ?? 0,
    hasCurrentCode: !!currentCode,
  });

  const anthropic = createAnthropic({ apiKey });

  // Build diagram tools (always available)
  const diagramTools = {
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
  };

  // Conditionally add client context tools when feedback system is configured
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: Record<string, any> = { ...diagramTools };

  if (isFeedbackSystemConfigured()) {
    allTools.listClients = tool({
      description:
        "Search and list clients from the feedback system. Returns client names, IDs, status, and integration links (ClickUp, Notion, Slack). Use when the user mentions a client or asks about client data.",
      parameters: listClientsSchema,
      execute: async ({ search, status }: { search?: string; status?: string }) => {
        try {
          const result = await listClients({ search, status, limit: 20 });
          if (result.items.length === 0) {
            return "No clients found matching your criteria.";
          }
          const clientList = result.items
            .map((c) => {
              const integrations: string[] = [];
              if (c.clickup_folder_id) integrations.push("ClickUp");
              if (c.notion_page_url) integrations.push("Notion");
              if (c.internal_slack_channel_id || c.external_slack_channel_id)
                integrations.push("Slack");
              const intStr =
                integrations.length > 0
                  ? ` [${integrations.join(", ")}]`
                  : "";
              return `- ${c.name} (ID: ${c.id}, status: ${c.status})${intStr}`;
            })
            .join("\n");
          return `Found ${result.total} client(s):\n${clientList}`;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return `Error fetching clients: ${message}`;
        }
      },
    });
    allTools.getClientContext = tool({
      description:
        "Fetch full details for a specific client including team members, tools, domains, source systems, and integration links (ClickUp folder, Notion page, Slack channels). Use after listClients to get detailed context for diagram creation.",
      parameters: getClientContextSchema,
      execute: async ({ clientId }: { clientId: string }) => {
        try {
          const client = await getClient(clientId);
          return formatClientContext(client);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return `Error fetching client details: ${message}`;
        }
      },
    });
  }

  const capturedSessionId = resolvedSessionId;

  const result = streamText({
    model: anthropic(modelId),
    system: buildSystemPrompt(currentCode || "", customPrompt, folderClientContext, selectedNodeIds, selectedEdgeIds, userContext),
    messages,
    tools: allTools,
    maxSteps,
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
