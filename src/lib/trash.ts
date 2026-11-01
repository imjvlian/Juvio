import type { Page } from "../types";

export interface TrashEntry {
  id: string;
  rootId: string;
  title: string;
  icon: string | null;
  deletedAt: number;
  pages: Page[];
}

const MAX_ENTRIES = 20;

function storageKey(scope: string): string {
  return `juvio.trash.v1.${scope}`;
}

function isEntry(value: unknown): value is TrashEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.rootId === "string" &&
    typeof entry.title === "string" &&
    (entry.icon === null || typeof entry.icon === "string") &&
    typeof entry.deletedAt === "number" &&
    Array.isArray(entry.pages)
  );
}

export function loadTrash(scope: string): TrashEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).sort((a, b) => b.deletedAt - a.deletedAt);
  } catch {
    return [];
  }
}

export function saveTrash(scope: string, entries: TrashEntry[]): void {
  try {
    const trimmed = [...entries].sort((a, b) => b.deletedAt - a.deletedAt).slice(0, MAX_ENTRIES);
    localStorage.setItem(storageKey(scope), JSON.stringify(trimmed));
  } catch {
    // Trash is best-effort local state.
  }
}

export function collectSubtree(pages: Record<string, Page>, rootId: string): Page[] {
  const collected: Page[] = [];
  const walk = (id: string) => {
    const page = pages[id];
    if (!page) return;
    collected.push(page);
    for (const child of page.children) walk(child);
  };
  walk(rootId);
  return collected;
}
