@echo off
echo Building FolderTree (Electron) for Windows...
cd /d "%~dp0\Electron"
call npm install
call npx electron-builder --win --dir
if exist "dist\win-unpacked" (
    echo.
    echo ✓ Build complete: Electron\dist\win-unpacked\FolderTree.exe
) else (
    echo.
    echo ✗ Build failed
    exit /b 1
)
