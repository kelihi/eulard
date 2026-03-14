"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MermaidNodeType } from "@/types/graph";

interface NodeContextMenuProps {
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
  onRename: (nodeId: string, newLabel: string) => void;
  onDelete: (nodeId: string) => void;
  onChangeShape: (nodeId: string, newType: MermaidNodeType) => void;
  onClose: () => void;
}

const SHAPE_OPTIONS: { label: string; value: MermaidNodeType }[] = [
  { label: "Rectangle", value: "default" },
  { label: "Diamond", value: "decision" },
  { label: "Stadium", value: "stadium" },
  { label: "Subroutine", value: "subroutine" },
  { label: "Cylinder", value: "cylinder" },
  { label: "Circle", value: "circle" },
];

export function NodeContextMenu({
  nodeId,
  nodeLabel,
  x,
  y,
  onRename,
  onDelete,
  onChangeShape,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showShapes, setShowShapes] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleRenameClick = useCallback(() => {
    setIsRenaming(true);
    setRenameValue(nodeLabel);
  }, [nodeLabel]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== nodeLabel) {
      onRename(nodeId, trimmed);
    }
    onClose();
  }, [renameValue, nodeLabel, onRename, nodeId, onClose]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitRename();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [commitRename, onClose]
  );

  const handleDelete = useCallback(() => {
    onDelete(nodeId);
    onClose();
  }, [onDelete, nodeId, onClose]);

  const handleChangeShape = useCallback(
    (newType: MermaidNodeType) => {
      onChangeShape(nodeId, newType);
      onClose();
    },
    [onChangeShape, nodeId, onClose]
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg"
      style={{ top: y, left: x }}
    >
      {isRenaming ? (
        <div className="p-2">
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            className="w-full rounded border border-[var(--primary)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)] outline-none"
            placeholder="Node name"
          />
        </div>
      ) : (
        <div className="py-1">
          <button
            onClick={handleRenameClick}
            className="flex w-full items-center px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-left"
          >
            Rename
          </button>
          <button
            onClick={handleDelete}
            className="flex w-full items-center px-3 py-1.5 text-sm text-red-500 hover:bg-[var(--accent)] transition-colors text-left"
          >
            Delete
          </button>
          <div className="relative">
            <button
              onClick={() => setShowShapes((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-left"
            >
              Change Shape
              <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                {showShapes ? "\u25B4" : "\u25BE"}
              </span>
            </button>
            {showShapes && (
              <div className="border-t border-[var(--border)]">
                {SHAPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChangeShape(opt.value)}
                    className="flex w-full items-center px-5 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-left"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
