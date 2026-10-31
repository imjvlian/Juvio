import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";

try {
  const stored = localStorage.getItem("juvio.theme.v1");
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    document.documentElement.dataset.theme = "dark";
  }
} catch {
  // A blocked storage API should not prevent the app from rendering.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
