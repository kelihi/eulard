export interface DiagramState {
  id: string;
  title: string;
  code: string;
  positions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramListItem {
  id: string;
  title: string;
  updatedAt: string;
}
