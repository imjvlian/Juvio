import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Page, WorkspaceState } from "../types";
import { loadWorkspace, saveWorkspace } from "../lib/storage";
import { createSeedWorkspace, createEmptyPage } from "../lib/seed";
import { migrateSeedWorkspace } from "../lib/migration";
import { createId } from "../lib/id";
import { loadFavorites, saveFavorites } from "../lib/favorites";
import { collectSubtree, loadTrash, saveTrash, type TrashEntry } from "../lib/trash";
import {
  loadWorkspaceFromSupabase,
  loadWorkspaceName,
  loadWorkspaceMemberCount,
  loadInboxItems,
  saveWorkspaceToSupabase,
} from "../lib/supabase-storage";
import { loadSeenPages, saveSeenPages, type InboxItem } from "../lib/inbox";
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
      const { page, afterId } = action;      const pages = { ...state.pages, [page.id]: page };
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
      return {
        ...state,
        pages,
        rootOrder,
        activePageId: action.select === false ? state.activePageId : page.id,
      };
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

    case "restore_pages": {
      // Restore a trashed subtree, skipping pages that already exist.
      const incoming = action.pages.filter((page) => !state.pages[page.id]);
      const restored = new Set(incoming.map((page) => page.id));
      const root = incoming.find((page) => page.id === action.rootId) ?? incoming[0];
      if (!root) return state;

      const pages: Record<string, Page> = { ...state.pages };
      for (const page of incoming) {
        pages[page.id] = {
          ...page,
          children: page.children.filter((child) => restored.has(child)),
          updatedAt: Date.now(),
        };
      }

      const parent = root.parentId ? pages[root.parentId] : undefined;
      let rootOrder = state.rootOrder;
      if (parent) {
        pages[parent.id] = {
          ...parent,
          children: parent.children.includes(root.id)
            ? parent.children
            : [...parent.children, root.id],
          updatedAt: Date.now(),
        };
      } else {
        // The old parent is gone, so the restored root becomes a top-level page.
        pages[root.id] = { ...pages[root.id], parentId: null };
        if (!rootOrder.includes(root.id)) rootOrder = [...rootOrder, root.id];
      }

      return { ...state, pages, rootOrder };
    }

    case "duplicate_page": {
      const source = state.pages[action.id];
      if (!source) return state;

      // Copy the page and every descendant, remapping parent/child links.
      const idMap = new Map<string, string>();
      const collect = (id: string) => {
        if (idMap.has(id)) return;
        idMap.set(id, createId());
        for (const child of state.pages[id]?.children ?? []) collect(child);
      };
      collect(action.id);

      const pages: Record<string, Page> = { ...state.pages };
      for (const [oldId, newId] of idMap) {
        const original = state.pages[oldId];
        if (!original) continue;
        pages[newId] = {
          ...original,
          id: newId,
          title:
            oldId === action.id
              ? `${original.title.trim() || "Untitled"} (Copy)`
              : original.title,
          parentId:
            oldId === action.id
              ? original.parentId
              : (idMap.get(original.parentId ?? "") ?? original.parentId),
          children: original.children.map((child) => idMap.get(child) ?? child),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      const copyId = idMap.get(action.id);
      if (!copyId) return state;

      let rootOrder = state.rootOrder;
      if (source.parentId && pages[source.parentId]) {
        const parent = pages[source.parentId];
        pages[parent.id] = {
          ...parent,
          children: [...parent.children, copyId],
          updatedAt: Date.now(),
        };
      } else {
        const index = rootOrder.indexOf(action.id);
        rootOrder = [...rootOrder];
        rootOrder.splice(index >= 0 ? index + 1 : rootOrder.length, 0, copyId);
      }

      return { ...state, pages, rootOrder, activePageId: copyId };
    }

    case "move_page": {
      const page = state.pages[action.id];
      if (!page) return state;
      if (page.parentId === action.parentId) return state;
      // A page cannot become its own ancestor.
      if (action.parentId && descendants(state.pages, action.id).includes(action.parentId)) {
        return state;
      }

      const pages = { ...state.pages };

      if (page.parentId && pages[page.parentId]) {
        const parent = pages[page.parentId];
        pages[parent.id] = {
          ...parent,
          children: parent.children.filter((id) => id !== action.id),
          updatedAt: Date.now(),
        };
      } else {
        const order = [...state.rootOrder];
        const idx = order.indexOf(action.id);
        if (idx >= 0) order.splice(idx, 1);
        pages[action.id] = { ...pages[action.id], parentId: action.parentId, updatedAt: Date.now() };
        return { ...state, pages, rootOrder: order, activePageId: state.activePageId };
      }

      if (action.parentId && pages[action.parentId]) {
        const parent = pages[action.parentId];
        if (!parent.children.includes(action.id)) {
          parent.children.push(action.id);
          pages[parent.id] = { ...parent, updatedAt: Date.now() };
        }
      } else {
        const order = [...state.rootOrder];
        order.push(action.id);
        pages[action.id] = { ...pages[action.id], parentId: action.parentId, updatedAt: Date.now() };
        return { ...state, pages, rootOrder: order, activePageId: state.activePageId };
      }

      pages[action.id] = { ...pages[action.id], parentId: action.parentId, updatedAt: Date.now() };
      return { ...state, pages, activePageId: state.activePageId };
    }

    case "save_template": {
      const page = state.pages[action.pageId];
      if (!page) return state;
      const templates = state.templates ?? {};
      templates[action.name] = {
        id: createId(),
        name: action.name,
        pageId: action.pageId,
        blocks: page.blocks,
        createdAt: Date.now(),
      };
      return { ...state, templates };
    }

    case "delete_template": {
      const templates = { ...(state.templates ?? {}) };
      delete templates[action.id];
      return { ...state, templates };
    }

    case "create_page_from_template": {
      const template = state.templates?.[action.templateId];
      if (!template) return state;
      const newPage = createEmptyPage(action.parentId, template.name);
      const newBlocks = template.blocks.map((b) => ({ ...b, id: createId() }));
      const pages = { ...state.pages, [newPage.id]: { ...newPage, blocks: newBlocks } };
      let rootOrder = state.rootOrder;
      if (!action.parentId) {
        rootOrder = [...rootOrder, newPage.id];
      } else if (state.pages[action.parentId]) {
        const parent = state.pages[action.parentId];
        pages[parent.id] = { ...parent, children: [...parent.children, newPage.id], updatedAt: Date.now() };
      }
      return { ...state, pages, rootOrder, activePageId: newPage.id };
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

    case "move_block": {
      const page = state.pages[action.pageId];
      if (!page) return state;
      const blocks = [...page.blocks];
      const idx = blocks.findIndex((b) => b.id === action.blockId);
      if (idx < 0) return state;
      const [moved] = blocks.splice(idx, 1);
      const toIndex = Math.max(0, Math.min(action.toIndex, blocks.length));
      blocks.splice(toIndex, 0, moved);
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

// Actions that mutate content and should be recorded in history.
const CONTENT_ACTIONS = new Set([
  "create_page",
  "delete_page",
  "restore_pages",
  "update_page",
  "add_block",
  "update_block",
  "delete_block",
  "set_blocks",
  "reset",
]);

const COALESCE_WINDOW = 800; // ms — rapid same-block updates merge into one history entry
const MAX_HISTORY = 100;

interface WorkspaceProviderProps {
  children: ReactNode;
  workspaceId?: string;
  userId?: string;
}

export function WorkspaceProvider({ children, workspaceId, userId }: WorkspaceProviderProps) {
  const [state, baseDispatch] = useReducer(reducer, undefined, () =>
    workspaceId && userId
      ? createSeedWorkspace()
      : migrateSeedWorkspace(loadWorkspace(), "local"),
  );
  const [past, setPast] = useState<WorkspaceState[]>([]);
  const [future, setFuture] = useState<WorkspaceState[]>([]);
  const [isLoading, setIsLoading] = useState(!!workspaceId && !!userId);

  const scope = workspaceId ?? "local";
  const [workspaceName, setWorkspaceName] = useState<string>("Team 6");
  const [memberCount, setMemberCount] = useState<number>(1);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [seenPageIds, setSeenPageIds] = useState<Set<string>>(() => loadSeenPages(scope));
  const [trash, setTrash] = useState<TrashEntry[]>(() => loadTrash(scope));
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites(scope));
  const [lastTrashed, setLastTrashed] = useState<{ entryId: string; title: string } | null>(null);

  useEffect(() => {
    saveTrash(scope, trash);
  }, [scope, trash]);

  useEffect(() => {
    saveFavorites(scope, favorites);
  }, [scope, favorites]);

  useEffect(() => {
    saveSeenPages(scope, seenPageIds);
  }, [scope, seenPageIds]);

  // Workspace members and inbox entries come from the database, not from
  // placeholders. Local-only workspaces have a single member and no inbox.
  const refreshInbox = useCallback(() => {
    if (!workspaceId || !userId) {
      setMemberCount(1);
      setInbox([]);
      return;
    }
    loadWorkspaceMemberCount(workspaceId)
      .then(setMemberCount)
      .catch(() => {
        // Keep the last known count when the lookup fails.
      });
    loadInboxItems(workspaceId, userId)
      .then(setInbox)
      .catch(() => {
        // Keep the last known inbox when the lookup fails.
      });
  }, [workspaceId, userId]);

  useEffect(() => {
    refreshInbox();
    const timer = window.setInterval(refreshInbox, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshInbox]);

  const markInboxSeen = useCallback((pageId: string) => {
    setSeenPageIds((current) => {
      if (current.has(pageId)) return current;
      const next = new Set(current);
      next.add(pageId);
      return next;
    });
  }, []);

  const unreadInboxCount = useMemo(
    () => inbox.filter((item) => !seenPageIds.has(item.id)).length,
    [inbox, seenPageIds],
  );

  const lastActionRef = useRef<{ type: string; id?: string; blockId?: string; time: number } | null>(null);

  // Load workspace from Supabase when a workspace is selected.
  useEffect(() => {
    if (!workspaceId || !userId) {
      setIsLoading(false);
      setPast([]);
      setFuture([]);
      return;
    }

    loadWorkspaceName(workspaceId)
      .then((name) => {
        if (name) setWorkspaceName(name);
      })
      .catch(() => {
        // Keep the default workspace name when the lookup fails.
      });

    loadWorkspaceFromSupabase(workspaceId)
      .then((supabaseState) => {
        if (supabaseState) {
          // Clear history on fresh load — undo should not cross session boundaries.
          setPast([]);
          setFuture([]);
          lastActionRef.current = null;
          baseDispatch({
            type: "reset",
            state: migrateSeedWorkspace(supabaseState, workspaceId),
          });
        } else {
          // Workspace exists but has no pages yet. Seed the default Team 6 HQ tree.
          baseDispatch({ type: "reset", state: createSeedWorkspace() });
          setPast([]);
          setFuture([]);
          lastActionRef.current = null;
        }
        setIsLoading(false);
      })
      .catch(() => {
        setPast([]);
        setFuture([]);
        lastActionRef.current = null;
        setIsLoading(false);
      });
  }, [workspaceId, userId, baseDispatch]);

  // Wrapped dispatch: records content mutations into history with coalescing.
  const dispatch = useCallback(
    (action: WorkspaceAction) => {
      if (action.type === "reset") {
        // Reset clears history — undo should not cross session/load boundaries.
        setPast([]);
        setFuture([]);
        lastActionRef.current = null;
        baseDispatch(action);
        return;
      }

      const isContentChange = CONTENT_ACTIONS.has(action.type);
      const now = Date.now();

      if (isContentChange) {
        const last = lastActionRef.current;
        let shouldPush = true;

        // Coalescing: merge rapid same-block html updates into one entry.
        if (
          action.type === "update_block" &&
          last?.type === "update_block" &&
          last.blockId === (action as { blockId?: string }).blockId &&
          now - last.time < COALESCE_WINDOW
        ) {
          shouldPush = false;
          setPast((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = state;
            return copy;
          });
        } else if (
          action.type === "update_page" &&
          last?.type === "update_page" &&
          last.id === (action as { id: string }).id &&
          now - last.time < COALESCE_WINDOW
        ) {
          shouldPush = false;
          setPast((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = state;
            return copy;
          });
        }

        if (shouldPush) {
          setPast((prev) => {
            const next = [...prev, state];
            if (next.length > MAX_HISTORY) return next.slice(-MAX_HISTORY);
            return next;
          });
          setFuture([]);
        }

        lastActionRef.current = {
          type: action.type,
          id: (action as { id?: string }).id,
          blockId: (action as { blockId?: string }).blockId,
          time: now,
        };
      } else if (action.type === "select_page") {
        lastActionRef.current = null;
      }

      baseDispatch(action);
    },
    [state, baseDispatch],
  );

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [id, ...current],
    );
  }, []);

  // Move a page and its sub-pages to the local trash, keeping a restorable snapshot.
  const moveToTrash = useCallback(
    (id: string) => {
      const page = state.pages[id];
      if (!page) return;
      const pages = collectSubtree(state.pages, id);
      const removed = new Set(pages.map((entry) => entry.id));
      const entry: TrashEntry = {
        id: createId(),
        rootId: id,
        title: page.title.trim() || "Untitled",
        icon: page.icon,
        deletedAt: Date.now(),
        pages,
      };
      setTrash((current) => [entry, ...current].slice(0, 20));
      setLastTrashed({ entryId: entry.id, title: entry.title });
      setFavorites((current) => current.filter((favorite) => !removed.has(favorite)));
      dispatch({ type: "delete_page", id });
    },
    [state.pages, dispatch],
  );

  const restoreFromTrash = useCallback(
    (entryId: string) => {
      const entry = trash.find((candidate) => candidate.id === entryId);
      if (!entry) return;
      dispatch({ type: "restore_pages", pages: entry.pages, rootId: entry.rootId });
      setTrash((current) => current.filter((candidate) => candidate.id !== entryId));
      setLastTrashed((current) => (current?.entryId === entryId ? null : current));
    },
    [trash, dispatch],
  );

  const deleteForever = useCallback((entryId: string) => {
    setTrash((current) => current.filter((candidate) => candidate.id !== entryId));
    setLastTrashed((current) => (current?.entryId === entryId ? null : current));
  }, []);

  const clearLastTrashed = useCallback(() => setLastTrashed(null), []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((fut) => [state, ...fut]);
    lastActionRef.current = null;
    baseDispatch({ type: "reset", state: previous });
  }, [canUndo, state, past]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = future[future.length - 1];
    setFuture((fut) => fut.slice(0, -1));
    setPast((prev) => [...prev, state]);
    lastActionRef.current = null;
    baseDispatch({ type: "reset", state: next });
  }, [canRedo, state, future]);

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

  const value = useMemo(
    () => ({
      state,
      dispatch,
      isLoading,
      canUndo,
      canRedo,
      undo,
      redo,
      scope,
      workspaceName,
      memberCount,
      inbox,
      seenPageIds,
      unreadInboxCount,
      markInboxSeen,
      refreshInbox,
      trash,
      favorites,
      toggleFavorite,
      moveToTrash,
      restoreFromTrash,
      deleteForever,
      lastTrashed,
      clearLastTrashed,
    }),
    [
      state,
      dispatch,
      isLoading,
      canUndo,
      canRedo,
      undo,
      redo,
      scope,
      workspaceName,
      memberCount,
      inbox,
      seenPageIds,
      unreadInboxCount,
      markInboxSeen,
      refreshInbox,
      trash,
      favorites,
      toggleFavorite,
      moveToTrash,
      restoreFromTrash,
      deleteForever,
      lastTrashed,
      clearLastTrashed,
    ],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
