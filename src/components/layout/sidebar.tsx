"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDiagramStore } from "@/stores/diagram-store";
import { cn } from "@/lib/utils";
import {
  Plus,
  FileText,
  Trash2,
  FolderOpen,
  FolderClosed,
  FolderPlus,
  Pencil,
  ChevronRight,
  Users,
  Building2,
  Share2,
} from "lucide-react";
import { ClientPicker } from "./client-picker";
import { FolderShareModal } from "@/components/layout/folder-share-modal";

export function Sidebar() {
  const diagrams = useDiagramStore((s) => s.diagrams);
  const folders = useDiagramStore((s) => s.folders);
  const currentId = useDiagramStore((s) => s.diagram?.id);
  const sharedFolders = useDiagramStore((s) => s.sharedFolders);
  const loadDiagrams = useDiagramStore((s) => s.loadDiagrams);
  const loadFolders = useDiagramStore((s) => s.loadFolders);
  const createDiagram = useDiagramStore((s) => s.createDiagram);
  const deleteDiagram = useDiagramStore((s) => s.deleteDiagram);
  const moveDiagram = useDiagramStore((s) => s.moveDiagram);
  const createFolder = useDiagramStore((s) => s.createFolder);
  const renameFolder = useDiagramStore((s) => s.renameFolder);
  const deleteFolder = useDiagramStore((s) => s.deleteFolder);
  const router = useRouter();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [sharedExpanded, setSharedExpanded] = useState(true);
  const [clientPickerFolderId, setClientPickerFolderId] = useState<string | null>(null);
  const [sharedFoldersExpanded, setSharedFoldersExpanded] = useState(true);
  const [shareFolderModal, setShareFolderModal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadDiagrams();
    loadFolders();
  }, [loadDiagrams, loadFolders]);

  useEffect(() => {
    if (editingFolderId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolderId]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateDiagram = async (folderId?: string) => {
    const id = await createDiagram(folderId);
    router.push(`/editor/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this diagram?")) return;
    await deleteDiagram(id);
    if (id === currentId && diagrams.length > 1) {
      const other = diagrams.find((d) => d.id !== id);
      if (other) router.push(`/editor/${other.id}`);
      else router.push("/");
    }
  };

  const handleCreateFolder = async () => {
    const id = await createFolder();
    setExpandedFolders((prev) => new Set(prev).add(id));
    setEditingFolderId(id);
    setEditingName("New Folder");
  };

  const handleRenameSubmit = async (folderId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      await renameFolder(folderId, trimmed);
    }
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this folder? Diagrams inside will be moved to uncategorized.")) return;
    await deleteFolder(id);
  };

  const handleDragStart = (e: React.DragEvent, diagramId: string) => {
    e.dataTransfer.setData("diagramId", diagramId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const diagramId = e.dataTransfer.getData("diagramId");
    if (diagramId) {
      await moveDiagram(diagramId, folderId);
    }
  };

  // Separate owned vs shared diagrams
  const ownedDiagrams = diagrams.filter((d) => !d.isShared);
  // Shared diagrams that belong to a shared folder are shown under "Shared Folders", not "Shared with me"
  const sharedFolderIds = new Set(sharedFolders.map((f) => f.id));
  const sharedDiagrams = diagrams.filter(
    (d) => d.isShared && (!d.folderId || !sharedFolderIds.has(d.folderId))
  );
  const uncategorized = ownedDiagrams.filter((d) => !d.folderId);
  const diagramsByFolder = (folderId: string) =>
    ownedDiagrams.filter((d) => d.folderId === folderId);

  const renderDiagram = (d: typeof diagrams[0], isShared = false) => (
    <div
      key={d.id}
      draggable={!isShared}
      onDragStart={!isShared ? (e) => handleDragStart(e, d.id) : undefined}
      onClick={() => router.push(`/editor/${d.id}`)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm group transition-all duration-150 relative",
        d.id === currentId
          ? "bg-[var(--background)] shadow-sm"
          : "hover:bg-[var(--background)]/50"
      )}
    >
      {d.id === currentId && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--primary)]" />
      )}
      <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
      <span className="truncate flex-1">{d.title}</span>
      {isShared && (
        <span className="text-[10px] text-[var(--muted-foreground)] px-1 py-0.5 bg-[var(--muted)] rounded">
          {d.permission}
        </span>
      )}
      {!isShared && (
        <button
          onClick={(e) => handleDelete(e, d.id)}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="w-56 h-full bg-[var(--muted)] border-r border-[var(--border)] flex flex-col shrink-0">
      {/* Logo + actions */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="font-bold text-sm tracking-tight">Eulard</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateFolder}
            className="p-1 rounded hover:bg-[var(--border)] transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleCreateDiagram()}
            className="p-1 rounded hover:bg-[var(--border)] transition-colors"
            title="New Diagram"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folder + diagram list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Folders */}
        {folders.map((folder) => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderDiagrams = diagramsByFolder(folder.id);
          const isEditing = editingFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div key={folder.id} className="relative">
              <div
                onClick={() => toggleFolder(folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm group transition-colors hover:bg-[var(--background)]/50",
                  isDragOver && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                )}
              >
                <ChevronRight
                  className={cn(
                    "w-3 h-3 text-[var(--muted-foreground)] transition-transform shrink-0",
                    isExpanded && "rotate-90"
                  )}
                />
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                ) : (
                  <FolderClosed className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                )}

                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRenameSubmit(folder.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSubmit(folder.id);
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-1 py-0 outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                ) : (
                  <span className="truncate flex-1">{folder.name}</span>
                )}

                <span className="text-xs text-[var(--muted-foreground)] mr-1">
                  {folderDiagrams.length}
                </span>

                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateDiagram(folder.id);
                    }}
                    className="p-0.5 rounded hover:bg-[var(--border)]"
                    title="New diagram in folder"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareFolderModal({ id: folder.id, name: folder.name });
                    }}
                    className="p-0.5 rounded hover:bg-[var(--border)]"
                    title="Share folder"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolderId(folder.id);
                      setEditingName(folder.name);
                    }}
                    className="p-0.5 rounded hover:bg-[var(--border)]"
                    title="Rename folder"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientPickerFolderId(
                        clientPickerFolderId === folder.id ? null : folder.id
                      );
                    }}
                    className={cn(
                      "p-0.5 rounded hover:bg-[var(--border)]",
                      folder.clientId && "opacity-100 text-[var(--primary)]"
                    )}
                    title={folder.clientId ? "Change client" : "Set client context"}
                  >
                    <Building2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                    className="p-0.5 rounded hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    title="Delete folder"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {clientPickerFolderId === folder.id && (
                  <ClientPicker
                    folderId={folder.id}
                    currentClientId={folder.clientId}
                    onClose={() => setClientPickerFolderId(null)}
                  />
                )}
              </div>

              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {folderDiagrams.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] px-3 py-1">
                      Empty folder
                    </p>
                  ) : (
                    folderDiagrams.map((d) => renderDiagram(d))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized diagrams */}
        {uncategorized.length > 0 && folders.length > 0 && (
          <div className="pt-1 mt-1 border-t border-[var(--border)]">
            <div
              className={cn(
                "px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold",
                dragOverFolderId === "uncategorized" && "bg-[var(--primary)]/10 rounded"
              )}
              onDragOver={(e) => handleDragOver(e, "uncategorized")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
            >
              Uncategorized
            </div>
          </div>
        )}
        <div
          className="space-y-0.5"
          onDragOver={folders.length > 0 ? (e) => handleDragOver(e, "uncategorized") : undefined}
          onDragLeave={folders.length > 0 ? handleDragLeave : undefined}
          onDrop={folders.length > 0 ? (e) => handleDrop(e, null) : undefined}
        >
          {uncategorized.map((d) => renderDiagram(d))}
        </div>

        {ownedDiagrams.length === 0 && folders.length === 0 && sharedDiagrams.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] text-center mt-4">
            No diagrams yet
          </p>
        )}

        {/* Shared folders section */}
        {sharedFolders.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[var(--border)]">
            <div
              onClick={() => setSharedFoldersExpanded(!sharedFoldersExpanded)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--background)]/50"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 text-[var(--muted-foreground)] transition-transform shrink-0",
                  sharedFoldersExpanded && "rotate-90"
                )}
              />
              <Users className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
                Shared Folders
              </span>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto">
                {sharedFolders.length}
              </span>
            </div>
            {sharedFoldersExpanded && (
              <div className="ml-4 mt-0.5 space-y-1">
                {sharedFolders.map((folder) => {
                  const isExpanded = expandedFolders.has(`shared-${folder.id}`);
                  const folderDiagrams = diagrams.filter(
                    (d) => d.isShared && d.folderId === folder.id
                  );

                  return (
                    <div key={folder.id}>
                      <div
                        onClick={() => {
                          setExpandedFolders((prev) => {
                            const next = new Set(prev);
                            const key = `shared-${folder.id}`;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                        }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--background)]/50"
                      >
                        <ChevronRight
                          className={cn(
                            "w-3 h-3 text-[var(--muted-foreground)] transition-transform shrink-0",
                            isExpanded && "rotate-90"
                          )}
                        />
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                        ) : (
                          <FolderClosed className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                        )}
                        <span className="truncate flex-1">{folder.name}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] px-1 py-0.5 bg-[var(--muted)] rounded">
                          {folder.permission}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {folderDiagrams.length}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="ml-4 mt-0.5 space-y-0.5">
                          {folderDiagrams.length === 0 ? (
                            <p className="text-xs text-[var(--muted-foreground)] px-3 py-1">
                              No diagrams
                            </p>
                          ) : (
                            folderDiagrams.map((d) => renderDiagram(d, true))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Shared with me section (individual diagrams) */}
        {sharedDiagrams.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[var(--border)]">
            <div
              onClick={() => setSharedExpanded(!sharedExpanded)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm hover:bg-[var(--background)]/50"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 text-[var(--muted-foreground)] transition-transform shrink-0",
                  sharedExpanded && "rotate-90"
                )}
              />
              <Users className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
                Shared with me
              </span>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto">
                {sharedDiagrams.length}
              </span>
            </div>
            {sharedExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {sharedDiagrams.map((d) => renderDiagram(d, true))}
              </div>
            )}
          </div>
        )}
      </div>
      {shareFolderModal && (
        <FolderShareModal
          open={true}
          onClose={() => setShareFolderModal(null)}
          folderId={shareFolderModal.id}
          folderName={shareFolderModal.name}
          isOwner={true}
        />
      )}
    </div>
  );
}
