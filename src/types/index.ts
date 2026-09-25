export interface FileNode {
  id: string;
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[] | null;
}

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
}

export type ViewMode = "editor" | "graph" | "canvas";
