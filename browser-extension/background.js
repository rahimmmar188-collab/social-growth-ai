// ── Background service worker ─────────────────────────────────────────────────
// Handles messages and keeps track of content script readiness.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "CONTENT_SCRIPT_READY") {
    // Content script has loaded — nothing needed here, just acknowledge
    console.log("[SocialGrowthAI] Content script ready on:", msg.hostname);
  }
});

// Auto-open the popup when the extension is installed via the script
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Attempt to open the popup HTML in a standalone popup window
    // positioned near the top right of the screen
    chrome.system.display.getInfo((displays) => {
      const primaryDisplay = displays.find((d) => d.isPrimary) || displays[0];
      const width = 420;
      const height = 650;
      const left = primaryDisplay ? primaryDisplay.workArea.width - width - 20 : 9999;
      const top = primaryDisplay ? primaryDisplay.workArea.top + 20 : 20;

      chrome.windows.create({
        url: "popup.html",
        type: "popup",
        width: width,
        height: height,
        left: left,
        top: top
      });
    });
  }
});

// Open the app when the extension icon is clicked (if no popup — not used here
// but good to have for future use)
chrome.action.onClicked && chrome.action.onClicked.addListener(() => {
  // popup.html handles the click — this fires only if default_popup is not set
});
