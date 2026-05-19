#!/bin/bash
set -e

echo "Building FolderTree (Electron) for macOS..."
cd "$(dirname "$0")/Electron"
npm install
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir

if [ -d "dist/mac-arm64" ]; then
    echo ""
    echo "✓ Build complete: Electron/dist/mac-arm64/FolderTree.app"
elif [ -d "dist/mac-universal" ]; then
    echo ""
    echo "✓ Build complete: Electron/dist/mac-universal/FolderTree.app"
else
    echo ""
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "Note: Swift version is much smaller (2MB vs 441MB)"
echo "Build Swift version with: cd Swift && xcodebuild -scheme FolderTree build"
