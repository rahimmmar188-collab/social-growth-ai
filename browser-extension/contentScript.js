// ── Content Script v3.0 — Social Growth AI ────────────────────────────────────
// Extracts real captions, CDN video URLs, and engagement metrics.
// Supports: Instagram, TikTok, YouTube, LinkedIn, Twitter/X, Facebook, Threads

(function () {
  "use strict";

  const hostname = window.location.hostname.replace("www.", "");

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

  // ── Caption selectors ────────────────────────────────────────────────────────
  const CAPTION_SELECTORS = {
    instagram: [
      "article div._a9zs span",
      "h1._aacl._aaco._aacu._aacx._aad7",
      "._a9zs._a9zw",
      "[data-testid='post-comment-root'] span",
      "article span[class*='_aa'] span",
      "article div > span[dir='auto']",
      "div[class*='C4VMK'] span",
    ],
    tiktok: [
      "[data-e2e='browse-video-desc']",
      "[data-e2e='video-desc']",
      ".video-meta-caption span",
      "h1[data-e2e]",
      "[class*='DivVideoInfoContainer'] span",
      "[class*='video-info-detail'] span",
    ],
    youtube: [
      "#description-inline-expander yt-attributed-string",
      "#description .ytd-text-inline-expander",
      "ytd-video-secondary-info-renderer #description",
      "#description-text",
    ],
    linkedin: [
      ".feed-shared-update-v2__description span[dir]",
      ".update-components-text span[dir]",
      ".feed-shared-text span[dir]",
      ".attributed-text-segment-list__content",
      ".update-components-text__text-view span",
      "[data-test-id='main-feed-activity-card'] span",
    ],
    twitter: [
      "[data-testid='tweetText']",
      "article [lang] span",
    ],
    facebook: [
      "[data-ad-preview='message']",
      "div[data-testid='post_message']",
      "[data-ad-comet-preview='message']",
      "div[class*='userContent']",
      "[role='article'] div[dir='auto']",
    ],
    threads: [
      "article div[dir='auto']",
      "[data-pressable-container] span[dir='auto']",
    ],
  };

  function extractCaption(platform) {
    const selectors = CAPTION_SELECTORS[platform] || [];
    for (const selector of selectors) {
      try {
        const els = document.querySelectorAll(selector);
        const texts = Array.from(els)
          .map((el) => el.innerText?.trim())
          .filter((t) => t && t.length > 20);
        if (texts.length > 0) return texts.slice(0, 3).join("\n\n");
      } catch (_) { /* skip */ }
    }
    // Fallback: selected text
    const sel = window.getSelection()?.toString()?.trim();
    if (sel && sel.length > 30) return sel;
    // Fallback: first long paragraph
    const paras = Array.from(document.querySelectorAll("p, span[dir='auto'], div[dir='auto']"))
      .map((el) => el.innerText?.trim())
      .filter((t) => t && t.length > 80 && !t.includes("{") && !t.includes("function"));
    if (paras.length > 0) return paras.slice(0, 3).join("\n\n");
    return (document.body.innerText || "").slice(0, 2000).trim();
  }

  // ── Video URL extraction ─────────────────────────────────────────────────────

  /** Search for a URL matching any of these patterns in a text blob */
  function findUrlInText(text, patterns) {
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) return m[1] || m[0];
    }
    return null;
  }

  /** Clean up escaped URLs from JSON strings */
  function cleanUrl(url) {
    return url
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/&amp;/g, "&")
      .trim();
  }

  /** Try to get non-blob video from <video> elements */
  function extractVideoFromDom() {
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (v.src && !v.src.startsWith("blob:") && v.src.startsWith("http")) return v.src;
      const srcs = v.querySelectorAll("source[src]");
      for (const s of srcs) {
        if (s.src && !s.src.startsWith("blob:") && s.src.startsWith("http")) return s.src;
      }
    }
    return null;
  }

  /** Scan all inline scripts for a CDN video URL */
  function extractVideoFromScripts(patterns) {
    const allScripts = document.querySelectorAll("script:not([src])");
    for (const s of allScripts) {
      const content = s.textContent || "";
      const url = findUrlInText(content, patterns);
      if (url) return cleanUrl(url);
    }
    return null;
  }

  function extractInstagramVideoUrl() {
    // 1. Try <video> elements directly — Instagram sometimes puts the CDN URL
    const domUrl = extractVideoFromDom();
    if (domUrl && (domUrl.includes("cdninstagram") || domUrl.includes("fbcdn") || domUrl.includes("scontent"))) {
      return domUrl;
    }

    // 2. Scan script tags for CDN URLs
    const igPatterns = [
      /"video_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/, // Old API format
      /"playback_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/, // New API format
      /"video_versions"[^[]*\[[^\]]*?"url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/,
      /(https:\/\/[^"'\s]*(?:cdninstagram|scontent-)[^"'\s]*\.mp4[^"'\s]*)/,
    ];

    const scriptUrl = extractVideoFromScripts(igPatterns);
    if (scriptUrl) return scriptUrl;

    // 3. Try __additionalDataLoaded from window
    try {
      const dataKeys = Object.keys(window).filter(k => k.includes("Data") || k.includes("data"));
      for (const key of dataKeys) {
        const str = JSON.stringify(window[key] || "");
        const m = str.match(/"video_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/);
        if (m) return cleanUrl(m[1]);
      }
    } catch (_) { /* skip */ }

    // 4. Last resort: return page URL (yt-dlp will try)
    return window.location.href;
  }

  function extractTikTokVideoUrl() {
    // Try DOM first
    const domUrl = extractVideoFromDom();
    if (domUrl && !domUrl.startsWith("blob:")) return domUrl;

    // Scan scripts for TikTok CDN URLs
    const patterns = [
      /"playAddr"\s*:\s*"([^"]+\.mp4[^"]*)"/,
      /"downloadAddr"\s*:\s*"([^"]+\.mp4[^"]*)"/,
      /(https:\/\/[^"'\s]*\.tiktokcdn[^"'\s]*\.mp4[^"'\s]*)/,
      /(https:\/\/[^"'\s]*tiktok[^"'\s]*\.mp4[^"'\s]*)/,
    ];
    const scriptUrl = extractVideoFromScripts(patterns);
    if (scriptUrl) return scriptUrl;

    return window.location.href;
  }

  function extractLinkedInVideoUrl() {
    // 1. Try <video> element directly
    const domUrl = extractVideoFromDom();
    if (domUrl && (domUrl.includes("dms.licdn") || domUrl.includes("licdn.com") || domUrl.includes(".mp4"))) {
      return domUrl;
    }

    // 2. Look for LinkedIn's video player data attributes
    const playerEl = document.querySelector("[data-sources]");
    if (playerEl) {
      try {
        const sources = JSON.parse(playerEl.getAttribute("data-sources") || "[]");
        if (sources.length > 0 && sources[0].src) return sources[0].src;
      } catch (_) { /* skip */ }
    }

    // 3. Look for LinkedIn CDN in scripts
    const patterns = [
      /"progressiveStreams"[^[]*\[[^\]]*?"streamingLocations"[^[]*\[[^\]]*?"url"\s*:\s*"(https:\/\/[^"]+)"/, 
      /(https:\/\/[^"'\s]*dms\.licdn\.com[^"'\s]*\.mp4[^"'\s]*)/,
      /(https:\/\/[^"'\s]*video\.licdn\.com[^"'\s]*\.mp4[^"'\s]*)/,
      /"url"\s*:\s*"(https:\/\/dms\.licdn\.com[^"]+)"/,
    ];
    const scriptUrl = extractVideoFromScripts(patterns);
    if (scriptUrl) return scriptUrl;

    return ""; // LinkedIn page URLs usually don't work with yt-dlp
  }

  function extractFacebookVideoUrl() {
    // 1. Try DOM video
    const domUrl = extractVideoFromDom();
    if (domUrl && (domUrl.includes("fbcdn") || domUrl.includes(".mp4"))) return domUrl;

    // 2. Facebook stores video URL in script tags under "playable_url"
    const patterns = [
      /"playable_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/,
      /"browser_native_hd_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/,
      /"browser_native_sd_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/,
      /(https:\/\/[^"'\s]*video[^"'\s]*fbcdn\.net[^"'\s]*\.mp4[^"'\s]*)/,
      /"video_url"\s*:\s*"(https:\/\/[^"]+\.mp4[^"]*)"/,
    ];
    const scriptUrl = extractVideoFromScripts(patterns);
    if (scriptUrl) return scriptUrl;

    return window.location.href;
  }

  function extractVideoUrl(platform) {
    switch (platform) {
      case "youtube":
        return window.location.href;
      case "instagram":
        return extractInstagramVideoUrl();
      case "tiktok":
        return extractTikTokVideoUrl();
      case "linkedin":
        return extractLinkedInVideoUrl();
      case "facebook":
        return extractFacebookVideoUrl();
      default: {
        const domUrl = extractVideoFromDom();
        return domUrl || window.location.href;
      }
    }
  }

  // ── Title extraction ─────────────────────────────────────────────────────────
  function extractTitle(platform) {
    try {
      if (platform === "youtube") {
        const el = document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string, #title h1, h1.ytd-watch-metadata yt-formatted-string");
        if (el) return el.innerText.trim();
      }
      if (platform === "linkedin") {
        const el = document.querySelector(".update-components-actor__title, .feed-shared-actor__title");
        if (el) return el.innerText.trim();
      }
    } catch (_) { /* ignore */ }
    return document.title || "";
  }

  // ── Engagement metrics ───────────────────────────────────────────────────────
  function extractEngagement(platform) {
    let likes = "0", views = "0", commentsCount = "0";
    try {
      if (platform === "youtube") {
        const likeBtn = document.querySelector("#segmented-like-button span.yt-formatted-string, .yt-spec-button-shape-next__button-text-content");
        if (likeBtn) likes = likeBtn.textContent.trim().replace(/,/g, "");
        const viewEl = document.querySelector(".view-count, .ytd-video-view-count-renderer");
        if (viewEl) { const m = viewEl.textContent.match(/[\d,]+/); if (m) views = m[0].replace(/,/g, ""); }
      }
      if (platform === "instagram") {
        const likeEl = document.querySelector("section a[href*='liked_by'], [aria-label*='like' i]");
        if (likeEl) {
          const m = (likeEl.textContent || likeEl.getAttribute("aria-label") || "").match(/[\d,]+/);
          if (m) likes = m[0].replace(/,/g, "");
        }
        const viewEl = document.querySelector("[aria-label*='view' i], [aria-label*='play' i]");
        if (viewEl) {
          const m = (viewEl.getAttribute("aria-label") || viewEl.textContent || "").match(/[\d,]+/);
          if (m) views = m[0].replace(/,/g, "");
        }
      }
      if (platform === "tiktok") {
        const likeEl = document.querySelector("[data-e2e='like-count']");
        if (likeEl) likes = (likeEl.textContent || "0").trim();
        const viewEl = document.querySelector("[data-e2e='video-views']");
        if (viewEl) views = (viewEl.textContent || "0").trim();
        const commentEl = document.querySelector("[data-e2e='comment-count']");
        if (commentEl) commentsCount = (commentEl.textContent || "0").trim();
      }
      if (platform === "linkedin") {
        const reactionEl = document.querySelector(".social-details-social-counts__reactions-count, .reactions-react-button__count");
        if (reactionEl) likes = reactionEl.textContent.trim().replace(/,/g, "");
      }
    } catch (_) { /* non-fatal */ }
    return { likes, views, commentsCount };
  }

  // ── Creator info ─────────────────────────────────────────────────────────────
  function extractCreator(platform) {
    let username = "", profileUrl = "";
    try {
      if (platform === "youtube") {
        const el = document.querySelector("#channel-name a, ytd-channel-name a");
        if (el) { username = el.textContent.trim(); profileUrl = el.href || ""; }
      }
      if (platform === "instagram") {
        const el = document.querySelector("header a[role='link'], article header a");
        if (el) {
          username = el.textContent?.trim() || "";
          const href = el.getAttribute("href") || "";
          profileUrl = href ? `https://instagram.com${href}` : "";
        }
      }
      if (platform === "tiktok") {
        const el = document.querySelector("[data-e2e='browse-username']");
        if (el) { username = el.textContent?.trim() || ""; profileUrl = window.location.origin + "/" + username.replace("@", ""); }
      }
      if (platform === "linkedin") {
        const el = document.querySelector(".update-components-actor__name, .feed-shared-actor__name");
        if (el) { username = el.textContent?.trim() || ""; }
        const profileEl = document.querySelector(".update-components-actor__meta a, .feed-shared-actor__meta a");
        if (profileEl) profileUrl = profileEl.href || "";
      }
    } catch (_) { /* non-fatal */ }
    return { username, profileUrl };
  }

  // ── Message listener ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "EXTRACT_CONTENT") {
      const platform   = detectPlatform(hostname);
      const caption    = extractCaption(platform);
      const videoUrl   = extractVideoUrl(platform);
      const engagement = extractEngagement(platform);
      const creator    = extractCreator(platform);
      const title      = extractTitle(platform);

      const isCdnUrl = videoUrl && (
        videoUrl.includes("cdninstagram") || videoUrl.includes("fbcdn") ||
        videoUrl.includes("scontent-") || videoUrl.includes("licdn.com") ||
        (videoUrl.includes(".mp4") && !videoUrl.includes(platform + ".com"))
      );

      console.log(`[SocialGrowthAI] ${platform} — caption:${caption.length}ch videoUrl:${videoUrl ? (isCdnUrl ? "CDN✓" : "page") : "none"}`);

      sendResponse({
        content:    caption,
        caption,
        title,
        videoUrl:   videoUrl || "",
        engagement,
        creator,
        postMeta: {
          postUrl:   window.location.href,
          timestamp: new Date().toISOString(),
        },
        platform,
        isCdnVideoUrl: isCdnUrl,
      });
    }
    return true;
  });

  chrome.runtime.sendMessage({ action: "CONTENT_SCRIPT_READY", hostname });
})();
