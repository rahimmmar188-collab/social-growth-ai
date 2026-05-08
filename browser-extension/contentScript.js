// ── Content Script — injected into social media pages ────────────────────────
// Extracts real post captions, video URLs, and engagement data.
// Priority: structured data > DOM scraping > selected text > body fallback.

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

  // ── Caption selectors by platform ──────────────────────────────────────────
  const CAPTION_SELECTORS = {
    instagram: [
      "._a9zs._a9zw._a9zx._a9zy",
      "h1._aacl._aaco._aacu._aacx._aad7",
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
    ],
    twitter: [
      "[data-testid='tweetText']",
      "article [lang] span",
    ],
    facebook: [
      "[data-ad-preview='message']",
      "div[data-testid='post_message']",
      "[data-ad-comet-preview='message']",
    ],
  };

  /** Extract caption text using platform-specific selectors */
  function extractCaption(platform) {
    const selectors = CAPTION_SELECTORS[platform] || [];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        const texts = Array.from(elements)
          .map((el) => el.innerText?.trim())
          .filter((t) => t && t.length > 20);
        if (texts.length > 0) return texts.join("\n\n");
      } catch (_) { /* ignore */ }
    }
    // Fallback: selected text
    const sel = window.getSelection()?.toString()?.trim();
    if (sel && sel.length > 30) return sel;
    // Fallback: first long paragraph
    const paras = Array.from(document.querySelectorAll("p, span, div[role='article']"))
      .map((el) => el.innerText?.trim())
      .filter((t) => t && t.length > 80 && !t.includes("{") && !t.includes("function"));
    if (paras.length > 0) return paras.slice(0, 3).join("\n\n");
    return (document.body.innerText || "").slice(0, 2000).trim();
  }

  /** Extract direct video URL from the page */
  function extractVideoUrl(platform) {
    // 1. Direct <video src> (not blob)
    const videoEl = document.querySelector("video[src]");
    if (videoEl && videoEl.src && !videoEl.src.startsWith("blob:")) {
      return videoEl.src;
    }
    // 2. <video><source src> (not blob)
    const sourceEl = document.querySelector("video source[src]");
    if (sourceEl && sourceEl.src && !sourceEl.src.startsWith("blob:")) {
      return sourceEl.src;
    }
    // 3. Instagram: scan JSON script tags for video_url
    if (platform === "instagram") {
      const scripts = document.querySelectorAll("script[type='application/json']");
      for (const s of scripts) {
        try {
          const match = s.textContent.match(/"video_url"\s*:\s*"([^"]+)"/);
          if (match) return match[1].replace(/\\/g, "");
        } catch (_) { /* skip */ }
      }
      // Also try inline script content
      const allScripts = document.querySelectorAll("script:not([src])");
      for (const s of allScripts) {
        try {
          const match = s.textContent.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          if (match) return match[0];
        } catch (_) { /* skip */ }
      }
    }
    // 4. TikTok: look for .mp4 in network requests (via page source scan)
    if (platform === "tiktok") {
      const allScripts = document.querySelectorAll("script:not([src])");
      for (const s of allScripts) {
        try {
          const match = s.textContent.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          if (match) return match[0];
        } catch (_) { /* skip */ }
      }
    }
    return "";
  }

  /** Extract engagement metrics */
  function extractEngagement(platform) {
    let likes = "0", views = "0", commentsCount = "0";
    try {
      if (platform === "instagram") {
        // Likes: aria-label containing "like"
        const likeEl = document.querySelector("[aria-label*='like' i], section a[href*='liked_by']");
        if (likeEl) {
          const match = (likeEl.textContent || likeEl.getAttribute("aria-label") || "").match(/[\d,]+/);
          if (match) likes = match[0].replace(/,/g, "");
        }
        // Views: aria-label containing "view" or "play"
        const viewEl = document.querySelector("[aria-label*='view' i], [aria-label*='play' i]");
        if (viewEl) {
          const match = (viewEl.getAttribute("aria-label") || viewEl.textContent || "").match(/[\d,]+/);
          if (match) views = match[0].replace(/,/g, "");
        }
      }
      if (platform === "tiktok") {
        const likeEl = document.querySelector("[data-e2e='like-count']");
        if (likeEl) likes = (likeEl.textContent || "0").replace(/[^0-9]/g, "") || "0";
        const viewEl = document.querySelector("[data-e2e='video-views']");
        if (viewEl) views = (viewEl.textContent || "0").replace(/[^0-9KkMm.]/g, "") || "0";
      }
    } catch (_) { /* non-fatal */ }
    return { likes, views, commentsCount };
  }

  /** Extract creator info */
  function extractCreator(platform) {
    let username = "", profileUrl = "";
    try {
      if (platform === "instagram") {
        const userLink = document.querySelector("a[href^='/'][role='link'] span, header a[role='link']");
        if (userLink) {
          username = userLink.textContent?.trim() || "";
          const href = userLink.closest("a")?.getAttribute("href") || "";
          profileUrl = href ? `https://instagram.com${href}` : "";
        }
      }
      if (platform === "tiktok") {
        const userEl = document.querySelector("[data-e2e='browse-username']");
        if (userEl) {
          username = userEl.textContent?.trim() || "";
          profileUrl = window.location.origin + "/" + username.replace("@", "");
        }
      }
    } catch (_) { /* non-fatal */ }
    return { username, profileUrl };
  }

  // ── Message listener from popup ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "EXTRACT_CONTENT") {
      const platform = detectPlatform(hostname);

      const caption    = extractCaption(platform);
      const videoUrl   = extractVideoUrl(platform);
      const engagement = extractEngagement(platform);
      const creator    = extractCreator(platform);

      sendResponse({
        // Legacy field (backward compat with existing analyzer pages)
        content: caption,

        // New structured fields for multimodal pipeline
        videoUrl,
        caption,
        engagement,
        creator,
        postMeta: {
          postUrl:   window.location.href,
          timestamp: new Date().toISOString(),
        },
        platform,
        title: document.title,
      });
    }
    return true; // keep channel open for async
  });

  // ── Auto-announce readiness to background ─────────────────────────────────
  chrome.runtime.sendMessage({ action: "CONTENT_SCRIPT_READY", hostname });
})();
