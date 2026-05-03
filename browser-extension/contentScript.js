// ── Content Script — injected into social media pages ────────────────────────
// Extracts real post captions using platform-specific selectors,
// then falls back to selected text → innerText.

(function () {
  "use strict";

  const hostname = window.location.hostname.replace("www.", "");

  /** Detect platform name from hostname */
  function detectPlatform(host) {
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com"))    return "tiktok";
    if (host.includes("linkedin.com"))  return "linkedin";
    if (host.includes("twitter.com") || host.includes("x.com")) return "twitter";
    if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
    return "unknown";
  }

  /**
   * Platform-specific selectors (tried in order).
   * These target the actual post caption / tweet text / article body.
   * Falls back to selected text, then body innerText.
   */
  function extractContent(platform) {
    const selectors = {
      instagram: [
        "._a9zs._a9zw._a9zx._a9zy",          // Caption on post page
        "h1._aacl._aaco._aacu._aacx._aad7",    // Alt caption
        "[data-testid='post-comment-root'] span",
        "article span[class*='_aa'] span",
        "div._a9zs span",
        "article div > span",
      ],
      tiktok: [
        "[data-e2e='browse-video-desc']",
        "[data-e2e='video-desc']",
        ".video-meta-caption span",
        "h1[data-e2e]",
        ".desc span",
      ],
      linkedin: [
        ".feed-shared-update-v2__description span[dir]",
        ".update-components-text span[dir]",
        ".feed-shared-text span[dir]",
        ".attributed-text-segment-list__content",
        "[data-ad-description]",
        "article .reader-article-content",
      ],
      twitter: [
        "[data-testid='tweetText']",
        "article [lang] span",
        "[data-testid='tweet'] [lang]",
      ],
      facebook: [
        "[data-ad-preview='message']",
        "div[data-testid='post_message']",
        "div[class*='userContent'] p",
        ".userContent",
        "[data-ad-comet-preview='message']",
      ],
    };

    const candidates = selectors[platform] || [];

    // Try platform-specific selectors first
    for (const selector of candidates) {
      try {
        const elements = document.querySelectorAll(selector);
        const texts = Array.from(elements)
          .map((el) => el.innerText?.trim())
          .filter((t) => t && t.length > 20);
        if (texts.length > 0) {
          return texts.join("\n\n");
        }
      } catch (_) { /* ignore invalid selector */ }
    }

    // Fallback 1: User-selected text
    const selection = window.getSelection()?.toString()?.trim();
    if (selection && selection.length > 30) return selection;

    // Fallback 2: First long paragraph on the page
    const paragraphs = Array.from(document.querySelectorAll("p, span, div[role='article']"))
      .map((el) => el.innerText?.trim())
      .filter((t) => t && t.length > 80 && !t.includes("{") && !t.includes("function"));
    if (paragraphs.length > 0) {
      return paragraphs.slice(0, 3).join("\n\n");
    }

    // Fallback 3: body.innerText (truncated to 2000 chars)
    return (document.body.innerText || "").slice(0, 2000).trim();
  }

  // ── Message listener from popup ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "EXTRACT_CONTENT") {
      const platform = detectPlatform(hostname);
      const content = extractContent(platform);

      sendResponse({
        content: content,
        platform: platform,
        url: window.location.href,
        title: document.title,
      });
    }
    return true; // keep channel open for async
  });

  // ── Auto-announce readiness to background ────────────────────────────────────
  chrome.runtime.sendMessage({ action: "CONTENT_SCRIPT_READY", hostname });
})();
