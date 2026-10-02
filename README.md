# FreeBuff

**FreeBuff** is a local-first, offline Markdown knowledge-management desktop app — a fast, Obsidian-style note-taking experience built with **Tauri 2** + **React 19** + **CodeMirror 6**.

Open any folder as a *vault*, edit Markdown notes in a live-preview editor, navigate files in a tree, and see backlinks between your notes update in real time. Your notes stay plain `.md` files on your own disk — no cloud, no lock-in, no account.

---

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Building a Release](#building-a-release)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Backend API (Tauri Commands)](#backend-api-tauri-commands)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Contributing](#contributing)

---

## Highlights

- **Local-first vault** — point FreeBuff at any directory; every note remains a plain `.md` file on your filesystem.
- **Live-preview Markdown editor** — CodeMirror 6 with syntax highlighting, inline rendering of bold/italic/headings/links, line numbers, code folding, bracket auto-close, search, undo/redo, and a custom light/dark theme.
- **Obsidian-style `[[wikilinks]]`** — parse `[[note]]`, `[[note|alias]]`, `[[note#heading]]`, `[[note#^blockid]]` and `![[embed]]`.
- **Backlinks panel** — a bidirectional link index (outgoing + incoming) is maintained in memory and updated incrementally as you type.
- **File tree sidebar** — directories sorted first, then case-insensitive alphabetical order; hidden files, `.git`, `.obsidian`, `node_modules`, `target`, etc. are filtered out.
- **Multi-tab editing** — open many notes at once, dirty markers, click-to-close with sensible active-tab fallback.
- **Frontmatter properties panel** — view and edit YAML frontmatter key/value pairs of the active note.
- **File-system watcher** — external changes (created/removed/renamed files, edits from other apps) are detected via `notify` and synced into the UI; clean tabs auto-refresh, dirty tabs are never clobbered.
- **Full CRUD on disk** — create, rename, move, and delete files and folders from the UI.
- **Vanilla Vault format** — vaults are just folders of Markdown, so they work with git, Syncthing, Dropbox, or any other sync tool.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) |
| Frontend | React 19, TypeScript 5.7, Vite 6 |
| State | Zustand 5 |
| Editor | CodeMirror 6 (`@codemirror/*`, `@lezer/*`) |
| Styling | Tailwind CSS 3.4 + PostCSS + Autoprefixer |
| FS events | [`notify`](https://crates.io/crates/notify) 7 (recursive watcher) |
| FS traversal | [`walkdir`](https://crates.io/crates/walkdir) |
| Link parsing | [`regex`](https://crates.io/crates/regex) |
| Tauri plugins | `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-shell` |

---

## Architecture

FreeBuff follows a two-process model: a Rust backend that owns all disk I/O and watching, and a React frontend that owns all UI state.

```
┌──────────────────────────────────────────────┐
│  React frontend (src/)                       │
│                                              │
│  Zustand store ── tabs / file tree / index   │
│  Components   ── Sidebar, TabBar, Editor...   │
│  Hooks        ── useFileWatcher, useLinkIndex│
│       │  invoke("command", args)  │          │
└───────┼───────────────────────────┼──────────┘
        ▼                           ▲  events ("fs-event")
┌──────────────────────────────────────────────┐
│  Rust backend (src-tauri/src/lib.rs)         │
│                                              │
│  AppState (Mutex): vault path, path<->id     │
│  Commands: open/read/write/create/rename/... │
│  notify watcher ── emits "fs-event"          │
│  scan_vault_links ── wikilink extraction      │
└──────────────────────────────────────────────┘
        ▼
   Plain .md files on disk (your vault)
```

**Design notes**

- **Stable node IDs**: every path gets a UUID that is mapped both ways (`path_id_map` / `id_path_map`), so React keys and tab references survive tree refreshes.
- **Debounced refresh**: rapid bursts of FS events are coalesced into a single tree rebuild; `modify` events are only forwarded for `.md` files.
- **Incremental link index**: the full index is built once by a Rust `walkdir` scan, then updated per-file on every keystroke — no re-scan of the whole vault while typing.

---

## Project Structure

```
freebuff/
├── index.html                 # Vite entry HTML
├── package.json               # JS deps + scripts
├── vite.config.ts             # Vite + Tauri dev server (port 1420)
├── tsconfig.json / tsconfig.node.json
├── tailwind.config.js         # Design tokens (colors, spacing)
├── postcss.config.js
├── src/                       # React frontend
│   ├── main.tsx               # React root
│   ├── App.tsx                # Layout, vault bootstrap, shortcuts
│   ├── index.css              # Tailwind layers + globals
│   ├── components/
│   │   ├── Sidebar.tsx        # Vault picker + file tree + backlinks
│   │   ├── FileTree.tsx       # Recursive tree, context actions
│   │   ├── TabBar.tsx         # Open tabs, dirty markers
│   │   ├── MarkdownEditor.tsx # CodeMirror 6 editor
│   │   ├── FrontmatterPanel.tsx
│   │   └── BacklinksPanel.tsx
│   ├── editor/
│   │   ├── theme.ts           # FreeBuff light/dark CM theme
│   │   ├── livePreview.ts     # Inline markdown rendering
│   │   └── obsidianSyntax.ts   # Wikilink / callout highlighting
│   ├── hooks/
│   │   ├── useFileWatcher.ts  # Listens to "fs-event" from Rust
│   │   └── useLinkIndex.ts    # Builds/maintains link index
│   ├── lib/
│   │   ├── frontmatter.ts     # YAML frontmatter parse/serialize
│   │   └── linkIndex.ts       # outgoing/incoming link maps
│   ├── store/useStore.ts      # Zustand app state
│   ├── types/index.ts         # Shared TS types (FileNode, Tab...)
│   └── utils/ignore.ts        # Name filters mirrored from Rust
└── src-tauri/                 # Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json        # App id, window, plugin scopes
    ├── build.rs
    └── src/
        ├── main.rs            # Binary entry point
        └── lib.rs             # Commands, AppState, watcher, link scan
```

---

## Prerequisites

- **Node.js** ≥ 18 (20+ recommended) and **npm**
- **Rust** toolchain (stable) — [rustup.rs](https://rustup.rs)
- **Tauri 2 system dependencies** — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)
  - **Windows**: Microsoft Visual C++ Build Tools + WebView2 (pre-installed on Win 10/11)
  - **macOS**: Xcode command line tools (`xcode-select --install`)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

Verify your toolchain:

```bash
node -v      # v18+
cargo -V     # cargo 1.70+
rustc -V
```

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/freebuff.git
cd freebuff

# 2. Install JS dependencies
npm install

# 3. Start the app in development mode (Vite + Tauri, hot reload)
npm run tauri dev
```

On first launch the app is empty — click **Open Vault** in the sidebar and choose a folder containing Markdown notes (or create one). The folder tree appears immediately and every `.md` file inside is openable.

> **Browser-only preview:** `npm run dev` starts just the Vite dev server on `http://localhost:1420`. The UI loads, but file operations require the Tauri runtime, so use `npm run tauri dev` for the real experience.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (frontend only, no Tauri IPC) |
| `npm run build` | Type-check with `tsc` then build production assets to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run tauri dev` | Launch the desktop app in dev mode with hot reload |
| `npm run tauri build` | Package a platform-native installer/binary |

---

## Building a Release

```bash
npm run tauri build
```

This runs `tsc && vite build`, compiles the Rust binary in release mode, and produces an installer under `src-tauri/target/release/bundle/`:

- **Windows** — `.msi` / `.exe` (NSIS)
- **macOS** — `.dmg` / `.app`
- **Linux** — `.deb` / `.AppImage`

A bare binary is also emitted at `src-tauri/target/release/`.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` / `Cmd` + `S` | Save the active note to disk |
| `Ctrl` / `Cmd` + `Shift` + `B` | Toggle the sidebar |
| `Ctrl` / `Cmd` + `F` | Search inside the editor (CodeMirror search) |
| `Ctrl` / `Cmd` + `Z` / `Shift+Z` | Undo / redo |
| `Tab` | Indent (with selection awareness) |
| `Ctrl` / `Cmd` + `Space` | Autocomplete |

---

## Backend API (Tauri Commands)

All commands live in `src-tauri/src/lib.rs` and are invoked from the frontend via `invoke("<name>", { ...args })`.

| Command | Args | Returns | Purpose |
| --- | --- | --- | --- |
| `open_vault` | `path` | `FileNode` | Set the active vault and build the file tree |
| `refresh_file_tree` | – | `FileNode` | Rebuild the tree, preserving existing path↔ID mappings |
| `get_vault_path` | – | `string \| null` | Read back the last opened vault (used to auto-restore) |
| `read_file` | `path` | `string` | Read a file's UTF-8 contents |
| `write_file` | `path`, `content` | `()` | Write a file, creating parent directories as needed |
| `create_file` | `path`, `content?` | `()` | Create a new file |
| `create_directory` | `path` | `()` | Create a new folder |
| `rename_path` | `old_path`, `new_path` | `()` | Rename or move a file/folder |
| `delete_path` | `path` | `()` | Delete a file or a whole directory |
| `resolve_path_id` | `path` | `string` | Get/create the stable ID for a path |
| `resolve_id_path` | `id` | `string` | Resolve a stable ID back to a path |
| `start_watcher` | – | `()` | Start recursive `notify` watching; emits `fs-event` |
| `stop_watcher` | – | `()` | Stop the watcher |
| `scan_vault_links` | – | `FileLinks[]` | Extract wikilinks from every `.md` file in the vault |

**Frontend → backend events**

- `fs-event` payload: `{ kind: "create" | "modify" | "remove" | "rename", paths: string[] }`

---

## Configuration

| File | What it controls |
| --- | --- |
| `src-tauri/tauri.conf.json` | Product name `FreeBuff`, app id `com.freebuff.app`, window size (1200×800, min 800×600), dev URL (`http://localhost:1420`), build commands, FS/dialog/shell plugin scopes |
| `src-tauri/Cargo.toml` | Rust crate metadata and native dependencies |
| `tailwind.config.js` | Design tokens: `bg-primary`, `border`, `text-muted`, `accent`, etc. |
| `vite.config.ts` | Vite plugins, dev-server port, strict port binding |
| `tsconfig.json` | TypeScript strictness and path resolution |

The filesystem plugin is intentionally scoped to `**` so any folder you pick can be opened as a vault — tighten the `plugins.fs.scope` entry in `tauri.conf.json` if you ship to untrusted environments.

---

## How It Works

1. **Opening a vault** — `open_vault` stores the path, clears the ID maps, walks the directory with `fs::read_dir`, filters ignored names, and returns a recursive `FileNode` tree sorted directories-first.
2. **Editing** — clicking a file reads it via `read_file` and pushes it into a Zustand tab. Edits update tab state only; `Ctrl+S` calls `write_file` and clears the dirty flag.
3. **Watching** — `start_watcher` creates a `RecommendedWatcher` on a background thread that forwards events to the webview as `fs-event`. The `useFileWatcher` hook debounces create/remove/rename into a `refresh_file_tree` call, and re-reads modified `.md` files into any clean tabs.
4. **Backlinks** — `scan_vault_links` walks every `.md` file with `walkdir` and extracts `[[...]]` targets using a regex (aliases, headings, and block IDs stripped). `useLinkIndex` builds outgoing/incoming maps and keeps them fresh as tabs change.
5. **Frontmatter** — `src/lib/frontmatter.ts` parses and re-serializes YAML frontmatter so the properties panel can edit metadata without touching the note body.

---

## Contributing

Contributions are welcome.

1. Fork the repository and create a feature branch: `git checkout -b feature/my-feature`
2. Install dependencies: `npm install`
3. Make your changes, keeping the existing TypeScript/React and Rust style
4. Verify: `npm run build` (runs `tsc` + `vite build`) and `npm run tauri dev`
5. Commit with a clear message and open a pull request

Please open an issue first for large changes so the design can be discussed.

---

**FreeBuff** — your notes, your files, your machine.

---

Built by **Girish Lade** — [ladestack.in](https://ladestack.in)
