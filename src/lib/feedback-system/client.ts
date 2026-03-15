/**
 * HTTP client for the feedback_system API.
 * Fetches client data including integration details (ClickUp, Notion, Slack).
 */

import type { ClientResponse, ClientListResponse } from "./types";

function getBaseUrl(): string | null {
  return process.env.FEEDBACK_SYSTEM_API_URL || null;
}

function getApiToken(): string | null {
  return process.env.FEEDBACK_SYSTEM_API_TOKEN || null;
}

async function apiFetch<T>(path: string): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "FEEDBACK_SYSTEM_API_URL is not configured. Set this environment variable to the feedback system backend URL."
    );
  }

  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getApiToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers, next: { revalidate: 60 } });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Feedback system API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * List clients from the feedback system with optional filters.
 */
export async function listClients(options?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ClientListResponse> {
  const params = new URLSearchParams();
  if (options?.search) params.set("search", options.search);
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const qs = params.toString();
  return apiFetch<ClientListResponse>(`/api/v1/clients${qs ? `?${qs}` : ""}`);
}

/**
 * Get a specific client by ID with full details.
 */
export async function getClient(clientId: string): Promise<ClientResponse> {
  return apiFetch<ClientResponse>(`/api/v1/clients/${clientId}`);
}

/**
 * Check if the feedback system integration is configured.
 */
export function isConfigured(): boolean {
  return !!getBaseUrl();
}
