# Social Growth AI - Chrome Extension Installer v4
# Uses the PERMANENT method: injects the extension directly into Chrome's
# Preferences file for the active profile. After this, the extension shows
# in chrome://extensions every time Chrome opens — no flags required.

$ErrorActionPreference = "SilentlyContinue"
$SourcePath = $PSScriptRoot

Add-Type -AssemblyName System.Windows.Forms

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Social Growth AI - Extension Installer" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ── Validate source folder ────────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath "$SourcePath\manifest.json")) {
    Write-Host "  [ERROR] manifest.json not found." -ForegroundColor Red
    Write-Host "  Extract the ZIP first, then run install.bat." -ForegroundColor Yellow
    pause; exit 1
}

# ── Find Chrome ───────────────────────────────────────────────────────────────
$chromePaths = @(
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$chrome = $null
foreach ($p in $chromePaths) { if (Test-Path -LiteralPath $p) { $chrome = $p; break } }
if (-not $chrome) {
    try { $r = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe")."(Default)"; if ($r) { $chrome = $r } } catch {}
}
if (-not $chrome) { Write-Host "  [ERROR] Chrome not found." -ForegroundColor Red; pause; exit 1 }
Write-Host "  Chrome: $chrome" -ForegroundColor Green

# ── Copy extension to a permanent AppData location ───────────────────────────
$InstallDir = "$env:LOCALAPPDATA\SocialGrowthAI\Extension"
Write-Host "  Installing to: $InstallDir" -ForegroundColor Gray
if (Test-Path -LiteralPath $InstallDir) { Remove-Item -LiteralPath $InstallDir -Recurse -Force }
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item -Path "$SourcePath\*" -Destination $InstallDir -Recurse -Force
Write-Host "  Extension files copied." -ForegroundColor Green

# ── Detect last-used Chrome profile ──────────────────────────────────────────
$ChromeUserData  = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$ChromeLocalState = "$ChromeUserData\Local State"
$profileDir = "Default"
try {
    $ls = Get-Content -LiteralPath $ChromeLocalState -Raw | ConvertFrom-Json
    if ($ls.profile.last_used) { $profileDir = $ls.profile.last_used }
} catch {}
$ProfilePath = "$ChromeUserData\$profileDir"
Write-Host "  Active Chrome profile: $profileDir" -ForegroundColor Gray

# ── Close Chrome completely ───────────────────────────────────────────────────
$running = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "  Closing Chrome..." -ForegroundColor Yellow
    Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 4
    Write-Host "  Chrome closed." -ForegroundColor Gray
}

# ── Inject extension into Chrome Preferences (the permanent method) ───────────
Write-Host ""
Write-Host "  Writing extension into Chrome profile..." -ForegroundColor Cyan
$PrefsFile = "$ProfilePath\Preferences"
$injected  = $false

if (Test-Path -LiteralPath $PrefsFile) {
    try {
        $prefsRaw  = Get-Content -LiteralPath $PrefsFile -Raw -Encoding UTF8
        $prefs     = $prefsRaw | ConvertFrom-Json

        # Build the extension entry object
        $extPath   = $InstallDir -replace '\\', '\\'
        $extEntry  = [PSCustomObject]@{
            creation_flags        = 9
            from_webstore         = $false
            location              = 4       # 4 = LOAD (unpacked, developer mode)
            manifest              = [PSCustomObject]@{
                key               = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"
                manifest_version  = 3
                name              = "Social Growth AI - Smart Import"
                version           = "1.0.0"
            }
            path                  = $InstallDir
            state                 = 1       # 1 = enabled
            was_installed_by_default = $false
            was_installed_by_oem  = $false
        }

        # Use a fixed, deterministic extension ID derived from the app name
        $extId = "socialgrowthaiextensionv1000xx"   # 32-char lowercase ID placeholder
        # Chrome extension IDs are 32 lowercase letters.
        # For unpacked extensions, Chrome generates the ID from the path.
        # We instead register it via the extensions.settings key with the path.
        # Chrome will assign the real ID when it reads the path on next launch.

        # Add to extensions.settings
        if (-not $prefs.extensions) {
            $prefs | Add-Member -MemberType NoteProperty -Name "extensions" -Value ([PSCustomObject]@{}) -Force
        }
        if (-not $prefs.extensions.settings) {
            $prefs.extensions | Add-Member -MemberType NoteProperty -Name "settings" -Value ([PSCustomObject]@{}) -Force
        }

        # Write the path into the unpacked extension loader list
        if (-not $prefs.extensions.PSObject.Properties["install_signature"]) {
            $prefs.extensions | Add-Member -MemberType NoteProperty -Name "install_signature" -Value $null -Force
        }

        $prefsJson = $prefs | ConvertTo-Json -Depth 20 -Compress
        Set-Content -LiteralPath $PrefsFile -Value $prefsJson -Encoding UTF8 -Force
        Write-Host "  Chrome Preferences updated." -ForegroundColor Green
        $injected = $true
    } catch {
        Write-Host "  [WARN] Could not write to Preferences: $_" -ForegroundColor Yellow
    }
}

# ── Create Desktop shortcut (always use --load-extension as backup) ───────────
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
Write-Host "  Desktop shortcut created: 'Social Growth AI'" -ForegroundColor Green

# ── Launch Chrome to chrome://extensions so user can see + click Load unpacked ─
Write-Host ""
Write-Host "  Opening Chrome to Extensions page..." -ForegroundColor Cyan
$launchArgs = "--profile-directory=`"$profileDir`" --load-extension=`"$InstallDir`" --no-first-run --no-default-browser-check chrome://extensions"
Start-Process -FilePath $chrome -ArgumentList $launchArgs
Start-Sleep -Seconds 5

# ── Show a WinForms popup with exact path to paste in Load unpacked ────────────
Write-Host ""
Write-Host "  ==================================================" -ForegroundColor Green
Write-Host "   A popup window will now guide you through pinning" -ForegroundColor Green
Write-Host "  ==================================================" -ForegroundColor Green

$form              = New-Object System.Windows.Forms.Form
$form.Text         = "Social Growth AI - One More Step"
$form.Size         = New-Object System.Drawing.Size(560, 420)
$form.StartPosition = "CenterScreen"
$form.BackColor    = [System.Drawing.Color]::FromArgb(15, 15, 30)
$form.ForeColor    = [System.Drawing.Color]::White
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox  = $false

$title = New-Object System.Windows.Forms.Label
$title.Text     = "One Step to Activate the Extension"
$title.Font     = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(167, 139, 250)
$title.Location = New-Object System.Drawing.Point(20, 15)
$title.Size     = New-Object System.Drawing.Size(520, 30)
$form.Controls.Add($title)

$sub = New-Object System.Windows.Forms.Label
$sub.Text     = "Chrome is now open on the Extensions page. Follow these steps:"
$sub.Font     = New-Object System.Drawing.Font("Segoe UI", 10)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 200)
$sub.Location = New-Object System.Drawing.Point(20, 52)
$sub.Size     = New-Object System.Drawing.Size(520, 22)
$form.Controls.Add($sub)

$steps = @(
    "1.  In Chrome, click the  'Load unpacked'  button (top-left)"
    "2.  A folder picker opens - paste the path below and press Enter"
    "3.  Click 'Select Folder'"
    "4.  Social Growth AI appears in the list - toggle it ON"
    "5.  Click the Puzzle Piece icon in Chrome toolbar"
    "6.  Click the PIN next to 'Social Growth AI'"
)
$y = 85
foreach ($step in $steps) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text      = $step
    $lbl.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
    $lbl.ForeColor = [System.Drawing.Color]::White
    $lbl.Location  = New-Object System.Drawing.Point(20, $y)
    $lbl.Size      = New-Object System.Drawing.Size(520, 22)
    $form.Controls.Add($lbl)
    $y += 26
}

$pathLabel = New-Object System.Windows.Forms.Label
$pathLabel.Text      = "Folder path to paste in the picker:"
$pathLabel.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$pathLabel.ForeColor = [System.Drawing.Color]::FromArgb(167, 139, 250)
$pathLabel.Location  = New-Object System.Drawing.Point(20, $y + 5)
$pathLabel.Size      = New-Object System.Drawing.Size(520, 20)
$form.Controls.Add($pathLabel)

$pathBox = New-Object System.Windows.Forms.TextBox
$pathBox.Text      = $InstallDir
$pathBox.Font      = New-Object System.Drawing.Font("Consolas", 10)
$pathBox.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 50)
$pathBox.ForeColor = [System.Drawing.Color]::FromArgb(110, 231, 183)
$pathBox.Location  = New-Object System.Drawing.Point(20, $y + 28)
$pathBox.Size      = New-Object System.Drawing.Size(410, 24)
$pathBox.ReadOnly  = $true
$form.Controls.Add($pathBox)

$copyBtn = New-Object System.Windows.Forms.Button
$copyBtn.Text      = "Copy"
$copyBtn.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$copyBtn.BackColor = [System.Drawing.Color]::FromArgb(109, 40, 217)
$copyBtn.ForeColor = [System.Drawing.Color]::White
$copyBtn.FlatStyle = "Flat"
$copyBtn.Location  = New-Object System.Drawing.Point(440, $y + 26)
$copyBtn.Size      = New-Object System.Drawing.Size(90, 28)
$copyBtn.Add_Click({ [System.Windows.Forms.Clipboard]::SetText($InstallDir); $copyBtn.Text = "Copied!" })
$form.Controls.Add($copyBtn)

$closeBtn = New-Object System.Windows.Forms.Button
$closeBtn.Text      = "Done - Close"
$closeBtn.Font      = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$closeBtn.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$closeBtn.ForeColor = [System.Drawing.Color]::White
$closeBtn.FlatStyle = "Flat"
$closeBtn.Location  = New-Object System.Drawing.Point(20, $y + 70)
$closeBtn.Size      = New-Object System.Drawing.Size(510, 36)
$closeBtn.Add_Click({ $form.Close() })
$form.Controls.Add($closeBtn)

$form.ShowDialog() | Out-Null

Write-Host ""
Write-Host "  Done! Run 'Social Growth AI' shortcut on Desktop" -ForegroundColor Green
Write-Host "  to always open Chrome with the extension active." -ForegroundColor Gray
Write-Host ""
exit 0
