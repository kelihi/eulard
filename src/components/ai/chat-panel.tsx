"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { ChatMessage } from "./chat-message";
import { downloadPng, downloadSvg, downloadMermaidCode } from "@/lib/export";
import { Send, Sparkles } from "lucide-react";

export function ChatPanel() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const title = useDiagramStore((s) => s.diagram?.title ?? "diagram");
  const setCode = useDiagramStore((s) => s.setCode);
  const setTitle = useDiagramStore((s) => s.setTitle);
  const setSyncState = useDiagramStore((s) => s.setSyncState);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, status } =
    useChat({
      api: "/api/ai/chat",
      body: { currentCode: code },
      onToolCall: async ({ toolCall }) => {
        if (toolCall.toolName === "updateDiagram") {
          const args = toolCall.args as { code: string };
          try {
            const mermaid = (await import("mermaid")).default;
            await mermaid.parse(args.code);
            setCode(args.code);
            return "Diagram updated successfully.";
          } catch {
            return "Error: AI generated invalid mermaid syntax. Please try again.";
          }
        }

        if (toolCall.toolName === "updateMetadata") {
          const args = toolCall.args as { title?: string; direction?: string };
          if (args.title) {
            setTitle(args.title);
          }
          if (args.direction) {
            // Update the direction in the code
            const newCode = code.replace(
              /^(flowchart|graph)\s+(TB|BT|LR|RL|TD)/m,
              `$1 ${args.direction}`
            );
            if (newCode !== code) {
              setCode(newCode);
            }
          }
          return "Metadata updated successfully.";
        }

        if (toolCall.toolName === "exportDiagram") {
          const args = toolCall.args as { format: "png" | "svg" | "mermaid" };
          const filename = title.replace(/[^a-zA-Z0-9-_]/g, "_") || "diagram";
          try {
            switch (args.format) {
              case "png":
                await downloadPng(code, filename);
                break;
              case "svg":
                await downloadSvg(code, filename);
                break;
              case "mermaid":
                downloadMermaidCode(code, filename);
                break;
            }
            return `Diagram exported as ${args.format.toUpperCase()} successfully.`;
          } catch {
            return `Error: Failed to export diagram as ${args.format}.`;
          }
        }
      },
      onResponse: () => {
        setSyncState("ai-streaming");
      },
      onFinish: () => {
        setSyncState("idle");
      },
      onError: () => {
        setSyncState("idle");
      },
    });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
