"use client";

import { useEffect, useCallback } from "react";
import { useDiagramStore } from "@/stores/diagram-store";

export function useKeyboardShortcuts() {
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "s") {
        e.preventDefault();
        saveDiagram();
      }

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    },
    [saveDiagram, undo, redo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
