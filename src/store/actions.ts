import type { Block, Page, WorkspaceState } from "../types";

export type WorkspaceAction =
  | { type: "select_page"; id: string }
  | { type: "create_page"; page: Page; afterId?: string }
  | { type: "delete_page"; id: string }
  | { type: "duplicate_page"; id: string }
  | { type: "move_page"; id: string; parentId: string | null }
  | { type: "save_template"; pageId: string; name: string }
  | { type: "delete_template"; id: string }
  | { type: "create_page_from_template"; templateId: string; parentId: string | null }
  | {
      type: "update_page";
      id: string;
      patch: Partial<Pick<Page, "title" | "icon" | "blocks">>;
    }
  | { type: "add_block"; pageId: string; block: Block; index?: number }
  | { type: "update_block"; pageId: string; blockId: string; patch: Partial<Block> }
  | { type: "delete_block"; pageId: string; blockId: string }
  | { type: "move_block"; pageId: string; blockId: string; toIndex: number }
  | { type: "set_blocks"; pageId: string; blocks: Block[] }
  | { type: "reset"; state: WorkspaceState };
