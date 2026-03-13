"use client";

import { useState, useRef, useEffect } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { Save, MessageSquare } from "lucide-react";
import { Toolbar } from "@/components/editor/toolbar";

interface HeaderProps {
  onToggleChat: () => void;
  chatOpen: boolean;
}

export function Header({ onToggleChat, chatOpen }: HeaderProps) {
  const title = useDiagramStore((s) => s.diagram?.title ?? "");
  const isDirty = useDiagramStore((s) => s.isDirty);
  const syncState = useDiagramStore((s) => s.syncState);
  const setTitle = useDiagramStore((s) => s.setTitle);
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    saveDiagram();
  };

  return (
    <div className="h-11 px-4 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
      {/* Title */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditing(false);
          }}
          className="text-sm font-medium bg-transparent border-b border-[var(--primary)] focus:outline-none px-0 py-0.5"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm font-medium hover:text-[var(--primary)] transition-colors truncate max-w-[300px]"
        >
          {title || "Untitled Diagram"}
        </button>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        {syncState === "saving" && <span>Saving...</span>}
        {syncState === "ai-streaming" && (
          <span className="text-[var(--primary)]">AI writing...</span>
        )}
        {isDirty && syncState === "idle" && (
          <span className="text-amber-500">Unsaved</span>
        )}
        {!isDirty && syncState === "idle" && <span>Saved</span>}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <Toolbar />

      <button
        onClick={handleSave}
        disabled={!isDirty}
        className="p-1.5 rounded hover:bg-[var(--muted)] disabled:opacity-30 transition-all"
        title="Save (Cmd+S)"
      >
        <Save className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleChat}
        className={`p-1.5 rounded transition-all ${
          chatOpen
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "hover:bg-[var(--muted)]"
        }`}
        title="Toggle AI Chat"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    </div>
  );
}
