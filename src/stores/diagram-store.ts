import { create } from "zustand";
import type { DiagramState, DiagramListItem } from "@/types/diagram";

const MAX_HISTORY = 50;

interface DiagramStore {
  diagram: DiagramState | null;
  diagrams: DiagramListItem[];
  isDirty: boolean;
  syncState: "idle" | "ai-streaming" | "saving";
  error: string | null;

  // Undo/redo
  undoStack: string[];
  redoStack: string[];
  canUndo: boolean;
  canRedo: boolean;

  setCode: (code: string) => void;
  setTitle: (title: string) => void;
  setPositions: (positions: string) => void;
  setSyncState: (state: DiagramStore["syncState"]) => void;
  setError: (error: string | null) => void;

  undo: () => void;
  redo: () => void;

  loadDiagram: (id: string) => Promise<void>;
  loadDiagrams: () => Promise<void>;
  saveDiagram: () => Promise<void>;
  createDiagram: () => Promise<string>;
  deleteDiagram: (id: string) => Promise<void>;
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
  isDirty: false,
  syncState: "idle",
  error: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  setCode: (code: string) => {
    const { diagram, undoStack } = get();
    if (!diagram) return;

    // Debounce undo snapshots — batch rapid typing into one undo step
    if (undoTimeout) clearTimeout(undoTimeout);
    const prevCode = diagram.code;
    undoTimeout = setTimeout(() => {
      const newStack = [...undoStack, prevCode].slice(-MAX_HISTORY);
      set({ undoStack: newStack, redoStack: [], canUndo: true, canRedo: false });
    }, 500);

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

  setSyncState: (syncState) => set({ syncState }),
  setError: (error) => set({ error }),

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
        }),
      });
      set({ isDirty: false, syncState: "idle" });
      get().loadDiagrams();
    } catch {
      set({ syncState: "idle" });
    }
  },

  createDiagram: async () => {
    const res = await fetch("/api/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
}));
