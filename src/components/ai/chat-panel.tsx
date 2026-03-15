"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Plus,
  MessageSquare,
  ChevronDown,
  Trash2,
} from "lucide-react";

interface ChatSession {
  id: string;
  diagramId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

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
  const folderId = useDiagramStore((s) => s.diagram?.folderId ?? null);
  const diagramId = useDiagramStore((s) => s.diagram?.id ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDone, setShowDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const sessionListRef = useRef<HTMLDivElement>(null);

  // Load sessions for current diagram
  const loadSessions = useCallback(async () => {
    if (!diagramId) return;
    try {
      const res = await fetch(`/api/chat-sessions?diagramId=${diagramId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // Silently fail — sessions are non-critical
    }
  }, [diagramId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Close session list when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node)) {
        setShowSessionList(false);
      }
    }
    if (showSessionList) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSessionList]);

  const { messages, input, handleInputChange, handleSubmit, status, setMessages } =
    useChat({
      api: "/api/ai/chat",
      body: { currentCode: code, folderId, sessionId, diagramId },
      onToolCall: async ({ toolCall }) => {
        pendingToolCalls++;
        try {
          return await handleToolCall(toolCall);
        } finally {
          pendingToolCalls--;
          maybeEndBatch();
        }
      },
      onResponse: (response) => {
        // Capture sessionId from response headers
        const newSessionId = response.headers.get("X-Session-Id");
        if (newSessionId && newSessionId !== sessionId) {
          setSessionId(newSessionId);
        }
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
        // Refresh session list after a chat completes
        loadSessions();
      },
      onError: () => {
        useDiagramStore.getState().endBatch();
        useDiagramStore.getState().setSyncState("idle");
        finishFired = false;
        pendingToolCalls = 0;
      },
    });

  // Reset session when diagram changes
  useEffect(() => {
    setSessionId(null);
    setMessages([]);
  }, [diagramId, setMessages]);

  // Load a previous session
  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/chat-sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionId(data.id);
      const hydrated = (data.messages as StoredMessage[])
        .filter((m: StoredMessage) => m.role === "user" || m.role === "assistant")
        .map((m: StoredMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      setMessages(hydrated);
      setShowSessionList(false);
    } catch {
      // Silently fail
    }
  };

  // Start a new session
  const newSession = () => {
    setSessionId(null);
    setMessages([]);
    setShowSessionList(false);
  };

  // Delete a session
  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }
      loadSessions();
    } catch {
      // Silently fail
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const isLoading = status === "streaming" || status === "submitted";
  const currentSession = sessions.find((s) => s.id === sessionId);

  return (
    <div className="flex flex-col h-full bg-[var(--background)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 shrink-0">
        <Sparkles className="w-4 h-4 text-[var(--primary)]" />
        <div className="flex-1 min-w-0 relative" ref={sessionListRef}>
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="flex items-center gap-1 text-sm font-medium hover:text-[var(--primary)] transition-colors max-w-full"
          >
            <span className="truncate">
              {currentSession?.title || "New Chat"}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>

          {/* Session dropdown */}
          {showSessionList && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              <button
                onClick={newSession}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] transition-colors text-[var(--primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
              {sessions.length > 0 && (
                <div className="border-t border-[var(--border)]">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] transition-colors group ${
                        s.id === sessionId ? "bg-[var(--accent)]" : ""
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="truncate flex-1 text-left">
                        {s.title || "Untitled"}
                      </span>
                      <Trash2
                        className="w-3 h-3 shrink-0 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                        onClick={(e) => deleteSession(s.id, e)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={newSession}
          title="New Chat"
          className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
        >
          <Plus className="w-4 h-4 text-[var(--muted-foreground)]" />
        </button>
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
