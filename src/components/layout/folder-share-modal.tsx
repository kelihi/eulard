"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, UserPlus, Trash2, Copy, Check, ArrowRightLeft } from "lucide-react";

interface FolderShare {
  id: string;
  folderId: string;
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

interface FolderShareModalProps {
  open: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  isOwner: boolean;
}

export function FolderShareModal({ open, onClose, folderId, folderName, isOwner }: FolderShareModalProps) {
  const [shares, setShares] = useState<FolderShare[]>([]);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // User autocomplete state
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      setInviteInfo(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setTransferTarget(null);
    }
  }, [open, folderId, isOwner]);

  const loadShares = async () => {
    try {
      const res = await fetch(`/api/folders/${folderId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch {
      // ignore
    }
  };

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: UserSuggestion[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
        setSelectedSuggestionIdx(-1);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setInviteInfo(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchUsers(value);
    }, 250);
  };

  const selectSuggestion = (suggestion: UserSuggestion) => {
    setEmail(suggestion.email);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedSuggestionIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSaving(true);
    setMessage(null);
    setInviteInfo(null);

    try {
      const res = await fetch(`/api/folders/${folderId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission: "view" }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.invited && data.guestPassword) {
          setInviteInfo({ email: email.trim(), password: data.guestPassword });
          setMessage(`Invited ${email.trim()} as a new guest user and shared folder.`);
        } else if (data.invited) {
          setMessage(`Invited ${email.trim()} (org user) and shared folder.`);
        } else {
          setMessage("Folder shared successfully!");
        }
        setEmail("");
        setSuggestions([]);
        setShowSuggestions(false);
        loadShares();
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to share folder.");
      }
    } catch {
      setMessage("Failed to share folder.");
    }
    setSaving(false);
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}/shares`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        loadShares();
      }
    } catch {
      // ignore
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!confirm("Transfer ownership of this folder? You will lose owner access.")) return;
    try {
      const res = await fetch(`/api/folders/${folderId}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId }),
      });
      if (res.ok) {
        setMessage("Ownership transferred successfully.");
        setTransferTarget(null);
        onClose();
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to transfer ownership.");
      }
    } catch {
      setMessage("Failed to transfer ownership.");
    }
  };

  const copyGuestPassword = async () => {
    if (inviteInfo?.password) {
      await navigator.clipboard.writeText(inviteInfo.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-base font-semibold">Share Folder: {folderName}</h2>
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
                {/* Share with specific user */}
                <form onSubmit={handleShare} className="space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Shared users get view-only access to all diagrams in this folder.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        onKeyDown={handleEmailKeyDown}
                        onBlur={() => {
                          setTimeout(() => setShowSuggestions(false), 150);
                        }}
                        onFocus={() => {
                          if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        placeholder="user@example.com"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute z-10 mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden"
                        >
                          {suggestions.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectSuggestion(s)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors ${
                                idx === selectedSuggestionIdx ? "bg-[var(--muted)]" : ""
                              }`}
                            >
                              <span className="font-medium">{s.email}</span>
                              {s.name && (
                                <span className="text-[var(--muted-foreground)] ml-2">
                                  {s.name}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]">
                      View
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !email.trim()}
                    className="w-full py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {saving ? "Sharing..." : "Share Folder"}
                  </button>
                </form>

                {/* Invite credentials */}
                {inviteInfo?.password && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs font-medium text-amber-600 mb-2">
                      Guest credentials for {inviteInfo.email}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">
                      Share these one-time credentials with the user:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)] select-all">
                        {inviteInfo.password}
                      </code>
                      <button
                        onClick={copyGuestPassword}
                        className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {message && !inviteInfo?.password && (
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
                            onClick={() => {
                              setTransferTarget(
                                transferTarget === share.sharedWithUserId ? null : share.sharedWithUserId
                              );
                            }}
                            className="p-1 rounded hover:bg-[var(--muted)] transition-colors"
                            title="Transfer ownership"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemove(share.sharedWithUserId)}
                            className="p-1 rounded hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {transferTarget === share.sharedWithUserId && (
                            <button
                              onClick={() => handleTransferOwnership(share.sharedWithUserId)}
                              className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded hover:bg-amber-500/20 transition-colors"
                            >
                              Confirm transfer
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                Only the folder owner can manage sharing.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
