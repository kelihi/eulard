export interface EulardDataAccess {
  resolveUser(): Promise<{ id: string; email: string; role: string }>;

  // Diagrams
  listDiagrams(): Promise<unknown[]>;
  getDiagram(id: string): Promise<unknown | null>;
  createDiagram(title: string, code?: string, folderId?: string): Promise<unknown>;
  updateDiagram(id: string, data: { title?: string; code?: string; folderId?: string | null }): Promise<unknown>;
  deleteDiagram(id: string): Promise<void>;
  searchDiagrams(query: string): Promise<unknown[]>;

  // Folders
  listFolders(): Promise<unknown[]>;
  createFolder(name: string): Promise<unknown>;
  deleteFolder(id: string): Promise<void>;

  // Shares
  listShares(diagramId: string): Promise<unknown[]>;
  shareDiagram(diagramId: string, email: string, permission: "view" | "edit"): Promise<string>;
  unshareDiagram(diagramId: string, email: string): Promise<void>;

  // Chat
  listChatSessions(diagramId: string): Promise<unknown[]>;
  getChatHistory(sessionId: string): Promise<unknown[]>;

  // Admin
  listUsers(): Promise<unknown[]>;
}
