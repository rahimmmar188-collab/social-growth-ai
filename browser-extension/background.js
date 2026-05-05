// ── Background service worker ─────────────────────────────────────────────────
// Handles messages and keeps track of content script readiness.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "CONTENT_SCRIPT_READY") {
    // Content script has loaded — nothing needed here, just acknowledge
    console.log("[SocialGrowthAI] Content script ready on:", msg.hostname);
  }
});

// Show a notification when the extension is installed via the script
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.notifications.create("install-notification", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Social Growth AI Installed!",
      message: "The Smart Content Import extension is now active. Click the puzzle icon in Chrome to pin it to your toolbar.",
      priority: 2,
      requireInteraction: true
    });
  }
});

// If the user clicks the notification, open the extension UI in a new tab
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === "install-notification") {
    chrome.tabs.create({ url: "popup.html" });
    chrome.notifications.clear(notificationId);
  }
});

// Open the app when the extension icon is clicked (if no popup — not used here
// but good to have for future use)
chrome.action.onClicked && chrome.action.onClicked.addListener(() => {
  // popup.html handles the click — this fires only if default_popup is not set
});
