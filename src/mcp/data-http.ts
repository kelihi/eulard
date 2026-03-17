import type { EulardDataAccess } from "./data.js";

export class HttpAccess implements EulardDataAccess {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async resolveUser() {
    return this.request("GET", "/api/me");
  }

  async listDiagrams() {
    return this.request("GET", "/api/diagrams");
  }

  async getDiagram(id: string) {
    try {
      return await this.request("GET", `/api/diagrams/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async createDiagram(title: string, code?: string, folderId?: string) {
    return this.request("POST", "/api/diagrams", { title, code, folderId });
  }

  async updateDiagram(id: string, data: { title?: string; code?: string; folderId?: string | null }) {
    return this.request("PUT", `/api/diagrams/${id}`, data);
  }

  async deleteDiagram(id: string) {
    await this.request("DELETE", `/api/diagrams/${id}`);
  }

  async searchDiagrams(query: string) {
    return this.request("GET", `/api/diagrams/search?q=${encodeURIComponent(query)}`);
  }

  async listFolders() {
    return this.request("GET", "/api/folders");
  }

  async createFolder(name: string) {
    return this.request("POST", "/api/folders", { name });
  }

  async deleteFolder(id: string) {
    await this.request("DELETE", "/api/folders", { id });
  }

  async listShares(diagramId: string) {
    return this.request("GET", `/api/shares?diagramId=${encodeURIComponent(diagramId)}`);
  }

  async shareDiagram(diagramId: string, email: string, permission: "view" | "edit") {
    await this.request("POST", "/api/shares", { diagramId, email, permission });
    return `Shared diagram with ${email} (${permission})`;
  }

  async unshareDiagram(diagramId: string, email: string) {
    // The shares DELETE endpoint expects userId, but we have email.
    // First resolve the user, then call delete.
    const users: { id: string; email: string }[] = await this.request("GET", "/api/admin/users");
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!target) throw new Error(`User not found: ${email}`);
    await this.request("DELETE", "/api/shares", { diagramId, userId: target.id });
  }

  async listChatSessions(diagramId: string) {
    return this.request("GET", `/api/chat-sessions?diagramId=${encodeURIComponent(diagramId)}`);
  }

  async getChatHistory(sessionId: string) {
    const result = await this.request("GET", `/api/chat-sessions/${sessionId}`);
    return result?.messages ?? [];
  }

  async listUsers() {
    return this.request("GET", "/api/admin/users");
  }
}
