# Social Growth AI - Chrome Extension Auto-Installer
# Uses a dedicated Chrome profile so existing tabs are never closed.

param(
    [string]$ExtPath = ""
)

$ErrorActionPreference = "Continue"

# Resolve extension path
if (-not $ExtPath) {
    $ExtPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$resolved = Resolve-Path $ExtPath -ErrorAction SilentlyContinue
if (-not $resolved) {
    Write-Host "  [ERROR] Could not resolve extension path." -ForegroundColor Red
    exit 1
}
$ExtPath = $resolved.Path.TrimEnd('\')

Write-Host ""
Write-Host "  Extension path: $ExtPath" -ForegroundColor Cyan

# Find Chrome
$chromeCandidates = @(
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($p in $chromeCandidates) {
    if (Test-Path $p) { $chromePath = $p; break }
}

if (-not $chromePath) {
    try {
        $reg = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue)."(Default)"
        if ($reg -and (Test-Path $reg)) { $chromePath = $reg }
    } catch {}
}

if (-not $chromePath) {
    $cmd = Get-Command "chrome" -ErrorAction SilentlyContinue
    if ($cmd) { $chromePath = $cmd.Source }
}

if (-not $chromePath) {
    Write-Host ""
    Write-Host "  [ERROR] Google Chrome was not found on this computer." -ForegroundColor Red
    Write-Host "  Please install Chrome from https://www.google.com/chrome" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "  Chrome found: $chromePath" -ForegroundColor Green

# Create a dedicated profile directory so existing Chrome windows are untouched
$profileDir = Join-Path $env:APPDATA "SocialGrowthAI-Extension"
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    Write-Host "  Created profile: $profileDir" -ForegroundColor Gray
}

# Launch Chrome with the extension loaded in the dedicated profile
Write-Host ""
Write-Host "  Launching Chrome with extension loaded..." -ForegroundColor Cyan

$appUrl = "https://social-growth-ai-nu.vercel.app"

$chromeArgs = @(
    "--user-data-dir=$profileDir",
    "--load-extension=$ExtPath",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    $appUrl
)

Start-Process -FilePath $chromePath -ArgumentList $chromeArgs

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   Extension installed successfully!" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "   1. Chrome just opened with the extension active" -ForegroundColor Gray
Write-Host "   2. Click the puzzle-piece icon in the toolbar" -ForegroundColor Gray
Write-Host "   3. Pin Social Growth AI for easy access" -ForegroundColor Gray
Write-Host "   4. Go to any Instagram, TikTok, or LinkedIn post" -ForegroundColor Gray
Write-Host "   5. Click the extension icon to send content to the app" -ForegroundColor Gray
Write-Host ""
Write-Host "  Your existing Chrome windows are untouched." -ForegroundColor DarkGray
Write-Host ""

exit 0
