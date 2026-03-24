"use client";

import { useEffect, useCallback, useState } from "react";
import { useDiagramStore } from "@/stores/diagram-store";

interface KeyboardShortcutsOptions {
  onToggleSidebar?: () => void;
  onToggleCode?: () => void;
  onToggleChat?: () => void;
}

/** Default sidebar toggle shortcut: Cmd+B (Mac) / Ctrl+B (Windows/Linux) */
const DEFAULT_SIDEBAR_SHORTCUT = "mod+b";
const DEFAULT_CODE_SHORTCUT = "mod+shift+e";
const DEFAULT_CHAT_SHORTCUT = "mod+/";

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

export function useKeyboardShortcuts({ onToggleSidebar, onToggleCode, onToggleChat }: KeyboardShortcutsOptions = {}) {
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);

  const [sidebarShortcut, setSidebarShortcut] = useState(DEFAULT_SIDEBAR_SHORTCUT);
  const [codeShortcut, setCodeShortcut] = useState(DEFAULT_CODE_SHORTCUT);
  const [chatShortcut, setChatShortcut] = useState(DEFAULT_CHAT_SHORTCUT);

  // Load custom shortcuts from user preferences
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
        if (data?.codeToggleShortcut) {
          setCodeShortcut(data.codeToggleShortcut);
        }
        if (data?.chatToggleShortcut) {
          setChatShortcut(data.chatToggleShortcut);
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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setCodeShortcut(detail);
    };
    window.addEventListener("code-shortcut-changed", handler);
    return () => window.removeEventListener("code-shortcut-changed", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setChatShortcut(detail);
    };
    window.addEventListener("chat-shortcut-changed", handler);
    return () => window.removeEventListener("chat-shortcut-changed", handler);
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
        return;
      }

      // Code editor toggle
      if (onToggleCode && matchesShortcut(e, codeShortcut)) {
        e.preventDefault();
        onToggleCode();
        return;
      }

      // AI Chat toggle
      if (onToggleChat && matchesShortcut(e, chatShortcut)) {
        e.preventDefault();
        onToggleChat();
        return;
      }
    },
    [saveDiagram, undo, redo, onToggleSidebar, sidebarShortcut, onToggleCode, codeShortcut, onToggleChat, chatShortcut]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
