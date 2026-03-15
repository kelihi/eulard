"use client";

import { useState, useEffect } from "react";
import { X, Key, Check, Trash2, Cpu, Zap } from "lucide-react";
import {
  useAISettingsStore,
  AI_MODELS,
  type AIModelId,
} from "@/stores/ai-settings-store";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const aiMaxSteps = useAISettingsStore((s) => s.maxSteps);
  const aiModel = useAISettingsStore((s) => s.model);
  const setAIMaxSteps = useAISettingsStore((s) => s.setMaxSteps);
  const setAIModel = useAISettingsStore((s) => s.setModel);

  useEffect(() => {
    if (open) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          setHasKey(data.hasApiKey);
          setKeyPreview(data.apiKeyPreview);
        });
      setApiKey("");
      setMessage(null);
    }
  }, [open]);

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
                Choose the Claude model for AI chat. Sonnet 4 is most capable;
                Haiku is faster and cheaper.
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
                  max={50}
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

            {message && (
              <p className="text-xs text-[var(--muted-foreground)]">{message}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
