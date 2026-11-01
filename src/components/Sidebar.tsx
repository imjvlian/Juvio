import { useEffect, useMemo, useState } from "react";
import type { Page } from "../types";
import { createEmptyPage } from "../lib/seed";
import { resetWorkspace } from "../lib/storage";
import { useWorkspace } from "../store/useWorkspace";
import {
  ChevronIcon,
  ChatIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  CalendarIcon,
  CustomizeIcon,
  UserIcon,
  HouseIcon,
  GettingStartedIcon,
  TeamIcon,
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

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onCollapse: () => void;
  onSignOut: () => void;
  onOpenTrash: () => void;
  onOpenLibrary: () => void;
  onSelectPage: (id: string) => void;
}

export function Sidebar({
  theme,
  onToggleTheme,
  onCollapse,
  onSignOut,
  onOpenTrash,
  onOpenLibrary,
  onSelectPage,
}: SidebarProps) {
  const { state, dispatch, favorites, trash } = useWorkspace();
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
  const [popupOpen, setPopupOpen] = useState(false);

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

  const rootPages = useMemo(() => {
    return state.rootOrder.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page));
  }, [state.rootOrder, state.pages]);

  const teamspaces = rootPages.filter((page) => page.children.length > 0);

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

  function createPage(parentId: string | null) {
    if (parentId) setOpen(parentId, true);
    dispatch({ type: "create_page", page: createEmptyPage(parentId) });
  }

  const favoritePages = useMemo(
    () => favorites.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page)),
    [favorites, state.pages],
  );

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
      {/* Top bar: toggle, inbox badge, compose */}
      <div className="sidebar-top">
        <button type="button" className="sidebar-toggle" aria-label="Collapse sidebar" onClick={onCollapse}>
          <SidebarIcon width={16} height={16} />
        </button>
        <button type="button" className="inbox-btn" aria-label="Inbox">
          <ChatIcon width={16} height={16} />
          <span className="inbox-badge">4</span>
        </button>
        <button type="button" className="compose-btn" aria-label="New page" onClick={() => createPage(null)}>
          <PlusIcon width={16} height={16} />
        </button>
      </div>

      {/* Search */}
      <label className="sidebar-search">
        <SearchIcon width={16} height={16} />
        <input
          value={query}
          placeholder="Search or ask"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search pages"
        />
        <span className="shortcut">Ctrl+K</span>
      </label>

      {/* Quick navigation */}
      <div className="sidebar-quick">
        <button type="button" className="nav-item is-active" aria-label="Home">
          <HomeIcon width={16} height={16} />
          <span>Home</span>
        </button>
        <button type="button" className="nav-item icon-only" aria-label="Chat">
          <ChatIcon width={16} height={16} />
        </button>
        <button type="button" className="nav-item icon-only" aria-label="Calendar">
          <CalendarIcon width={16} height={16} />
        </button>
      </div>

      <button
        type="button"
        className="nav-item"
        onClick={() => {
          setPopupOpen(false);
        }}
      >
        <ChatIcon width={16} height={16} />
        <span>New chat</span>
      </button>
      <button
        type="button"
        className="nav-item is-active"
        onClick={() => {
          onOpenLibrary();
        }}
      >
        <PageIcon width={16} height={16} />
        <span>Library</span>
      </button>

      {/* Upcoming events */}
      <div className="sidebar-section">
        <span className="sidebar-section-label">Upcoming events</span>
        <button
          type="button"
          className="calendar-link"
          onClick={() => setPopupOpen(false)}
        >
          <CalendarIcon width={14} height={14} />
          <span>Connect your calendar</span>
        </button>
      </div>

      {/* Teamspaces / search results */}
      {query.trim() ? (
        <>
          <div className="sidebar-section">
            <span className="sidebar-section-label">Results</span>
            {filtered.length === 0 ? (
              <p className="tree-empty">No pages match “{query.trim()}”.</p>
            ) : (
              filtered.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="page-item"
                  onClick={() => {
                    onSelectPage(page.id);
                    setPopupOpen(false);
                  }}
                >
                  <PageIcon width={14} height={14} />
                  <span>{page.title || "Untitled"}</span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="sidebar-section">
            <span className="sidebar-section-label">Teamspaces</span>
            {teamspaces.map((teamspace) => (
              <div key={teamspace.id} className="teamspace-group">
                <button
                  type="button"
                  className="teamspace-item"
                  onClick={() => {
                    onSelectPage(teamspace.id);
                    setPopupOpen(false);
                  }}
                >
                  <HouseIcon width={16} height={16} style={{ color: "#d97706" }} />
                  <span>{teamspace.title || "Untitled"}</span>
                </button>
                {visibleExpanded.has(teamspace.id) &&
                  teamspace.children.map((childId) => {
                    const child = state.pages[childId];
                    if (!child) return null;
                    return (
                      <button
                        key={childId}
                        type="button"
                        className={`page-item${child.id === state.activePageId ? " is-active" : ""}`}
                        onClick={() => {
                          onSelectPage(child.id);
                          setPopupOpen(false);
                        }}
                      >
                        <PageIcon width={14} height={14} />
                        <span>{child.title || "Untitled"}</span>
                      </button>
                    );
                  })}
              </div>
            ))}
            {teamspaces.length === 0 && <p className="tree-empty">No teamspaces yet.</p>}
          </div>

          <div className="sidebar-section">
            <span className="sidebar-section-label">Private</span>
            <button
              type="button"
              className="page-item"
              onClick={() => {
                setPopupOpen(false);
              }}
            >
              <GettingStartedIcon width={14} height={14} />
              <span>Getting Started</span>
            </button>
            <button
              type="button"
              className="page-item"
              onClick={() => {
                setPopupOpen(false);
              }}
            >
              <TeamIcon width={14} height={14} />
              <span>TEAM 7</span>
            </button>
            <button type="button" className="page-item add-new" onClick={() => createPage(null)}>
              <span aria-hidden="true">+</span> Add new
            </button>
          </div>
        </>
      )}

      {/* Favorites */}
      {favoritePages.length > 0 && (
        <div className="sidebar-section sidebar-section-stack">
          <span className="sidebar-section-label">Favorites</span>
          <div className="favorite-list">
            {favoritePages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`favorite-item${page.id === state.activePageId ? " is-active" : ""}`}
                onClick={() => {
                  onSelectPage(page.id);
                  setPopupOpen(false);
                }}
              >
                <span className="tree-icon">{page.icon ?? <PageIcon />}</span>
                <span className="tree-title">{page.title || "Untitled"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="sidebar-section sidebar-section-stack">
        <span className="sidebar-section-label">Templates</span>
        <div className="template-list">
          {Object.entries(state.templates ?? {}).map(([id, t]) => (
            <div key={id} className="template-item">
              <button
                type="button"
                className="template-item-main"
                onClick={() => {
                  dispatch({ type: "create_page_from_template", templateId: id, parentId: null });
                  setPopupOpen(false);
                }}
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
        <button
          type="button"
          className="footer-row"
          onClick={() => setPopupOpen(true)}
        >
          <CustomizeIcon width={16} height={16} />
          <span>Customize sidebar</span>
        </button>
        <div className="footer-switcher">
          <UserIcon width={16} height={16} />
          <span>Team 6</span>
          <ChevronIcon width={10} height={10} />
        </div>
        <button type="button" className="footer-icon" aria-label="Help">
          <HelpIcon width={16} height={16} />
        </button>
        <button type="button" className="footer-icon grid-btn" onClick={() => setPopupOpen(true)}>
          <GridIcon width={16} height={16} />
        </button>
        <button type="button" className="footer-row" onClick={onOpenTrash}>
          <TrashIcon width={16} height={16} />
          <span>Trash</span>
          {trash.length > 0 && <span className="footer-count">{trash.length}</span>}
        </button>
        <button type="button" className="footer-row" onClick={onToggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <button type="button" className="footer-row" onClick={onSignOut}>
          <LogOutIcon width={16} height={16} />
          <span>Log out</span>
        </button>
        <button
          type="button"
          className="footer-row footer-reset"
          aria-label="Reset workspace"
          onClick={handleReset}
        >
          <span aria-hidden="true">↺</span>
          <span>Reset workspace</span>
        </button>
      </div>

      {/* Popup menu (app launcher) */}
      {popupOpen && (
        <div className="popup-backdrop" onClick={() => setPopupOpen(false)}>
          <div className="popup" onClick={(event) => event.stopPropagation()}>
            <div className="popup-item">Library</div>
            <div className="popup-item">AI Meeting Notes</div>
            <div className="popup-item">Skills</div>
            <div className="popup-item">My Tasks</div>
            <div className="popup-item popup-hover">Marketplace</div>
            <div className="popup-item">Trash</div>
          </div>
        </div>
      )}
    </aside>
  );
}
