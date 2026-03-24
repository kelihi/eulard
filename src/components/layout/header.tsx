"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useDiagramStore } from "@/stores/diagram-store";
import { Save, MessageSquare, Settings, Share2, LogOut, Shield, User, PanelLeftClose, PanelLeftOpen, Code, CodeXml } from "lucide-react";
import { Toolbar } from "@/components/editor/toolbar";
import { SettingsModal } from "./settings-modal";
import { ShareModal } from "@/components/editor/share-modal";

interface HeaderProps {
  onToggleChat: () => void;
  chatOpen: boolean;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleCode: () => void;
  codeHidden: boolean;
}

export function Header({ onToggleChat, chatOpen, onToggleSidebar, sidebarOpen, onToggleCode, codeHidden }: HeaderProps) {
  const { data: session } = useSession();
  const title = useDiagramStore((s) => s.diagram?.title ?? "");
  const isDirty = useDiagramStore((s) => s.isDirty);
  const syncState = useDiagramStore((s) => s.syncState);
  const setTitle = useDiagramStore((s) => s.setTitle);
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const diagramId = useDiagramStore((s) => s.diagram?.id);
  const permission = useDiagramStore((s) => s.diagram?.permission);

  const [isEditing, setIsEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = () => {
    saveDiagram();
  };

  return (
    <>
      <div className="h-12 px-4 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md shrink-0">
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-all duration-150"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-[18px] h-[18px]" />
          ) : (
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          )}
        </button>

        {/* Title */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditing(false);
            }}
            className="text-sm font-medium bg-transparent border-b border-[var(--primary)] focus:outline-none px-0 py-0.5"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium hover:text-[var(--primary)] transition-colors truncate max-w-[300px]"
          >
            {title || "Untitled Diagram"}
          </button>
        )}

        {/* Status indicators */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          {syncState === "saving" && <span>Saving...</span>}
          {syncState === "ai-streaming" && (
            <span className="text-[var(--primary)]">AI writing...</span>
          )}
          {isDirty && syncState === "idle" && (
            <span className="text-amber-500">Unsaved</span>
          )}
          {!isDirty && syncState === "idle" && <span>Saved</span>}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <Toolbar />

        <button
          onClick={() => diagramId && setShareOpen(true)}
          className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-all duration-150"
          title="Share"
        >
          <Share2 className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="p-1.5 rounded-md hover:bg-[var(--muted)] disabled:opacity-30 transition-all duration-150"
          title="Save (Cmd+S)"
        >
          <Save className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-all duration-150"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>

        <button
          onClick={onToggleCode}
          className={`p-1.5 rounded transition-all ${
            codeHidden
              ? "bg-amber-500/10 text-amber-500"
              : "hover:bg-[var(--muted)]"
          }`}
          title={codeHidden ? "Show Code Editor" : "Hide Code Editor"}
        >
          {codeHidden ? <CodeXml className="w-4 h-4" /> : <Code className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleChat}
          className={`p-1.5 rounded-md transition-all duration-150 ${
            chatOpen
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
              : "hover:bg-[var(--muted)]"
          }`}
          title="Toggle AI Chat"
        >
          <MessageSquare className="w-[18px] h-[18px]" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-all duration-150"
            title={session?.user?.email || "Account"}
          >
            <User className="w-[18px] h-[18px]" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-2 border-b border-[var(--border)]">
                <p className="text-sm font-medium truncate">{session?.user?.name || session?.user?.email}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{session?.user?.email}</p>
              </div>
              {isAdmin && (
                <a
                  href="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin Panel
                </a>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {diagramId && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          diagramId={diagramId}
          isOwner={permission === "owner"}
        />
      )}
    </>
  );
}
