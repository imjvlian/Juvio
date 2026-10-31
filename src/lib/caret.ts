export function normalizeHtml(html: string): string {
  if (html === "<br>" || html === "<div><br></div>") return "";
  return html;
}

/** Number of characters between the start of `el` and the caret. */
export function caretOffset(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

export function isCaretAtStart(el: HTMLElement): boolean {
  return caretOffset(el) === 0;
}

export function placeCaret(el: HTMLElement, position: "start" | "end" = "end"): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(position === "start");
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
  el.focus();
}

/** Place the caret at a plain-text offset from the start of `el`. */
export function placeCaretAtOffset(el: HTMLElement, offset: number): void {
  const range = document.createRange();
  let remaining = Math.max(0, offset);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let placed = false;

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(node, remaining);
      placed = true;
      break;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  if (!placed) {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    range.collapse(true);
  }

  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
  el.focus();
}

export function splitAtCaret(el: HTMLElement): { left: string; right: string } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { left: normalizeHtml(el.innerHTML), right: "" };
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return { left: normalizeHtml(el.innerHTML), right: "" };

  const after = range.cloneRange();
  after.selectNodeContents(el);
  after.setStart(range.startContainer, range.startOffset);
  const fragment = after.extractContents();
  const holder = document.createElement("div");
  holder.appendChild(fragment);

  return { left: normalizeHtml(el.innerHTML), right: normalizeHtml(holder.innerHTML) };
}

export function caretRect(fallback: HTMLElement | null): { left: number; top: number; bottom: number } {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return { left: rect.left, top: rect.top, bottom: rect.bottom };
    }
  }
  if (fallback) {
    const rect = fallback.getBoundingClientRect();
    return { left: rect.left, top: rect.top, bottom: rect.bottom };
  }
  return { left: 0, top: 0, bottom: 0 };
}

export function plainText(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return holder.textContent ?? "";
}
