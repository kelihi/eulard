"use client";

import { useState, useEffect, useRef } from "react";
import { X, Key, Check, Trash2, Keyboard } from "lucide-react";
import { formatShortcut } from "@/hooks/use-keyboard-shortcuts";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SIDEBAR_SHORTCUT = "mod+b";

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Sidebar shortcut state
  const [sidebarShortcut, setSidebarShortcut] = useState(DEFAULT_SIDEBAR_SHORTCUT);
  const [isRecording, setIsRecording] = useState(false);
  const [shortcutSaving, setShortcutSaving] = useState(false);
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const recordingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          setHasKey(data.hasApiKey);
          setKeyPreview(data.apiKeyPreview);
        });
      // Load user preferences for shortcut
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
      setApiKey("");
      setMessage(null);
      setShortcutMessage(null);
      setIsRecording(false);
    }
  }, [open]);

  // Handle keyboard recording for shortcut customization
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore standalone modifier keys
      if (["Control", "Meta", "Shift", "Alt"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push("mod");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");

      // Need at least one modifier
      if (parts.length === 0) {
        setShortcutMessage("Shortcut must include a modifier key (Ctrl/Cmd, Shift, or Alt).");
        setIsRecording(false);
        return;
      }

      parts.push(e.key.toLowerCase());
      const newShortcut = parts.join("+");
      setSidebarShortcut(newShortcut);
      setIsRecording(false);
      saveShortcut(newShortcut);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording]);

  const saveShortcut = async (shortcut: string) => {
    setShortcutSaving(true);
    setShortcutMessage(null);
    try {
      await fetch("/api/user-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebarToggleShortcut: shortcut }),
      });
      setShortcutMessage("Shortcut saved.");
      // Notify the keyboard shortcuts hook
      window.dispatchEvent(
        new CustomEvent("sidebar-shortcut-changed", { detail: shortcut })
      );
    } catch {
      setShortcutMessage("Failed to save shortcut.");
    }
    setShortcutSaving(false);
  };

  const handleResetShortcut = async () => {
    setSidebarShortcut(DEFAULT_SIDEBAR_SHORTCUT);
    await saveShortcut(DEFAULT_SIDEBAR_SHORTCUT);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setHasKey(data.hasApiKey);
      setKeyPreview(data.apiKeyPreview);
      setApiKey("");
      setMessage("API key saved successfully.");
    } catch {
      setMessage("Failed to save API key.");
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearApiKey: true }),
      });
      const data = await res.json();
      setHasKey(data.hasApiKey);
      setKeyPreview(data.apiKeyPreview);
      setMessage("API key removed.");
    } catch {
      setMessage("Failed to remove API key.");
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-base font-semibold">Settings</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-6">
            {/* Keyboard Shortcuts */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Keyboard className="w-3.5 h-3.5" />
                Keyboard Shortcuts
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] rounded-lg">
                  <span className="text-sm">Toggle Sidebar</span>
                  <div className="flex items-center gap-2">
                    <button
                      ref={recordingRef}
                      onClick={() => setIsRecording(!isRecording)}
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                        isRecording
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse"
                          : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]"
                      }`}
                      disabled={shortcutSaving}
                    >
                      {isRecording
                        ? "Press keys..."
                        : formatShortcut(sidebarShortcut)}
                    </button>
                    {sidebarShortcut !== DEFAULT_SIDEBAR_SHORTCUT && (
                      <button
                        onClick={handleResetShortcut}
                        disabled={shortcutSaving}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                {shortcutMessage && (
                  <p className="text-xs text-[var(--muted-foreground)]">{shortcutMessage}</p>
                )}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Key className="w-3.5 h-3.5" />
                Anthropic API Key
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Required for AI chat. Get yours at{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>

              {hasKey && keyPreview && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[var(--muted)] rounded-lg text-sm">
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="flex-1 font-mono text-xs">{keyPreview}</span>
                  <button
                    onClick={handleClear}
                    disabled={saving}
                    className="p-1 rounded hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors"
                    title="Remove API key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasKey ? "Enter new key to replace..." : "sk-ant-..."}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="px-4 py-2 text-sm bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>

            {message && (
              <p className="text-xs text-[var(--muted-foreground)]">{message}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
