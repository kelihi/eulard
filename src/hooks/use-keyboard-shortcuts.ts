"use client";

import { useEffect, useCallback } from "react";
import { useDiagramStore } from "@/stores/diagram-store";

export function useKeyboardShortcuts() {
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "s") {
        e.preventDefault();
        saveDiagram();
      }
    },
    [saveDiagram]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
