import { create } from "zustand";

export const AI_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]["id"];

const STORAGE_KEY = "eulard-ai-settings";

export interface AISettings {
  maxSteps: number;
  model: AIModelId;
}

interface AISettingsStore extends AISettings {
  setMaxSteps: (maxSteps: number) => void;
  setModel: (model: AIModelId) => void;
}

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { maxSteps: 15, model: "claude-sonnet-4-20250514" };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        maxSteps: typeof parsed.maxSteps === "number" ? parsed.maxSteps : 15,
        model: AI_MODELS.some((m) => m.id === parsed.model)
          ? parsed.model
          : "claude-sonnet-4-20250514",
      };
    }
  } catch {
    // ignore
  }
  return { maxSteps: 15, model: "claude-sonnet-4-20250514" };
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
}));
