import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL || "http://127.0.0.1:8000";

const FALLBACK = {
  fallback: true,
  frames: [],
  transcript: "",
  hook_phrase: "",
  segments: [],
  ocr_texts: [],
  duration_seconds: 0,
  frame_count: 0,
  scene_count: 0,
  audio_energy: "unknown",
};

// ── URL type detection ────────────────────────────────────────────────────────
function isYouTubeUrl(url: string)   { return url.includes("youtube.com") || url.includes("youtu.be"); }
function isTikTokUrl(url: string)    { return url.includes("tiktok.com"); }
function isInstagramUrl(url: string) { return url.includes("instagram.com") && !url.includes("cdninstagram"); }
function isLinkedInUrl(url: string)  { return url.includes("linkedin.com") && !url.includes("licdn.com"); }
function isFacebookUrl(url: string)  { return (url.includes("facebook.com") || url.includes("fb.com")) && !url.includes("fbcdn.net"); }

/** CDN video URLs — publicly accessible without auth cookies */
function isCdnVideoUrl(url: string): boolean {
  return (
    url.includes("cdninstagram.com") ||
    url.includes("scontent-") ||          // Instagram CDN: scontent-sjc3-1.cdninstagram.com
    url.includes("fbcdn.net") ||          // Facebook/Instagram CDN
    url.includes("dms.licdn.com") ||      // LinkedIn video CDN
    url.includes("video.licdn.com") ||    // LinkedIn video CDN alt
    url.includes("akamaized.net") ||      // Generic CDN
    url.includes("cloudfront.net") ||     // AWS CDN
    (url.includes(".mp4") && url.startsWith("http")) ||
    (url.includes(".webm") && url.startsWith("http")) ||
    (url.includes(".mov") && url.startsWith("http"))
  );
}

/** Check if Gemini can analyze this URL natively (no download needed) */
function isGeminiNativeUrl(url: string): boolean {
  return isYouTubeUrl(url) || isTikTokUrl(url);
}

// ── Video Analysis Prompt ─────────────────────────────────────────────────────
const VIDEO_ANALYSIS_PROMPT = `Watch this entire video carefully. Return ONLY valid JSON — no markdown, no backticks, no explanation:
{
  "transcript": "Complete verbatim transcript of ALL spoken words, lyrics, captions, or narration. If no speech at all, return empty string.",
  "hook_phrase": "Exact words spoken or shown on screen in the first 3-5 seconds",
  "duration_seconds": 0,
  "scene_count": 0,
  "audio_energy": "high|medium|low",
  "ocr_texts": [{"frame_index": 0, "text": "any text visible on screen at this timestamp"}],
  "visual_analysis": {
    "hookStrength": 8,
    "pacing": "rapid-fire|moderate|slow-burn",
    "editingStyle": "jump cuts|talking head|montage|tutorial|b-roll|vlog|product demo",
    "storyStructure": "Describe the Hook → Build → Payoff arc in 1-2 sentences",
    "emotionalTone": "primary emotion of the content",
    "productionQuality": "high|medium|low",
    "ctaVisual": "Call-to-action text shown on screen, or none",
    "attentionMechanisms": ["list", "of", "techniques", "used"],
    "frameDescriptions": [
      {
        "index": 0,
        "timestamp": 0.5,
        "description": "Detailed scene description",
        "cameraAngle": "close-up|wide|medium|POV|overhead|dutch",
        "energyLevel": "high|medium|low",
        "textOverlays": ["any text on screen at this moment"],
        "facialExpression": "description or none"
      }
    ]
  }
}
Rules:
- Transcript MUST include all spoken words even if it is music/song lyrics
- Include 6-10 frameDescriptions evenly spaced through the video
- OCR: list every piece of text shown on screen across all frames
- Never guess — only report what you actually see and hear
- Return pure JSON only`;

// ── Parse Gemini response ─────────────────────────────────────────────────────
function parseGeminiResponse(text: string) {
  const clean = text
    .replace(/^```[\w]*\r?\n?/im, "")
    .replace(/\r?\n?```\s*$/im, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Try to extract JSON from middle of text
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch { throw new Error(`Gemini non-JSON: ${text.slice(0, 120)}`); }
    } else {
      throw new Error(`Gemini non-JSON: ${text.slice(0, 120)}`);
    }
  }

  const va = (parsed.visual_analysis || {}) as Record<string, unknown>;
  const frameDescriptions = Array.isArray(va.frameDescriptions) ? va.frameDescriptions : [];

  const hasContent =
    (parsed.transcript as string)?.length > 0 ||
    frameDescriptions.length > 0 ||
    (parsed.hook_phrase as string)?.length > 0;

  if (!hasContent) {
    throw new Error("Gemini returned empty analysis — video may be unavailable or private");
  }

  return {
    fallback: false,
    source: "gemini-native",
    frames: [] as unknown[],
    transcript:       (parsed.transcript as string)  || "",
    hook_phrase:      (parsed.hook_phrase as string) || "",
    segments:         [],
    ocr_texts:        Array.isArray(parsed.ocr_texts) ? parsed.ocr_texts : [],
    duration_seconds: Number(parsed.duration_seconds) || 0,
    frame_count:      frameDescriptions.length,
    scene_count:      Number(parsed.scene_count) || 0,
    audio_energy:     (parsed.audio_energy as string) || "unknown",
    visual_analysis: {
      frameDescriptions,
      overall: {
        hookStrength:        (va.hookStrength as number)     ?? 5,
        pacing:              (va.pacing as string)           || "",
        editingStyle:        (va.editingStyle as string)     || "",
        ctaVisual:           (va.ctaVisual as string)        || "",
        storyStructure:      (va.storyStructure as string)   || "",
        productionQuality:   (va.productionQuality as string)|| "medium",
        emotionalTone:       (va.emotionalTone as string)    || "",
        attentionMechanisms: (va.attentionMechanisms as string[]) || [],
      },
    },
  };
}

// ── Strategy 1: Gemini Native (YouTube/TikTok URL passed directly) ─────────────
async function analyzeWithGeminiNative(videoUrl: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [
        { fileData: { fileUri: videoUrl, mimeType: "video/*" } },
        { text: VIDEO_ANALYSIS_PROMPT },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
  });

  return parseGeminiResponse(result.response.text());
}

// ── Strategy 2: Download CDN video → send as inline base64 to Gemini ──────────
const MAX_CDN_VIDEO_MB = 45; // Gemini inline data limit for free tier is ~20MB, paid is higher
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.instagram.com/",
};

async function analyzeWithGeminiInline(videoUrl: string, referer?: string) {
  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    ...(referer ? { "Referer": referer } : {}),
  };

  // Download video
  const dlRes = await fetch(videoUrl, {
    headers,
    signal: AbortSignal.timeout(60000),
  });

  if (!dlRes.ok) {
    throw new Error(`CDN download failed: HTTP ${dlRes.status}`);
  }

  const contentType = dlRes.headers.get("content-type") || "video/mp4";
  const contentLength = Number(dlRes.headers.get("content-length") || "0");

  if (contentLength > MAX_CDN_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Video too large for inline analysis (${Math.round(contentLength / 1024 / 1024)}MB > ${MAX_CDN_VIDEO_MB}MB)`);
  }

  const videoBytes = await dlRes.arrayBuffer();
  const base64Video = Buffer.from(videoBytes).toString("base64");
  const mimeType = contentType.split(";")[0].trim() || "video/mp4";

  console.log(`[media/process] CDN download OK — ${Math.round(videoBytes.byteLength / 1024)}KB, type=${mimeType}`);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [
        { inlineData: { data: base64Video, mimeType } },
        { text: VIDEO_ANALYSIS_PROMPT },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
  });

  return parseGeminiResponse(result.response.text());
}

// ── Strategy 3: Python backend (yt-dlp + Whisper + OCR) ──────────────────────
async function analyzeWithPythonBackend(videoUrl: string, maxFrames: number) {
  const serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: videoUrl, max_frames: maxFrames }),
    signal: AbortSignal.timeout(90000),
  });

  if (!serviceRes.ok) {
    const errText = await serviceRes.text().catch(() => "unknown");
    const isTikTokBlock = errText.includes("IP address is blocked") || errText.includes("[TikTok]");
    const needsAuth = errText.toLowerCase().includes("login") ||
      errText.toLowerCase().includes("private") ||
      errText.toLowerCase().includes("authentication");
    throw new Error(
      isTikTokBlock ? "tiktok_ip_blocked"
      : needsAuth   ? "social_auth_required"
      : `backend_error: ${errText.slice(0, 150)}`
    );
  }

  return { ...(await serviceRes.json()), fallback: false };
}

/**
 * POST /api/media/process
 *
 * Routing:
 *  1. YouTube / TikTok → Gemini native (no download)
 *  2. CDN video URL (cdninstagram, fbcdn, licdn, .mp4, etc.) → download + Gemini inline
 *  3. Instagram/LinkedIn/Facebook page URL → Python backend (yt-dlp)
 *  4. Fallback on any failure
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, maxFrames = 12 } = body as {
      videoUrl?: string;
      maxFrames?: number;
    };

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "videoUrl is required", ...FALLBACK }, { status: 400 });
    }

    const url = videoUrl.trim();
    console.log(`[media/process] URL: ${url.slice(0, 80)}`);

    // ── 1. YouTube / TikTok → Gemini Native ─────────────────────────────────
    if (isGeminiNativeUrl(url)) {
      const platform = isYouTubeUrl(url) ? "YouTube" : "TikTok";
      console.log(`[media/process] ${platform} → Gemini native`);
      try {
        const data = await analyzeWithGeminiNative(url);
        console.log(`[media/process] ${platform} Gemini OK — transcript:${data.transcript.length}ch frames:${data.frame_count}`);
        return NextResponse.json(data);
      } catch (err) {
        console.warn(`[media/process] ${platform} Gemini failed:`, String(err).slice(0, 150));
        // Fallback to Python backend
        try {
          return NextResponse.json(await analyzeWithPythonBackend(url, maxFrames));
        } catch { /* ignore backend errors */ }
        return NextResponse.json({ ...FALLBACK, error: `${platform.toLowerCase()}_analysis_failed: ${String(err).slice(0, 100)}` });
      }
    }

    // ── 2. CDN video URL → Download + Gemini Inline ──────────────────────────
    if (isCdnVideoUrl(url)) {
      console.log("[media/process] CDN video URL → Gemini inline analysis");
      const referer = url.includes("cdninstagram") || url.includes("scontent-") || url.includes("fbcdn.net")
        ? "https://www.instagram.com/"
        : url.includes("licdn.com")
        ? "https://www.linkedin.com/"
        : undefined;
      try {
        const data = await analyzeWithGeminiInline(url, referer);
        console.log(`[media/process] CDN Gemini OK — transcript:${data.transcript.length}ch frames:${data.frame_count}`);
        return NextResponse.json(data);
      } catch (err) {
        console.warn("[media/process] CDN Gemini inline failed:", String(err).slice(0, 150));
        // Fallback to Python backend
        try {
          return NextResponse.json(await analyzeWithPythonBackend(url, maxFrames));
        } catch { /* ignore */ }
        return NextResponse.json({ ...FALLBACK, error: `cdn_analysis_failed: ${String(err).slice(0, 100)}` });
      }
    }

    // ── 3. Instagram / LinkedIn / Facebook page URL → Python backend ─────────
    if (isInstagramUrl(url) || isLinkedInUrl(url) || isFacebookUrl(url)) {
      const platform = isInstagramUrl(url) ? "Instagram" : isLinkedInUrl(url) ? "LinkedIn" : "Facebook";
      console.log(`[media/process] ${platform} page URL → Python backend`);
      try {
        const data = await analyzeWithPythonBackend(url, maxFrames);
        console.log(`[media/process] ${platform} backend OK — frames:${data.frame_count}`);
        return NextResponse.json(data);
      } catch (err) {
        const errMsg = String(err);
        console.warn(`[media/process] ${platform} backend failed:`, errMsg.slice(0, 150));
        // Return platform-specific error code
        const errorCode = errMsg.includes("auth_required") || errMsg.includes("login")
          ? `${platform.toLowerCase()}_auth_required`
          : "media_service_unavailable";
        return NextResponse.json({ ...FALLBACK, error: errorCode });
      }
    }

    // ── 4. Everything else → Python backend ──────────────────────────────────
    console.log(`[media/process] Generic URL → Python backend`);
    try {
      return NextResponse.json(await analyzeWithPythonBackend(url, maxFrames));
    } catch (err) {
      console.warn("[media/process] Backend failed:", String(err).slice(0, 150));
      return NextResponse.json({ ...FALLBACK, error: "media_service_unavailable" });
    }

  } catch (err) {
    console.error("[media/process] Unexpected error:", err);
    return NextResponse.json({ ...FALLBACK, error: String(err) }, { status: 200 });
  }
}
