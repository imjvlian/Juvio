import type { Block, Page } from "../types";

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inlineToMarkdown).join("");

  switch (el.tagName.toLowerCase()) {
    case "b":
    case "strong":
      return `**${inner}**`;
    case "i":
    case "em":
      return `*${inner}*`;
    case "s":
    case "strike":
    case "del":
      return `~~${inner}~~`;
    case "code":
      return `\`${inner}\``;
    case "u":
      return `<u>${inner}</u>`;
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "br":
      return "\n";
    default:
      return inner;
  }
}

function htmlToMarkdown(html: string): string {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return Array.from(holder.childNodes).map(inlineToMarkdown).join("");
}

function blockToMarkdown(block: Block, index: number): string {
  const text = htmlToMarkdown(block.html);

  switch (block.type) {
    case "heading1":
      return `# ${text}`;
    case "heading2":
      return `## ${text}`;
    case "heading3":
      return `### ${text}`;
    case "bulleted":
      return `- ${text}`;
    case "numbered":
      return `${index}. ${text}`;
    case "todo":
      return `- [${block.checked ? "x" : " "}] ${text}`;
    case "quote":
      return `> ${text.replace(/\n/g, "\n> ")}`;
    case "code":
      return `\`\`\`\n${text}\n\`\`\``;
    case "divider":
      return "---";
    default:
      return text;
  }
}

export function pageToMarkdown(page: Page): string {
  const lines: string[] = [`# ${page.title.trim() || "Untitled"}`, ""];
  let listIndex = 0;

  for (const block of page.blocks) {
    if (block.type === "numbered") listIndex += 1;
    else listIndex = 0;
    const line = blockToMarkdown(block, listIndex || 1).trimEnd();
    lines.push(line);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function markdownFileName(title: string): string {
  const base = title.trim() || "Untitled";
  const safe = base.replace(/[\\/:*?"<>|]+/g, "-");
  return `${safe}.md`;
}
