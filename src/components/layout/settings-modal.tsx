"use client";

import { useState, useEffect } from "react";
import { X, Key, Check, Trash2, Cpu, Zap, Keyboard } from "lucide-react";
import {
  useAISettingsStore,
  AI_MODELS,
  type AIModelId,
} from "@/stores/ai-settings-store";
import { RefreshCw } from "lucide-react";
import { formatShortcut } from "@/hooks/use-keyboard-shortcuts";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SIDEBAR_SHORTCUT = "mod+b";
const DEFAULT_CODE_SHORTCUT = "mod+shift+e";
const DEFAULT_CHAT_SHORTCUT = "mod+/";

type ShortcutTarget = "sidebar" | "code" | "chat";

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"cmd_enter" | "enter">("cmd_enter");
  const [savingSendMode, setSavingSendMode] = useState(false);

  // Shortcut state
  const [sidebarShortcut, setSidebarShortcut] = useState(DEFAULT_SIDEBAR_SHORTCUT);
  const [codeShortcut, setCodeShortcut] = useState(DEFAULT_CODE_SHORTCUT);
  const [chatShortcut, setChatShortcut] = useState(DEFAULT_CHAT_SHORTCUT);
  const [recordingTarget, setRecordingTarget] = useState<ShortcutTarget | null>(null);
  const [shortcutSaving, setShortcutSaving] = useState(false);
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);

  const aiMaxSteps = useAISettingsStore((s) => s.maxSteps);
  const aiModel = useAISettingsStore((s) => s.model);
  const aiMaxAutoRetries = useAISettingsStore((s) => s.maxAutoRetries);
  const setAIMaxSteps = useAISettingsStore((s) => s.setMaxSteps);
  const setAIModel = useAISettingsStore((s) => s.setModel);
  const setAIMaxAutoRetries = useAISettingsStore((s) => s.setMaxAutoRetries);

  useEffect(() => {
    if (open) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          setHasKey(data.hasApiKey);
          setKeyPreview(data.apiKeyPreview);
        });
      // Load user preferences for shortcuts
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
      fetch("/api/preferences")
        .then((r) => r.json())
        .then((data) => {
          if (data.sendMode === "enter" || data.sendMode === "cmd_enter") {
            setSendMode(data.sendMode);
          }
        });
      setApiKey("");
      setMessage(null);
      setShortcutMessage(null);
      setRecordingTarget(null);
    }
  }, [open]);

  // Handle keyboard recording for shortcut customization
  useEffect(() => {
    if (!recordingTarget) return;

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
        setRecordingTarget(null);
        return;
      }

      parts.push(e.key.toLowerCase());
      const newShortcut = parts.join("+");

      if (recordingTarget === "sidebar") {
        setSidebarShortcut(newShortcut);
        saveShortcut("sidebar", newShortcut);
      } else if (recordingTarget === "code") {
        setCodeShortcut(newShortcut);
        saveShortcut("code", newShortcut);
      } else if (recordingTarget === "chat") {
        setChatShortcut(newShortcut);
        saveShortcut("chat", newShortcut);
      }
      setRecordingTarget(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveShortcut = async (target: ShortcutTarget, shortcut: string) => {
    setShortcutSaving(true);
    setShortcutMessage(null);
    const keyMap: Record<ShortcutTarget, string> = {
      sidebar: "sidebarToggleShortcut",
      code: "codeToggleShortcut",
      chat: "chatToggleShortcut",
    };
    const eventMap: Record<ShortcutTarget, string> = {
      sidebar: "sidebar-shortcut-changed",
      code: "code-shortcut-changed",
      chat: "chat-shortcut-changed",
    };
    try {
      const res = await fetch("/api/user-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [keyMap[target]]: shortcut }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setShortcutMessage("Shortcut saved.");
      window.dispatchEvent(
        new CustomEvent(eventMap[target], { detail: shortcut })
      );
    } catch {
      setShortcutMessage("Failed to save shortcut.");
    }
    setShortcutSaving(false);
  };

  const handleResetShortcut = async (target: ShortcutTarget) => {
    const defaults: Record<ShortcutTarget, string> = {
      sidebar: DEFAULT_SIDEBAR_SHORTCUT,
      code: DEFAULT_CODE_SHORTCUT,
      chat: DEFAULT_CHAT_SHORTCUT,
    };
    const setters: Record<ShortcutTarget, (s: string) => void> = {
      sidebar: setSidebarShortcut,
      code: setCodeShortcut,
      chat: setChatShortcut,
    };
    setters[target](defaults[target]);
    await saveShortcut(target, defaults[target]);
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

  const handleSendModeChange = async (mode: "cmd_enter" | "enter") => {
    setSendMode(mode);
    setSavingSendMode(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendMode: mode }),
      });
    } catch {
      // Revert on failure
      setSendMode(mode === "cmd_enter" ? "enter" : "cmd_enter");
    }
    setSavingSendMode(false);
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
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                {/* Toggle Sidebar */}
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] rounded-lg">
                  <span className="text-sm">Toggle Sidebar</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecordingTarget(recordingTarget === "sidebar" ? null : "sidebar")}
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                        recordingTarget === "sidebar"
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse"
                          : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]"
                      }`}
                      disabled={shortcutSaving}
                    >
                      {recordingTarget === "sidebar"
                        ? "Press keys..."
                        : formatShortcut(sidebarShortcut)}
                    </button>
                    {sidebarShortcut !== DEFAULT_SIDEBAR_SHORTCUT && (
                      <button
                        onClick={() => handleResetShortcut("sidebar")}
                        disabled={shortcutSaving}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Toggle Code Editor */}
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] rounded-lg">
                  <span className="text-sm">Toggle Code Editor</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecordingTarget(recordingTarget === "code" ? null : "code")}
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                        recordingTarget === "code"
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse"
                          : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]"
                      }`}
                      disabled={shortcutSaving}
                    >
                      {recordingTarget === "code"
                        ? "Press keys..."
                        : formatShortcut(codeShortcut)}
                    </button>
                    {codeShortcut !== DEFAULT_CODE_SHORTCUT && (
                      <button
                        onClick={() => handleResetShortcut("code")}
                        disabled={shortcutSaving}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Toggle AI Chat */}
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] rounded-lg">
                  <span className="text-sm">Toggle AI Chat</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecordingTarget(recordingTarget === "chat" ? null : "chat")}
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                        recordingTarget === "chat"
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse"
                          : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]"
                      }`}
                      disabled={shortcutSaving}
                    >
                      {recordingTarget === "chat"
                        ? "Press keys..."
                        : formatShortcut(chatShortcut)}
                    </button>
                    {chatShortcut !== DEFAULT_CHAT_SHORTCUT && (
                      <button
                        onClick={() => handleResetShortcut("chat")}
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

            {/* API Key Section */}
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

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* AI Model Section */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Cpu className="w-3.5 h-3.5" />
                AI Model
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Choose the Claude model for AI chat. Opus 4.6 is most capable;
                Sonnet 4.6 is faster and cheaper.
              </p>
              <select
                value={aiModel}
                onChange={(e) => setAIModel(e.target.value as AIModelId)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Steps Section */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Zap className="w-3.5 h-3.5" />
                Max Tool Steps
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Maximum number of tool call iterations per AI response. Increase
                for complex diagrams with many nodes/edges. Higher values use
                more tokens.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={aiMaxSteps}
                  onChange={(e) => setAIMaxSteps(Number(e.target.value))}
                  className="flex-1 accent-[var(--primary)]"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={aiMaxSteps}
                  onChange={(e) => setAIMaxSteps(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Default: 15. Recommended: 30+ for complex supply chain or ER diagrams.
              </p>
            </div>

            {/* Max Auto-Retries Section */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Max Auto-Retries
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                When the AI generates diagram code that fails to parse, it will
                automatically retry up to this many times. Set to 0 to disable.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={aiMaxAutoRetries}
                  onChange={(e) => setAIMaxAutoRetries(Number(e.target.value))}
                  className="flex-1 accent-[var(--primary)]"
                />
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={aiMaxAutoRetries}
                  onChange={(e) => setAIMaxAutoRetries(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Default: 5. The AI will attempt to fix invalid syntax automatically.
              </p>
            </div>

            {/* Send Mode Preference */}
            <div className="pt-4 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Keyboard className="w-3.5 h-3.5" />
                Chat Send Shortcut
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Choose how to send messages in the AI chat.
              </p>
              <div className="flex flex-col gap-2">
                <label
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    sendMode === "cmd_enter"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="sendMode"
                    value="cmd_enter"
                    checked={sendMode === "cmd_enter"}
                    onChange={() => handleSendModeChange("cmd_enter")}
                    disabled={savingSendMode}
                    className="accent-[var(--primary)]"
                  />
                  <div>
                    <span className="text-sm font-medium">Cmd+Enter to send</span>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Enter inserts a new line
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    sendMode === "enter"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="sendMode"
                    value="enter"
                    checked={sendMode === "enter"}
                    onChange={() => handleSendModeChange("enter")}
                    disabled={savingSendMode}
                    className="accent-[var(--primary)]"
                  />
                  <div>
                    <span className="text-sm font-medium">Enter to send</span>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Shift+Enter inserts a new line
                    </p>
                  </div>
                </label>
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
