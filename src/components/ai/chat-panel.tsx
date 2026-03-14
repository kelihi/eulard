"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { ChatMessage } from "./chat-message";
import { downloadPng, downloadSvg, downloadMermaidCode } from "@/lib/export";
import { mermaidToGraph } from "@/lib/parser/mermaid-to-graph";
import type { FlowchartGraph } from "@/types/graph";
import { graphToMermaid } from "@/lib/parser/graph-to-mermaid";
import { incrementalLayout } from "@/lib/parser/auto-layout";
import {
  applyAddNodes,
  applyRemoveNodes,
  applyUpdateNodes,
  applyAddEdges,
  applyRemoveEdges,
  applyUpdateEdges,
} from "@/lib/graph-operations";
import {
  addNodesSchema,
  removeNodesSchema,
  updateNodesSchema,
  addEdgesSchema,
  removeEdgesSchema,
  updateEdgesSchema,
  replaceDiagramSchema,
} from "@/lib/ai/tools";
import { Send, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

// Track pending tool calls for safe batch timing
let pendingToolCalls = 0;
let finishFired = false;

function maybeEndBatch() {
  if (finishFired && pendingToolCalls === 0) {
    useDiagramStore.getState().endBatch();
    useDiagramStore.getState().setSyncState("idle");
    finishFired = false;
  }
}

export function ChatPanel() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const title = useDiagramStore((s) => s.diagram?.title ?? "diagram");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDone, setShowDone] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, status } =
    useChat({
      api: "/api/ai/chat",
      body: { currentCode: code },
      onToolCall: async ({ toolCall }) => {
        pendingToolCalls++;
        try {
          return await handleToolCall(toolCall);
        } finally {
          pendingToolCalls--;
          maybeEndBatch();
        }
      },
      onResponse: () => {
        finishFired = false;
        pendingToolCalls = 0;
        useDiagramStore.getState().beginBatch();
        useDiagramStore.getState().setSyncState("ai-streaming");
      },
      onFinish: () => {
        finishFired = true;
        maybeEndBatch();
        setShowDone(true);
        setTimeout(() => setShowDone(false), 2000);
      },
      onError: () => {
        // End batch on error to avoid stuck state
        useDiagramStore.getState().endBatch();
        useDiagramStore.getState().setSyncState("idle");
        finishFired = false;
        pendingToolCalls = 0;
      },
    });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-full bg-[var(--background)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 shrink-0">
        <Sparkles className="w-4 h-4 text-[var(--primary)]" />
        <span className="font-medium text-sm">AI Assistant</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[var(--muted-foreground)] text-sm mt-8 px-4">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">Vibe code your diagrams</p>
            <p className="text-xs">
              Describe what you want and I&apos;ll create or modify the mermaid
              diagram for you.
            </p>
          </div>
        )}
        {messages.map((m) => {
          if (m.role === "user" || m.role === "assistant") {
            const textContent =
              typeof m.content === "string"
                ? m.content
                : "";

            if (!textContent) return null;

            return (
              <ChatMessage
                key={m.id}
                role={m.role}
                content={textContent}
                isStreaming={
                  isLoading &&
                  m.id === messages[messages.length - 1]?.id &&
                  m.role === "assistant"
                }
              />
            );
          }
          return null;
        })}

        {/* Status indicators */}
        {status === "submitted" && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
            <span>Thinking...</span>
          </div>
        )}
        {status === "streaming" && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--primary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Writing...</span>
          </div>
        )}
        {showDone && !isLoading && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-green-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Done</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[var(--border)] shrink-0"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Describe your diagram..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Tool call handler ---

async function handleToolCall(toolCall: { toolName: string; args: unknown }): Promise<string> {
  // Helper: get latest state (avoids stale closures)
  const getCode = () => useDiagramStore.getState().diagram?.code;
  const getTitle = () => useDiagramStore.getState().diagram?.title ?? "diagram";

  // Helper: parse current code to graph, return error string if not flowchart
  function parseGraph():
    | { ok: true; graph: FlowchartGraph }
    | { ok: false; error: string } {
    const currentCode = getCode();
    if (!currentCode) return { ok: false, error: "Error: No diagram loaded." };
    const graph = mermaidToGraph(currentCode);
    if (!graph) return { ok: false, error: "Error: Current diagram is not a flowchart. Use replaceDiagram instead." };
    return { ok: true, graph };
  }

  // --- Graph operation tools ---

  if (toolCall.toolName === "addNodes") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = addNodesSchema.parse(toolCall.args);
    const result = applyAddNodes(parsed.graph, args.nodes);
    if (!result.ok) return result.error;

    const laid = incrementalLayout(result.graph, args.nodes.map((n) => n.id));
    const newCode = graphToMermaid(laid);
    useDiagramStore.getState().setCode(newCode);
    return `Added ${args.nodes.length} node(s): ${args.nodes.map((n) => n.id).join(", ")}`;
  }

  if (toolCall.toolName === "removeNodes") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = removeNodesSchema.parse(toolCall.args);
    const result = applyRemoveNodes(parsed.graph, args.nodeIds);
    if (!result.ok) return result.error;

    const newCode = graphToMermaid(result.graph);
    useDiagramStore.getState().setCode(newCode);
    return `Removed ${args.nodeIds.length} node(s): ${args.nodeIds.join(", ")}`;
  }

  if (toolCall.toolName === "updateNodes") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = updateNodesSchema.parse(toolCall.args);
    const result = applyUpdateNodes(parsed.graph, args.updates);
    if (!result.ok) return result.error;

    const newCode = graphToMermaid(result.graph);
    useDiagramStore.getState().setCode(newCode);
    return `Updated ${args.updates.length} node(s): ${args.updates.map((u) => u.id).join(", ")}`;
  }

  if (toolCall.toolName === "addEdges") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = addEdgesSchema.parse(toolCall.args);
    const result = applyAddEdges(parsed.graph, args.edges);
    if (!result.ok) return result.error;

    const newCode = graphToMermaid(result.graph);
    useDiagramStore.getState().setCode(newCode);
    return `Added ${args.edges.length} edge(s)`;
  }

  if (toolCall.toolName === "removeEdges") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = removeEdgesSchema.parse(toolCall.args);
    const result = applyRemoveEdges(parsed.graph, args.edges);
    if (!result.ok) return result.error;

    const newCode = graphToMermaid(result.graph);
    useDiagramStore.getState().setCode(newCode);
    return `Removed ${args.edges.length} edge(s)`;
  }

  if (toolCall.toolName === "updateEdges") {
    const parsed = parseGraph();
    if (!parsed.ok) return parsed.error;

    const args = updateEdgesSchema.parse(toolCall.args);
    const result = applyUpdateEdges(parsed.graph, args.updates);
    if (!result.ok) return result.error;

    const newCode = graphToMermaid(result.graph);
    useDiagramStore.getState().setCode(newCode);
    return `Updated ${args.updates.length} edge(s)`;
  }

  // --- replaceDiagram (escape hatch) ---

  if (toolCall.toolName === "replaceDiagram") {
    const args = replaceDiagramSchema.parse(toolCall.args);
    try {
      const mermaid = (await import("mermaid")).default;
      await mermaid.parse(args.code);
      useDiagramStore.getState().setCode(args.code);

      // Warn if this was a flowchart — prefer granular tools
      const isFlowchart = mermaidToGraph(args.code) !== null;
      if (isFlowchart) {
        return "Diagram replaced. Tip: For flowchart edits, prefer addNodes/addEdges/etc. for incremental changes.";
      }
      return "Diagram replaced successfully.";
    } catch {
      return "Error: Invalid mermaid syntax. Please try again with valid code.";
    }
  }

  // --- updateMetadata ---

  if (toolCall.toolName === "updateMetadata") {
    const args = toolCall.args as { title?: string; direction?: string };
    if (args.title) {
      useDiagramStore.getState().setTitle(args.title);
    }
    if (args.direction) {
      const currentCode = getCode() ?? "";
      const newCode = currentCode.replace(
        /^(flowchart|graph)\s+(TB|BT|LR|RL|TD)/m,
        `$1 ${args.direction}`
      );
      if (newCode !== currentCode) {
        useDiagramStore.getState().setCode(newCode);
      }
    }
    return "Metadata updated successfully.";
  }

  // --- exportDiagram ---

  if (toolCall.toolName === "exportDiagram") {
    const args = toolCall.args as { format: "png" | "svg" | "mermaid" };
    const currentCode = getCode() ?? "";
    const filename = getTitle().replace(/[^a-zA-Z0-9-_]/g, "_") || "diagram";
    try {
      switch (args.format) {
        case "png":
          await downloadPng(currentCode, filename);
          break;
        case "svg":
          await downloadSvg(currentCode, filename);
          break;
        case "mermaid":
          downloadMermaidCode(currentCode, filename);
          break;
      }
      return `Diagram exported as ${args.format.toUpperCase()} successfully.`;
    } catch {
      return `Error: Failed to export diagram as ${args.format}.`;
    }
  }

  return "Unknown tool.";
}
