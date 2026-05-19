# FolderTree

A modern folder tree viewer with file preview, available in **Swift** (macOS), **WPF** (Windows), and **Electron** (cross-platform).

![macOS](https://img.shields.io/badge/macOS-13.0+-blue) ![Windows](https://img.shields.io/badge/Windows-10+-blue) ![Swift](https://img.shields.io/badge/Swift-5.0-orange) ![.NET](https://img.shields.io/badge/.NET-8.0-purple) ![Electron](https://img.shields.io/badge/Electron-28.0-blue)

## Features

- 📁 **Folder tree** with lazy loading for fast performance
- 👀 **File preview** for 30+ file types
- 🎨 **Syntax highlighting** for code files
- 🖱️ **Drag & drop** to move files and folders
- 🌙 **Light/Dark theme** support (system automatic)
- 🔗 **External links** open in browser

### Supported File Types

| Category | Extensions | Preview Type |
|----------|------------|--------------|
| **Code** | Swift, JS, TS, Python, Ruby, Go, Rust, Java, C#, C/C++ | Syntax highlighted |
| **Data** | JSON, YAML, XML, SQL | Syntax highlighted / Tree view |
| **Web** | HTML, CSS, SCSS, Markdown | Rendered preview |
| **Images** | PNG, JPG, GIF, WebP, SVG, TIFF, HEIC, ICNS | Native preview |
| **Documents** | PDF | Native preview |
| **Shell** | Bash, Zsh, Fish | Syntax highlighted |

## Versions

### Swift (macOS - Recommended)

- **Size:** ~2 MB
- **Platform:** macOS 13.0+
- **Performance:** Native, fast, low memory

```bash
cd Swift
open FolderTree.app
# Or build from source:
xcodebuild -scheme FolderTree -configuration Release build
```

### WPF (Windows - Recommended)

- **Size:** ~15 MB (self-contained)
- **Platform:** Windows 10/11
- **Performance:** Native, fast

```batch
cd WPF
build.bat
:: Or run directly:
dotnet run --project FolderTree\FolderTree.csproj
```

### Electron (Cross-platform)

- **Size:** ~441 MB
- **Platform:** macOS, Windows
- **Note:** Includes TIFF support via Sharp library

```bash
cd Electron
npm install
npm start           # Run in development
npm run build:mac   # Build for macOS
npm run build:win   # Build for Windows
```

## Project Structure

```
FolderTree/
├── Swift/                    # Native macOS app (2 MB)
│   ├── FolderTree.xcodeproj
│   ├── FolderTree/
│   └── FolderTree.app
│
├── WPF/                      # Native Windows app (15 MB)
│   ├── FolderTree.sln
│   ├── FolderTree/
│   └── dist/
│
├── Electron/                 # Cross-platform (441 MB)
│   ├── src/
│   ├── package.json
│   └── dist/
│
├── build-mac.sh
└── build-win.bat
```

## Size Comparison

| Version | Size | Platform |
|---------|------|----------|
| **Swift** | 2 MB | macOS |
| **WPF** | 15 MB | Windows |
| **Electron** | 441 MB | Cross-platform |

## License

MIT
