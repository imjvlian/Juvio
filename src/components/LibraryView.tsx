import { useMemo, useState } from "react";
import type { Page } from "../types";
import { createEmptyPage } from "../lib/seed";
import { isTeamspacePage } from "../lib/pages";
import { useWorkspace } from "../store/useWorkspace";
import { PageGlyph } from "./PageGlyph";
import {
  ChevronIcon,
  ClockIcon,
  FileLinesIcon,
  GlobeIcon,
  LibraryIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  UsersIcon,
  WrenchIcon,
} from "./icons";

type TabId = "teamspaces" | "recents" | "favorites" | "shared" | "private" | "notes" | "skills";

interface LibraryViewProps {
  onSelectPage: (id: string) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof LibraryIcon }> = [
  { id: "teamspaces", label: "Teamspaces", icon: LibraryIcon },
  { id: "recents", label: "Recents", icon: ClockIcon },
  { id: "favorites", label: "Favorites", icon: SparkleIcon },
  { id: "shared", label: "Shared", icon: UsersIcon },
  { id: "private", label: "Private", icon: LockIcon },
  { id: "notes", label: "AI Meeting Notes", icon: FileLinesIcon },
  { id: "skills", label: "Skills", icon: WrenchIcon },
];

export function LibraryView({ onSelectPage }: LibraryViewProps) {
  const { state, dispatch, favorites, memberCount } = useWorkspace();
  const [tab, setTab] = useState<TabId>("teamspaces");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const rootPages = useMemo(
    () => state.rootOrder.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page)),
    [state.rootOrder, state.pages],
  );

  const teamspaces = rootPages.filter(isTeamspacePage);
  const privatePages = rootPages.filter((page) => !isTeamspacePage(page));
  const recentPages = useMemo(
    () => Object.values(state.pages).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20),
    [state.pages],
  );
  const favoritePages = useMemo(
    () => favorites.map((id) => state.pages[id]).filter((page): page is Page => Boolean(page)),
    [favorites, state.pages],
  );

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreateTeamspace() {
    const name = newName.trim();
    if (!name) return;
    const page = createEmptyPage(null, name);
    page.icon = "home-orange";
    dispatch({ type: "create_page", page, select: false });
    setDialogOpen(false);
    setNewName("");
  }

  function renderEmpty(message: string) {
    return <p className="library-empty">{message}</p>;
  }

  function renderPageList(pages: Page[], emptyMessage: string) {
    if (pages.length === 0) return renderEmpty(emptyMessage);
    return (
      <div className="library-list">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className="library-list-item"
            onClick={() => onSelectPage(page.id)}
          >
            <PageGlyph icon={page.icon} size={16} />
            <span>{page.title || "Untitled"}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <main className="page-scroll library-scroll">
      <div className="library-page">
        <header className="library-header">
          <h1 className="library-heading">Library</h1>
          <button
            type="button"
            className="new-teamspace-btn"
            onClick={() => {
              setNewName("");
              setDialogOpen(true);
            }}
          >
            <PlusIcon width={16} height={16} />
            <span>New teamspace</span>
          </button>
        </header>

        <div className="library-tabs" role="tablist" aria-label="Library filters">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`tab${tab === entry.id ? " is-active" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              <entry.icon width={16} height={16} />
              <span>{entry.label}</span>
            </button>
          ))}
          <button type="button" className="tab-search" aria-label="Search library">
            <SearchIcon width={16} height={16} />
          </button>
        </div>

        {tab === "teamspaces" && (
          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th className="col-name">
                    <LibraryIcon width={14} height={14} />
                    <span>Name</span>
                  </th>
                  <th className="col-desc">
                    <FileLinesIcon width={14} height={14} />
                    <span>Description</span>
                  </th>
                  <th className="col-access">
                    <GlobeIcon width={14} height={14} />
                    <span>Access</span>
                  </th>
                  <th className="col-members">
                    <UsersIcon width={14} height={14} />
                    <span>Members</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamspaces.map((teamspace) => (
                  <TeamspaceRows
                    key={teamspace.id}
                    teamspace={teamspace}
                    memberCount={memberCount}
                    expanded={expanded.has(teamspace.id)}
                    onToggle={() => toggleExpanded(teamspace.id)}
                    onSelectPage={onSelectPage}
                  />
                ))}
                {teamspaces.length === 0 && (
                  <tr>
                    <td className="col-name" colSpan={4}>
                      {renderEmpty("No teamspaces yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "recents" && renderPageList(recentPages, "No recent pages.")}
        {tab === "favorites" && renderPageList(favoritePages, "No favorites yet.")}
        {tab === "private" && renderPageList(privatePages, "No private pages.")}
        {tab === "shared" && renderEmpty("Shared pages will appear here.")}
        {tab === "notes" && renderEmpty("AI Meeting Notes are not connected yet.")}
        {tab === "skills" && renderEmpty("Skills are not connected yet.")}
      </div>

      {dialogOpen && (
        <div className="dialog-backdrop" onClick={() => setDialogOpen(false)}>
          <div
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-label="New teamspace"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">New teamspace</div>
            <input
              type="text"
              className="dialog-input"
              placeholder="Teamspace name"
              value={newName}
              autoFocus
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateTeamspace();
              }}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-btn-cancel"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dialog-btn-save"
                disabled={!newName.trim()}
                onClick={handleCreateTeamspace}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TeamspaceRows({
  teamspace,
  memberCount,
  expanded,
  onToggle,
  onSelectPage,
}: {
  teamspace: Page;
  memberCount: number;
  expanded: boolean;
  onToggle: () => void;
  onSelectPage: (id: string) => void;
}) {
  const { state } = useWorkspace();
  return (
    <>
      <tr className="library-row">
        <td className="col-name">
          <button type="button" className="row-link" onClick={() => onSelectPage(teamspace.id)}>
            <span
              className={`row-expand${expanded ? " is-open" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={expanded ? `Collapse ${teamspace.title}` : `Expand ${teamspace.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggle();
                }
              }}
            >
              <ChevronIcon width={12} height={12} />
            </span>
            <span className="teamspace-badge" aria-hidden="true">
              <PageGlyph icon={teamspace.icon ?? "home-orange"} size={14} />
            </span>
            <span className="row-title">{teamspace.title || "Untitled"}</span>
          </button>
        </td>
        <td className="col-desc"></td>
        <td className="col-access">
          <span className="access-cell">
            <GlobeIcon width={14} height={14} />
            Default
          </span>
        </td>
        <td className="col-members">{memberCount}</td>
      </tr>
      {expanded &&
        teamspace.children.map((childId) => {
          const child = state.pages[childId];
          if (!child) return null;
          return (
            <tr key={child.id} className="library-row is-child">
              <td className="col-name">
                <button type="button" className="row-link" onClick={() => onSelectPage(child.id)}>
                  <span className="row-expand row-expand-placeholder" />
                  <PageGlyph icon={child.icon} size={16} />
                  <span className="row-title is-child">{child.title || "Untitled"}</span>
                </button>
              </td>
              <td className="col-desc"></td>
              <td className="col-access"></td>
              <td className="col-members"></td>
            </tr>
          );
        })}
    </>
  );
}
