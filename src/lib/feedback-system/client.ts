/**
 * HTTP client for the feedback_system API.
 * Fetches client data including integration details (ClickUp, Notion, Slack).
 *
 * Authentication options (checked in order):
 * 1. FEEDBACK_SYSTEM_API_TOKEN — a pre-minted JWT or raw Bearer token.
 * 2. FEEDBACK_SYSTEM_JWT_SECRET + FEEDBACK_SYSTEM_SERVICE_PERSON_ID +
 *    FEEDBACK_SYSTEM_SERVICE_EMAIL — eulard mints its own short-lived JWT
 *    using the same secret key as the feedback_system backend (JWT_SECRET_KEY).
 */

import { SignJWT } from "jose";
import type { ClientResponse, ClientListResponse } from "./types";

function getBaseUrl(): string | null {
  return process.env.FEEDBACK_SYSTEM_API_URL || null;
}

/**
 * Mint a short-lived JWT that the feedback_system backend will accept.
 * Uses the same HS256 / JWT_SECRET_KEY algorithm as feedback_system's auth.py.
 */
async function mintServiceToken(): Promise<string | null> {
  const secret = process.env.FEEDBACK_SYSTEM_JWT_SECRET;
  const personId = process.env.FEEDBACK_SYSTEM_SERVICE_PERSON_ID;
  const email = process.env.FEEDBACK_SYSTEM_SERVICE_EMAIL;

  if (!secret || !personId || !email) return null;

  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({ person_id: personId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secretKey);

  return token;
}

/**
 * Resolve a Bearer token for the feedback_system API.
 * Prefers a static token if configured, otherwise mints a JWT.
 */
async function resolveToken(): Promise<string | null> {
  const staticToken = process.env.FEEDBACK_SYSTEM_API_TOKEN;
  if (staticToken) return staticToken;
  return mintServiceToken();
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

  const token = await resolveToken();
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
