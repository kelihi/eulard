import { create } from "zustand";

export const AI_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]["id"];

const STORAGE_KEY = "eulard-ai-settings";

export interface AISettings {
  maxSteps: number;
  model: AIModelId;
  maxAutoRetries: number;
}

interface AISettingsStore extends AISettings {
  setMaxSteps: (maxSteps: number) => void;
  setModel: (model: AIModelId) => void;
  setMaxAutoRetries: (maxAutoRetries: number) => void;
}

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { maxSteps: 15, model: "claude-sonnet-4-6", maxAutoRetries: 5 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        maxSteps: typeof parsed.maxSteps === "number" ? parsed.maxSteps : 15,
        model: AI_MODELS.some((m) => m.id === parsed.model)
          ? parsed.model
          : "claude-sonnet-4-6",
        maxAutoRetries: typeof parsed.maxAutoRetries === "number" ? parsed.maxAutoRetries : 5,
      };
    }
  } catch {
    // ignore
  }
  return { maxSteps: 15, model: "claude-sonnet-4-6", maxAutoRetries: 5 };
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

  setModel: (model: AIModelId) => {
    set({ model });
    persistSettings({ ...get(), model });
  },

  setMaxAutoRetries: (maxAutoRetries: number) => {
    const clamped = Math.max(0, Math.min(20, maxAutoRetries));
    set({ maxAutoRetries: clamped });
    persistSettings({ ...get(), maxAutoRetries: clamped });
  },
}));
