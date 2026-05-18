@echo off
echo Building FolderTree for Windows...
cd /d "%~dp0"
call npm install
call npx electron-builder --win --dir
if exist "dist\win-unpacked" (
    if exist "dist\windows" rmdir /s /q "dist\windows"
    ren "dist\win-unpacked" "windows"
    echo.
    echo ✓ Build complete: dist\windows\FolderTree.exe
) else (
    echo.
    echo ✗ Build failed
    exit /b 1
)
