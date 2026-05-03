// ── Background service worker ─────────────────────────────────────────────────
// Handles messages and keeps track of content script readiness.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "CONTENT_SCRIPT_READY") {
    // Content script has loaded — nothing needed here, just acknowledge
    console.log("[SocialGrowthAI] Content script ready on:", msg.hostname);
  }
});

// Open the app when the extension icon is clicked (if no popup — not used here
// but good to have for future use)
chrome.action.onClicked && chrome.action.onClicked.addListener(() => {
  // popup.html handles the click — this fires only if default_popup is not set
});
