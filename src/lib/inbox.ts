export interface InboxItem {
  id: string;
  title: string;
  icon: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

const SEEN_KEY = "juvio.inbox.seen.v1";

function seenKey(scope: string): string {
  return `${SEEN_KEY}.${scope}`;
}

/** Page ids the user already opened, used to derive the unread inbox count. */
export function loadSeenPages(scope: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(scope));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function saveSeenPages(scope: string, ids: Set<string>): void {
  try {
    localStorage.setItem(seenKey(scope), JSON.stringify([...ids].slice(-500)));
  } catch {
    // Seen state is best-effort.
  }
}
