import { getSetting } from "@/lib/db";

interface AnthropicModel {
  type: "model";
  id: string;
  display_name?: string;
  created_at?: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

// Fallback options if the Anthropic Models API is unavailable.
// Ordered by release date (newest first) so the first entry is the default.
export const FALLBACK_MODELS: ModelOption[] = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-fable-5", label: "Claude Fable 5" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
];

const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const FETCH_TIMEOUT_MS = 5000;

let cachedModels: ModelOption[] | null = null;
let cachedAt = 0;
let pendingPromise: Promise<ModelOption[]> | null = null;

export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

async function fetchAnthropicModels(): Promise<ModelOption[]> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return FALLBACK_MODELS;
  }

  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Anthropic models API returned ${response.status}`);
  }

  const json = (await response.json()) as { data?: AnthropicModel[] };
  const models = (json.data || [])
    .filter((m) => m.type === "model" && m.id)
    .sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    })
    .map((m) => ({
      id: m.id,
      label: m.display_name || m.id,
    }));

  return models.length > 0 ? models : FALLBACK_MODELS;
}

/**
 * Returns the list of currently available Anthropic models, cached for a short TTL.
 * Pass `force = true` to bypass the cache and refresh the list (useful in settings UI).
 */
export async function getAvailableModels(force = false): Promise<ModelOption[]> {
  if (!force && cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = fetchAnthropicModels()
    .then((models) => {
      cachedModels = models;
      cachedAt = Date.now();
      return models;
    })
    .catch((error) => {
      console.error("Failed to fetch Anthropic models list", error);
      return cachedModels ?? FALLBACK_MODELS;
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

/**
 * Mark the cached model list as stale so the next call fetches fresh data.
 */
export async function refreshAvailableModels(): Promise<ModelOption[]> {
  cachedModels = null;
  cachedAt = 0;
  return getAvailableModels(true);
}

const CLAUDE_MODEL_ID_RE = /^claude-[a-z0-9-]+$/;

function isKnownClaudeModelId(id: string | null | undefined): boolean {
  return !!id && CLAUDE_MODEL_ID_RE.test(id);
}

/**
 * Resolve the model ID to use for a chat request.
 * 1. Use the client-provided model if it is valid.
 * 2. Fall back to the admin-configured default model.
 * 3. Fall back to the newest available model.
 */
export async function resolveModelId(clientModel?: string | null): Promise<string> {
  const [availableModels, adminModel] = await Promise.all([
    getAvailableModels(),
    getSetting("ai_model"),
  ]);

  const availableIds = new Set(availableModels.map((m) => m.id));

  if (clientModel && (availableIds.has(clientModel) || isKnownClaudeModelId(clientModel))) {
    return clientModel;
  }

  if (adminModel && (availableIds.has(adminModel) || isKnownClaudeModelId(adminModel))) {
    return adminModel;
  }

  return availableModels[0]?.id ?? FALLBACK_MODELS[0].id;
}

/**
 * Get the default model ID for new requests (admin override or newest available).
 */
export async function getDefaultModelId(): Promise<string> {
  return resolveModelId(null);
}
