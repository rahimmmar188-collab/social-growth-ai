@echo off
title Social Growth AI - Extension Installer
color 0B

echo.
echo  ==============================================
echo   Social Growth AI - Smart Content Import
echo   Extension Installer v2.0
echo  ==============================================
echo.

:: ── Detect if running from inside a ZIP ──────────────────────────────────────
echo %~dp0 | findstr /i "Temp" >nul
if %errorlevel% equ 0 (
    color 0C
    echo.
    echo  [ERROR] You are running this from INSIDE the ZIP file!
    echo.
    echo  Please do this first:
    echo   1. Close this window
    echo   2. Right-click the ZIP file
    echo   3. Choose "Extract All"
    echo   4. Open the extracted folder
    echo   5. Double-click install.bat again
    echo.
    pause
    exit /b 1
)

:: ── Check for Node.js ─────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo  [WARN] Node.js not found - skipping icon generation.
    echo  Icons may not display. Download Node from https://nodejs.org
    echo.
    goto :skip_icons
)

:: ── Generate icons ────────────────────────────────────────────────────────────
echo  [1/3] Generating extension icons...
node "%~dp0generate-icons.js"
if %errorlevel% neq 0 (
    echo  [WARN] Icon generation had issues - using defaults.
)
echo  [OK] Icons ready.
echo.

:skip_icons

:: ── Run PowerShell installer ──────────────────────────────────────────────────
echo  [2/3] Installing extension into Chrome...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

echo.
echo  [3/3] COMPLETE!
echo.
echo  ============================================================
echo   Chrome has opened to the Extensions page.
echo  ============================================================
echo.
echo   NEXT STEPS (takes 30 seconds):
echo.
echo   1. Look at Chrome - it should show the Extensions page
echo   2. Find "Social Growth AI" in the list
echo   3. Make sure its toggle is ON (blue/enabled)
echo   4. Click the PUZZLE PIECE icon in Chrome's top-right corner
echo   5. Click the PIN icon next to "Social Growth AI"
echo   6. DONE - the icon now permanently shows in your toolbar!
echo.
echo   TIP: Always use the "Social Growth AI" shortcut on your
echo   Desktop to keep the extension active when browsing.
echo.
pause
