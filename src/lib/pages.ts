import type { Page } from "../types";

/** Icon marker used for teamspace roots. */
export const TEAMSPACE_ICON = "home-orange";

/**
 * A teamspace is a root page that either contains child pages or carries the
 * teamspace icon marker. The schema has no dedicated teamspace entity, so the
 * marker keeps a freshly created (still empty) teamspace visible in the
 * Library table and the sidebar.
 */
export function isTeamspacePage(page: Page): boolean {
  return page.children.length > 0 || page.icon === TEAMSPACE_ICON;
}
