# Social Growth AI - Chrome Extension Installer
# Installs into the user's DEFAULT Chrome profile so it works everywhere.

$ErrorActionPreference = "Continue"
$ExtPath = $PSScriptRoot
$appUrl  = "https://social-growth-ai-nu.vercel.app/extension"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Social Growth AI - Extension Installer" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ── Validate extension folder ─────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath "$ExtPath\manifest.json")) {
    Write-Host "  [ERROR] manifest.json not found." -ForegroundColor Red
    Write-Host "  Run install.bat from the extracted folder, not inside the ZIP." -ForegroundColor Yellow
    exit 1
}
Write-Host "  Extension folder: $ExtPath" -ForegroundColor Gray

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
    Write-Host "  [ERROR] Chrome not found. Install from https://www.google.com/chrome" -ForegroundColor Red
    exit 1
}
Write-Host "  Chrome: $chrome" -ForegroundColor Green

# ── Close all Chrome windows so --load-extension takes effect ─────────────────
$running = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host ""
    Write-Host "  Closing Chrome to apply the extension..." -ForegroundColor Yellow
    Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  Chrome closed." -ForegroundColor Gray
}

# ── Launch Chrome with extension into the DEFAULT profile ─────────────────────
# NO --user-data-dir so the extension loads into the user's regular Chrome.
Write-Host ""
Write-Host "  Opening Chrome with extension installed..." -ForegroundColor Cyan

$argString = "--load-extension=`"$ExtPath`" --no-first-run --no-default-browser-check `"$appUrl`""
Start-Process -FilePath $chrome -ArgumentList $argString
Start-Sleep -Seconds 3

# ── Create Desktop shortcut (always opens Chrome with extension active) ────────
Write-Host "  Creating desktop shortcut..." -ForegroundColor Cyan

$desktop  = [Environment]::GetFolderPath("Desktop")
$lnkPath  = "$desktop\Social Growth AI (Extension).lnk"
$wsh      = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath       = $chrome
$shortcut.Arguments        = "--load-extension=`"$ExtPath`" --no-first-run `"https://social-growth-ai-nu.vercel.app`""
$shortcut.WorkingDirectory = $ExtPath
$shortcut.Description      = "Open Social Growth AI with the Smart Content Import Extension"
$shortcut.IconLocation     = $chrome
$shortcut.Save()

Write-Host "  Shortcut created on Desktop." -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   Extension installed! Chrome is opening." -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  HOW TO SEE THE EXTENSION:" -ForegroundColor White
Write-Host "   - Look for the PUZZLE PIECE icon (top-right of Chrome)" -ForegroundColor Cyan
Write-Host "   - Click it, find 'Social Growth AI', click the PIN" -ForegroundColor Cyan
Write-Host "   - The bolt icon will appear permanently in your toolbar" -ForegroundColor Cyan
Write-Host ""
Write-Host "  IMPORTANT - FOR FUTURE USE:" -ForegroundColor Yellow
Write-Host "   Always open Chrome via the 'Social Growth AI (Extension)'" -ForegroundColor Yellow
Write-Host "   shortcut on your Desktop to keep the extension active." -ForegroundColor Yellow
Write-Host ""
exit 0
