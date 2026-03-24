import { create } from "zustand";
import { compare, applyPatch, type Operation } from "fast-json-patch";
import type { DiagramState, DiagramListItem, Folder } from "@/types/diagram";
import type { DiagramStyles } from "@/types/graph";

const MAX_HISTORY = 50;

/** The subset of diagram state tracked by undo/redo */
export interface DiagramSnapshot {
  code: string;
  positions: string | null;
  styleOverrides: string | null;
  title: string;
}

/** A single undo entry: forward patch + inverse patch */
interface VersionEntry {
  patch: Operation[];
  inversePatch: Operation[];
  source: "user" | "ai" | "auto";
  /** Whether this entry has been persisted to the server */
  persisted: boolean;
}

function snapshotOf(d: DiagramState): DiagramSnapshot {
  return {
    code: d.code,
    positions: d.positions,
    styleOverrides: d.styleOverrides,
    title: d.title,
  };
}

function applySnapshotToDiagram(d: DiagramState, snap: DiagramSnapshot): DiagramState {
  return { ...d, ...snap };
}

function computePatches(
  prev: DiagramSnapshot,
  next: DiagramSnapshot
): { patch: Operation[]; inversePatch: Operation[] } {
  const patch = compare(prev, next);
  const inversePatch = compare(next, prev);
  return { patch, inversePatch };
}

interface DiagramStore {
  diagram: DiagramState | null;
  diagrams: DiagramListItem[];
  folders: Folder[];
  sharedFolders: Folder[];
  isDirty: boolean;
  syncState: "idle" | "ai-streaming" | "saving";
  error: string | null;

  // Undo/redo (diff-based)
  undoStack: VersionEntry[];
  redoStack: VersionEntry[];
  canUndo: boolean;
  canRedo: boolean;
  /** The snapshot at the time of the last undo checkpoint */
  _lastSnapshot: DiagramSnapshot | null;

  // Batch undo (for multi-step AI tool calls)
  _batchStartSnapshot: DiagramSnapshot | undefined;
  beginBatch: () => void;
  endBatch: () => void;

  // Multi-selection state
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeIds: (ids: string[]) => void;
  clearSelection: () => void;

  setCode: (code: string) => void;
  setTitle: (title: string) => void;
  setPositions: (positions: string) => void;
  setStyleOverrides: (styles: DiagramStyles) => void;
  getStyleOverrides: () => DiagramStyles;
  setSyncState: (state: DiagramStore["syncState"]) => void;
  setError: (error: string | null) => void;
  flushSave: () => Promise<void>;

  undo: () => void;
  redo: () => void;

  loadDiagram: (id: string) => Promise<void>;
  loadDiagrams: () => Promise<void>;
  saveDiagram: () => Promise<void>;
  createDiagram: (folderId?: string) => Promise<string>;
  deleteDiagram: (id: string) => Promise<void>;
  moveDiagram: (diagramId: string, folderId: string | null) => Promise<void>;

  loadFolders: () => Promise<void>;
  loadSharedFolders: () => Promise<void>;
  createFolder: (name?: string) => Promise<string>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  setFolderClient: (id: string, clientId: string | null) => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | null = null;
let positionUndoTimeout: ReturnType<typeof setTimeout> | null = null;
let styleUndoTimeout: ReturnType<typeof setTimeout> | null = null;
let versionFlushTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => DiagramStore) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    get().saveDiagram();
  }, 1000);
}

/**
 * Push a version entry onto the undo stack and schedule persistence.
 * Clears the redo stack.
 */
function pushUndoEntry(
  set: (partial: Partial<DiagramStore>) => void,
  get: () => DiagramStore,
  entry: VersionEntry
) {
  const { undoStack } = get();
  const newStack = [...undoStack, entry].slice(-MAX_HISTORY);
  set({
    undoStack: newStack,
    redoStack: [],
    canUndo: true,
    canRedo: false,
  });
  scheduleVersionFlush(get);
}

/**
 * Debounce persisting un-persisted version entries to the server.
 */
function scheduleVersionFlush(get: () => DiagramStore) {
  if (versionFlushTimeout) clearTimeout(versionFlushTimeout);
  versionFlushTimeout = setTimeout(() => {
    flushVersionsToServer(get);
  }, 2000);
}

async function flushVersionsToServer(get: () => DiagramStore) {
  const { diagram, undoStack } = get();
  if (!diagram) return;

  const unpersisted = undoStack.filter((e) => !e.persisted);
  if (unpersisted.length === 0) return;

  try {
    const res = await fetch(`/api/diagrams/${diagram.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patches: unpersisted.map((e) => ({
          patch: e.patch,
          inversePatch: e.inversePatch,
        })),
        source: unpersisted[0].source,
      }),
    });
    if (res.ok) {
      // Mark all as persisted
      const { undoStack: currentStack } = get();
      const updated = currentStack.map((e) =>
        e.persisted ? e : { ...e, persisted: true }
      );
      useDiagramStore.setState({ undoStack: updated });
    }
  } catch {
    // Persistence is best-effort; entries remain in memory
  }
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  diagram: null,
  diagrams: [],
  folders: [],
  sharedFolders: [],
  isDirty: false,
  syncState: "idle",
  error: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  _lastSnapshot: null,
  _batchStartSnapshot: undefined,

  // Multi-selection state
  selectedNodeIds: [],
  selectedEdgeIds: [],
  setSelectedNodeIds: (ids: string[]) => set({ selectedNodeIds: ids }),
  setSelectedEdgeIds: (ids: string[]) => set({ selectedEdgeIds: ids }),
  clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

  beginBatch: () => {
    const { diagram } = get();
    if (!diagram) return;

    // Clear any pending undo debounce timers to prevent
    // a partial snapshot from being pushed mid-batch
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }
    if (positionUndoTimeout) {
      clearTimeout(positionUndoTimeout);
      positionUndoTimeout = null;
    }
    if (styleUndoTimeout) {
      clearTimeout(styleUndoTimeout);
      styleUndoTimeout = null;
    }

    set({ _batchStartSnapshot: snapshotOf(diagram) });
  },

  endBatch: () => {
    const { _batchStartSnapshot, diagram } = get();
    if (_batchStartSnapshot !== undefined && diagram) {
      const currentSnapshot = snapshotOf(diagram);
      const { patch, inversePatch } = computePatches(
        _batchStartSnapshot,
        currentSnapshot
      );
      if (patch.length > 0) {
        pushUndoEntry(set, get, {
          patch,
          inversePatch,
          source: "ai",
          persisted: false,
        });
      }
      set({
        _batchStartSnapshot: undefined,
        _lastSnapshot: currentSnapshot,
      });
    }
  },

  setCode: (code: string) => {
    const { diagram, _batchStartSnapshot } = get();
    if (!diagram) return;

    // Only push undo snapshots outside of batch operations
    if (_batchStartSnapshot === undefined) {
      if (undoTimeout) clearTimeout(undoTimeout);
      const prevSnapshot = get()._lastSnapshot ?? snapshotOf(diagram);
      undoTimeout = setTimeout(() => {
        const current = get().diagram;
        if (!current) return;
        const currentSnapshot = snapshotOf(current);
        const { patch, inversePatch } = computePatches(
          prevSnapshot,
          currentSnapshot
        );
        if (patch.length > 0) {
          pushUndoEntry(set, get, {
            patch,
            inversePatch,
            source: "user",
            persisted: false,
          });
          set({ _lastSnapshot: currentSnapshot });
        }
      }, 500);
    }

    set({ diagram: { ...diagram, code }, isDirty: true, error: null });
    scheduleSave(get);
  },

  setTitle: (title: string) => {
    const { diagram, _batchStartSnapshot } = get();
    if (!diagram) return;

    // Track title changes for undo (outside batch)
    if (_batchStartSnapshot === undefined) {
      const prevSnapshot = get()._lastSnapshot ?? snapshotOf(diagram);
      const newDiagram = { ...diagram, title };
      const currentSnapshot = snapshotOf(newDiagram);
      const { patch, inversePatch } = computePatches(
        prevSnapshot,
        currentSnapshot
      );
      if (patch.length > 0) {
        pushUndoEntry(set, get, {
          patch,
          inversePatch,
          source: "user",
          persisted: false,
        });
        set({ _lastSnapshot: currentSnapshot });
      }
    }

    set({ diagram: { ...diagram, title }, isDirty: true });
    scheduleSave(get);
  },

  setPositions: (positions: string) => {
    const { diagram, _batchStartSnapshot } = get();
    if (!diagram) return;

    // Debounced undo for position changes (e.g. dragging)
    if (_batchStartSnapshot === undefined) {
      // Capture the "before" snapshot only when drag starts (no pending timeout)
      if (!positionUndoTimeout) {
        const prevSnapshot = get()._lastSnapshot ?? snapshotOf(diagram);
        positionUndoTimeout = setTimeout(() => {
          const current = get().diagram;
          if (!current) return;
          const currentSnapshot = snapshotOf(current);
          const { patch, inversePatch } = computePatches(
            prevSnapshot,
            currentSnapshot
          );
          if (patch.length > 0) {
            pushUndoEntry(set, get, {
              patch,
              inversePatch,
              source: "user",
              persisted: false,
            });
            set({ _lastSnapshot: currentSnapshot });
          }
          positionUndoTimeout = null;
        }, 800);
      }
    }

    set({ diagram: { ...diagram, positions }, isDirty: true });
    scheduleSave(get);
  },

  setStyleOverrides: (styles: DiagramStyles) => {
    const { diagram, _batchStartSnapshot } = get();
    if (!diagram) return;
    const styleOverrides = JSON.stringify(styles);

    // Debounced undo for style changes (e.g. color picker)
    if (_batchStartSnapshot === undefined) {
      if (!styleUndoTimeout) {
        const prevSnapshot = get()._lastSnapshot ?? snapshotOf(diagram);
        styleUndoTimeout = setTimeout(() => {
          const current = get().diagram;
          if (!current) return;
          const currentSnapshot = snapshotOf(current);
          const { patch, inversePatch } = computePatches(
            prevSnapshot,
            currentSnapshot
          );
          if (patch.length > 0) {
            pushUndoEntry(set, get, {
              patch,
              inversePatch,
              source: "user",
              persisted: false,
            });
            set({ _lastSnapshot: currentSnapshot });
          }
          styleUndoTimeout = null;
        }, 800);
      }
    }

    set({ diagram: { ...diagram, styleOverrides }, isDirty: true });
    scheduleSave(get);
  },

  getStyleOverrides: (): DiagramStyles => {
    const { diagram } = get();
    if (!diagram?.styleOverrides) return {};
    try {
      return JSON.parse(diagram.styleOverrides) as DiagramStyles;
    } catch {
      return {};
    }
  },

  setSyncState: (syncState) => set({ syncState }),
  setError: (error) => set({ error }),

  flushSave: async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await get().saveDiagram();
  },

  undo: () => {
    const { diagram, undoStack, redoStack } = get();
    if (!diagram || undoStack.length === 0) return;

    // Flush any pending undo snapshot timers
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }
    if (positionUndoTimeout) {
      clearTimeout(positionUndoTimeout);
      positionUndoTimeout = null;
    }
    if (styleUndoTimeout) {
      clearTimeout(styleUndoTimeout);
      styleUndoTimeout = null;
    }

    const entry = undoStack[undoStack.length - 1];
    const currentSnapshot = snapshotOf(diagram);

    // Apply the inverse patch to get previous state
    try {
      const result = applyPatch(
        JSON.parse(JSON.stringify(currentSnapshot)),
        JSON.parse(JSON.stringify(entry.inversePatch))
      );
      const prevSnapshot = result.newDocument as DiagramSnapshot;

      const newUndoStack = undoStack.slice(0, -1);
      // Push a redo entry (swap patch and inversePatch)
      const redoEntry: VersionEntry = {
        patch: entry.inversePatch,
        inversePatch: entry.patch,
        source: entry.source,
        persisted: entry.persisted,
      };
      const newRedoStack = [...redoStack, redoEntry];

      set({
        diagram: applySnapshotToDiagram(diagram, prevSnapshot),
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
        isDirty: true,
        _lastSnapshot: prevSnapshot,
      });
      scheduleSave(get);
    } catch (err) {
      console.error("Undo failed:", err);
    }
  },

  redo: () => {
    const { diagram, undoStack, redoStack } = get();
    if (!diagram || redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    const currentSnapshot = snapshotOf(diagram);

    try {
      const result = applyPatch(
        JSON.parse(JSON.stringify(currentSnapshot)),
        JSON.parse(JSON.stringify(entry.inversePatch))
      );
      const nextSnapshot = result.newDocument as DiagramSnapshot;

      const newRedoStack = redoStack.slice(0, -1);
      // Push back onto undo (swap patch and inversePatch)
      const undoEntry: VersionEntry = {
        patch: entry.inversePatch,
        inversePatch: entry.patch,
        source: entry.source,
        persisted: entry.persisted,
      };
      const newUndoStack = [...undoStack, undoEntry];

      set({
        diagram: applySnapshotToDiagram(diagram, nextSnapshot),
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
        isDirty: true,
        _lastSnapshot: nextSnapshot,
      });
      scheduleSave(get);
    } catch (err) {
      console.error("Redo failed:", err);
    }
  },

  loadDiagram: async (id: string) => {
    const res = await fetch(`/api/diagrams/${id}`);
    if (!res.ok) throw new Error("Failed to load diagram");
    const data = await res.json();
    const diagram = { ...data, permission: data.permission ?? null };
    const snapshot = snapshotOf(diagram);

    // Load persisted version history
    let restoredUndoStack: VersionEntry[] = [];
    try {
      const vRes = await fetch(`/api/diagrams/${id}/versions`);
      if (vRes.ok) {
        const versions = (await vRes.json()) as Array<{
          patch: unknown;
          inverse_patch: unknown;
          source: string;
        }>;
        restoredUndoStack = versions.map((v) => ({
          patch: v.patch as Operation[],
          inversePatch: v.inverse_patch as Operation[],
          source: v.source as "user" | "ai" | "auto",
          persisted: true,
        }));
      }
    } catch {
      // If version loading fails, start with empty history
    }

    set({
      diagram,
      isDirty: false,
      error: null,
      undoStack: restoredUndoStack,
      redoStack: [],
      canUndo: restoredUndoStack.length > 0,
      canRedo: false,
      _lastSnapshot: snapshot,
      _batchStartSnapshot: undefined,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  },

  loadDiagrams: async () => {
    const res = await fetch("/api/diagrams");
    if (!res.ok) throw new Error("Failed to load diagrams");
    const diagrams = await res.json();
    set({ diagrams });
  },

  saveDiagram: async () => {
    const { diagram, isDirty, syncState } = get();
    if (!diagram || !isDirty || syncState === "saving") return;

    set({ syncState: "saving" });
    try {
      await fetch(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: diagram.title,
          code: diagram.code,
          positions: diagram.positions,
          styleOverrides: diagram.styleOverrides,
        }),
      });
      set({ isDirty: false, syncState: "idle" });
      get().loadDiagrams();
    } catch (err) {
      console.error("Failed to save diagram:", err);
      set({ syncState: "idle" });
    }
  },

  createDiagram: async (folderId?: string) => {
    const res = await fetch("/api/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const diagram = await res.json();
    set({
      diagram,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      _lastSnapshot: snapshotOf(diagram),
      _batchStartSnapshot: undefined,
    });
    get().loadDiagrams();
    return diagram.id;
  },

  deleteDiagram: async (id: string) => {
    await fetch(`/api/diagrams/${id}`, { method: "DELETE" });
    const { diagram } = get();
    if (diagram?.id === id) {
      set({ diagram: null });
    }
    get().loadDiagrams();
  },

  moveDiagram: async (diagramId: string, folderId: string | null) => {
    await fetch(`/api/diagrams/${diagramId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const { diagram } = get();
    if (diagram?.id === diagramId) {
      set({ diagram: { ...diagram, folderId } });
    }
    get().loadDiagrams();
  },

  loadFolders: async () => {
    const res = await fetch("/api/folders");
    if (!res.ok) return;
    const data = await res.json();
    set({ folders: data.owned || [], sharedFolders: data.shared || [] });
  },

  loadSharedFolders: async () => {
    const res = await fetch("/api/folders");
    if (!res.ok) return;
    const data = await res.json();
    set({ folders: data.owned || [], sharedFolders: data.shared || [] });
  },

  createFolder: async (name?: string) => {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const folder = await res.json();
    get().loadFolders();
    return folder.id;
  },

  renameFolder: async (id: string, name: string) => {
    await fetch("/api/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    get().loadFolders();
  },

  setFolderClient: async (id: string, clientId: string | null) => {
    await fetch("/api/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, clientId }),
    });
    get().loadFolders();
  },

  deleteFolder: async (id: string) => {
    await fetch("/api/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    get().loadFolders();
    get().loadDiagrams();
  },
}));
