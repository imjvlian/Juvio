import type { Page, WorkspaceState } from "../types";
import { createEmptyPage, TEAMSPACE_CHILDREN } from "./seed";
import { TEAMSPACE_ICON } from "./pages";

const MIGRATION_KEY = "juvio.seed.migration.v2";

function isNamedIcon(icon: string | null): boolean {
  return Boolean(icon && /^[a-z][a-z0-9-]*$/.test(icon));
}

/**
 * Bring workspaces created from the pre-Library seed in line with the Team 6
 * HQ structure without deleting anything the user wrote. Runs once per
 * workspace scope; later structural edits are left alone.
 */
export function migrateSeedWorkspace(state: WorkspaceState, scope: string): WorkspaceState {
  const key = `${MIGRATION_KEY}.${scope}`;
  try {
    if (localStorage.getItem(key) === "done") return state;
  } catch {
    // Storage is optional; fall through and migrate in memory.
  }

  const pages: Record<string, Page> = { ...state.pages };
  let rootOrder = [...state.rootOrder];
  let changed = false;

  const rootByTitle = (title: string): Page | undefined =>
    Object.values(pages).find((page) => page.parentId === null && page.title === title);

  const byTitle = (parent: Page | undefined, title: string): Page | undefined =>
    parent?.children
      .map((id) => pages[id])
      .find((page): page is Page => Boolean(page) && page.title === title);

  const hadTeamspace = Boolean(rootByTitle("Team 6 HQ"));

  let teamspace = rootByTitle("Team 6 HQ");
  if (!teamspace) {
    teamspace = createEmptyPage(null, "Team 6 HQ");
    teamspace.icon = TEAMSPACE_ICON;
    pages[teamspace.id] = teamspace;
    rootOrder = [teamspace.id, ...rootOrder];
    changed = true;
  }

  if (teamspace.children.length === 0) {
    const children = TEAMSPACE_CHILDREN.map((spec) => {
      const child = createEmptyPage(teamspace!.id, spec.title);
      child.icon = spec.icon;
      pages[child.id] = child;
      return child;
    });
    teamspace = {
      ...teamspace,
      children: children.map((child) => child.id),
      updatedAt: Date.now(),
    };
    pages[teamspace.id] = teamspace;
    changed = true;
  } else {
    // Replace legacy emoji icons on seeded children with their named glyphs.
    teamspace.children.forEach((id, index) => {
      const child = pages[id];
      const spec = TEAMSPACE_CHILDREN[index];
      if (!child || !spec || child.title !== spec.title) return;
      if (isNamedIcon(child.icon)) return;
      pages[id] = { ...child, icon: spec.icon };
      changed = true;
    });
    if (!isNamedIcon(teamspace.icon)) {
      teamspace = { ...teamspace, icon: TEAMSPACE_ICON };
      pages[teamspace.id] = teamspace;
      changed = true;
    }
  }

  // Move onboarding pages out of the root list and under Docs.
  const docs = byTitle(teamspace, "Docs");
  if (docs) {
    for (const title of ["Welcome to Juvio", "Ideas"]) {
      const legacy = rootByTitle(title);
      if (!legacy || legacy.id === docs.id) continue;
      rootOrder = rootOrder.filter((id) => id !== legacy.id);
      pages[legacy.id] = { ...legacy, parentId: docs.id, updatedAt: Date.now() };
      pages[docs.id] = {
        ...pages[docs.id],
        children: [...pages[docs.id].children, legacy.id],
        updatedAt: Date.now(),
      };
      changed = true;
    }
  }

  // A workspace on the old seed also gains the two Private pages.
  if (!hadTeamspace) {
    for (const spec of [
      { title: "Getting Started", icon: "file" },
      { title: "TEAM 7", icon: "file" },
    ]) {
      if (rootByTitle(spec.title)) continue;
      const privatePage = createEmptyPage(null, spec.title);
      privatePage.icon = spec.icon;
      pages[privatePage.id] = privatePage;
      rootOrder.push(privatePage.id);
      changed = true;
    }
  }

  try {
    localStorage.setItem(key, "done");
  } catch {
    // The migration still applies in memory for this session.
  }

  if (!changed) return state;
  return { ...state, pages, rootOrder };
}
