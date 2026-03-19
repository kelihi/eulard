"use client";

import { useEffect, useCallback, useState } from "react";
import { useDiagramStore } from "@/stores/diagram-store";

interface KeyboardShortcutsOptions {
  onToggleSidebar?: () => void;
}

export interface ShortcutBinding {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** Default sidebar toggle shortcut: Cmd+B (Mac) / Ctrl+B (Windows/Linux) */
const DEFAULT_SIDEBAR_SHORTCUT = "mod+b";

/**
 * Parse a shortcut string like "mod+b", "mod+shift+\\", "ctrl+b" into a ShortcutBinding.
 * "mod" means metaKey on Mac, ctrlKey elsewhere.
 */
export function parseShortcut(shortcut: string): ShortcutBinding {
  const parts = shortcut.toLowerCase().split("+");
  const binding: ShortcutBinding = { key: parts[parts.length - 1] };
  for (const part of parts.slice(0, -1)) {
    if (part === "mod") {
      // Will be resolved at match time
    } else if (part === "ctrl") {
      binding.ctrlKey = true;
    } else if (part === "meta" || part === "cmd") {
      binding.metaKey = true;
    } else if (part === "shift") {
      binding.shiftKey = true;
    } else if (part === "alt") {
      binding.altKey = true;
    }
  }
  // If "mod" is in parts, we handle it specially during matching
  if (parts.includes("mod")) {
    // Mark both as potential — resolved at match time
    binding.ctrlKey = undefined;
    binding.metaKey = undefined;
  }
  return binding;
}

/**
 * Check if a keyboard event matches a shortcut string.
 */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  if (e.key.toLowerCase() !== key) return false;

  const hasMod = modifiers.includes("mod");
  const hasCtrl = modifiers.includes("ctrl");
  const hasMeta = modifiers.includes("meta") || modifiers.includes("cmd");
  const hasShift = modifiers.includes("shift");
  const hasAlt = modifiers.includes("alt");

  // "mod" means either metaKey or ctrlKey
  if (hasMod) {
    if (!e.metaKey && !e.ctrlKey) return false;
  } else {
    if (hasCtrl && !e.ctrlKey) return false;
    if (!hasCtrl && e.ctrlKey) return false;
    if (hasMeta && !e.metaKey) return false;
    if (!hasMeta && e.metaKey) return false;
  }

  if (hasShift !== e.shiftKey) return false;
  if (hasAlt !== e.altKey) return false;

  return true;
}

/**
 * Format a shortcut string for display: "mod+b" -> "Ctrl+B" or "⌘B"
 */
export function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  const labels: string[] = [];
  for (const mod of modifiers) {
    if (mod === "mod") {
      labels.push(isMac ? "\u2318" : "Ctrl");
    } else if (mod === "ctrl") {
      labels.push(isMac ? "\u2303" : "Ctrl");
    } else if (mod === "meta" || mod === "cmd") {
      labels.push(isMac ? "\u2318" : "Win");
    } else if (mod === "shift") {
      labels.push(isMac ? "\u21E7" : "Shift");
    } else if (mod === "alt") {
      labels.push(isMac ? "\u2325" : "Alt");
    }
  }

  const displayKey = key === "\\" ? "\\" : key.toUpperCase();
  if (isMac) {
    return labels.join("") + displayKey;
  }
  return [...labels, displayKey].join("+");
}

export function useKeyboardShortcuts({ onToggleSidebar }: KeyboardShortcutsOptions = {}) {
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);

  const [sidebarShortcut, setSidebarShortcut] = useState(DEFAULT_SIDEBAR_SHORTCUT);

  // Load custom sidebar shortcut from user preferences
  useEffect(() => {
    fetch("/api/user-preferences")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.sidebarToggleShortcut) {
          setSidebarShortcut(data.sidebarToggleShortcut);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for shortcut changes from settings modal
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setSidebarShortcut(detail);
    };
    window.addEventListener("sidebar-shortcut-changed", handler);
    return () => window.removeEventListener("sidebar-shortcut-changed", handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "s") {
        e.preventDefault();
        saveDiagram();
        return;
      }

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Sidebar toggle
      if (onToggleSidebar && matchesShortcut(e, sidebarShortcut)) {
        e.preventDefault();
        onToggleSidebar();
      }
    },
    [saveDiagram, undo, redo, onToggleSidebar, sidebarShortcut]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
