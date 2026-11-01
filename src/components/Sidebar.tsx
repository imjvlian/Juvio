import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { Page } from "../types";
import { createEmptyPage } from "../lib/seed";
import { isTeamspacePage } from "../lib/pages";
import { resetWorkspace } from "../lib/storage";
import { useWorkspace } from "../store/useWorkspace";
import { PageGlyph } from "./PageGlyph";
import {
  BookOpenIcon,
  CalendarIcon,
  ChatIcon,
  CheckSquareIcon,
  ChevronIcon,
  ComposeIcon,
  CustomizeIcon,
  FileLinesIcon,
  GiftIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  LockIcon,
  PageIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  StoreIcon,
  TrashIcon,
  WrenchIcon,
} from "./icons";

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onCollapse: () => void;
  onSignOut: () => void;
  onOpenTrash: () => void;
  onOpenLibrary: () => void;
  onSelectPage: (id: string) => void;
  currentRoute: string;
}

type MenuIcon = ComponentType<{ width?: number; height?: number }>;

const APP_MENU: Array<{ label: string; icon: MenuIcon; target: "library" | "trash" }> = [
  { label: "Library", icon: LibraryIcon, target: "library" },
  { label: "AI Meeting Notes", icon: FileLinesIcon, target: "library" },
  { label: "Skills", icon: WrenchIcon, target: "library" },
  { label: "My Tasks", icon: CheckSquareIcon, target: "library" },
  { label: "Marketplace", icon: StoreIcon, target: "library" },
  { label: "Trash", icon: TrashIcon, target: "trash" },
];

export function Sidebar({
  theme,
  onToggleTheme,
  onCollapse,
  onSignOut,
  onOpenTrash,
  onOpenLibrary,
  onSelectPage,
  currentRoute,
}: SidebarProps) {
  const {
    state,
    dispatch,
    favorites,
    trash,
    workspaceName,
    inbox,
    seenPageIds,
    unreadInboxCount,
    markInboxSeen,
    refreshInbox,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!popupOpen && !teamMenuOpen && !inboxOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPopupOpen(false);
        setTeamMenuOpen(false);
        setInboxOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popupOpen, teamMenuOpen, inboxOpen]);

  const rootPages = useMemo(
    () => state.rootOrder.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page)),
    [state.rootOrder, state.pages],
  );

  const teamspaces = rootPages.filter(isTeamspacePage);
  const privatePages = rootPages.filter((page) => !isTeamspacePage(page));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return Object.values(state.pages)
      .filter(
        (page) =>
          (page.title || "untitled").toLowerCase().includes(needle) ||
          (page.icon ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [query, state.pages]);

  const favoritePages = useMemo(
    () => favorites.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page)),
    [favorites, state.pages],
  );

  function createPage(parentId: string | null) {
    dispatch({ type: "create_page", page: createEmptyPage(parentId) });
  }

  function handleReset() {
    if (!window.confirm("Reset the workspace? Local pages will be replaced by the sample pages.")) return;
    dispatch({ type: "reset", state: resetWorkspace() });
    setQuery("");
  }

  function closeMenus() {
    setPopupOpen(false);
    setTeamMenuOpen(false);
    setInboxOpen(false);
  }

  function toggleChild(parentId: string) {
    setExpandedChildren((current) => {
      const next = new Set(current);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  function inboxLabel(timestamp: number, now: number): string {
    const diff = now - timestamp;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "just now";
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
        >
          <SidebarIcon width={16} height={16} />
        </button>
        <div className="sidebar-top-actions">
          <button
            type="button"
            className="topbar-icon"
            aria-label="Inbox"
            aria-expanded={inboxOpen}
            onClick={() => {
              setInboxOpen((open) => !open);
              setPopupOpen(false);
              setTeamMenuOpen(false);
              refreshInbox();
            }}
          >
            <InboxIcon width={17} height={17} />
            {unreadInboxCount > 0 && <span className="inbox-badge">{unreadInboxCount}</span>}
          </button>
          <button
            type="button"
            className="topbar-icon"
            aria-label="New page"
            title="New page"
            onClick={() => createPage(null)}
          >
            <ComposeIcon width={17} height={17} />
          </button>
        </div>
      </div>

      {inboxOpen && (
        <>
          <div className="menu-scrim" onClick={() => setInboxOpen(false)} />
          <div className="popup inbox-panel" role="dialog" aria-label="Inbox">
            <div className="inbox-panel-header">Inbox</div>
            {inbox.length === 0 ? (
              <p className="inbox-empty">No updates from your team yet.</p>
            ) : (
              inbox.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="inbox-item"
                  onClick={() => {
                    markInboxSeen(item.id);
                    onSelectPage(item.id);
                    setInboxOpen(false);
                  }}
                >
                  <PageGlyph icon={item.icon} size={16} />
                  <span className="inbox-item-copy">
                    <span className="inbox-item-title">{item.title}</span>
                    <small className="inbox-item-time">Updated {inboxLabel(item.updatedAt, now)}</small>
                  </span>
                  {!seenPageIds.has(item.id) && <span className="inbox-unread-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </>
      )}

      <label className="sidebar-search">
        <SearchIcon width={15} height={15} />
        <input
          value={query}
          placeholder="Search or ask"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search pages"
        />
        <span className="shortcut">Ctrl+K</span>
      </label>

      <div className="sidebar-quick">
        <button
          type="button"
          className={`quick-home${currentRoute === "library" ? " is-current" : ""}`}
          onClick={onOpenLibrary}
        >
          <HomeIcon width={15} height={15} />
          <span>Home</span>
        </button>
        <button type="button" className="quick-icon" aria-label="Chat" title="Chat">
          <ChatIcon width={16} height={16} />
        </button>
        <button type="button" className="quick-icon" aria-label="Calendar" title="Calendar">
          <CalendarIcon width={16} height={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <button type="button" className="nav-item" title="Chat is coming soon">
          <ChatIcon width={16} height={16} />
          <span>New chat</span>
        </button>
        <button
          type="button"
          className={`nav-item${currentRoute === "library" ? " is-active" : ""}`}
          onClick={onOpenLibrary}
          aria-current={currentRoute === "library" ? "page" : undefined}
        >
          <LibraryIcon width={16} height={16} />
          <span>Library</span>
        </button>
      </nav>

      {query.trim() ? (
        <div className="sidebar-section">
          <span className="sidebar-section-label">Results</span>
          {filtered.length === 0 ? (
            <p className="tree-empty">No pages match “{query.trim()}”.</p>
          ) : (
            filtered.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`page-item${currentRoute === page.id ? " is-active" : ""}`}
                onClick={() => {
                  onSelectPage(page.id);
                  closeMenus();
                }}
              >
                <PageGlyph icon={page.icon} size={16} />
                <span className="page-item-title">{page.title || "Untitled"}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="sidebar-section">
            <span className="sidebar-section-label">Upcoming events</span>
            <button type="button" className="page-item calendar-link">
              <span className="calendar-icon" aria-hidden="true">
                <CalendarIcon width={16} height={16} />
                <span className="calendar-day">31</span>
              </span>
              <span className="page-item-title">Connect your calendar</span>
            </button>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-section-label">Teamspaces</span>
            {teamspaces.map((teamspace) => (
              <div key={teamspace.id} className="teamspace-group">
                <button
                  type="button"
                  className={`page-item teamspace-item${currentRoute === teamspace.id ? " is-active" : ""}`}
                  onClick={() => {
                    onSelectPage(teamspace.id);
                    closeMenus();
                  }}
                >
                  <span className="teamspace-badge" aria-hidden="true">
                    <PageGlyph icon={teamspace.icon ?? "home-orange"} size={14} />
                  </span>
                  <span className="page-item-title">{teamspace.title || "Untitled"}</span>
                </button>
                {teamspace.children.map((childId) => {
                  const child = state.pages[childId];
                  if (!child) return null;
                  const grandchildren = child.children
                    .map((id) => state.pages[id])
                    .filter((page): page is Page => Boolean(page));
                  const isOpen = expandedChildren.has(child.id);
                  return (
                    <div key={childId} className="teamspace-group">
                      <div className={`page-item subpage-item${currentRoute === child.id ? " is-active" : ""}`}>
                        {grandchildren.length > 0 ? (
                          <button
                            type="button"
                            className={`tree-expander${isOpen ? " is-open" : ""}`}
                            aria-label={isOpen ? `Collapse ${child.title}` : `Expand ${child.title}`}
                            onClick={() => toggleChild(child.id)}
                          >
                            <ChevronIcon width={12} height={12} />
                          </button>
                        ) : (
                          <span className="tree-expander-placeholder" />
                        )}
                        <button
                          type="button"
                          className="tree-item-button"
                          onClick={() => {
                            onSelectPage(child.id);
                            closeMenus();
                          }}
                        >
                          <PageGlyph icon={child.icon} size={16} />
                          <span className="page-item-title">{child.title || "Untitled"}</span>
                        </button>
                      </div>
                      {isOpen &&
                        grandchildren.map((grandchild) => (
                          <button
                            key={grandchild.id}
                            type="button"
                            className={`page-item nested-item${currentRoute === grandchild.id ? " is-active" : ""}`}
                            onClick={() => {
                              onSelectPage(grandchild.id);
                              closeMenus();
                            }}
                          >
                            <PageGlyph icon={grandchild.icon} size={16} />
                            <span className="page-item-title">{grandchild.title || "Untitled"}</span>
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            ))}
            {teamspaces.length === 0 && <p className="tree-empty">No teamspaces yet.</p>}
          </div>

          <div className="sidebar-section">
            <span className="sidebar-section-label">Private</span>
            {privatePages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`page-item${currentRoute === page.id ? " is-active" : ""}`}
                onClick={() => {
                  onSelectPage(page.id);
                  closeMenus();
                }}
              >
                <PageGlyph icon={page.icon} size={16} />
                <span className="page-item-title">{page.title || "Untitled"}</span>
              </button>
            ))}
            <button type="button" className="page-item add-new" onClick={() => createPage(null)}>
              <PlusIcon width={16} height={16} />
              <span>Add new</span>
            </button>
          </div>
        </>
      )}

      {favoritePages.length > 0 && !query.trim() && (
        <div className="sidebar-section">
          <span className="sidebar-section-label">Favorites</span>
          {favoritePages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`page-item${currentRoute === page.id ? " is-active" : ""}`}
              onClick={() => {
                onSelectPage(page.id);
                closeMenus();
              }}
            >
              <PageGlyph icon={page.icon} size={16} />
              <span className="page-item-title">{page.title || "Untitled"}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-spacer" />

      <button type="button" className="sidebar-customize" onClick={() => setTeamMenuOpen(true)}>
        <CustomizeIcon width={16} height={16} />
        <span>Customize sidebar</span>
      </button>

      <div className="sidebar-footerbar">
        <button
          type="button"
          className={`footer-team${teamMenuOpen ? " is-open" : ""}`}
          aria-haspopup="menu"
          aria-expanded={teamMenuOpen}
          onClick={() => {
            setTeamMenuOpen((open) => !open);
            setPopupOpen(false);
          }}
        >
          <span className="team-avatar" aria-hidden="true">
            {workspaceName.trim().charAt(0).toUpperCase() || "T"}
          </span>
          <span className="team-name">{workspaceName}</span>
          <ChevronIcon className="team-chevron" width={12} height={12} />
        </button>
        <div className="footer-actions">
          <button type="button" className="footer-icon is-gift" aria-label="What's new">
            <GiftIcon width={16} height={16} />
          </button>
          <button type="button" className="footer-icon" aria-label="Help">
            <HelpIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className={`footer-icon${popupOpen ? " is-open" : ""}`}
            aria-label="Browse apps"
            aria-haspopup="menu"
            aria-expanded={popupOpen}
            onClick={() => {
              setPopupOpen((open) => !open);
              setTeamMenuOpen(false);
            }}
          >
            <GridIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {teamMenuOpen && (
        <>
          <div className="menu-scrim" onClick={() => setTeamMenuOpen(false)} />
          <div className="popup team-menu" role="menu" aria-label="Team settings">
            <button
              type="button"
              className="popup-item"
              role="menuitem"
              onClick={() => {
                setTeamMenuOpen(false);
                onToggleTheme();
              }}
            >
              {theme === "dark" ? <HomeIcon width={16} height={16} /> : <LockIcon width={16} height={16} />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button
              type="button"
              className="popup-item"
              role="menuitem"
              onClick={() => {
                setTeamMenuOpen(false);
                onOpenTrash();
              }}
            >
              <TrashIcon width={16} height={16} />
              <span>Trash{trash.length > 0 ? ` (${trash.length})` : ""}</span>
            </button>
            <div className="popup-separator" />
            <button
              type="button"
              className="popup-item"
              role="menuitem"
              onClick={() => {
                setTeamMenuOpen(false);
                onSignOut();
              }}
            >
              <PageIcon width={16} height={16} />
              <span>Log out</span>
            </button>
            <button
              type="button"
              className="popup-item is-danger"
              role="menuitem"
              onClick={() => {
                setTeamMenuOpen(false);
                handleReset();
              }}
            >
              <BookOpenIcon width={16} height={16} />
              <span>Reset workspace</span>
            </button>
          </div>
        </>
      )}

      {popupOpen && (
        <>
          <div className="menu-scrim" onClick={() => setPopupOpen(false)} />
          <div className="popup app-menu" role="menu" aria-label="Browse apps">
            {APP_MENU.map((item) => (
              <button
                key={item.label}
                type="button"
                className="popup-item"
                role="menuitem"
                onClick={() => {
                  setPopupOpen(false);
                  if (item.target === "trash") onOpenTrash();
                  else onOpenLibrary();
                }}
              >
                <item.icon width={16} height={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
