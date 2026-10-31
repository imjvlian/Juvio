import { useEffect, useRef, useState } from "react";
import type { Block, BlockType } from "../types";
import { caretOffset, caretRect, normalizeHtml, plainText, placeCaretAtOffset, splitAtCaret } from "../lib/caret";
import { useWorkspace } from "../store/useWorkspace";
import { MoreIcon, PlusIcon } from "./icons";
import type { MenuAnchor, MenuMode } from "./BlockMenu";

export interface FocusRequest {
  blockId: string;
  /** "start", "end", or a plain-text character offset. */
  position: "start" | "end" | number;
  token: number;
}

interface BlockRowProps {
  pageId: string;
  block: Block;
  number: number | null;
  isFirst: boolean;
  isLast: boolean;
  focusRequest: FocusRequest | null;
  onFocusHandled: (token: number) => void;
  onSplit: (blockId: string, left: string, right: string) => void;
  onMergePrevious: (blockId: string, mergedHtml: string) => void;
  onConvert: (blockId: string, type: BlockType) => void;
  onInsertBelow: (blockId: string, type?: BlockType) => void;
  onDelete: (blockId: string) => void;
  onPasteLines: (blockId: string, currentHtml: string, remaining: string[]) => void;
  onOpenMenu: (blockId: string, anchor: MenuAnchor, mode: MenuMode) => void;
  onFocusNeighbor: (blockId: string, position: "start" | "end") => void;
}

const SHORTCUTS: Record<string, BlockType> = {
  "#": "heading1",
  "##": "heading2",
  "###": "heading3",
  "-": "bulleted",
  "*": "bulleted",
  "+": "bulleted",
  "1.": "numbered",
  "1)": "numbered",
  "[]": "todo",
  "[ ]": "todo",
  ">": "quote",
  "```": "code",
  "---": "divider",
};

export function BlockRow({
  pageId,
  block,
  number,
  isFirst,
  isLast,
  focusRequest,
  onFocusHandled,
  onSplit,
  onMergePrevious,
  onConvert,
  onInsertBelow,
  onDelete,
  onPasteLines,
  onOpenMenu,
  onFocusNeighbor,
}: BlockRowProps) {
  const { dispatch } = useWorkspace();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastLocalHtml = useRef<string | null>(null);
  const handledFocusToken = useRef<number | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const isEmpty = plainText(block.html).length === 0;

  function pushHtml(html: string) {
    const normalized = normalizeHtml(html);
    lastLocalHtml.current = normalized;
    dispatch({ type: "update_block", pageId, blockId: block.id, patch: { html: normalized } });
  }

  // Sync external HTML changes (merge, paste, type switches) without stealing the caret.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (lastLocalHtml.current === block.html) return;
    if (document.activeElement === el) {
      el.innerHTML = block.html;
      return;
    }
    if (el.innerHTML !== block.html) el.innerHTML = block.html;
  }, [block.html, block.type]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !focusRequest || focusRequest.blockId !== block.id) return;
    if (handledFocusToken.current === focusRequest.token) return;
    handledFocusToken.current = focusRequest.token;
    el.focus({ preventScroll: false });
    if (focusRequest.position === "start") placeCaretAtOffset(el, 0);
    else if (focusRequest.position === "end") placeCaretAtOffset(el, Number.MAX_SAFE_INTEGER);
    else placeCaretAtOffset(el, focusRequest.position);
    onFocusHandled(focusRequest.token);
  }, [focusRequest, block.id, onFocusHandled]);

  function openAtCaret(mode: MenuMode) {
    const el = contentRef.current;
    const rect = caretRect(el);
    onOpenMenu(block.id, { left: rect.left, top: rect.top, bottom: rect.bottom }, mode);
  }

  function openAtButton(button: HTMLElement, mode: MenuMode) {
    const rect = button.getBoundingClientRect();
    onOpenMenu(block.id, { left: rect.left, top: rect.top, bottom: rect.bottom }, mode);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const el = contentRef.current;
    if (!el) return;
    if (event.nativeEvent.isComposing || isComposing) return;

    const mod = event.metaKey || event.ctrlKey;

    if (mod && !event.altKey && !event.shiftKey) {
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i" || key === "u") {
        event.preventDefault();
        document.execCommand(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
        window.setTimeout(() => pushHtml(el.innerHTML), 0);
        return;
      }
    }

    if (event.key === "/" && !mod && plainText(el.innerHTML) === "") {
      event.preventDefault();
      openAtCaret("slash");
      return;
    }

    if (event.key === " " && !mod && caretOffset(el) === (el.textContent ?? "").length) {
      const text = (el.textContent ?? "").trim();
      const shortcut = SHORTCUTS[text];
      if (shortcut) {
        event.preventDefault();
        el.innerHTML = "";
        pushHtml("");
        onConvert(block.id, shortcut);
        return;
      }
    }

    if (event.key === "Enter") {
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (block.type === "code") {
        document.execCommand("insertLineBreak");
        pushHtml(el.innerHTML);
        return;
      }
      if (isEmpty) {
        if (block.type !== "paragraph") onConvert(block.id, "paragraph");
        return;
      }
      const { left, right } = splitAtCaret(el);
      onSplit(block.id, left, right);
      return;
    }

    if (event.key === "Backspace" && !mod && !event.shiftKey) {
      const selection = window.getSelection();
      if (!selection || !selection.isCollapsed) return;
      if (caretOffset(el) !== 0) return;
      if (isEmpty && block.type !== "paragraph") {
        event.preventDefault();
        onConvert(block.id, "paragraph");
        return;
      }
      if (isFirst) return;
      event.preventDefault();
      onMergePrevious(block.id, block.html);
      return;
    }

    if (event.key === "ArrowUp" && !mod) {
      if (caretOffset(el) === 0 && !isFirst) {
        event.preventDefault();
        onFocusNeighbor(block.id, "end");
      }
    }

    if (event.key === "ArrowDown" && !mod) {
      if (caretOffset(el) === (el.textContent ?? "").length && !isLast) {
        event.preventDefault();
        onFocusNeighbor(block.id, "start");
      }
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    const el = contentRef.current;
    if (!el) return;
    event.preventDefault();

    if (block.type === "code") {
      insertCodeText(text);
      return;
    }

    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const firstHtml = normalizeHtml(insertTextAtCaret(el, lines[0] ?? ""));
    pushHtml(firstHtml);
    if (lines.length > 1) {
      onPasteLines(block.id, firstHtml, lines.slice(1));
    }
  }

  function insertCodeText(text: string) {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, index) => {
      if (index > 0) document.execCommand("insertLineBreak");
      if (line) document.execCommand("insertText", false, line);
    });
    pushHtml(el.innerHTML);
  }

  function insertTextAtCaret(el: HTMLElement, text: string): string {
    el.focus();
    if (document.execCommand("insertText", false, text)) return el.innerHTML;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      el.textContent = `${el.textContent ?? ""}${text}`;
      return el.innerHTML;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return el.innerHTML;
  }

  function handleInput() {
    const el = contentRef.current;
    if (!el) return;
    pushHtml(el.innerHTML);
  }

  if (block.type === "divider") {
    return (
      <div
        className="block block-divider"
        data-block-id={block.id}
        onKeyDown={(event) => {
          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            onDelete(block.id);
          } else if (event.key === "Enter") {
            event.preventDefault();
            onInsertBelow(block.id);
          }
        }}
      >
        <BlockControls
          block={block}
          onInsert={() => onInsertBelow(block.id)}
          onOpenMenu={(button) => openAtButton(button, "turn")}
        />
        <div className="divider-line" role="separator" tabIndex={0} aria-label="Divider" />
      </div>
    );
  }

  const contentClass = [
    "block-content",
    block.type === "code" ? "is-code" : "",
    block.checked ? "is-checked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`block block-${block.type}`} data-block-id={block.id} data-empty={isEmpty}>
      <BlockControls
        block={block}
        onInsert={() => onInsertBelow(block.id)}
        onOpenMenu={(button) => openAtButton(button, "turn")}
      />
      {block.type === "bulleted" && (
        <span className="block-marker" aria-hidden="true">
          •
        </span>
      )}
      {block.type === "numbered" && (
        <span className="block-marker" aria-hidden="true">
          {number ?? 1}.
        </span>
      )}
      {block.type === "todo" && (
        <button
          type="button"
          className={`todo-checkbox${block.checked ? " is-checked" : ""}`}
          role="checkbox"
          aria-checked={Boolean(block.checked)}
          aria-label="Toggle to-do"
          onClick={() =>
            dispatch({
              type: "update_block",
              pageId,
              blockId: block.id,
              patch: { checked: !block.checked },
            })
          }
        >
          {block.checked ? "✓" : ""}
        </button>
      )}
      <div
        ref={contentRef}
        className={contentClass}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        spellCheck
        data-placeholder={placeholderFor(block.type)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
      />
    </div>
  );
}

function placeholderFor(type: BlockType): string {
  switch (type) {
    case "heading1":
      return "Heading 1";
    case "heading2":
      return "Heading 2";
    case "heading3":
      return "Heading 3";
    case "bulleted":
      return "List item";
    case "numbered":
      return "List item";
    case "todo":
      return "To-do";
    case "quote":
      return "Quote";
    case "code":
      return "Code";
    default:
      return "Type “/” for commands";
  }
}

function BlockControls({
  block,
  onInsert,
  onOpenMenu,
}: {
  block: Block;
  onInsert: () => void;
  onOpenMenu: (button: HTMLElement) => void;
}) {
  return (
    <div className="block-controls" aria-hidden={false}>
      <button type="button" className="block-control" tabIndex={-1} aria-label="Add block below" onClick={onInsert}>
        <PlusIcon />
      </button>
      <button
        type="button"
        className="block-control"
        tabIndex={-1}
        aria-label={`Change block type (${block.type})`}
        onClick={(event) => onOpenMenu(event.currentTarget)}
      >
        <MoreIcon />
      </button>
    </div>
  );
}
