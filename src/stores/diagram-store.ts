import { create } from "zustand";
import type { DiagramState, DiagramListItem, Folder } from "@/types/diagram";
import type { DiagramStyles } from "@/types/graph";

const MAX_HISTORY = 50;

interface DiagramStore {
  diagram: DiagramState | null;
  diagrams: DiagramListItem[];
  folders: Folder[];
  isDirty: boolean;
  syncState: "idle" | "ai-streaming" | "saving";
  error: string | null;

  // Undo/redo
  undoStack: string[];
  redoStack: string[];
  canUndo: boolean;
  canRedo: boolean;

  // Batch undo (for multi-step AI tool calls)
  _batchStartCode: string | undefined;
  beginBatch: () => void;
  endBatch: () => void;

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
  createFolder: (name?: string) => Promise<string>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => DiagramStore) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    get().saveDiagram();
  }, 1000);
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  diagram: null,
  diagrams: [],
  folders: [],
  isDirty: false,
  syncState: "idle",
  error: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  _batchStartCode: undefined,

  beginBatch: () => {
    const { diagram } = get();
    if (!diagram) return;

    // Clear any pending undo debounce timer to prevent
    // a partial snapshot from being pushed mid-batch
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }

    set({ _batchStartCode: diagram.code });
  },

  endBatch: () => {
    const { _batchStartCode, undoStack } = get();
    if (_batchStartCode !== undefined) {
      const newStack = [...undoStack, _batchStartCode].slice(-MAX_HISTORY);
      set({
        undoStack: newStack,
        redoStack: [],
        canUndo: true,
        canRedo: false,
        _batchStartCode: undefined,
      });
    }
  },

  setCode: (code: string) => {
    const { diagram, _batchStartCode } = get();
    if (!diagram) return;

    // Only push undo snapshots outside of batch operations
    if (_batchStartCode === undefined) {
      if (undoTimeout) clearTimeout(undoTimeout);
      const prevCode = diagram.code;
      undoTimeout = setTimeout(() => {
        const newStack = [...get().undoStack, prevCode].slice(-MAX_HISTORY);
        set({ undoStack: newStack, redoStack: [], canUndo: true, canRedo: false });
      }, 500);
    }

    set({ diagram: { ...diagram, code }, isDirty: true, error: null });
    scheduleSave(get);
  },

  setTitle: (title: string) => {
    const { diagram } = get();
    if (!diagram) return;
    set({ diagram: { ...diagram, title }, isDirty: true });
    scheduleSave(get);
  },

  setPositions: (positions: string) => {
    const { diagram } = get();
    if (!diagram) return;
    set({ diagram: { ...diagram, positions }, isDirty: true });
    scheduleSave(get);
  },

  setStyleOverrides: (styles: DiagramStyles) => {
    const { diagram } = get();
    if (!diagram) return;
    const styleOverrides = JSON.stringify(styles);
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

    // Flush any pending undo snapshot
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }

    const prevCode = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, diagram.code];

    set({
      diagram: { ...diagram, code: prevCode },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: newUndoStack.length > 0,
      canRedo: true,
      isDirty: true,
    });
    scheduleSave(get);
  },

  redo: () => {
    const { diagram, undoStack, redoStack } = get();
    if (!diagram || redoStack.length === 0) return;

    const nextCode = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, diagram.code];

    set({
      diagram: { ...diagram, code: nextCode },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: true,
      canRedo: newRedoStack.length > 0,
      isDirty: true,
    });
    scheduleSave(get);
  },

  loadDiagram: async (id: string) => {
    const res = await fetch(`/api/diagrams/${id}`);
    if (!res.ok) throw new Error("Failed to load diagram");
    const diagram = await res.json();
    set({
      diagram,
      isDirty: false,
      error: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
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
    } catch {
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
    set({ diagram, isDirty: false, undoStack: [], redoStack: [], canUndo: false, canRedo: false });
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
    const folders = await res.json();
    set({ folders });
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
