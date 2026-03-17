#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { EulardDataAccess } from "./data.js";
import { DirectDbAccess } from "./data-db.js";
import { HttpAccess } from "./data-http.js";

// --- Backend selection ---

function createDataAccess(): EulardDataAccess {
  const apiUrl = process.env.EULARD_API_URL;
  const apiKey = process.env.EULARD_API_KEY;

  if (apiUrl && apiKey) {
    console.error(`Eulard MCP: HTTP mode -> ${apiUrl}`);
    return new HttpAccess(apiUrl, apiKey);
  }

  console.error("Eulard MCP: Direct DB mode");
  return new DirectDbAccess();
}

const data = createDataAccess();

// --- MCP Server ---

const server = new McpServer({
  name: "eulard",
  version: "1.0.0",
});

// ===== TOOLS =====

// --- Diagrams ---

server.tool(
  "list_diagrams",
  "List all diagrams accessible to the current user (owned and shared)",
  {},
  async () => {
    const rows = await data.listDiagrams();
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  "get_diagram",
  "Get a diagram by ID, including its mermaid code and metadata",
  { diagramId: z.string().describe("The diagram ID") },
  async ({ diagramId }) => {
    const diagram = await data.getDiagram(diagramId);
    if (!diagram) {
      return { content: [{ type: "text" as const, text: "Diagram not found or access denied" }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }] };
  }
);

server.tool(
  "create_diagram",
  "Create a new mermaid diagram",
  {
    title: z.string().describe("Diagram title"),
    code: z.string().optional().describe("Mermaid diagram code (defaults to a simple flowchart if omitted)"),
    folderId: z.string().optional().describe("Folder ID to place the diagram in"),
  },
  async ({ title, code, folderId }) => {
    const diagram = await data.createDiagram(title, code, folderId);
    return { content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }] };
  }
);

server.tool(
  "update_diagram",
  "Update an existing diagram's title, mermaid code, or folder",
  {
    diagramId: z.string().describe("The diagram ID to update"),
    title: z.string().optional().describe("New title"),
    code: z.string().optional().describe("New mermaid diagram code"),
    folderId: z.string().nullable().optional().describe("New folder ID (null to remove from folder)"),
  },
  async ({ diagramId, title, code, folderId }) => {
    try {
      const diagram = await data.updateDiagram(diagramId, { title, code, folderId });
      return { content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

server.tool(
  "delete_diagram",
  "Delete a diagram (owner only)",
  { diagramId: z.string().describe("The diagram ID to delete") },
  async ({ diagramId }) => {
    try {
      await data.deleteDiagram(diagramId);
      return { content: [{ type: "text" as const, text: `Deleted diagram ${diagramId}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

server.tool(
  "search_diagrams",
  "Search diagrams by title or mermaid code content",
  { query: z.string().describe("Search term to match against diagram titles and code") },
  async ({ query }) => {
    const rows = await data.searchDiagrams(query);
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  }
);

// --- Folders ---

server.tool(
  "list_folders",
  "List all folders for the current user",
  {},
  async () => {
    const rows = await data.listFolders();
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  "create_folder",
  "Create a new folder to organize diagrams",
  { name: z.string().describe("Folder name") },
  async ({ name }) => {
    const folder = await data.createFolder(name);
    return { content: [{ type: "text" as const, text: JSON.stringify(folder, null, 2) }] };
  }
);

server.tool(
  "delete_folder",
  "Delete a folder (diagrams in it are unfoldered, not deleted)",
  { folderId: z.string().describe("The folder ID to delete") },
  async ({ folderId }) => {
    await data.deleteFolder(folderId);
    return { content: [{ type: "text" as const, text: `Deleted folder ${folderId}` }] };
  }
);

// --- Sharing ---

server.tool(
  "list_shares",
  "List all shares for a diagram",
  { diagramId: z.string().describe("The diagram ID") },
  async ({ diagramId }) => {
    try {
      const rows = await data.listShares(diagramId);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

server.tool(
  "share_diagram",
  "Share a diagram with another user by email",
  {
    diagramId: z.string().describe("The diagram ID to share"),
    email: z.string().describe("Email of the user to share with"),
    permission: z.enum(["view", "edit"]).describe("Permission level: view or edit"),
  },
  async ({ diagramId, email, permission }) => {
    try {
      const msg = await data.shareDiagram(diagramId, email, permission);
      return { content: [{ type: "text" as const, text: msg }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

server.tool(
  "unshare_diagram",
  "Remove a user's access to a shared diagram",
  {
    diagramId: z.string().describe("The diagram ID"),
    email: z.string().describe("Email of the user to remove access from"),
  },
  async ({ diagramId, email }) => {
    try {
      await data.unshareDiagram(diagramId, email);
      return { content: [{ type: "text" as const, text: `Removed ${email}'s access to diagram ${diagramId}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

// --- Chat Sessions ---

server.tool(
  "list_chat_sessions",
  "List chat sessions for a diagram",
  { diagramId: z.string().describe("The diagram ID") },
  async ({ diagramId }) => {
    const rows = await data.listChatSessions(diagramId);
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  "get_chat_history",
  "Get the message history for a chat session",
  { sessionId: z.string().describe("The chat session ID") },
  async ({ sessionId }) => {
    try {
      const rows = await data.getChatHistory(sessionId);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

// --- Users (admin only) ---

server.tool(
  "list_users",
  "List all users (admin only)",
  {},
  async () => {
    try {
      const rows = await data.listUsers();
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: (err as Error).message }], isError: true };
    }
  }
);

// ===== RESOURCES =====

server.resource(
  "diagrams-list",
  "eulard://diagrams",
  { description: "List of all diagrams accessible to the current user with their IDs and titles", mimeType: "application/json" },
  async (uri) => {
    const rows = await data.listDiagrams();
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(rows, null, 2) }],
    };
  }
);

server.resource(
  "diagram-detail",
  "eulard://diagrams/{diagramId}",
  { description: "Full diagram detail including mermaid code — use this to read a diagram as context", mimeType: "application/json" },
  async (uri) => {
    const diagramId = uri.pathname.split("/").pop() || "";
    const diagram = await data.getDiagram(diagramId);
    if (!diagram) {
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "Diagram not found or access denied" }] };
    }
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(diagram, null, 2) }],
    };
  }
);

// ===== START =====

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eulard MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
