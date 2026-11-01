import type { WorkspaceState } from "../types";
import { createSeedWorkspace } from "./seed";

const STORAGE_KEY = "juvio.workspace.v1";

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulleted",
  "numbered",
  "todo",
  "quote",
  "callout",
  "code",
  "image",
  "divider",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidState(value: unknown): value is WorkspaceState {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isRecord(value.pages)) return false;
  if (!Array.isArray(value.rootOrder)) return false;

  const pages = value.pages;
  const ids = Object.keys(pages);
  if (ids.length === 0) return false;
  if (value.activePageId !== null && typeof value.activePageId !== "string") return false;
  if (!value.rootOrder.every((id): id is string => typeof id === "string" && id in pages)) {
    return false;
  }

  return ids.every((id) => {
    const page = pages[id];
    if (!isRecord(page)) return false;
    if (page.id !== id) return false;
    if (typeof page.title !== "string") return false;
    if (typeof page.createdAt !== "number" || typeof page.updatedAt !== "number") return false;
    if (page.icon !== null && typeof page.icon !== "string") return false;
    if (page.parentId !== null && typeof page.parentId !== "string") return false;
    if (!Array.isArray(page.children)) return false;
    if (!page.children.every((child): child is string => typeof child === "string" && child in pages)) {
      return false;
    }
    if (!Array.isArray(page.blocks)) return false;
    return page.blocks.every((block) => {
      if (!isRecord(block)) return false;
      return (
        typeof block.id === "string" &&
        typeof block.type === "string" &&
        BLOCK_TYPES.has(block.type) &&
        typeof block.html === "string" &&
        (block.checked === undefined || typeof block.checked === "boolean")
      );
    });
  });
}

export function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedWorkspace();
    const parsed: unknown = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
  } catch {
    // Fall through to a fresh workspace when stored data is unreadable.
  }
  return createSeedWorkspace();
}

export function saveWorkspace(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode / quota). The session still works.
  }
}

export function resetWorkspace(): WorkspaceState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors; the caller re-seeds in memory.
  }
  return createSeedWorkspace();
}
