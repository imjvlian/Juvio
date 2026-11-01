export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulleted"
  | "numbered"
  | "todo"
  | "quote"
  | "code"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  /** Sanitized inline HTML produced by this editor (b, i, u, s, code). */
  html: string;
  checked?: boolean;
}

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  children: string[];
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  pageId: string;
  blocks: Block[];
  createdAt: number;
}

export interface WorkspaceState {
  version: 1;
  pages: Record<string, Page>;
  rootOrder: string[];
  activePageId: string | null;
  templates?: Record<string, Template>;
}

export type BlockPatch = Partial<Pick<Block, "type" | "html" | "checked">>;
