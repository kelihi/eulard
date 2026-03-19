export interface DiagramState {
  id: string;
  title: string;
  code: string;
  positions: string | null;
  styleOverrides: string | null;
  folderId: string | null;
  permission: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramListItem {
  id: string;
  title: string;
  folderId: string | null;
  updatedAt: string;
  isShared?: boolean;
  permission?: string | null;
  ownerEmail?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  isShared?: boolean;
  permission?: string;
  ownerEmail?: string;
}
