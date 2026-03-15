"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, ArrowLeft, Bot, RotateCcw } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface AISettings {
  systemPrompt: string | null;
  defaultSystemPrompt: string;
  model: string | null;
  defaultModel: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedModel, setEditedModel] = useState("");
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      router.replace("/");
      return;
    }
    loadUsers();
    loadAiSettings();
  }, [session, status, router]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !invitePassword.trim()) return;

    setInviting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || inviteEmail.split("@")[0],
          password: invitePassword.trim(),
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `User ${inviteEmail} invited successfully.` });
        setInviteEmail("");
        setInviteName("");
        setInvitePassword("");
        loadUsers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to invite user." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to invite user." });
    }
    setInviting(false);
  };

  const loadAiSettings = async () => {
    setAiSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/ai-settings");
      if (res.ok) {
        const data: AISettings = await res.json();
        setAiSettings(data);
        setEditedPrompt(data.systemPrompt ?? "");
        setEditedModel(data.model ?? "");
      }
    } catch {
      // ignore
    }
    setAiSettingsLoading(false);
  };

  const handleSaveAiSettings = async () => {
    setSavingAiSettings(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: editedPrompt.trim() || null,
          model: editedModel.trim() || null,
        }),
      });
      if (res.ok) {
        const data: AISettings = await res.json();
        setAiSettings(data);
        setEditedPrompt(data.systemPrompt ?? "");
        setEditedModel(data.model ?? "");
        setMessage({ type: "success", text: "AI settings saved." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save AI settings." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save AI settings." });
    }
    setSavingAiSettings(false);
  };

  const handleResetPrompt = () => {
    setEditedPrompt("");
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? All their diagrams will be deleted.`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `User ${email} deleted.` });
        loadUsers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete user." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete user." });
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>

        {/* Invite User Form */}
        <div className="border border-[var(--border)] rounded-xl p-6 mb-8">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Invite New User
          </h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="John Doe"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Temporary Password *</label>
              <input
                type="text"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-mono"
                placeholder="temporary-password"
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {inviting ? "Inviting..." : "Invite User"}
            </button>
          </form>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`px-4 py-3 text-sm rounded-lg mb-6 ${
              message.type === "success"
                ? "text-green-600 bg-green-500/10 border border-green-500/20"
                : "text-red-500 bg-red-500/10 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* AI Settings */}
        <div className="border border-[var(--border)] rounded-xl p-6 mb-8">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI Configuration
          </h2>
          {aiSettingsLoading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading AI settings...</p>
          ) : (
            <div className="space-y-4">
              {/* Model selector */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Model {aiSettings?.defaultModel && (
                    <span className="text-[var(--muted-foreground)] font-normal">(default: {aiSettings.defaultModel})</span>
                  )}
                </label>
                <input
                  type="text"
                  value={editedModel}
                  onChange={(e) => setEditedModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-mono"
                  placeholder={aiSettings?.defaultModel || "claude-sonnet-4-20250514"}
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Leave empty to use the default model. Must be a valid Anthropic model ID.
                </p>
              </div>

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">
                    System Prompt
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPromptEditor(!showPromptEditor)}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      {showPromptEditor ? "Hide Editor" : "Show Editor"}
                    </button>
                    {editedPrompt && (
                      <button
                        type="button"
                        onClick={handleResetPrompt}
                        className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title="Reset to default prompt"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mb-2">
                  Customize the system prompt sent to the AI. Use <code className="bg-[var(--muted)] px-1 rounded">{"{{CURRENT_CODE}}"}</code> and <code className="bg-[var(--muted)] px-1 rounded">{"{{GRAPH_CONTEXT}}"}</code> as placeholders for the current diagram context.
                  Leave empty to use the default prompt.
                </p>
                {showPromptEditor && (
                  <>
                    <textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-mono resize-y"
                      placeholder="Leave empty to use the default system prompt..."
                    />
                    {aiSettings?.defaultSystemPrompt && !editedPrompt && (
                      <details className="mt-2">
                        <summary className="text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]">
                          View current default prompt
                        </summary>
                        <pre className="mt-2 p-3 text-xs bg-[var(--muted)] rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                          {aiSettings.defaultSystemPrompt}
                        </pre>
                      </details>
                    )}
                  </>
                )}
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={savingAiSettings}
                className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingAiSettings ? "Saving..." : "Save AI Settings"}
              </button>
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-base font-semibold">Users ({users.length})</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <div key={user.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{user.email}</span>
                    {user.role === "admin" && (
                      <span className="px-1.5 py-0.5 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  {user.name && (
                    <p className="text-xs text-[var(--muted-foreground)]">{user.name}</p>
                  )}
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
                {user.email !== session?.user?.email && (
                  <button
                    onClick={() => handleDelete(user.id, user.email)}
                    className="p-1.5 rounded hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
