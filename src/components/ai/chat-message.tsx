"use client";

import { cn } from "@/lib/utils";
import Markdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 text-sm rounded-xl transition-all duration-150",
        role === "user"
          ? "bg-[var(--primary)]/10 border border-[var(--primary)]/10 ml-6"
          : "bg-[var(--muted)] border border-[var(--border)] mr-6"
      )}
    >
      <div className="font-semibold text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
        {role === "user" ? "You" : "Eulard AI"}
      </div>
      <div className="leading-relaxed chat-markdown">
        <Markdown>{content}</Markdown>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-[var(--primary)] rounded-sm animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
