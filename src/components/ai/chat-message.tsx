"use client";

import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 text-sm",
        role === "user"
          ? "bg-[var(--accent)] rounded-lg ml-8"
          : "mr-8"
      )}
    >
      <div className="font-medium text-xs text-[var(--muted-foreground)] mb-1">
        {role === "user" ? "You" : "VizMerm AI"}
      </div>
      <div className="whitespace-pre-wrap leading-relaxed">
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-[var(--primary)] animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
