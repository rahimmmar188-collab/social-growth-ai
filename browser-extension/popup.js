// ── Social Growth AI — Smart Content Import Popup ────────────────────────────
"use strict";

const DEFAULT_APP_URL = "https://social-growth-ai-nu.vercel.app";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const platformDot    = document.getElementById("platformDot");
const platformLabel  = document.getElementById("platformLabel");
const previewBox     = document.getElementById("previewBox");
const previewText    = document.getElementById("previewText");
const previewChars   = document.getElementById("previewChars");
const warningBox     = document.getElementById("warningBox");
const warningText    = document.getElementById("warningText");
const sendBtn        = document.getElementById("sendBtn");
const btnIcon        = document.getElementById("btnIcon");
const btnText        = document.getElementById("btnText");
const statusSuccess  = document.getElementById("statusIdle");
const statusError    = document.getElementById("statusError");
const errorText      = document.getElementById("errorText");
const openAppLink    = document.getElementById("openAppLink");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel  = document.getElementById("settingsPanel");
const appUrlInput    = document.getElementById("appUrlInput");
const saveSettingsBtn = document.getElementById("saveSettings");

// ── State ─────────────────────────────────────────────────────────────────────
let extractedData = null; // full structured object from contentScript
let appUrl = DEFAULT_APP_URL;

// ── Platform helpers ──────────────────────────────────────────────────────────
const PLATFORM_NAMES = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  linkedin:  "LinkedIn",
  twitter:   "Twitter / X",
  facebook:  "Facebook",
  unknown:   "Unknown page",
};

const SUPPORTED = ["instagram", "tiktok", "linkedin", "twitter", "facebook"];

function setPlatformUI(platform, supported) {
  platformDot.className = "platform-dot " + (supported ? platform : "unsupported");
  platformLabel.textContent = supported
    ? `📍 ${PLATFORM_NAMES[platform] || platform} detected`
    : `⚠ Not a supported platform`;
  platformLabel.style.color = supported
    ? "rgba(241,240,255,0.85)"
    : "rgba(245,158,11,0.85)";
}

// ── Load saved settings ───────────────────────────────────────────────────────
chrome.storage.sync.get(["appUrl"], (result) => {
  appUrl = result.appUrl || DEFAULT_APP_URL;
  appUrlInput.value = appUrl;
  openAppLink.href = appUrl;
  openAppLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: appUrl });
  });
});

// ── Save settings ─────────────────────────────────────────────────────────────
saveSettingsBtn.addEventListener("click", () => {
  const val = appUrlInput.value.trim();
  if (!val) return;
  appUrl = val;
  chrome.storage.sync.set({ appUrl: val }, () => {
    saveSettingsBtn.textContent = "Saved ✓";
    setTimeout(() => { saveSettingsBtn.textContent = "Save"; }, 1500);
    settingsPanel.style.display = "none";
  });
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.style.display =
    settingsPanel.style.display === "none" ? "flex" : "none";
});

// ── Main: get current tab and extract content ─────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.id) {
    setPlatformUI("unknown", false);
    showWarning("Could not access current tab.");
    return;
  }

  const tabUrl = tab.url || "";
  const platform = detectPlatformFromUrl(tabUrl);
  const supported = SUPPORTED.includes(platform);

  setPlatformUI(platform, supported);

  if (!supported) {
    showWarning("Navigate to Instagram, TikTok, LinkedIn, Twitter/X, or Facebook to extract content.");
    return;
  }

  // Inject content script if needed, then extract
  try {
    let result = await tryExtract(tab.id);
    if (!result) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contentScript.js"],
      });
      result = await tryExtract(tab.id);
    }

    if (result && result.content && result.content.length > 10) {
      extractedData = { ...result, platform };

      // Show what was captured
      const hasVideo = !!result.videoUrl;
      const captionLen = (result.caption || result.content || "").length;
      showPreview(result.caption || result.content, captionLen, hasVideo);
      sendBtn.disabled = false;
    } else {
      showWarning("No caption found. Try selecting the post text first, then click the extension.");
    }
  } catch (err) {
    console.warn("[SocialGrowthAI] Extract error:", err);
    showWarning("Couldn't access this page. Try refreshing and clicking the extension again.");
  }
});

/** Try to send EXTRACT_CONTENT message to content script */
function tryExtract(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { action: "EXTRACT_CONTENT" }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response || null);
      });
    } catch { resolve(null); }
  });
}

/** Detect platform from URL */
function detectPlatformFromUrl(url) {
  if (!url) return "unknown";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com"))    return "tiktok";
  if (url.includes("linkedin.com"))  return "linkedin";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "facebook";
  return "unknown";
}

// ── Show preview ──────────────────────────────────────────────────────────────
function showPreview(content, charCount, hasVideoUrl) {
  previewText.textContent = content;

  const videoTag = hasVideoUrl
    ? " · 🎬 Video URL captured"
    : " · ⚠ No direct video URL (captions only)";
  previewChars.textContent = `${charCount} chars${videoTag}`;
  previewBox.style.display = "block";
  warningBox.style.display = "none";
}

function showWarning(msg) {
  warningText.textContent = msg;
  warningBox.style.display = "flex";
  previewBox.style.display = "none";
  sendBtn.disabled = true;
}

// ── Send button ───────────────────────────────────────────────────────────────
sendBtn.addEventListener("click", async () => {
  if (!extractedData) return;

  sendBtn.disabled = true;
  sendBtn.classList.add("sending");
  btnText.textContent = "Sending…";
  btnIcon.classList.add("spin");
  setSpinIcon();

  statusSuccess.style.display = "none";
  statusError.style.display = "none";

  try {
    const res = await fetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Legacy field (backward compat)
        content: extractedData.caption || extractedData.content,

        // New structured fields for multimodal pipeline
        videoUrl:   extractedData.videoUrl   || "",
        caption:    extractedData.caption    || extractedData.content || "",
        engagement: extractedData.engagement || { likes: "0", views: "0" },
        creator:    extractedData.creator    || { username: "", profileUrl: "" },
        postMeta:   extractedData.postMeta   || { postUrl: extractedData.url, timestamp: new Date().toISOString() },

        // Standard fields
        platform: extractedData.platform,
        url:      extractedData.postMeta?.postUrl || extractedData.url,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Server returned ${res.status}: ${body}`);
    }

    const json = await res.json();
    console.log("[SocialGrowthAI] Sent:", json.sessionId, "| videoUrl:", !!extractedData.videoUrl);
    chrome.storage.session && chrome.storage.session.set({ lastSessionId: json.sessionId });
    showSuccess();
  } catch (err) {
    console.error("[SocialGrowthAI] Send error:", err);
    showError(err.message || "Failed to send. Check your connection.");
    sendBtn.disabled = false;
    sendBtn.classList.remove("sending");
    resetBtnIcon();
    btnText.textContent = "Retry";
  }
});

function showSuccess() {
  sendBtn.classList.remove("sending");
  btnText.textContent = "Sent!";
  btnIcon.classList.remove("spin");
  setCheckIcon();
  statusSuccess.style.display = "block";
  statusError.style.display = "none";
  setTimeout(() => { chrome.tabs.create({ url: appUrl + "/spy-recreate" }); }, 1500);
}

function showError(msg) {
  errorText.textContent = msg;
  statusError.style.display = "flex";
  statusSuccess.style.display = "none";
}

function setSpinIcon() {
  btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 2v11M2 7.5h11" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}
function setCheckIcon() {
  btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M3 7.5l3 3 6-6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function resetBtnIcon() {
  btnIcon.classList.remove("spin");
  btnIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M13 7.5L2 2l2.5 5.5L2 13l11-5.5z" fill="currentColor"/>
  </svg>`;
}
