import { PageIcon, TrashIcon } from "./icons";
import { useWorkspace } from "../store/useWorkspace";

function deletedLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / day);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function TrashView() {
  const { trash, restoreFromTrash, deleteForever } = useWorkspace();

  function handleEmpty() {
    if (trash.length === 0) return;
    if (!window.confirm("Delete everything in Trash permanently? This cannot be undone.")) return;
    for (const entry of trash) deleteForever(entry.id);
  }

  return (
    <main className="page-scroll">
      <div className="page-topbar">
        <div className="page-breadcrumbs">
          <span className="crumb-current">Trash</span>
        </div>
        <div className="page-actions">
          {trash.length > 0 && (
            <button type="button" className="page-share-btn" onClick={handleEmpty}>
              Empty trash
            </button>
          )}
        </div>
      </div>

      <div className="page trash-page">
        <h1 className="trash-heading">Trash</h1>
        <p className="trash-note">Items in Trash are deleted after 30 days.</p>

        {trash.length === 0 ? (
          <div className="trash-empty">
            <TrashIcon width={22} height={22} />
            <p>Trash is empty.</p>
          </div>
        ) : (
          <div className="trash-list">
            {trash.map((entry) => (
              <div key={entry.id} className="trash-entry">
                <span className="trash-entry-icon">{entry.icon ?? <PageIcon />}</span>
                <span className="trash-entry-copy">
                  <span className="trash-entry-title">{entry.title}</span>
                  <small>
                    {entry.pages.length > 1 ? `${entry.pages.length} pages · ` : ""}
                    Deleted {deletedLabel(entry.deletedAt)}
                  </small>
                </span>
                <span className="trash-entry-actions">
                  <button
                    type="button"
                    className="trash-entry-btn"
                    onClick={() => restoreFromTrash(entry.id)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="trash-entry-btn is-danger"
                    onClick={() => deleteForever(entry.id)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
