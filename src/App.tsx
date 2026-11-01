import { useEffect, useRef, useState, useCallback } from "react";
import { PageEditor } from "./components/PageEditor";
import { Sidebar } from "./components/Sidebar";
import { TrashView } from "./components/TrashView";
import { SidebarIcon } from "./components/icons";
import { WorkspaceProvider } from "./store/WorkspaceContext";
import { useWorkspace } from "./store/useWorkspace";
import { supabase } from "./lib/supabase";
import { LoginForm } from "./components/auth/LoginForm";
import { WorkspaceList } from "./components/auth/WorkspaceList";

const THEME_KEY = "juvio.theme.v1";
const SIDEBAR_KEY = "juvio.sidebar.open.v1";
const WORKSPACE_ID_KEY = "juvio.workspace.id.v1";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Fall back to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "dark";
}

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "closed";
  } catch {
    return true;
  }
}

function readWorkspaceId(): string | null {
  try {
    const stored = localStorage.getItem(WORKSPACE_ID_KEY);
    if (stored && stored !== "null") return stored;
  } catch {
    // Fall back to no workspace.
  }
  return null;
}

function Shell() {
  const {
    state,
    dispatch,
    isLoading,
    canUndo,
    canRedo,
    undo,
    redo,
    lastTrashed,
    clearLastTrashed,
    restoreFromTrash,
  } = useWorkspace();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readSidebarOpen);
  const [showTrash, setShowTrash] = useState(false);

  const openTrash = useCallback(() => {
    setShowTrash(true);
    window.history.replaceState(null, "", "#/trash");
  }, []);

  const selectPage = useCallback(
    (id: string) => {
      setShowTrash(false);
      window.history.replaceState(null, "", `#/${id}`);
      dispatch({ type: "select_page", id });
    },
    [dispatch],
  );

  // Selecting a page leaves the Trash view.
  const lastActiveRef = useRef(state.activePageId);
  useEffect(() => {
    if (isLoading) {
      lastActiveRef.current = state.activePageId;
      return;
    }
    if (lastActiveRef.current === state.activePageId) return;
    lastActiveRef.current = state.activePageId;
    setShowTrash(false);
    if (state.activePageId && window.location.hash === "#/trash") {
      window.history.replaceState(null, "", `#/${state.activePageId}`);
    }
  }, [isLoading, state.activePageId]);

  // Keep the URL in sync with the active page so links can be shared or refreshed.
  // A deep link wins over the restored selection once the workspace has loaded.
  useEffect(() => {
    if (isLoading) return;
    const hashId = window.location.hash.replace(/^#\/?/, "");
    if (hashId === "trash") {
      setShowTrash(true);
      return;
    }
    if (hashId && hashId !== state.activePageId && state.pages[hashId]) {
      setShowTrash(false);
      dispatch({ type: "select_page", id: hashId });
      return;
    }
    if (showTrash || !state.activePageId) return;
    const next = `#/${state.activePageId}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [isLoading, state.activePageId, state.pages, dispatch, showTrash]);

  // Follow hash edits made by the user (address bar, pasted links).
  const pagesRef = useRef(state.pages);
  useEffect(() => {
    pagesRef.current = state.pages;
  }, [state.pages]);
  useEffect(() => {
    function applyHash() {
      const id = window.location.hash.replace(/^#\/?/, "");
      if (id === "trash") {
        setShowTrash(true);
        return;
      }
      if (id && pagesRef.current[id]) {
        dispatch({ type: "select_page", id });
      }
    }
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [dispatch]);

  // Auto-dismiss the "moved to Trash" toast.
  useEffect(() => {
    if (!lastTrashed) return;
    const timer = window.setTimeout(clearLastTrashed, 6000);
    return () => window.clearTimeout(timer);
  }, [lastTrashed, clearLastTrashed]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "open" : "closed");
    } catch {
      // Sidebar persistence is optional.
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (showTrash) {
      document.title = "Trash · Juvio";
      return;
    }
    const page = state.activePageId ? state.pages[state.activePageId] : undefined;
    document.title = page?.title ? `${page.title} · Juvio` : "Juvio";
  }, [showTrash, state.activePageId, state.pages]);

  // Global keyboard shortcuts: undo / redo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? event.metaKey : event.ctrlKey;

      if (!mod || event.altKey) return;

      if (event.key === "z" && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          undo();
        }
        return;
      }

      if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        if (canRedo) {
          event.preventDefault();
          redo();
        }
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  if (isLoading) {
    return (
      <div className="app">
        <div className="auth-page">
          <div className="auth-card">Loading workspace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${sidebarOpen ? "" : " is-sidebar-collapsed"}`}>
      {sidebarOpen ? (
        <Sidebar
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          onCollapse={() => setSidebarOpen(false)}
          onSignOut={handleSignOut}
          onOpenTrash={openTrash}
          onSelectPage={selectPage}
        />
      ) : (
        <button
          type="button"
          className="sidebar-reveal"
          aria-label="Show sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <SidebarIcon />
        </button>
      )}
      {showTrash ? (
        <TrashView />
      ) : (
        <PageEditor key={state.activePageId ?? "empty"} />
      )}
      {lastTrashed && (
        <div className="trash-toast" role="status">
          <span className="trash-toast-text">“{lastTrashed.title}” moved to Trash</span>
          <button
            type="button"
            className="trash-toast-undo"
            onClick={() => restoreFromTrash(lastTrashed.entryId)}
          >
            Undo
          </button>
          <button
            type="button"
            className="trash-toast-close"
            aria-label="Dismiss"
            onClick={clearLastTrashed}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

type AppView = "login" | "workspaces" | "editor";

export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(readWorkspaceId());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session on load.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setLoading(false);
        return;
      }
      setUser({ id: data.session.user.id, email: data.session.user.email ?? null });
      setView(workspaceId ? "editor" : "workspaces");
      setLoading(false);
    });

    // Listen for auth changes (login, logout, refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session) {
          setUser({ id: session.user.id, email: session.user.email ?? null });
          setView(workspaceId ? "editor" : "workspaces");
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setWorkspaceId(null);
        try {
          localStorage.removeItem(WORKSPACE_ID_KEY);
        } catch {
          // Ignore storage errors.
        }
        setView("login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">Signing in…</div>
      </div>
    );
  }

  if (view === "login") {
    return (
      <LoginForm
        onAuthenticated={() => {
          setView(workspaceId ? "editor" : "workspaces");
        }}
      />
    );
  }

  if (view === "workspaces") {
    if (!user) return <div className="auth-page"><div className="auth-card">Loading user…</div></div>;
    return (
      <WorkspaceList
        userId={user.id}
        onSelectWorkspace={(id) => {
          setWorkspaceId(id);
          try {
            localStorage.setItem(WORKSPACE_ID_KEY, id);
          } catch {
            // Workspace persistence is optional.
          }
          setView("editor");
        }}
      />
    );
  }

  // view === "editor"
  if (!user || !workspaceId) return <div className="auth-page"><div className="auth-card">Select a workspace.</div></div>;

  return (
    <WorkspaceProvider key={workspaceId} workspaceId={workspaceId} userId={user.id}>
      <Shell />
    </WorkspaceProvider>
  );
}
