#!/bin/bash
set -e

echo "Building FolderTree for macOS..."
cd "$(dirname "$0")"
npm install
npx electron-builder --mac --dir

if [ -d "dist/mac-arm64" ]; then
    rm -rf "dist/mac"
    mv "dist/mac-arm64" "dist/mac"
    echo ""
    echo "✓ Build complete: dist/mac/FolderTree.app"
elif [ -d "dist/mac-universal" ]; then
    rm -rf "dist/mac"
    mv "dist/mac-universal" "dist/mac"
    echo ""
    echo "✓ Build complete: dist/mac/FolderTree.app"
elif [ -d "dist/mac-unpacked" ]; then
    rm -rf "dist/mac"
    mv "dist/mac-unpacked" "dist/mac"
    echo ""
    echo "✓ Build complete: dist/mac/FolderTree.app"
else
    echo ""
    echo "✗ Build failed"
    exit 1
fi
