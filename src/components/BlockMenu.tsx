import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockType } from "../types";

export interface MenuAnchor {
  left: number;
  top: number;
  bottom: number;
}

export type MenuMode = "slash" | "insert" | "turn";

interface Command {
  type: BlockType;
  label: string;
  description: string;
  glyph: string;
  keywords: string;
}

const COMMANDS: Command[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Start writing with plain text",
    glyph: "Aa",
    keywords: "paragraph plain text body p",
  },
  {
    type: "heading1",
    label: "Heading 1",
    description: "Big section heading",
    glyph: "H1",
    keywords: "h1 title heading large",
  },
  {
    type: "heading2",
    label: "Heading 2",
    description: "Medium section heading",
    glyph: "H2",
    keywords: "h2 subtitle heading",
  },
  {
    type: "heading3",
    label: "Heading 3",
    description: "Small section heading",
    glyph: "H3",
    keywords: "h3 heading",
  },
  {
    type: "bulleted",
    label: "Bulleted list",
    description: "Create a simple bulleted list",
    glyph: "•",
    keywords: "bullet unordered list ul",
  },
  {
    type: "numbered",
    label: "Numbered list",
    description: "Create a list with numbering",
    glyph: "1.",
    keywords: "number ordered list ol",
  },
  {
    type: "todo",
    label: "To-do list",
    description: "Track tasks with a checkbox",
    glyph: "☑",
    keywords: "todo task checkbox check",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Capture a quote",
    glyph: "❝",
    keywords: "quote blockquote citation",
  },
  {
    type: "code",
    label: "Code",
    description: "Capture a code snippet",
    glyph: "</>",
    keywords: "code snippet pre monospace",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visually divide blocks",
    glyph: "―",
    keywords: "divider line separator hr",
  },
];

interface BlockMenuProps {
  anchor: MenuAnchor;
  mode: MenuMode;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

const MENU_WIDTH = 292;
const MENU_MAX_HEIGHT = 336;

const HEADINGS: Record<MenuMode, string> = {
  slash: "Basic blocks",
  insert: "Insert block below",
  turn: "Turn into",
};

export function BlockMenu({ anchor, mode, onSelect, onClose }: BlockMenuProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.keywords.includes(needle) ||
        c.type.includes(needle),
    );
  }, [query]);

  // The menu is closed on resize, so a render-time position is enough.
  const position = useMemo(() => {
    const maxLeft = Math.max(8, window.innerWidth - MENU_WIDTH - 12);
    const left = Math.min(Math.max(8, anchor.left), maxLeft);
    let top = anchor.bottom + 6;
    if (top + MENU_MAX_HEIGHT > window.innerHeight) {
      top = Math.max(8, anchor.top - MENU_MAX_HEIGHT - 6);
    }
    return { left, top };
  }, [anchor.left, anchor.top, anchor.bottom]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    function onScroll(event: Event) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  function choose(command: Command | undefined) {
    if (!command) return;
    onSelect(command.type);
  }

  return (
    <div
      className="block-menu"
      ref={menuRef}
      style={{ left: position.left, top: position.top }}
      role="dialog"
      aria-label={HEADINGS[mode]}
    >
      <div className="block-menu-header">{HEADINGS[mode]}</div>
      <div className="block-menu-search">
        <input
          ref={inputRef}
          value={query}
          placeholder="Filter blocks…"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) =>
                results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(results[active]);
            }
          }}
        />
      </div>
      <div className="block-menu-list" role="listbox">
        {results.length === 0 ? (
          <div className="block-menu-empty">No blocks match “{query}”</div>
        ) : (
          results.map((command, index) => (
            <button
              key={command.type}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`block-menu-item${index === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(command)}
            >
              <span className="block-menu-glyph">{command.glyph}</span>
              <span className="block-menu-copy">
                <span className="block-menu-label">{command.label}</span>
                <span className="block-menu-description">{command.description}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
