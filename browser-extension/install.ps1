# Social Growth AI - Chrome Extension Auto-Installer
# $PSScriptRoot = the folder this .ps1 file lives in (bulletproof, no parameter needed)

$ErrorActionPreference = "Continue"

$ExtPath = $PSScriptRoot
Write-Host ""
Write-Host "  Extension folder: $ExtPath" -ForegroundColor Cyan

# ── Find Chrome ──────────────────────────────────────────────────────────────
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
        $reg = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -EA SilentlyContinue)."(Default)"
        if ($reg -and (Test-Path -LiteralPath $reg)) { $chrome = $reg }
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

# ── Dedicated profile (does NOT close existing Chrome windows) ────────────────
$profile = "$env:APPDATA\SocialGrowthAI-Profile"
if (-not (Test-Path -LiteralPath $profile)) {
    New-Item -ItemType Directory -Path $profile -Force | Out-Null
}
Write-Host "  Profile: $profile" -ForegroundColor Gray

# ── Launch Chrome with extension ──────────────────────────────────────────────
Write-Host ""
Write-Host "  Launching Chrome..." -ForegroundColor Cyan

# Build argument list — double-quote paths that may contain spaces
$args = @(
    "--user-data-dir=`"$profile`""
    "--load-extension=`"$ExtPath`""
    "--no-first-run"
    "--no-default-browser-check"
    "--new-window"
    "https://social-growth-ai-nu.vercel.app"
)

Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   Extension installed successfully!" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Chrome just opened with the extension loaded" -ForegroundColor Gray
Write-Host "  2. Click the puzzle-piece icon in the Chrome toolbar" -ForegroundColor Gray
Write-Host "  3. Pin Social Growth AI to keep it visible" -ForegroundColor Gray
Write-Host "  4. Go to any Instagram, TikTok, or LinkedIn post" -ForegroundColor Gray
Write-Host "  5. Click the icon to send content into the app" -ForegroundColor Gray
Write-Host ""
Write-Host "  Note: Your existing Chrome windows are untouched." -ForegroundColor DarkGray
Write-Host ""
exit 0
