import { createContext, type Dispatch } from "react";
import type { WorkspaceAction } from "./actions";
import type { WorkspaceState } from "../types";

export interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  isLoading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
