export interface DiagramState {
  id: string;
  title: string;
  code: string;
  positions: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramListItem {
  id: string;
  title: string;
  folderId: string | null;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
}
