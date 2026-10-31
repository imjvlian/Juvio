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

export function createSeedWorkspace(): WorkspaceState {
  const welcome = page({
    title: "Welcome to Juvio",
    icon: "👋",
    parentId: null,
    blocks: [
      block("paragraph", "Juvio is a local-first workspace for notes, docs, and light databases. It is a ground-up build inspired by the block editing model of tools like Notion — no proprietary code or assets are copied."),
      block("heading2", "What works right now"),
      block("bulleted", "Type <b>/</b> on an empty block to insert headings, lists, quotes, code, or a divider."),
      block("bulleted", "Markdown shortcuts work too: <code>#</code>, <code>##</code>, <code>-</code>, <code>1.</code>, <code>[]</code>, <code>&gt;</code>, <code>```</code> followed by space."),
      block("bulleted", "Select text and use <b>Ctrl/⌘ + B</b>, <b>I</b>, or <b>U</b> for inline formatting."),
      block("bulleted", "Press <b>Enter</b> to split a block, <b>Backspace</b> at the start to merge it back."),
      block("bulleted", "Everything is saved to this browser automatically."),
      block("heading2", "Try it"),
      block("todo", "Create a page from the sidebar", false),
      block("todo", "Write a paragraph and turn it into a heading", true),
      block("quote", "Local-first means your notes stay on this device, in your browser storage."),
      block("code", "const idea = &quot;Juvio&quot;;\nconsole.log(`${idea} is ready.`);"),
      block("divider"),
      block("paragraph", "Use the <b>+</b> button beside a block to add one below, or the dots to change its type."),
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
      block("heading3", "Structure"),
      block("paragraph", "Nest pages by hovering a sidebar item and pressing <b>+</b>. Pages keep their own block content."),
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

  return {
    version: 1,
    pages: { [welcome.id]: welcome, [quickStart.id]: quickStart, [ideas.id]: ideas },
    rootOrder: [welcome.id, ideas.id],
    activePageId: welcome.id,
  };
}
