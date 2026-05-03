@echo off
:: Social Growth AI — Extension Auto-Installer
:: Double-click this file to install the extension automatically.
:: No manual steps needed — Chrome will open with the extension ready.

title Social Growth AI — Extension Installer
color 0B

echo.
echo  ==============================================
echo   Social Growth AI - Smart Content Import
echo   Auto-Installer
echo  ==============================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    echo  Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [1/3] Generating extension icons...
node "%~dp0generate-icons.js"
if %errorlevel% neq 0 (
    echo  [ERROR] Icon generation failed.
    pause
    exit /b 1
)
echo  [OK] Icons ready.
echo.

echo  [2/3] Running PowerShell installer...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -ExtPath "%~dp0"
if %errorlevel% neq 0 (
    echo.
    echo  [FALLBACK] Opening Chrome manually...
    echo  Please follow the instructions in the window that opens.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process 'chrome' -ArgumentList '--load-extension=\"%~dp0\"', 'https://social-growth-ai-nu.vercel.app'"
)

echo.
echo  [3/3] Done!
echo.
echo  Look for the purple lightning bolt icon in your Chrome toolbar.
echo  Pin it by clicking the puzzle-piece icon in Chrome toolbar.
echo.
pause
