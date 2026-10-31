import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { listWorkspacesForUser, createWorkspaceInSupabase } from "../../lib/supabase-storage";
import type { WorkspaceInfo } from "../../lib/supabase-storage";

interface WorkspaceListProps {
  userId: string;
  onSelectWorkspace: (workspaceId: string) => void;
}

export function WorkspaceList({ userId, onSelectWorkspace }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listWorkspacesForUser(userId);
      setWorkspaces(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWorkspaces();
  }, [userId, loadWorkspaces]);

  async function handleCreateWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const result = await createWorkspaceInSupabase(userId, newName.trim());
      if (result) {
        setWorkspaces((prev) => [
          { id: result.workspaceId, name: newName.trim(), role: "owner", isOwner: true },
          ...prev,
        ]);
        setNewName("");
        onSelectWorkspace(result.workspaceId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create workspace.");
    } finally {
      setCreating(false);
    }
  }

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">Loading workspaces…</div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="workspace-card">
        <div className="workspace-header">
          <div className="workspace-brand">Juvio</div>
          <button
            type="button"
            className="auth-button ghost"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
        <h2>Your workspaces</h2>
        {error && <div className="auth-error">{error}</div>}
        <ul className="workspace-list">
          {workspaces.length === 0 && (
            <li className="workspace-empty">No workspaces yet. Create one below.</li>
          )}
          {workspaces.map((ws) => (
            <li key={ws.id} className="workspace-item">
              <button
                type="button"
                className="workspace-button"
                onClick={() => onSelectWorkspace(ws.id)}
              >
                <span className="workspace-name">{ws.name}</span>
                {ws.isOwner && <span className="workspace-owner">(you)</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="workspace-divider">Or create a new workspace</div>
        <form onSubmit={handleCreateWorkspace} className="workspace-form">
          <div className="auth-field">
            <label>Workspace name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. My Team"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="auth-button" disabled={creating}>
            {creating ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
