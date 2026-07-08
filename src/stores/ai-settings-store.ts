import { create } from "zustand";

// Fallback list used when the server-side Anthropic model list is unavailable.
// Ordered by release date (newest first) so the first entry is the default.
export const AI_MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-fable-5", label: "Claude Fable 5" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
] as const;

const STORAGE_KEY = "eulard-ai-settings";

export interface AISettings {
  maxSteps: number;
  model: string;
}

interface AISettingsStore extends AISettings {
  setMaxSteps: (maxSteps: number) => void;
  setModel: (model: string) => void;
}

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { maxSteps: 15, model: AI_MODELS[0].id };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        maxSteps: typeof parsed.maxSteps === "number" ? parsed.maxSteps : 15,
        model: typeof parsed.model === "string" && parsed.model.length > 0
          ? parsed.model
          : AI_MODELS[0].id,
      };
    }
  } catch {
    // ignore
  }
  return { maxSteps: 15, model: AI_MODELS[0].id };
}

function persistSettings(settings: AISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export const useAISettingsStore = create<AISettingsStore>((set, get) => ({
  ...loadSettings(),

  setMaxSteps: (maxSteps: number) => {
    const clamped = Math.max(1, Math.min(100, maxSteps));
    set({ maxSteps: clamped });
    persistSettings({ ...get(), maxSteps: clamped });
  },

  setModel: (model: string) => {
    set({ model });
    persistSettings({ ...get(), model });
  },
}));
