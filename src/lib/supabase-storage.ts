import { supabase } from "./supabase";
import type { WorkspaceState } from "../types";
import { createSeedWorkspace } from "./seed";
import { isValidState } from "./storage";
import type { InboxItem } from "./inbox";

/**
 * Load a workspace from Supabase. Returns null when the workspace has no pages yet.
 * Throws on network/auth errors so the caller can fall back to localStorage.
 */
export async function loadWorkspaceFromSupabase(
  workspaceId: string,
): Promise<WorkspaceState | null> {
  const { data: pages, error: pagesError } = await supabase
    .from("pages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (pagesError) throw pagesError;
  if (!pages || pages.length === 0) return null;

  const pageIds = pages.map((p) => p.id);
  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("*")
    .in("page_id", pageIds)
    .order("order_index", { ascending: true });

  if (blocksError) throw blocksError;
  const allBlocks = blocks ?? [];

  const pageMap: Record<string, any> = {};
  const rootOrder: string[] = [];

  for (const page of pages) {
    const pageBlocks = allBlocks
      .filter((b) => b.page_id === page.id)
      .map((b) => ({
        id: b.id,
        type: b.type,
        html: b.html,
        ...(b.checked !== undefined ? { checked: b.checked } : {}),
      }));

    pageMap[page.id] = {
      id: page.id,
      title: page.title,
      icon: page.icon,
      parentId: page.parent_id,
      children: [],
      blocks: pageBlocks,
      createdAt: new Date(page.created_at).getTime(),
      updatedAt: new Date(page.updated_at).getTime(),
    };

    if (!page.parent_id) {
      rootOrder.push(page.id);
    }
  }

  for (const page of pages) {
    if (page.parent_id && pageMap[page.parent_id]) {
      pageMap[page.parent_id].children.push(page.id);
    }
  }

  if (!isValidState({ version: 1, pages: pageMap, rootOrder, activePageId: rootOrder[0] ?? null })) {
    return null;
  }

  return {
    version: 1,
    pages: pageMap,
    rootOrder,
    activePageId: rootOrder[0] ?? null,
  };
}

/**
 * Save an entire workspace to Supabase. Upserts pages and blocks.
 */
export async function saveWorkspaceToSupabase(
  workspaceId: string,
  userId: string,
  state: WorkspaceState,
): Promise<void> {
  const now = new Date().toISOString();

  const pageRows = Object.values(state.pages).map((page) => ({
    id: page.id,
    workspace_id: workspaceId,
    parent_id: page.parentId,
    title: page.title,
    icon: page.icon,
    created_by: userId,
    updated_by: userId,
    updated_at: new Date(page.updatedAt).toISOString(),
    created_at: new Date(page.createdAt).toISOString(),
  }));

  const { error: pagesError } = await supabase.from("pages").upsert(pageRows, { onConflict: "id" });
  if (pagesError) throw pagesError;

  // Delete pages no longer in state (and their blocks, due to FK constraint).
  const { data: existingPages, error: existingPagesError } = await supabase
    .from("pages")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (existingPagesError) throw existingPagesError;

  const currentPageIds = Object.keys(state.pages);
  const existingPageIds = new Set((existingPages ?? []).map((p) => p.id));
  const toDeletePages = [...existingPageIds].filter((id) => !currentPageIds.includes(id));
  if (toDeletePages.length > 0) {
    await supabase.from("blocks").delete().in("page_id", toDeletePages);
    await supabase.from("pages").delete().in("id", toDeletePages);
  }

  const blockRows: any[] = [];
  for (const page of Object.values(state.pages)) {
    page.blocks.forEach((block, index) => {
      blockRows.push({
        id: block.id,
        page_id: page.id,
        parent_block_id: null,
        type: block.type,
        html: block.html,
        order_index: index,
        created_by: userId,
        updated_by: userId,
        created_at: now,
        updated_at: now,
      });
    });
  }

  if (blockRows.length > 0) {
    const { error: blocksError } = await supabase.from("blocks").upsert(blockRows, { onConflict: "id" });
    if (blocksError) throw blocksError;
  }

  // Delete blocks no longer in state.
  const currentPageIdSet = new Set(Object.keys(state.pages));
  const currentBlockIds = new Set(blockRows.map((b) => b.id));
  const { data: existingBlocks, error: existingBlocksError } = await supabase
    .from("blocks")
    .select("id, page_id")
    .in("page_id", [...currentPageIdSet]);
  if (existingBlocksError) throw existingBlocksError;

  const toDeleteBlocks = (existingBlocks ?? [])
    .filter((b) => !currentBlockIds.has(b.id))
    .map((b) => b.id);
  if (toDeleteBlocks.length > 0) {
    await supabase.from("blocks").delete().in("id", toDeleteBlocks);
  }
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isOwner: boolean;
}

/** Fetch the workspace display name used by the sidebar switcher. */
export async function loadWorkspaceName(workspaceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;
  return data?.name ?? null;
}

/** Number of members in the workspace (the Library "Members" column). */
export async function loadWorkspaceMemberCount(workspaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Inbox entries: pages other workspace members changed. No notifications table
 * exists, so the inbox is derived from the real `pages.updated_by` history.
 */
export async function loadInboxItems(
  workspaceId: string,
  userId: string,
): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("pages")
    .select("id, title, icon, updated_at, updated_by")
    .eq("workspace_id", workspaceId)
    .neq("updated_by", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((page) => ({
    id: page.id,
    title: page.title || "Untitled",
    icon: page.icon,
    updatedAt: new Date(page.updated_at).getTime(),
    updatedBy: page.updated_by,
  }));
}

/**
 * List workspaces the user is a member of (owner or member).
 */
export async function listWorkspacesForUser(userId: string) {
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, joined_at")
    .eq("user_id", userId);

  if (error) throw error;
  if (!memberships || memberships.length === 0) return [];

  const workspaceIds = memberships.map((m) => m.workspace_id);
  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name, owner_id, created_at")
    .in("id", workspaceIds)
    .order("created_at", { ascending: true });

  if (wsError) throw wsError;
  return (workspaces ?? []).map((ws) => ({
    id: ws.id,
    name: ws.name,
    role: memberships.find((m) => m.workspace_id === ws.id)?.role ?? "member",
    isOwner: ws.owner_id === userId,
  })) as WorkspaceInfo[];
}

/**
 * Create a new workspace with an empty seed page.
 */
export async function createWorkspaceInSupabase(
  userId: string,
  name: string,
): Promise<{ workspaceId: string; state: WorkspaceState } | null> {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: userId })
    .select("id")
    .single();

  if (error || !workspace) throw error;

  // Add owner as member
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  });

  const seed = createSeedWorkspace();
  const idMap = new Map<string, string>();

  const pages: Record<string, any> = {};
  const rootOrder: string[] = [];

  // First pass: create pages with fresh valid UUIDs
  for (const [, page] of Object.entries(seed.pages)) {
    const newPageId = crypto.randomUUID();
    idMap.set(page.id, newPageId);
    pages[newPageId] = { ...page, id: newPageId };
    if (!page.parentId) rootOrder.push(newPageId);
  }

  // Second pass: fix children references
  for (const [, page] of Object.entries(seed.pages)) {
    if (page.parentId) {
      const parentNewId = idMap.get(page.parentId);
      if (parentNewId && pages[parentNewId]) {
        pages[parentNewId].children = pages[parentNewId].children.map((c: string) => idMap.get(c)!);
      }
    }
  }

  await saveWorkspaceToSupabase(workspace.id, userId, {
    version: 1,
    pages,
    rootOrder,
    activePageId: rootOrder[0] ?? null,
  });

  return { workspaceId: workspace.id, state: { version: 1, pages, rootOrder, activePageId: rootOrder[0] ?? null } };
}

export { createSeedWorkspace };
