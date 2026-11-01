import { useEffect, useMemo, useState } from "react";
import type { Page } from "../types";
import { createEmptyPage } from "../lib/seed";
import { resetWorkspace } from "../lib/storage";
import { useWorkspace } from "../store/useWorkspace";
import {
  ChevronIcon,
  LogOutIcon,
  MoonIcon,
  PageIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

const EXPANDED_KEY = "juvio.sidebar.expanded.v1";

function loadExpanded(): Set<string> | null {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    // Ignore unreadable state; the tree falls back to sensible defaults.
  }
  return null;
}

function saveExpanded(ids: Set<string>): void {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
  } catch {
    // Sidebar expansion is best-effort state.
  }
}

function pathOf(page: Page, pages: Record<string, Page>): string {
  const names: string[] = [];
  let current: Page | undefined = page.parentId ? pages[page.parentId] : undefined;
  while (current) {
    names.unshift(current.title || "Untitled");
    current = current.parentId ? pages[current.parentId] : undefined;
  }
  return names.join(" / ");
}

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onCollapse: () => void;
  onSignOut: () => void;
}

export function Sidebar({ theme, onToggleTheme, onCollapse, onSignOut }: SidebarProps) {
  const { state, dispatch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const stored = loadExpanded();
    if (stored) return stored;
    return new Set(
      Object.values(state.pages)
        .filter((page) => page.children.length > 0)
        .map((page) => page.id),
    );
  });
  // Pages the user explicitly collapsed, so ancestors of the active page can stay closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    saveExpanded(expanded);
  }, [expanded]);

  // Keep the active page's ancestor trail visible without persisting it.
  const visibleExpanded = useMemo(() => {
    const active = state.activePageId ? state.pages[state.activePageId] : undefined;
    if (!active) return expanded;
    const next = new Set(expanded);
    let cursor: Page | undefined = active;
    while (cursor?.parentId) {
      if (!collapsed.has(cursor.parentId)) next.add(cursor.parentId);
      cursor = state.pages[cursor.parentId];
    }
    return next;
  }, [expanded, collapsed, state.activePageId, state.pages]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return Object.values(state.pages)
      .filter((page) => (page.title || "untitled").toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [query, state.pages]);

  function setOpen(id: string, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
    setCollapsed((current) => {
      const next = new Set(current);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle(id: string) {
    setOpen(id, !visibleExpanded.has(id));
  }

  function createPage(parentId: string | null) {
    if (parentId) setOpen(parentId, true);
    dispatch({ type: "create_page", page: createEmptyPage(parentId) });
  }

  function deletePage(page: Page) {
    const descendants = countDescendants(page.id, state.pages);
    const label = page.title.trim() || "Untitled";
    const message =
      descendants > 0
        ? `Delete “${label}” and its ${descendants} sub-page${descendants === 1 ? "" : "s"}? This cannot be undone.`
        : `Delete “${label}”? This cannot be undone.`;
    if (window.confirm(message)) dispatch({ type: "delete_page", id: page.id });
  }

  function handleReset() {
    if (!window.confirm("Reset the workspace? Local pages will be replaced by the sample pages.")) return;
    const fresh = resetWorkspace();
    dispatch({ type: "reset", state: fresh });
    setExpanded(
      new Set(
        Object.values(fresh.pages)
          .filter((page) => page.children.length > 0)
          .map((page) => page.id),
      ),
    );
    setCollapsed(new Set());
    setQuery("");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-workspace">
        <button type="button" className="workspace-switch">
          <span className="brand-mark">J</span>
          <span className="workspace-name">Juvio</span>
          <ChevronIcon className="workspace-chevron" width={12} height={12} />
        </button>
        <button type="button" className="ghost-icon" aria-label="Collapse sidebar" onClick={onCollapse}>
          <SidebarIcon />
        </button>
      </div>

      <label className="sidebar-search">
        <SearchIcon width={16} height={16} />
        <input
          value={query}
          placeholder="Search"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search pages"
        />
      </label>

      <button type="button" className="new-page-button" onClick={() => createPage(null)}>
        <PlusIcon />
        New page
      </button>

      <div className="sidebar-section">
        <span className="sidebar-section-label">Private</span>
        <button
          type="button"
          className="ghost-icon"
          aria-label="New page"
          onClick={() => createPage(null)}
        >
          <PlusIcon />
        </button>
      </div>

      <nav className="page-tree" aria-label="Pages">
        {query.trim() ? (
          filtered.length === 0 ? (
            <p className="tree-empty">No pages match “{query.trim()}”.</p>
          ) : (
            filtered.map((page) => {
              const parentPath = pathOf(page, state.pages);
              return (
                <button
                  key={page.id}
                  type="button"
                  className={`search-result${page.id === state.activePageId ? " is-active" : ""}`}
                  onClick={() => dispatch({ type: "select_page", id: page.id })}
                >
                  <span className="tree-icon">{page.icon ?? <PageIcon />}</span>
                  <span className="search-result-copy">
                    <span>{page.title || "Untitled"}</span>
                    {parentPath && <small>{parentPath}</small>}
                  </span>
                </button>
              );
            })
          )
        ) : (
          <>
            {state.rootOrder.map((id) => {
              const page = state.pages[id];
              if (!page) return null;
              return (
                <TreeItem
                  key={id}
                  page={page}
                  depth={0}
                  pages={state.pages}
                  activeId={state.activePageId}
                  expanded={visibleExpanded}
                  onToggle={toggle}
                  onSelect={(pageId) => dispatch({ type: "select_page", id: pageId })}
                  onCreateChild={(pageId) => createPage(pageId)}
                  onDelete={deletePage}
                />
              );
            })}
            {state.rootOrder.length === 0 && <p className="tree-empty">No pages yet.</p>}
          </>
        )}
      </nav>

      <div className="sidebar-section sidebar-section-stack">
        <span className="sidebar-section-label">Templates</span>
        <div className="template-list">
          {Object.entries(state.templates ?? {}).map(([id, t]) => (
            <div key={id} className="template-item">
              <button
                type="button"
                className="template-item-main"
                onClick={() => dispatch({ type: "create_page_from_template", templateId: id, parentId: null })}
              >
                <PageIcon width={14} height={14} />
                <span className="template-item-title">{t.name}</span>
              </button>
              <button
                type="button"
                className="template-item-delete"
                aria-label={`Delete template ${t.name}`}
                onClick={() => dispatch({ type: "delete_template", id })}
              >
                ×
              </button>
            </div>
          ))}
          {Object.keys(state.templates ?? {}).length === 0 && (
            <p className="template-empty">No templates yet.</p>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="footer-button" onClick={onToggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button type="button" className="ghost-icon" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
          <LogOutIcon />
        </button>
        <button type="button" className="ghost-icon" aria-label="Reset workspace" onClick={handleReset}>
          <TrashIcon />
        </button>
      </div>
    </aside>
  );
}

interface TreeItemProps {
  page: Page;
  depth: number;
  pages: Record<string, Page>;
  activeId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateChild: (id: string) => void;
  onDelete: (page: Page) => void;
}

function TreeItem({
  page,
  depth,
  pages,
  activeId,
  expanded,
  onToggle,
  onSelect,
  onCreateChild,
  onDelete,
}: TreeItemProps) {
  const hasChildren = page.children.length > 0;
  const isOpen = expanded.has(page.id);
  const isActive = page.id === activeId;

  return (
    <div className="tree-branch">
      <div
        className={`tree-row${isActive ? " is-active" : ""}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        <button
          type="button"
          className={`tree-arrow${hasChildren ? "" : " is-hidden"}${isOpen ? " is-open" : ""}`}
          aria-label={isOpen ? "Collapse page" : "Expand page"}
          tabIndex={hasChildren ? 0 : -1}
          onClick={() => hasChildren && onToggle(page.id)}
        >
          <ChevronIcon width={12} height={12} />
        </button>
        <button
          type="button"
          className="tree-main"
          onClick={() => onSelect(page.id)}
          title={page.title || "Untitled"}
        >
          <span className="tree-icon">{page.icon ?? <PageIcon />}</span>
          <span className="tree-title">{page.title || "Untitled"}</span>
        </button>
        <span className="tree-actions">
          <button
            type="button"
            className="tree-action"
            aria-label="Add sub-page"
            title="Add sub-page"
            onClick={() => onCreateChild(page.id)}
          >
            <PlusIcon width={14} height={14} />
          </button>
          <button
            type="button"
            className="tree-action"
            aria-label="Delete page"
            title="Delete page"
            onClick={() => onDelete(page)}
          >
            <TrashIcon width={14} height={14} />
          </button>
        </span>
      </div>
      {isOpen &&
        page.children.map((childId) => {
          const child = pages[childId];
          if (!child) return null;
          return (
            <TreeItem
              key={childId}
              page={child}
              depth={depth + 1}
              pages={pages}
              activeId={activeId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
            />
          );
        })}
    </div>
  );
}

function countDescendants(id: string, pages: Record<string, Page>): number {
  const page = pages[id];
  if (!page) return 0;
  return page.children.reduce(
    (total, childId) => total + 1 + countDescendants(childId, pages),
    0,
  );
}
