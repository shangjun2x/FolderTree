# FolderTree WPF

Native Windows app built with WPF (.NET 8).

## Requirements

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

## Build

```batch
build.bat
```

Or manually:

```batch
dotnet publish FolderTree\FolderTree.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

## Run

```batch
dotnet run --project FolderTree\FolderTree.csproj
```

## Features

- 📁 Folder tree with lazy loading
- 👀 File preview (images, JSON, code)
- 🎨 Syntax highlighting (C#, JS, Python, SQL, YAML)
- 🌙 Dark theme
- ⚡ Fast native performance
- 📦 Single EXE (~15 MB self-contained)

## Size Comparison

| Version | Size |
|---------|------|
| WPF (.NET) | ~15 MB |
| Swift (macOS) | ~2 MB |
| Electron | ~441 MB |
