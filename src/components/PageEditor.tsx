import { useEffect, useMemo, useRef, useState } from "react";
import type { Block, BlockType, Page } from "../types";
import { createEmptyPage } from "../lib/seed";
import { createId } from "../lib/id";
import { plainText } from "../lib/caret";
import { useWorkspace } from "../store/useWorkspace";
import { BlockMenu, type MenuAnchor, type MenuMode } from "./BlockMenu";
import { BlockRow, type FocusRequest } from "./BlockRow";
import { EmojiPicker } from "./EmojiPicker";
import { ChevronIcon } from "./icons";

interface OpenMenu {
  blockId: string;
  anchor: MenuAnchor;
  mode: MenuMode;
}

function ancestorsOf(page: Page, pages: Record<string, Page>): Page[] {
  const chain: Page[] = [];
  let current: Page | undefined = page.parentId ? pages[page.parentId] : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? pages[current.parentId] : undefined;
  }
  return chain;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function continuationType(type: BlockType): BlockType {
  if (type === "bulleted" || type === "numbered" || type === "todo") return type;
  return "paragraph";
}

function makeBlock(type: BlockType, html = ""): Block {
  const base: Block = { id: createId(), type, html };
  if (type === "todo") base.checked = false;
  return base;
}

export function PageEditor() {
  const { state, dispatch } = useWorkspace();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const focusToken = useRef(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");
  const [templateModal, setTemplateModal] = useState<"save" | "pick" | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [pageMenu, setPageMenu] = useState(false);

  const breadcrumbs = useMemo(
    () => (page ? ancestorsOf(page, state.pages) : []),
    [page, state.pages],
  );

  const numbers = useMemo(() => {
    let counter = 0;
    return (page?.blocks ?? []).map((block) => {
      if (block.type !== "numbered") {
        counter = 0;
        return null;
      }
      counter += 1;
      return counter;
    });
  }, [page?.blocks]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [page?.title, page?.id]);

  if (!page) {
    return (
      <main className="page-scroll">
        <div className="page-empty-state">
          <div className="page-empty-icon">✨</div>
          <h1>Juvio</h1>
          <p>Select a page from the sidebar, or start a new one.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => dispatch({ type: "create_page", page: createEmptyPage(null) })}
          >
            Create a page
          </button>
        </div>
      </main>
    );
  }

  const blocks = page.blocks;
  const activePageId = page.id;

  function requestFocus(blockId: string, position: FocusRequest["position"]) {
    focusToken.current += 1;
    setFocusRequest({ blockId, position, token: focusToken.current });
  }

  function commitBlocks(next: Block[]) {
    dispatch({ type: "set_blocks", pageId: activePageId, blocks: next });
  }

  function handleSplit(blockId: string, left: string, right: string) {
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const current = blocks[index];
    const next = blocks.map((block, i) => (i === index ? { ...block, html: left } : block));
    const created = makeBlock(continuationType(current.type), right);
    next.splice(index + 1, 0, created);
    commitBlocks(next);
    requestFocus(created.id, "start");
  }

  function handleMergePrevious(blockId: string, currentHtml: string) {
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index <= 0) return;
    const previous = blocks[index - 1];
    if (previous.type === "divider") {
      commitBlocks(blocks.filter((block) => block.id !== previous.id));
      requestFocus(blockId, "start");
      return;
    }
    const mergedHtml = `${previous.html}${currentHtml}`;
    const offset = plainText(previous.html).length;
    const next = blocks
      .filter((block) => block.id !== blockId)
      .map((block) => (block.id === previous.id ? { ...block, html: mergedHtml } : block));
    commitBlocks(next);
    requestFocus(previous.id, offset);
  }

  function handleConvert(blockId: string, type: BlockType) {
    dispatch({
      type: "update_block",
      pageId: activePageId,
      blockId,
      patch: type === "divider" ? { type, html: "" } : { type },
    });
    if (type !== "divider") requestFocus(blockId, "end");
  }

  function handleInsertBelow(blockId: string, type: BlockType = "paragraph") {
    const index = blocks.findIndex((block) => block.id === blockId);
    const created = makeBlock(type);
    const next = [...blocks];
    next.splice(index < 0 ? next.length : index + 1, 0, created);
    commitBlocks(next);
    if (type !== "divider") requestFocus(created.id, "start");
  }

  function handleDelete(blockId: string) {
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const next = blocks.filter((block) => block.id !== blockId);
    commitBlocks(next);
    const neighbor = next[Math.min(index, next.length - 1)];
    if (neighbor) requestFocus(neighbor.id, index >= next.length ? "end" : "start");
  }

  function handlePasteLines(blockId: string, currentHtml: string, lines: string[]) {
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const created = lines.map((line) => makeBlock("paragraph", line ? escapeHtml(line) : ""));
    if (created.length === 0) return;
    const next = blocks.map((block) =>
      block.id === blockId ? { ...block, html: currentHtml } : block,
    );
    next.splice(index + 1, 0, ...created);
    commitBlocks(next);
    requestFocus(created[created.length - 1].id, "end");
  }

  function handleMenuSelect(type: BlockType) {
    if (!menu) return;
    const { blockId, mode } = menu;
    setMenu(null);
    if (mode === "insert") handleInsertBelow(blockId, type);
    else handleConvert(blockId, type);
  }

  function handleTailClick() {
    const last = blocks[blocks.length - 1];
    if (last && last.type === "paragraph" && plainText(last.html) === "") {
      requestFocus(last.id, "end");
      return;
    }
    if (last) handleInsertBelow(last.id, "paragraph");
    else {
      const created = makeBlock("paragraph");
      commitBlocks([created]);
      requestFocus(created.id, "start");
    }
  }

  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = blocks[0];
      if (first) requestFocus(first.id, "start");
      else handleTailClick();
    } else if (event.key === "ArrowDown" && event.currentTarget.selectionStart === event.currentTarget.value.length) {
      const first = blocks[0];
      if (first) {
        event.preventDefault();
        requestFocus(first.id, "start");
      }
    }
  }

  function handleReorder(draggedId: string, targetId: string | null, position: "before" | "after") {
    if (!page) return;
    if (draggedId === targetId) return;
    const index = blocks.findIndex((b) => b.id === draggedId);
    if (index < 0) return;
    let toIndex = blocks.findIndex((b) => b.id === targetId);
    if (toIndex < 0) toIndex = blocks.length;
    else if (position === "after") toIndex += 1;
    if (toIndex > index) toIndex -= 1;
    dispatch({ type: "move_block", pageId: page.id, blockId: draggedId, toIndex });
    setDropTargetId(null);
    setDropPosition("before");
  }

  function handleDragOver(targetId: string, position: "before" | "after") {
    setDropTargetId(targetId);
    setDropPosition(position);
  }

  function handleConfirmSaveTemplate() {
    if (!page || !templateName.trim()) return;
    dispatch({ type: "save_template", pageId: page.id, name: templateName.trim() });
    setTemplateModal(null);
    setTemplateName("");
  }

  function handleCreateFromTemplate(templateId: string) {
    dispatch({ type: "create_page_from_template", templateId, parentId: page?.parentId ?? null });
    setTemplateModal(null);
  }

  function handleDeleteTemplate(id: string) {
    dispatch({ type: "delete_template", id });
  }

  return (
    <main className="page-scroll">
      <div className="page">
        <div className="page-breadcrumbs">
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="crumb">
              <button
                type="button"
                className="crumb-link"
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch({ type: "select_page", id: crumb.id });
                }}
              >
                {crumb.icon ? `${crumb.icon} ` : ""}
                {crumb.title || "Untitled"}
              </button>
              <ChevronIcon className="crumb-chevron" width={12} height={12} />
            </span>
          ))}
          <span className="crumb-current">
            {page.icon ? `${page.icon} ` : ""}
            {page.title || "Untitled"}
          </span>
        </div>

        <div className="page-icon-wrap">
          {page.icon ? (
            <button
              type="button"
              className="page-icon"
              data-emoji-anchor
              aria-label="Change page icon"
              onClick={(event) => {
                event.stopPropagation();
                setPickerOpen((open) => !open);
              }}
            >
              {page.icon}
            </button>
          ) : (
            <button
              type="button"
              className="page-icon-add"
              data-emoji-anchor
              onClick={(event) => {
                event.stopPropagation();
                setPickerOpen((open) => !open);
              }}
            >
              <span aria-hidden="true">🙂</span> Add icon
            </button>
          )}
          {pickerOpen && (
            <EmojiPicker
              onPick={(emoji) => {
                dispatch({ type: "update_page", id: page.id, patch: { icon: emoji } });
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="page-action-btn"
            onClick={() => setPageMenu((open) => !open)}
            title="More actions"
          >
            ⋮
          </button>
          {pageMenu && (
            <div className="page-menu">
              <button type="button" className="page-menu-item" onClick={() => { setPageMenu(false); dispatch({ type: "duplicate_page", id: page.id }); }}>
                Duplicate
              </button>
              <button type="button" className="page-menu-item" onClick={() => { setPageMenu(false); dispatch({ type: "delete_page", id: page.id }); }}>
                Delete
              </button>
              <button type="button" className="page-menu-item" onClick={() => { setPageMenu(false); setTemplateModal(null); }}>
                Move
              </button>
              <button type="button" className="page-menu-item" onClick={() => { setPageMenu(false); }}>
                Export
              </button>
            </div>
          )}
        </div>

        <textarea
          ref={titleRef}
          className="page-title"
          value={page.title}
          rows={1}
          placeholder="Untitled"
          autoFocus={page.title.trim() === ""}
          spellCheck={false}
          onChange={(event) =>
            dispatch({ type: "update_page", id: page.id, patch: { title: event.target.value } })
          }
          onKeyDown={handleTitleKeyDown}
          aria-label="Page title"
        />

        <div className="page-blocks">
          {blocks.map((block, index) => (
            <>
              <BlockRow
                key={block.id}
                pageId={page.id}
                block={block}
                number={numbers[index]}
                isFirst={index === 0}
                isLast={index === blocks.length - 1}
                focusRequest={focusRequest}
                onFocusHandled={(token) =>
                  setFocusRequest((current) => (current && current.token === token ? null : current))
                }
                onSplit={handleSplit}
                onMergePrevious={handleMergePrevious}
                onConvert={handleConvert}
                onInsertBelow={handleInsertBelow}
                onDelete={handleDelete}
                onPasteLines={handlePasteLines}
                onOpenMenu={(blockId, anchor, mode) => setMenu({ blockId, anchor, mode })}
                onFocusNeighbor={(blockId, position) => {
                  const index = blocks.findIndex((block) => block.id === blockId);
                  const target = blocks[index + (position === "end" ? -1 : 1)];
                  if (target) requestFocus(target.id, position);
                }}
                onReorder={handleReorder}
                onDragOver={handleDragOver}
              />
              {dropTargetId === block.id && dropPosition === "before" && (
                <div className="block-drop-indicator" />
              )}
            </>
          ))}
          {dropTargetId === blocks[blocks.length - 1]?.id && dropPosition === "after" && (
            <div className="block-drop-indicator" />
          )}
        </div>

        <div className="page-tail" onClick={handleTailClick} role="presentation" />

        <footer className="page-footer">
          <span className="page-footer-dot" aria-hidden="true" />
          Saved locally · {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </footer>
      </div>

      {menu && (
        <BlockMenu
          anchor={menu.anchor}
          mode={menu.mode}
          onSelect={handleMenuSelect}
          onClose={() => setMenu(null)}
        />
      )}

      {templateModal === "save" && (
        <div className="template-modal">
          <div className="template-modal-content">
            <h3>Save as template</h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              autoFocus
            />
            <div className="template-modal-actions">
              <button type="button" className="template-btn-cancel" onClick={() => setTemplateModal(null)}>
                Cancel
              </button>
              <button type="button" className="template-btn-save" onClick={handleConfirmSaveTemplate}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {templateModal === "pick" && (
        <div className="template-modal">
          <div className="template-modal-content">
            <h3>New from template</h3>
            <div className="template-list">
              {Object.entries(state.templates ?? {}).map(([id, t]) => (
                <div key={id} className="template-item">
                  <span>{t.name}</span>
                  <div className="template-item-actions">
                    <button type="button" className="template-btn-use" onClick={() => handleCreateFromTemplate(id)}>
                      Use
                    </button>
                    <button type="button" className="template-btn-delete" onClick={() => handleDeleteTemplate(id)}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {Object.keys(state.templates ?? {}).length === 0 && <p className="template-empty">No templates yet.</p>}
            </div>
            <div className="template-modal-actions">
              <button type="button" className="template-btn-cancel" onClick={() => setTemplateModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
