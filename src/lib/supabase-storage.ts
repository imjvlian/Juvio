import { supabase } from "./supabase";
import type { WorkspaceState } from "../types";
import { createSeedWorkspace } from "./seed";
import { isValidState } from "./storage";

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
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isOwner: boolean;
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
  // Reset IDs so Supabase generates consistent ones; keep seed structure but remap.
  const pages: Record<string, any> = {};
  const rootOrder: string[] = [];

  for (const [, page] of Object.entries(seed.pages)) {
    const pageId = `${workspace.id}-${page.id}`;
    pages[pageId] = { ...page, id: pageId };
    if (!page.parentId) rootOrder.push(pageId);
  }

  // Fix children references
  for (const page of Object.values(seed.pages)) {
    if (page.parentId) {
      const parentId = `${workspace.id}-${page.parentId}`;
      if (pages[parentId]) pages[parentId].children = pages[parentId].children.map((c: string) => `${workspace.id}-${c}`);
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
