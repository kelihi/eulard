"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
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

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      router.replace("/");
      return;
    }
    loadUsers();
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
