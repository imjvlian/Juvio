import { useEffect, useState } from "react";
import { PageEditor } from "./components/PageEditor";
import { Sidebar } from "./components/Sidebar";
import { SidebarIcon } from "./components/icons";
import { WorkspaceProvider } from "./store/WorkspaceContext";
import { useWorkspace } from "./store/useWorkspace";

const THEME_KEY = "juvio.theme.v1";
const SIDEBAR_KEY = "juvio.sidebar.open.v1";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Fall back to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "closed";
  } catch {
    return true;
  }
}

function Shell() {
  const { state } = useWorkspace();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readSidebarOpen);

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
    const page = state.activePageId ? state.pages[state.activePageId] : undefined;
    document.title = page?.title ? `${page.title} · Juvio` : "Juvio";
  }, [state.activePageId, state.pages]);

  return (
    <div className={`app${sidebarOpen ? "" : " is-sidebar-collapsed"}`}>
      {sidebarOpen ? (
        <Sidebar
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          onCollapse={() => setSidebarOpen(false)}
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
      <PageEditor key={state.activePageId ?? "empty"} />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
