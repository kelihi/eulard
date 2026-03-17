"use client";

import { useState, useEffect, useRef } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";

interface Share {
  id: string;
  diagramId: string;
  sharedWithUserId: string;
  permission: string;
  email: string;
  name: string;
  createdAt: string;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  diagramId: string;
  isOwner: boolean;
}

export function ShareModal({ open, onClose, diagramId, isOwner }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up debounce timer on unmount
  useEffect(() => {
    const ref = debounceRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

  useEffect(() => {
    if (open && isOwner) {
      loadShares();
      setEmail("");
      setMessage(null);
    }
  }, [open, diagramId, isOwner]);

  const loadShares = async () => {
    try {
      const res = await fetch(`/api/shares?diagramId=${diagramId}`);
      if (res.ok) {
        const data = await res.json();
        setShares(data);
      }
    } catch {
      // ignore
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagramId, email: email.trim(), permission }),
      });

      if (res.ok) {
        setMessage("Shared successfully!");
        setEmail("");
        loadShares();
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to share.");
      }
    } catch {
      setMessage("Failed to share.");
    }
    setSaving(false);
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagramId, userId }),
      });

      if (res.ok) {
        loadShares();
      }
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-base font-semibold">Share Diagram</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {isOwner ? (
              <>
                <form onSubmit={handleShare} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <select
                      value={permission}
                      onChange={(e) => setPermission(e.target.value as "view" | "edit")}
                      className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !email.trim()}
                    className="w-full py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {saving ? "Sharing..." : "Share"}
                  </button>
                </form>

                {message && (
                  <p className="text-xs text-[var(--muted-foreground)]">{message}</p>
                )}

                {shares.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                      Shared with
                    </p>
                    <div className="space-y-2">
                      {shares.map((share) => (
                        <div
                          key={share.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="flex-1 truncate">{share.email}</span>
                          <span className="text-xs text-[var(--muted-foreground)] px-1.5 py-0.5 bg-[var(--muted)] rounded">
                            {share.permission}
                          </span>
                          <button
                            onClick={() => handleRemove(share.sharedWithUserId)}
                            className="p-1 rounded hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                Only the diagram owner can manage sharing.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
