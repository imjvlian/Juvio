import type { Block, BlockType, Page, WorkspaceState } from "../types";
import { createId } from "./id";

function block(type: BlockType, html = "", checked?: boolean): Block {
  return checked === undefined ? { id: createId(), type, html } : { id: createId(), type, html, checked };
}

function page(input: Omit<Page, "id" | "children" | "createdAt" | "updatedAt">): Page {
  const now = Date.now();
  return { ...input, id: createId(), children: [], createdAt: now, updatedAt: now };
}

export function createEmptyPage(parentId: string | null, title = ""): Page {
  return page({
    title,
    icon: null,
    parentId,
    blocks: [block("paragraph")],
  });
}

/** Stable icon keys for the seeded teamspace tree. Named keys render as SVG. */
export const TEAMSPACE_CHILDREN = [
  { title: "Tasks", icon: "check-circle" },
  { title: "Tasks", icon: "checkbox" },
  { title: "Projects", icon: "target" },
  { title: "Wiki", icon: "book-open" },
  { title: "Meetings", icon: "file-lines" },
  { title: "Docs", icon: "file" },
  { title: "TEAM ROLES", icon: "file" },
] as const;

export function createSeedWorkspace(): WorkspaceState {
  const welcome = page({
    title: "Welcome to Juvio",
    icon: "👋",
    parentId: null,
    blocks: [
      block("paragraph", "Juvio is a local-first workspace for notes, docs, and light databases."),
      block("heading2", "What works right now"),
      block("bulleted", "Type <b>/</b> on an empty block to insert headings, lists, quotes, code, or a divider."),
      block("bulleted", "Markdown shortcuts work too: <code>#</code>, <code>##</code>, <code>-</code>, <code>1.</code>, <code>[]</code>, <code>&gt;</code>, <code>```</code> followed by space."),
      block("bulleted", "Select text and use <b>Ctrl/⌘ + B</b>, <b>I</b>, or <b>U</b> for inline formatting."),
      block("bulleted", "Press <b>Enter</b> to split a block, <b>Backspace</b> at the start to merge it back."),
      block("bulleted", "Everything is saved to this browser automatically."),
    ],
  });

  const quickStart = page({
    title: "Quick start",
    icon: "⚡",
    parentId: welcome.id,
    blocks: [
      block("paragraph", "A few ways to move faster:"),
      block("heading3", "Keyboard"),
      block("bulleted", "<b>Enter</b> — new block, splitting at the caret."),
      block("bulleted", "<b>Backspace</b> at the start — merge with the block above."),
      block("bulleted", "<b>/</b> — open the insert menu."),
    ],
  });

  const ideas = page({
    title: "Ideas",
    icon: "💡",
    parentId: null,
    blocks: [
      block("heading2", "Parking lot"),
      block("numbered", "Inline mentions and backlinks"),
      block("numbered", "Drag to reorder blocks and pages"),
      block("numbered", "Undo / redo history"),
      block("numbered", "Markdown import and export"),
    ],
  });

  welcome.children = [quickStart.id];

  // Team 6 HQ teamspace with the seven seeded children.
  const team6Hq = page({
    title: "Team 6 HQ",
    icon: "home-orange",
    parentId: null,
    blocks: [block("paragraph", "Team 6 HQ workspace.")],
  });

  const teamChildren = TEAMSPACE_CHILDREN.map((spec) =>
    page({
      title: spec.title,
      icon: spec.icon,
      parentId: team6Hq.id,
      blocks: [block("paragraph")],
    }),
  );
  team6Hq.children = teamChildren.map((child) => child.id);

  // Keep the legacy onboarding pages reachable from Docs instead of the root.
  const docs = teamChildren.find((child) => child.title === "Docs");
  if (docs) {
    docs.children = [welcome.id, ideas.id];
    welcome.parentId = docs.id;
    ideas.parentId = docs.id;
  }

  const gettingStarted = page({
    title: "Getting Started",
    icon: "file",
    parentId: null,
    blocks: [block("paragraph", "Getting started with Juvio.")],
  });

  const team7 = page({
    title: "TEAM 7",
    icon: "file",
    parentId: null,
    blocks: [block("paragraph", "TEAM 7 workspace.")],
  });

  const pages: Record<string, Page> = {};
  for (const entry of [
    team6Hq,
    ...teamChildren,
    welcome,
    quickStart,
    ideas,
    gettingStarted,
    team7,
  ]) {
    pages[entry.id] = entry;
  }

  return {
    version: 1,
    pages,
    rootOrder: [team6Hq.id, gettingStarted.id, team7.id],
    activePageId: team6Hq.id,
  };
}
