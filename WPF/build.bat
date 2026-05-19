@echo off
echo Building FolderTree (WPF) for Windows...
cd /d "%~dp0"

REM Check for dotnet
where dotnet >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: .NET SDK not found. Install from https://dotnet.microsoft.com/download
    exit /b 1
)

REM Build
dotnet publish FolderTree\FolderTree.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist

if exist "dist\FolderTree.exe" (
    echo.
    echo Build complete: dist\FolderTree.exe
) else (
    echo.
    echo Build failed
    exit /b 1
)
