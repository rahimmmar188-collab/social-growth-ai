// ── Content Script v2.0 — injected into social media pages ───────────────────
// Extracts real post captions, video URLs, engagement data.
// Supports: Instagram, TikTok, YouTube, LinkedIn, Twitter/X, Facebook

(function () {
  "use strict";

  const hostname = window.location.hostname.replace("www.", "");

  /** Detect platform from hostname */
  function detectPlatform(host) {
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com"))    return "tiktok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("linkedin.com"))  return "linkedin";
    if (host.includes("twitter.com") || host.includes("x.com")) return "twitter";
    if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
    if (host.includes("threads.net"))   return "threads";
    return "unknown";
  }

  // ── Caption selectors by platform ──────────────────────────────────────────
  const CAPTION_SELECTORS = {
    instagram: [
      "._a9zs._a9zw._a9zx._a9zy",
      "h1._aacl._aaco._aacu._aacx._aad7",
      "article div._a9zs span",
      "[data-testid='post-comment-root'] span",
      "article span[class*='_aa'] span",
      "article div > span",
    ],
    tiktok: [
      "[data-e2e='browse-video-desc']",
      "[data-e2e='video-desc']",
      ".video-meta-caption span",
      "h1[data-e2e]",
      ".desc span",
      "[class*='DivVideoInfoContainer'] span",
    ],
    youtube: [
      "#description-inline-expander yt-attributed-string",
      "#description .ytd-text-inline-expander",
      "#meta-contents #description",
      "ytd-video-secondary-info-renderer #description",
      "#description-text",
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
    threads: [
      "article div[dir='auto']",
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

  /** Extract the video URL from the page */
  function extractVideoUrl(platform) {
    // ── YouTube: extract from window.location ─────────────────────────────
    if (platform === "youtube") {
      const url = window.location.href;
      if (url.includes("youtube.com/watch") || url.includes("youtu.be/")) {
        return url; // Return the full YouTube URL — Gemini will analyze it natively
      }
      return "";
    }

    // ── TikTok: try direct video element first ────────────────────────────
    if (platform === "tiktok") {
      // Direct video element
      const videoEl = document.querySelector("video");
      if (videoEl) {
        if (videoEl.src && !videoEl.src.startsWith("blob:")) return videoEl.src;
        const sourceEl = videoEl.querySelector("source[src]");
        if (sourceEl && !sourceEl.src.startsWith("blob:")) return sourceEl.src;
      }
      // Scan inline scripts for .mp4 URLs
      const allScripts = document.querySelectorAll("script:not([src])");
      for (const s of allScripts) {
        try {
          // TikTok stores video URLs in __NEXT_DATA__ or similar script tags
          const match = s.textContent.match(/"playAddr"\s*:\s*"([^"]+\.mp4[^"]*)"/);
          if (match) return decodeURIComponent(match[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/"));
          const match2 = s.textContent.match(/https:\/\/[^\s"']+\.mp4[^\s"']*/);
          if (match2) return match2[0];
        } catch (_) { /* skip */ }
      }
      // Use the page URL as fallback — yt-dlp can handle it
      return window.location.href;
    }

    // ── Instagram: scan for direct .mp4 in scripts ────────────────────────
    if (platform === "instagram") {
      const scripts = document.querySelectorAll("script[type='application/json']");
      for (const s of scripts) {
        try {
          const match = s.textContent.match(/"video_url"\s*:\s*"([^"]+)"/);
          if (match) return match[1].replace(/\\/g, "");
        } catch (_) { /* skip */ }
      }
      const allScripts = document.querySelectorAll("script:not([src])");
      for (const s of allScripts) {
        try {
          const match = s.textContent.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/);
          if (match) return match[0];
        } catch (_) { /* skip */ }
      }
      // Fallback: return page URL (yt-dlp will handle auth if needed)
      return window.location.href;
    }

    // ── Generic: direct <video src> (not blob) ────────────────────────────
    const videoEl = document.querySelector("video[src]");
    if (videoEl && videoEl.src && !videoEl.src.startsWith("blob:")) return videoEl.src;
    const sourceEl = document.querySelector("video source[src]");
    if (sourceEl && sourceEl.src && !sourceEl.src.startsWith("blob:")) return sourceEl.src;

    return "";
  }

  /** Extract video title (useful for YouTube) */
  function extractTitle(platform) {
    try {
      if (platform === "youtube") {
        const el = document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string, #title h1");
        if (el) return el.innerText.trim();
      }
    } catch (_) { /* ignore */ }
    return document.title || "";
  }

  /** Extract engagement metrics */
  function extractEngagement(platform) {
    let likes = "0", views = "0", commentsCount = "0";
    try {
      if (platform === "youtube") {
        // Likes
        const likeBtn = document.querySelector("like-button-view-model .yt-spec-button-shape-next__button-text-content, #segmented-like-button span.yt-formatted-string");
        if (likeBtn) likes = likeBtn.textContent.trim().replace(/,/g, "");
        // Views  
        const viewEl = document.querySelector(".view-count, #count .ytd-video-view-count-renderer");
        if (viewEl) {
          const match = viewEl.textContent.match(/[\d,]+/);
          if (match) views = match[0].replace(/,/g, "");
        }
      }
      if (platform === "instagram") {
        const likeEl = document.querySelector("[aria-label*='like' i], section a[href*='liked_by']");
        if (likeEl) {
          const match = (likeEl.textContent || likeEl.getAttribute("aria-label") || "").match(/[\d,]+/);
          if (match) likes = match[0].replace(/,/g, "");
        }
        const viewEl = document.querySelector("[aria-label*='view' i], [aria-label*='play' i]");
        if (viewEl) {
          const match = (viewEl.getAttribute("aria-label") || viewEl.textContent || "").match(/[\d,]+/);
          if (match) views = match[0].replace(/,/g, "");
        }
      }
      if (platform === "tiktok") {
        const likeEl = document.querySelector("[data-e2e='like-count']");
        if (likeEl) likes = (likeEl.textContent || "0").replace(/[^0-9KkMm.]/g, "") || "0";
        const viewEl = document.querySelector("[data-e2e='video-views'], strong[data-e2e='video-views']");
        if (viewEl) views = (viewEl.textContent || "0").replace(/[^0-9KkMm.]/g, "") || "0";
      }
    } catch (_) { /* non-fatal */ }
    return { likes, views, commentsCount };
  }

  /** Extract creator info */
  function extractCreator(platform) {
    let username = "", profileUrl = "";
    try {
      if (platform === "youtube") {
        const channelEl = document.querySelector("#channel-name a, ytd-channel-name a");
        if (channelEl) {
          username = channelEl.textContent.trim();
          profileUrl = channelEl.href || "";
        }
      }
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

  // ── Message listener from popup ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "EXTRACT_CONTENT") {
      const platform  = detectPlatform(hostname);
      const caption   = extractCaption(platform);
      const videoUrl  = extractVideoUrl(platform);
      const engagement = extractEngagement(platform);
      const creator   = extractCreator(platform);
      const title     = extractTitle(platform);

      sendResponse({
        // Legacy field (backward compat)
        content: caption,

        // Structured fields for multimodal pipeline
        videoUrl,
        caption,
        title,
        engagement,
        creator,
        postMeta: {
          postUrl:   window.location.href,
          timestamp: new Date().toISOString(),
        },
        platform,
      });
    }
    return true; // keep channel open for async
  });

  // ── Auto-announce readiness to background ──────────────────────────────────
  chrome.runtime.sendMessage({ action: "CONTENT_SCRIPT_READY", hostname });
})();
