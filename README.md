# FolderTree

A cross-platform desktop application that displays folder structures as a tree and provides file preview capabilities.

## Features

- **Tree View** — Left pane shows folders and files in a hierarchical tree with expand/collapse
- **Preview Tab** — Right pane renders file previews (images, markdown, HTML, plain text with line numbers)
- **Source Tab** — View raw file source code
- **Split View** — Show preview and source side-by-side
- **Toggle Pane** — Hide/show the right pane with one click
- **Resizable Splitter** — Drag to adjust pane widths
- **File Icons** — Contextual icons based on file extension

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm start
```

### Build

**Windows** (run on Windows):
```bash
npm run build:win
```

**macOS** (run on macOS):
```bash
npm run build:mac
```

**Both** (requires macOS for Mac build):
```bash
npm run build:all
```

Built apps are output to `dist/windows/` and `dist/mac/`.

## Project Structure

```
FolderTree/
├── src/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Context bridge (IPC)
│   └── renderer/
│       ├── index.html   # App shell
│       ├── styles.css   # Dark theme UI
│       └── app.js       # Tree rendering & file preview logic
├── dist/
│   ├── windows/         # Windows build output
│   └── mac/             # macOS build output
├── package.json
└── README.md
```

## Usage

1. Launch the app
2. Click **📂 Open Folder** to select a directory
3. Browse the tree on the left, click files to view them
4. Switch between **Preview**, **Source**, or **Split** tabs
5. Click **◧** to toggle the right pane

## License

MIT
