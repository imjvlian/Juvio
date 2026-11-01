import { useEffect, useRef, useState, useCallback } from "react";
import { PageEditor } from "./components/PageEditor";
import { Sidebar } from "./components/Sidebar";
import { TrashView } from "./components/TrashView";
import { LibraryView } from "./components/LibraryView";
import { PencilIcon, SidebarIcon } from "./components/icons";
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
  return "dark";
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

/** The hash is the single source of truth for the current view. */
function readHashRoute(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

function routeHash(route: string): string {
  return route ? `#/${route}` : "#/";
}

export function Shell() {
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
    markInboxSeen,
  } = useWorkspace();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readSidebarOpen);
  const [route, setRoute] = useState<string>(() => readHashRoute() || "library");
  const [aiOpen, setAiOpen] = useState(false);

  const navigate = useCallback((next: string) => {
    const hash = routeHash(next);
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    setRoute(next);
  }, []);

  const openTrash = useCallback(() => navigate("trash"), [navigate]);
  const openLibrary = useCallback(() => navigate("library"), [navigate]);
  const selectPage = useCallback(
    (id: string) => {
      if (!id) {
        navigate("library");
        return;
      }
      navigate(id);
      dispatch({ type: "select_page", id });
    },
    [navigate, dispatch],
  );

  const pagesRef = useRef(state.pages);
  useEffect(() => {
    pagesRef.current = state.pages;
  }, [state.pages]);

  // Canonicalise the URL: no hash means Library, unknown ids fall back to it too.
  useEffect(() => {
    if (isLoading) return;
    const hashRoute = readHashRoute();
    if (!hashRoute) {
      window.history.replaceState(null, "", "#/library");
      return;
    }
    if (hashRoute === "library" || hashRoute === "trash") return;
    if (!pagesRef.current[hashRoute]) {
      window.history.replaceState(null, "", "#/library");
    }
  }, [isLoading]);

  // Follow hash edits (address bar, pasted links, browser navigation).
  useEffect(() => {
    function applyHash() {
      const id = readHashRoute();
      if (!id) {
        setRoute("library");
        return;
      }
      if (id === "library" || id === "trash") {
        setRoute(id);
        return;
      }
      if (pagesRef.current[id]) {
        setRoute(id);
        dispatch({ type: "select_page", id });
        return;
      }
      setRoute("library");
      window.history.replaceState(null, "", "#/library");
    }
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [dispatch]);

  // Follow page changes made inside the editor (create, duplicate, breadcrumbs, undo).
  const previousActiveRef = useRef(state.activePageId);
  useEffect(() => {
    if (isLoading) {
      previousActiveRef.current = state.activePageId;
      return;
    }
    const previous = previousActiveRef.current;
    previousActiveRef.current = state.activePageId;
    if (state.activePageId === previous) return;
    if (!state.activePageId) {
      navigate("library");
      return;
    }
    if (route !== state.activePageId) navigate(state.activePageId);
  }, [isLoading, state.activePageId, route, navigate]);

  // A page that no longer exists (deleted or moved to Trash) falls back to Library.
  useEffect(() => {
    if (route === "library" || route === "trash") return;
    if (!state.pages[route]) navigate("library");
  }, [route, state.pages, navigate]);

  // Opening a page clears its inbox entry.
  useEffect(() => {
    if (route === "library" || route === "trash") return;
    if (state.pages[route]) markInboxSeen(route);
  }, [route, state.pages, markInboxSeen]);

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
    if (route === "trash") {
      document.title = "Trash · Juvio";
      return;
    }
    if (route === "library") {
      document.title = "Library · Juvio";
      return;
    }
    const page = state.pages[route];
    document.title = page?.title ? `${page.title} · Juvio` : "Juvio";
  }, [route, state.pages]);

  // Global keyboard shortcuts: undo / redo, and Escape closes the AI panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && aiOpen) {
        setAiOpen(false);
        return;
      }

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
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiOpen, canUndo, canRedo, undo, redo]);

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

  const showTrash = route === "trash";
  const showLibrary = route === "library" || !state.pages[route];

  return (
    <div className={`app${sidebarOpen ? "" : " is-sidebar-collapsed"}`}>
      {sidebarOpen ? (
        <Sidebar
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          onCollapse={() => setSidebarOpen(false)}
          onSignOut={handleSignOut}
          onOpenTrash={openTrash}
          onOpenLibrary={openLibrary}
          onSelectPage={selectPage}
          currentRoute={route}
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
      ) : showLibrary ? (
        <LibraryView onSelectPage={selectPage} />
      ) : (
        <PageEditor key={route} />
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
      {aiOpen && (
        <div className="ai-panel" role="dialog" aria-label="Ask AI">
          <div className="ai-panel-title">Ask AI</div>
          <p className="ai-panel-text">
            AI features are not connected yet. Ask about this page once Juvio is linked to a model.
          </p>
          <button type="button" className="ai-panel-close" onClick={() => setAiOpen(false)}>
            Close
          </button>
        </div>
      )}
      <button
        type="button"
        className="ai-float-btn"
        aria-label="Ask AI"
        title="Ask AI"
        aria-expanded={aiOpen}
        onClick={() => setAiOpen((open) => !open)}
      >
        <PencilIcon width={20} height={20} />
      </button>
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
