import { create } from "zustand";
import type { DiagramState, DiagramListItem } from "@/types/diagram";

interface DiagramStore {
  diagram: DiagramState | null;
  diagrams: DiagramListItem[];
  isDirty: boolean;
  syncState: "idle" | "ai-streaming" | "saving";
  error: string | null;

  setCode: (code: string) => void;
  setTitle: (title: string) => void;
  setSyncState: (state: DiagramStore["syncState"]) => void;
  setError: (error: string | null) => void;

  loadDiagram: (id: string) => Promise<void>;
  loadDiagrams: () => Promise<void>;
  saveDiagram: () => Promise<void>;
  createDiagram: () => Promise<string>;
  deleteDiagram: (id: string) => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  diagram: null,
  diagrams: [],
  isDirty: false,
  syncState: "idle",
  error: null,

  setCode: (code: string) => {
    const { diagram } = get();
    if (!diagram) return;
    set({ diagram: { ...diagram, code }, isDirty: true, error: null });

    // Auto-save with 1s debounce
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      get().saveDiagram();
    }, 1000);
  },

  setTitle: (title: string) => {
    const { diagram } = get();
    if (!diagram) return;
    set({ diagram: { ...diagram, title }, isDirty: true });

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      get().saveDiagram();
    }, 1000);
  },

  setSyncState: (syncState) => set({ syncState }),
  setError: (error) => set({ error }),

  loadDiagram: async (id: string) => {
    const res = await fetch(`/api/diagrams/${id}`);
    if (!res.ok) throw new Error("Failed to load diagram");
    const diagram = await res.json();
    set({ diagram, isDirty: false, error: null });
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
        body: JSON.stringify({ title: diagram.title, code: diagram.code }),
      });
      set({ isDirty: false, syncState: "idle" });
      // Refresh sidebar list
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
    set({ diagram, isDirty: false });
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
