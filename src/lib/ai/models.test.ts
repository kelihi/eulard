import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAvailableModels, resolveModelId, FALLBACK_MODELS } from "./models";

vi.mock("@/lib/db", () => ({
  getSetting: vi.fn(),
}));

import { getSetting } from "@/lib/db";

describe("models", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns sorted models from Anthropic /v1/models", async () => {
    const mockedFetch = vi.mocked(fetch);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { type: "model", id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6", created_at: "2026-02-17T00:00:00Z" },
          { type: "model", id: "claude-opus-4-8", display_name: "Claude Opus 4.8", created_at: "2026-05-28T00:00:00Z" },
        ],
      }),
    } as unknown as Response);

    const models = await getAvailableModels(true);
    expect(models[0].id).toBe("claude-opus-4-8");
    expect(models[1].id).toBe("claude-sonnet-4-6");
    expect(models[0].label).toBe("Claude Opus 4.8");
  });

  it("falls back to FALLBACK_MODELS if the API fails", async () => {
    const mockedFetch = vi.mocked(fetch);
    mockedFetch.mockRejectedValueOnce(new Error("network error"));

    const models = await getAvailableModels(true);
    expect(models).toEqual(FALLBACK_MODELS);
  });

  it("resolves to the client model when it is in the available list", async () => {
    const mockedFetch = vi.mocked(fetch);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { type: "model", id: "claude-sonnet-5", display_name: "Claude Sonnet 5", created_at: "2026-06-29T00:00:00Z" },
          { type: "model", id: "claude-opus-4-8", display_name: "Claude Opus 4.8", created_at: "2026-05-28T00:00:00Z" },
        ],
      }),
    } as unknown as Response);

    const modelId = await resolveModelId("claude-opus-4-8");
    expect(modelId).toBe("claude-opus-4-8");
  });

  it("falls back to the admin model when the client model is invalid", async () => {
    const mockedFetch = vi.mocked(fetch);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { type: "model", id: "claude-opus-4-8", display_name: "Claude Opus 4.8", created_at: "2026-05-28T00:00:00Z" },
        ],
      }),
    } as unknown as Response);

    vi.mocked(getSetting).mockResolvedValueOnce("claude-opus-4-8");

    const modelId = await resolveModelId("not-a-real-model");
    expect(modelId).toBe("claude-opus-4-8");
  });
});
