import { createContext, type Dispatch } from "react";
import type { WorkspaceAction } from "./actions";
import type { WorkspaceState } from "../types";
import type { TrashEntry } from "../lib/trash";

export interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  isLoading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Local storage namespace for UI-only state (favorites, trash). */
  scope: string;
  trash: TrashEntry[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (entryId: string) => void;
  deleteForever: (entryId: string) => void;
  /** Most recent page moved to Trash, used for the Undo toast. */
  lastTrashed: { entryId: string; title: string } | null;
  clearLastTrashed: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
