"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, UserPlus, Trash2, Building2, Copy, Check } from "lucide-react";

interface Share {
  id: string;
  diagramId: string;
  sharedWithUserId: string;
  permission: string;
  email: string;
  name: string;
  createdAt: string;
}

interface UserSuggestion {
  id: string;
  email: string;
  name: string;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  diagramId: string;
  isOwner: boolean;
}

export function ShareModal({ open, onClose, diagramId, isOwner }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [orgShared, setOrgShared] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [guestCredentials, setGuestCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open && isOwner) {
      loadShares();
      setEmail("");
      setMessage(null);
      setGuestCredentials(null);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open, diagramId, isOwner]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const users: UserSuggestion[] = await res.json();
        // Filter out users already shared with
        const sharedIds = new Set(shares.map((s) => s.sharedWithUserId));
        const filtered = users.filter((u) => !sharedIds.has(u.id));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(-1);
      }
    } catch {
      // ignore
    }
  }, [shares]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value), 200);
  };

  const selectSuggestion = (user: UserSuggestion) => {
    setEmail(user.email);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const loadShares = async () => {
    try {
      const res = await fetch(`/api/shares?diagramId=${diagramId}`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares ?? data);
        setOrgShared(data.orgShared ?? null);
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
    setGuestCredentials(null);
    setShowSuggestions(false);

    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagramId, email: email.trim(), permission }),
      });

      if (res.ok) {
        const data = await res.json();
        setShares(data.shares);

        if (data.invited && data.guestPassword) {
          setGuestCredentials({ email: email.trim(), password: data.guestPassword });
          setMessage({ type: "info", text: "Guest account created. Share these credentials with the user:" });
        } else if (data.invited) {
          setMessage({ type: "success", text: `Invited ${email.trim()} — they can sign in with Google.` });
        } else {
          setMessage({ type: "success", text: "Shared successfully!" });
        }
        setEmail("");
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to share." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to share." });
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

  const handleOrgShare = async (value: string | null) => {
    setSavingOrg(true);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgShared: value }),
      });
      if (res.ok) {
        setOrgShared(value);
      }
    } catch {
      // ignore
    }
    setSavingOrg(false);
  };

  const copyCredentials = async () => {
    if (guestCredentials) {
      await navigator.clipboard.writeText(
        `Email: ${guestCredentials.email}\nPassword: ${guestCredentials.password}`
      );
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
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
                {/* Organization sharing */}
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                    <span className="text-sm font-medium">Organization Access</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">
                    Share with everyone in your organization.
                  </p>
                  <select
                    value={orgShared ?? "private"}
                    onChange={(e) => {
                      const val = e.target.value === "private" ? null : e.target.value;
                      handleOrgShare(val);
                    }}
                    disabled={savingOrg}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
                  >
                    <option value="private">Private — only shared individuals</option>
                    <option value="view">Organization — can view</option>
                    <option value="edit">Organization — can edit</option>
                  </select>
                </div>

                {/* Individual sharing with autocomplete */}
                <form onSubmit={handleShare} className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        onFocus={() => {
                          if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search users or enter email..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        autoComplete="off"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute z-10 top-full left-0 right-0 mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden"
                        >
                          {suggestions.map((user, index) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => selectSuggestion(user)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors ${
                                index === selectedIndex ? "bg-[var(--muted)]" : ""
                              }`}
                            >
                              <div className="font-medium truncate">{user.email}</div>
                              {user.name && (
                                <div className="text-xs text-[var(--muted-foreground)] truncate">{user.name}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                    {saving ? "Sharing..." : "Share / Invite"}
                  </button>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    If the user doesn&apos;t have an account, they&apos;ll be automatically invited.
                  </p>
                </form>

                {/* Messages */}
                {message && (
                  <div
                    className={`text-xs p-2.5 rounded-lg ${
                      message.type === "success"
                        ? "text-green-600 bg-green-500/10 border border-green-500/20"
                        : message.type === "info"
                        ? "text-blue-600 bg-blue-500/10 border border-blue-500/20"
                        : "text-red-500 bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {/* Guest credentials */}
                {guestCredentials && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs font-medium text-amber-700 mb-2">
                      Guest credentials (shown once):
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs font-mono bg-[var(--background)] px-2 py-1.5 rounded border border-[var(--border)]">
                        <div>Email: {guestCredentials.email}</div>
                        <div>Password: {guestCredentials.password}</div>
                      </div>
                      <button
                        onClick={copyCredentials}
                        className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors shrink-0"
                        title="Copy credentials"
                      >
                        {copiedCreds ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Shared users list */}
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
