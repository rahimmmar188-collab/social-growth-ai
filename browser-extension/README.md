# Social Growth AI — Smart Content Import
## Chrome Extension

Extract real social media captions and send them directly into Social Growth AI for accurate AI analysis — no copy-pasting needed.

---

## ⚡ Installation — One Double-Click

### Just double-click `install.bat`

That's it. The installer automatically:
1. Generates the extension icons
2. Finds your Chrome installation
3. Restarts Chrome with the extension pre-loaded
4. Opens the Social Growth AI app

```
browser-extension/
└── install.bat   ← Double-click this
```

> **After Chrome opens:** Click the 🧩 puzzle-piece icon in the top-right of the Chrome toolbar, find **"Social Growth AI"**, and click the 📌 pin icon to keep it visible.

---

## 🚀 How to Use

### Workflow
1. **Go to any supported social media post** (Instagram, TikTok, LinkedIn, Twitter/X, Facebook)
2. **Click the Social Growth AI extension icon** in the toolbar
3. The extension detects the platform and extracts the post caption automatically
4. Click **"Send to Social Growth AI"**
5. The web app opens automatically — the content is pre-loaded and ready to analyze

### Supported Platforms
| Platform | Extraction Method |
|---|---|
| 🟣 Instagram | Caption text from post page |
| 🎵 TikTok | Video description |
| 💼 LinkedIn | Post body text |
| 🐦 Twitter / X | Tweet text |
| 👥 Facebook | Post message |

### Tips for best results
- **Navigate to the specific post page** (not the feed) before clicking the extension
- If no caption is detected, **select the post text manually** then click the extension
- For Instagram Stories or Reels, go to the individual post URL

---

## ⚙️ Configuration

Click the **⚙ gear icon** in the extension popup to change the app URL.

- Default: `https://social-growth-ai-nu.vercel.app`
- Change this if you are running the app locally (e.g. `http://localhost:3000`)

The setting is saved automatically across sessions.

---

## 🔄 How It Works

```
User clicks extension icon
    ↓
Extension detects platform from tab URL
    ↓
Content script extracts post caption using platform-specific selectors
    ↓
Popup shows preview of extracted text (char count)
    ↓
User clicks "Send to Social Growth AI"
    ↓
POST /api/extract { content, platform, url }
    ↓
App opens automatically (spy-recreate page)
    ↓
App auto-detects imported content on page load (Part 7)
Shows 🟢 "Imported real content from browser" banner
    ↓
User clicks Analyze → AI uses REAL content (no hallucinations)
    ↓
Session deleted after analysis (Part 9 cleanup)
```

---

## 📁 File Structure

```
browser-extension/
├── manifest.json        ← Chrome extension config (Manifest V3)
├── popup.html           ← Extension popup UI
├── popup.js             ← Popup logic: platform detect, extract, send to API
├── contentScript.js     ← Injected into pages: extracts captions
├── background.js        ← Service worker (minimal)
├── styles.css           ← Dark glassmorphism popup styles
├── generate-icons.js    ← Script to generate PNG icons
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔐 Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's URL to detect platform |
| `scripting` | Inject content script to extract post text |
| `storage` | Save the app URL setting across sessions |
| `host_permissions: https://*/*` | POST to the Social Growth AI API endpoint |

---

## 🛠 Development

To test locally:
1. Change the App URL in the extension settings to `http://localhost:3000`
2. Run `npm run dev` in the main project
3. Use the extension on any social media page
4. The content will appear pre-loaded in the Analyzer and Spy & Recreate pages

---

## ✅ Success Criteria

- [x] User installs extension in Developer Mode
- [x] Clicking icon on Instagram/TikTok/LinkedIn/Twitter/Facebook detects platform
- [x] Caption is extracted and previewed in popup
- [x] Content sent to `POST /api/extract`
- [x] App opens and auto-detects content on page load
- [x] Analysis runs with 🟢 High Accuracy badge (real content, no hallucinations)
- [x] Session is deleted after analysis completes (no stale data)
- [x] All existing app features remain unchanged
