# Social Growth AI - Chrome Extension Auto-Installer
# $PSScriptRoot = folder this .ps1 lives in (bulletproof)

$ErrorActionPreference = "Continue"
$ExtPath = $PSScriptRoot
$appUrl  = "https://social-growth-ai-nu.vercel.app"

Write-Host ""
Write-Host "  Extension folder: $ExtPath" -ForegroundColor Cyan

# ── Validate the extension folder has manifest.json ──────────────────────────
if (-not (Test-Path -LiteralPath "$ExtPath\manifest.json")) {
    Write-Host "  [ERROR] manifest.json not found in $ExtPath" -ForegroundColor Red
    Write-Host "  Make sure you extracted the full ZIP and run from the extracted folder." -ForegroundColor Yellow
    exit 1
}

# ── Find Chrome ───────────────────────────────────────────────────────────────
$chromePaths = @(
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$chrome = $null
foreach ($p in $chromePaths) {
    if (Test-Path -LiteralPath $p) { $chrome = $p; break }
}
if (-not $chrome) {
    try {
        $r = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -EA SilentlyContinue)."(Default)"
        if ($r -and (Test-Path -LiteralPath $r)) { $chrome = $r }
    } catch {}
}
if (-not $chrome) {
    $c = Get-Command "chrome.exe" -ErrorAction SilentlyContinue
    if ($c) { $chrome = $c.Source }
}
if (-not $chrome) {
    Write-Host "  [ERROR] Chrome not found. Install from https://www.google.com/chrome" -ForegroundColor Red
    exit 1
}
Write-Host "  Chrome: $chrome" -ForegroundColor Green

# ── Dedicated profile (does NOT disturb existing Chrome windows) ──────────────
$profile = "$env:APPDATA\SocialGrowthAI-Profile"
if (-not (Test-Path -LiteralPath $profile)) {
    New-Item -ItemType Directory -Path $profile -Force | Out-Null
}
Write-Host "  Profile: $profile" -ForegroundColor Gray

# ── Launch Chrome — CRITICAL: pass as ONE single string (not array) ────────────
# When PowerShell Start-Process receives an array, it mis-quotes each item.
# Passing a single string sends the args exactly as Chrome expects them.
Write-Host ""
Write-Host "  Launching Chrome with extension..." -ForegroundColor Cyan

$argString = "--user-data-dir=`"$profile`" --load-extension=`"$ExtPath`" --no-first-run --no-default-browser-check --new-window `"$appUrl`""
Start-Process -FilePath $chrome -ArgumentList $argString
Start-Sleep -Seconds 3

# ── Create a Desktop shortcut so user never needs to run installer again ──────
Write-Host "  Creating desktop shortcut..." -ForegroundColor Cyan
$desktop   = [Environment]::GetFolderPath("Desktop")
$lnkPath   = "$desktop\Social Growth AI.lnk"
$wsh       = New-Object -ComObject WScript.Shell
$shortcut  = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath       = $chrome
$shortcut.Arguments        = "--user-data-dir=`"$profile`" --load-extension=`"$ExtPath`" --no-first-run `"$appUrl`""
$shortcut.WorkingDirectory = $ExtPath
$shortcut.Description      = "Social Growth AI with Smart Content Import Extension"
$shortcut.IconLocation     = $chrome
$shortcut.Save()
Write-Host "  Desktop shortcut created: Social Growth AI.lnk" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   Extension installed successfully!" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Chrome just opened WITH the extension loaded." -ForegroundColor White
Write-Host "  Look for the purple bolt icon in the TOP-RIGHT toolbar." -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: Use the desktop shortcut 'Social Growth AI'" -ForegroundColor Yellow
Write-Host "  to open Chrome with the extension active in future." -ForegroundColor Yellow
Write-Host ""
Write-Host "  To use the extension:" -ForegroundColor Gray
Write-Host "   1. Click puzzle-piece icon in Chrome toolbar" -ForegroundColor Gray
Write-Host "   2. Find Social Growth AI and click the pin icon" -ForegroundColor Gray
Write-Host "   3. Visit any Instagram/TikTok/LinkedIn post" -ForegroundColor Gray
Write-Host "   4. Click the bolt icon to send content to the app" -ForegroundColor Gray
Write-Host ""
exit 0
