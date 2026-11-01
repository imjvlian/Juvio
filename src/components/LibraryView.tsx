import { useState } from "react";
import { PlusIcon } from "./icons";

export function LibraryView() {
  const [newTeamspaceOpen, setNewTeamspaceOpen] = useState(false);
  const [newTeamspaceName, setNewTeamspaceName] = useState("");

  function handleCreateTeamspace() {
    const name = newTeamspaceName.trim();
    if (!name) return;
    setNewTeamspaceOpen(false);
    setNewTeamspaceName("");
    // Placeholder: create a new teamspace/workspace.
  }

  return (
    <main className="page-scroll">
      <div className="page library-page">
        <h1 className="library-heading">Library</h1>
        <p className="library-note">All your teamspaces and pages in one place.</p>

        <div className="library-tabs">
          <button type="button" className="tab is-active">
            <span className="tab-icon">🏢</span>
            Teamspaces
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">🕒</span>
            Recents
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">★</span>
            Favorites
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">👥</span>
            Shared
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">🔒</span>
            Private
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">🤖</span>
            AI Meeting Notes
          </button>
          <button type="button" className="tab">
            <span className="tab-icon">🛠</span>
            Skills
          </button>
          <button type="button" className="tab-search" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </div>

        <div className="library-table-wrap">
          <table className="library-table">
            <thead>
              <tr>
                <th className="col-name">
                  <span className="th-icon">🏠</span>
                  Name
                </th>
                <th className="col-desc">
                  <span className="th-icon">☰</span>
                  Description
                </th>
                <th className="col-access">
                  <span className="th-icon">🌐</span>
                  Access
                </th>
                <th className="col-members">
                  <span className="th-icon">👥</span>
                  Members
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="library-row">
                <td className="col-name">
                  <button type="button" className="row-link">
                    <span className="row-expand">▶</span>
                    <span className="row-icon">🏠</span>
                    <span className="row-title">Team 6 HQ</span>
                  </button>
                </td>
                <td className="col-desc"></td>
                <td className="col-access">
                  <span className="pill pill-default">Default</span>
                </td>
                <td className="col-members">2</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="new-teamspace-btn"
          onClick={() => setNewTeamspaceOpen(true)}
        >
          <PlusIcon width={16} height={16} />
          <span>New teamspace</span>
        </button>

        {/* New teamspace dialog */}
        {newTeamspaceOpen && (
          <div className="popup-backdrop" onClick={() => setNewTeamspaceOpen(false)}>
            <div className="popup dialog-popup" onClick={(event) => event.stopPropagation()}>
              <div className="dialog-header">New teamspace</div>
              <input
                type="text"
                placeholder="Teamspace name"
                value={newTeamspaceName}
                onChange={(event) => setNewTeamspaceName(event.target.value)}
                autoFocus
                className="dialog-input"
              />
              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={() => setNewTeamspaceOpen(false)}
                  className="dialog-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTeamspace}
                  disabled={!newTeamspaceName.trim()}
                  className="dialog-btn-save"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
