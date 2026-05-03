@echo off
title Social Growth AI - Extension Installer
color 0B

echo.
echo  ==============================================
echo   Social Growth AI - Smart Content Import
echo   Auto-Installer
echo  ==============================================
echo.

:: Detect if running from inside a ZIP (Windows extracts to Temp)
echo %~dp0 | findstr /i "Temp" >nul
if %errorlevel% equ 0 (
    echo.
    echo  [ERROR] Please EXTRACT the ZIP file first!
    echo  Right-click the ZIP and choose "Extract All".
    echo  Then run install.bat from the extracted folder.
    echo.
    pause
    exit /b 1
)

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is required but not found.
    echo  Download it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Generate icons
echo  [1/3] Generating icons...
node "%~dp0generate-icons.js"
if %errorlevel% neq 0 (
    echo  [WARN] Icon generation had an issue - continuing anyway.
)
echo  [OK] Icons ready.
echo.

:: Run the PowerShell installer (no arguments - it uses $PSScriptRoot)
echo  [2/3] Installing Chrome extension...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

echo.
echo  [3/3] Done!
echo.
echo  Chrome is now open with the extension loaded.
echo  Click the puzzle-piece icon in Chrome and pin Social Growth AI.
echo.
pause
