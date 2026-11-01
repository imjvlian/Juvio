import { useWorkspace } from "../store/useWorkspace";
import { PlusIcon } from "./icons";

export function LibraryView() {
  const { trash, deleteForever } = useWorkspace();

  function handleEmpty() {
    if (trash.length === 0) return;
    if (!window.confirm("Delete everything in Trash permanently? This cannot be undone.")) return;
    for (const entry of trash) deleteForever(entry.id);
  }

  return (
    <main className="page-scroll">
      <div className="page-topbar">
        <div className="page-breadcrumbs">
          <span className="crumb-current">Library</span>
        </div>
        <div className="page-actions">
          <button type="button" className="page-share-btn" onClick={handleEmpty}>
            Empty trash
          </button>
        </div>
      </div>

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
                  <span className="th-icon">⌨</span>
                  Name
                </th>
                <th className="col-desc">
                  <span className="th-icon">☰</span>
                  Description
                </th>
                <th className="col-access">
                  <span className="th-icon">👥</span>
                  Access
                </th>
                <th className="col-members">
                  <span className="th-icon">👤</span>
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
          onClick={() => {
            // Placeholder: create a new teamspace/workspace.
          }}
        >
          <PlusIcon width={16} height={16} />
          <span>New teamspace</span>
        </button>
      </div>
    </main>
  );
}
