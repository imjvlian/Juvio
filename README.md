# Juvio

Juvio is a local-first, Notion-inspired workspace: pages in a sidebar, a block-based editor, and automatic persistence in the browser.

It is a ground-up build. The block editing model and interaction patterns are inspired by Notion, but no Notion code, assets, or branding are used.

> **Status: Milestone 1.** The editor, page tree, and local persistence are implemented and tested. Databases, drag reordering, and undo/redo are planned (see [Roadmap](#roadmap)).

## Features

- **Pages and sub-pages** — create, rename, nest, search, and delete pages. The tree remembers which branches are open; the active page's ancestors stay visible.
- **Block editor** — paragraphs, headings 1–3, bulleted/numbered/to-do lists, quotes, code blocks, and dividers.
- **Notion-style input** — press `/` on an empty block for the insert menu, or type a Markdown prefix and a space.
- **Inline formatting** — bold, italic, and underline via keyboard; formatting is preserved through reloads.
- **Editing flow** — `Enter` splits a block at the caret, `Backspace` at the start merges with the previous block, and arrow keys move between blocks at the edges.
- **Paste handling** — multi-line text pastes into separate blocks; code blocks keep line breaks.
- **Page headers** — emoji icon picker, auto-growing title, breadcrumbs for nested pages.
- **Light and dark themes** — follows the system preference until you choose one.
- **Local-only** — no account, network requests, or telemetry; data lives in this browser.

## Getting started

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the printed URL (Vite defaults to `http://localhost:5173`).

### Scripts

| Command           | What it does                                 |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR.          |
| `npm run build`   | Type-check and produce a production build.   |
| `npm run preview` | Serve the production build locally.          |
| `npm run lint`    | Run Oxlint (currently clean, no warnings).   |

## Keyboard shortcuts

| Shortcut                             | Result                                              |
| ------------------------------------ | --------------------------------------------------- |
| `Enter`                              | Split the block at the caret, or exit an empty block. |
| `Shift + Enter`                      | Line break inside the current block.                |
| `Backspace` at block start           | Merge into the previous block (empty non-paragraph blocks become paragraphs first). |
| `Arrow Up` / `Arrow Down` at edges   | Move the caret to the previous/next block.          |
| `/` on an empty block                | Open the insert menu.                               |
| `Ctrl/⌘ + B` / `I` / `U`             | Bold, italic, underline.                            |
| `Enter` in the page title              | Jump to the first block.                             |

### Markdown prefixes

Type the prefix, then `Space`:

| Prefix                       | Block          |
| ---------------------------- | -------------- |
| `#`, `##`, `###`              | Headings 1–3   |
| `-`, `*`, `+`                 | Bulleted list  |
| `1.`, `1)`                    | Numbered list  |
| `[]`, `[ ]`                   | To-do          |
| `>`                           | Quote          |
| ` ``` `                       | Code           |
| `---`                         | Divider        |

Inside a code block, `Enter` inserts a newline instead of splitting the block.

## Data and persistence

Everything is stored in `localStorage` under namespaced keys:

| Key                        | Contents                                        |
| -------------------------- | ----------------------------------------------- |
| `juvio.workspace.v1`       | Pages, blocks, page order, and the active page. |
| `juvio.sidebar.expanded.v1`| Which sidebar branches are open.                |
| `juvio.sidebar.open.v1`    | Sidebar visibility.                             |
| `juvio.theme.v1`           | Chosen light/dark theme.                        |

Saves are debounced (200 ms). Loaded data is validated; corrupt or incompatible data is discarded and replaced with the sample workspace. Use the reset button in the sidebar footer to restore the sample pages — this cannot be undone.

Because storage is per-browser and per-origin, the workspace does not sync between devices or profiles.

## Project structure

```
src/
  App.tsx                  App shell: theme, sidebar visibility, page editor
  components/
    Sidebar.tsx            Page tree, search, create/delete, theme, reset
    PageEditor.tsx         Breadcrumbs, page header, block list and actions
    BlockRow.tsx           contentEditable block, shortcuts, paste, inline controls
    BlockMenu.tsx          Slash / insert / turn-into menu with filtering
    EmojiPicker.tsx        Icon picker
    icons.tsx              Inline SVG icons
  lib/
    storage.ts             Load/save/reset and workspace validation
    seed.ts                Sample workspace and empty-page factory
    caret.ts               Caret offsets, splitting, and text helpers
    id.ts                  ID generation
  store/
    WorkspaceContext.tsx   Reducer, provider, debounced save
    actions.ts             Workspace action union
    context.ts             React context contract
    useWorkspace.ts        Typed context hook
  styles.css               Design tokens, layout, light/dark themes
  types.ts                 Page, Block, and workspace types
```

## REA research notes

Juvio was studied with [REA](https://github.com/rea-tools/rea) before implementation:

- Target: Notion Desktop **7.41.1.0** (Electron **44.9.1**) on Windows.
- The shipped `app.asar` contains only the desktop shell (main process, preload, updater, window management).
- The renderer, editor, and product logic are loaded remotely from `notion.so` / `app.notion.com`; they are not part of the installed archive.
- Conclusion: there was no product implementation in the shipped desktop archive to reuse. Juvio's architecture and UI were therefore designed from scratch, using observed interaction patterns (blocks, slash menu, Markdown prefixes, page tree) as behavioral references.
- No proprietary source, assets, or trademarks were copied. Analysis was read-only.

## Roadmap

Planned, roughly in order:

- Undo/redo history, including block structure changes.
- Drag to reorder blocks and pages.
- Page actions (duplicate, move, delete from the page header).
- Markdown import/export and full-workspace JSON export.
- Richer blocks: images, callouts, toggles, and synced links.
- Multi-tab safety and larger, indexed persistence (e.g. IndexedDB).

## Known limitations

- Storage is browser `localStorage`, so very large workspaces can exceed the quota.
- Two tabs editing the same workspace can overwrite each other (last write wins).
- Inline formatting uses `document.execCommand`, which is deprecated but still universally supported.
- Blocks support plain text plus bold/italic/underline; there are no mentions, links, or embeds yet.
- The UI is optimized for desktop; mobile layout is functional but not tuned.
