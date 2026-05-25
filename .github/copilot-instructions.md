# Copilot Instructions

## Architecture

FolderTree is a folder tree viewer with file preview, implemented as **three independent apps** sharing the same feature set but no code:

- **Swift/** — Native macOS app (SwiftUI, Xcode project). Targets macOS 13.0+.
- **WPF/** — Native Windows app (C#/.NET 8, WPF + WinForms interop). Self-contained deployment.
- **Electron/** — Cross-platform app (Node.js + Chromium). Uses Sharp for image processing (TIFF/HEIC support).

Each version implements: lazy-loaded folder tree, file preview for 30+ types with syntax highlighting, drag & drop, and system theme support.

## Build Commands

### Electron (cross-platform)
```bash
cd Electron
npm install
npm start              # Dev mode
npm run build:win      # Package for Windows
npm run build:mac      # Package for macOS
```

### WPF (Windows)
```batch
cd WPF
dotnet run --project FolderTree\FolderTree.csproj
:: Or use build.bat for release build
```

### Swift (macOS)
```bash
cd Swift
xcodebuild -scheme FolderTree -configuration Release build
```

### Root-level build scripts
- `build-win.bat` — Builds the Electron version for Windows
- `build-mac.sh` — Builds the Electron version for macOS

## Key Conventions

- Each platform version is fully self-contained in its directory; changes to one don't affect others.
- The Electron app follows main/preload/renderer separation (`src/main.js`, `src/preload.js`, `src/renderer/`).
- The WPF app uses code-behind pattern (XAML + `.xaml.cs`), not MVVM.
- Sharp is unpacked from asar in Electron builds (native module requirement).
- No test suites exist in any of the three implementations.
