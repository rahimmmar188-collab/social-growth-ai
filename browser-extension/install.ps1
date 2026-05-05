# Social Growth AI - Chrome Extension Permanent Installer v3
# Strategy:
# 1. Copy extension to AppData (permanent safe location)
# 2. Launch Chrome with --load-extension pointing to AppData path
# 3. Open chrome://extensions page so user can see + pin the extension
# 4. Create Desktop shortcut that ALWAYS uses --load-extension
# (This is the only reliable developer-mode method without Chrome Web Store)

$ErrorActionPreference = "SilentlyContinue"
$SourcePath = $PSScriptRoot

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Social Growth AI - Extension Installer" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ── Validate extension folder ─────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath "$SourcePath\manifest.json")) {
    Write-Host "  [ERROR] manifest.json not found." -ForegroundColor Red
    Write-Host "  Extract the ZIP first, then run install.bat." -ForegroundColor Yellow
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
        $r = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe")."(Default)"
        if ($r -and (Test-Path -LiteralPath $r)) { $chrome = $r }
    } catch {}
}
if (-not $chrome) {
    Write-Host "  [ERROR] Chrome not found. Install Google Chrome and try again." -ForegroundColor Red
    exit 1
}
Write-Host "  Chrome: $chrome" -ForegroundColor Green

# ── Copy extension to a permanent location in AppData ─────────────────────────
$InstallDir = "$env:LOCALAPPDATA\SocialGrowthAI\Extension"
Write-Host "  Installing to: $InstallDir" -ForegroundColor Gray

if (Test-Path -LiteralPath $InstallDir) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item -Path "$SourcePath\*" -Destination $InstallDir -Recurse -Force
Write-Host "  Files installed successfully." -ForegroundColor Green

# ── Detect last-used Chrome profile to skip the profile picker ────────────────
$ChromeLocalState = "$env:LOCALAPPDATA\Google\Chrome\User Data\Local State"
$profileDir = "Default"
try {
    $localState = Get-Content -LiteralPath $ChromeLocalState -Raw | ConvertFrom-Json
    $lastUsed   = $localState.profile.last_used
    if ($lastUsed) { $profileDir = $lastUsed }
} catch {}
Write-Host "  Chrome profile: $profileDir" -ForegroundColor Gray

# ── Close Chrome so --load-extension takes effect ─────────────────────────────
$running = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host ""
    Write-Host "  Closing Chrome to apply changes..." -ForegroundColor Yellow
    Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Host "  Chrome closed." -ForegroundColor Gray
}

# ── Create Desktop shortcut (this is the permanent solution) ──────────────────
# The shortcut always passes --load-extension so the extension is ALWAYS active
$desktop  = [Environment]::GetFolderPath("Desktop")
$lnkPath  = "$desktop\Social Growth AI.lnk"
$wsh      = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath       = $chrome
$shortcut.Arguments        = "--profile-directory=`"$profileDir`" --load-extension=`"$InstallDir`" --no-first-run --no-default-browser-check `"https://social-growth-ai-nu.vercel.app`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description      = "Open Social Growth AI with Smart Content Import Extension"
$shortcut.IconLocation     = $chrome
$shortcut.Save()
Write-Host "  Desktop shortcut 'Social Growth AI' created." -ForegroundColor Green

# ── Launch Chrome via --load-extension, opening chrome://extensions ───────────
Write-Host ""
Write-Host "  Launching Chrome with the extension active..." -ForegroundColor Cyan

$extUrl     = "chrome://extensions"
$siteUrl    = "https://social-growth-ai-nu.vercel.app"
$launchArgs = "--profile-directory=`"$profileDir`" --load-extension=`"$InstallDir`" --no-first-run --no-default-browser-check `"$extUrl`""
Start-Process -FilePath $chrome -ArgumentList $launchArgs

Start-Sleep -Seconds 4

# ── Print instructions ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  =================================================" -ForegroundColor Green
Write-Host "   Extension loaded! Chrome is now open." -ForegroundColor Green
Write-Host "  =================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  STEP-BY-STEP - DO THIS NOW:" -ForegroundColor White
Write-Host ""
Write-Host "   [1] Chrome opened to the Extensions page" -ForegroundColor Cyan
Write-Host "       You should see 'Social Growth AI - Smart Import' listed" -ForegroundColor Gray
Write-Host ""
Write-Host "   [2] Make sure its toggle is turned ON (blue)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   [3] Click the PUZZLE PIECE icon in Chrome toolbar (top-right)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   [4] Find 'Social Growth AI' and click the PIN icon" -ForegroundColor Cyan
Write-Host "       The bolt icon will now PERMANENTLY appear in your toolbar!" -ForegroundColor Green
Write-Host ""
Write-Host "  EVERY TIME YOU WANT TO USE IT:" -ForegroundColor Yellow
Write-Host "   Use the 'Social Growth AI' shortcut on your Desktop." -ForegroundColor Yellow
Write-Host "   This keeps the extension active in Chrome." -ForegroundColor Yellow
Write-Host ""
exit 0
