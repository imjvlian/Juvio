import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { Page, WorkspaceState } from "../types";
import { loadWorkspace, saveWorkspace } from "../lib/storage";
import { createSeedWorkspace, createEmptyPage } from "../lib/seed";
import {
  loadWorkspaceFromSupabase,
  saveWorkspaceToSupabase,
} from "../lib/supabase-storage";
import type { WorkspaceAction } from "./actions";
import { WorkspaceContext } from "./context";

function withPage(
  state: WorkspaceState,
  id: string,
  update: (page: Page) => Page,
): WorkspaceState {
  const page = state.pages[id];
  if (!page) return state;
  return {
    ...state,
    pages: { ...state.pages, [id]: { ...update(page), updatedAt: Date.now() } },
  };
}

function descendants(pages: Record<string, Page>, id: string, out: string[] = []): string[] {
  out.push(id);
  for (const child of pages[id]?.children ?? []) descendants(pages, child, out);
  return out;
}

function removeIds(
  order: string[],
  removed: Set<string>,
): string[] {
  return order.filter((id) => !removed.has(id));
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "select_page": {
      if (!state.pages[action.id]) return state;
      return { ...state, activePageId: action.id };
    }

    case "create_page": {
      const { page, afterId } = action;
      const pages = { ...state.pages, [page.id]: page };
      let rootOrder = state.rootOrder;
      let parentChildren: string[] | null = null;

      if (page.parentId && pages[page.parentId]) {
        const parent = pages[page.parentId];
        const children = [...parent.children];
        const index = afterId ? children.indexOf(afterId) : -1;
        if (index >= 0) children.splice(index + 1, 0, page.id);
        else children.push(page.id);
        pages[parent.id] = { ...parent, children, updatedAt: Date.now() };
        parentChildren = children;
      } else {
        const order = [...state.rootOrder];
        const index = afterId ? order.indexOf(afterId) : -1;
        if (index >= 0) order.splice(index + 1, 0, page.id);
        else order.push(page.id);
        rootOrder = order;
      }

      void parentChildren;
      return { ...state, pages, rootOrder, activePageId: page.id };
    }

    case "delete_page": {
      const page = state.pages[action.id];
      if (!page) return state;
      const removed = new Set(descendants(state.pages, action.id));
      const pages: Record<string, Page> = {};
      for (const [id, value] of Object.entries(state.pages)) {
        if (removed.has(id)) continue;
        pages[id] = value;
      }

      if (page.parentId && pages[page.parentId]) {
        const parent = pages[page.parentId];
        pages[page.parentId] = {
          ...parent,
          children: removeIds(parent.children, removed),
          updatedAt: Date.now(),
        };
      }

      const rootOrder = removeIds(state.rootOrder, removed);
      let activePageId = state.activePageId;
      if (!activePageId || removed.has(activePageId)) {
        activePageId = rootOrder[0] ?? Object.keys(pages)[0] ?? null;
      }

      return { ...state, pages, rootOrder, activePageId };
    }

    case "update_page":
      return withPage(state, action.id, (page) => ({ ...page, ...action.patch }));

    case "add_block": {
      const page = state.pages[action.pageId];
      if (!page) return state;
      const blocks = [...page.blocks];
      const index = action.index ?? blocks.length;
      blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, action.block);
      return withPage(state, page.id, (current) => ({ ...current, blocks }));
    }

    case "update_block": {
      const page = state.pages[action.pageId];
      if (!page) return state;
      const blocks = page.blocks.map((block) =>
        block.id === action.blockId ? { ...block, ...action.patch } : block,
      );
      return withPage(state, page.id, (current) => ({ ...current, blocks }));
    }

    case "delete_block": {
      const page = state.pages[action.pageId];
      if (!page) return state;
      const blocks = page.blocks.filter((block) => block.id !== action.blockId);
      return withPage(state, page.id, (current) => ({ ...current, blocks }));
    }

    case "set_blocks":
      return withPage(state, action.pageId, (page) => ({ ...page, blocks: action.blocks }));

    case "reset":
      return action.state;

    default:
      return state;
  }
}

interface WorkspaceProviderProps {
  children: ReactNode;
  workspaceId?: string;
  userId?: string;
}

export function WorkspaceProvider({ children, workspaceId, userId }: WorkspaceProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    workspaceId && userId ? createSeedWorkspace() : loadWorkspace(),
  );
  const [isLoading, setIsLoading] = useState(!!workspaceId && !!userId);

  // Load workspace from Supabase when a workspace is selected.
  useEffect(() => {
    if (!workspaceId || !userId) {
      setIsLoading(false);
      return;
    }

    loadWorkspaceFromSupabase(workspaceId)
      .then((supabaseState) => {
        if (supabaseState) {
          dispatch({ type: "reset", state: supabaseState });
        } else {
          // Workspace exists but has no pages yet. Create an initial empty page.
          const initialPage = createEmptyPage(null, "Untitled");
          dispatch({ type: "create_page", page: initialPage });
          // Debounced save effect will persist to Supabase on next render.
        }
        setIsLoading(false);
      })
      .catch(() => {
        // Fall back to localStorage seed on Supabase failure.
        setIsLoading(false);
      });
  }, [workspaceId, userId, dispatch]);

  // Persist to localStorage and Supabase (debounced).
  useEffect(() => {
    if (isLoading) return;
    const timer = window.setTimeout(() => {
      saveWorkspace(state);
      if (workspaceId && userId) {
        saveWorkspaceToSupabase(workspaceId, userId, state).catch(() => {
          // Supabase save failed; localStorage still has the session data.
        });
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [state, workspaceId, userId, isLoading]);

  const value = useMemo(() => ({ state, dispatch, isLoading }), [state, isLoading]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
