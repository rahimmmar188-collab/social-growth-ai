import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

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

// ── Gemini native YouTube analysis prompt ─────────────────────────────────────
const YOUTUBE_PROMPT = `You are an expert social media video analyst. Watch this entire video now.

Extract and return ALL of the following as a single valid JSON object:
{
  "transcript": "Complete verbatim transcript of ALL spoken words. If no speech, return empty string.",
  "hook_phrase": "Exact words spoken in the first 5 seconds only",
  "duration_seconds": 0,
  "scene_count": 0,
  "audio_energy": "high OR medium OR low",
  "ocr_texts": [{"frame_index": 0, "text": "any on-screen text, captions, overlays you see"}],
  "visual_analysis": {
    "hookStrength": 8,
    "pacing": "rapid-fire OR moderate OR slow-burn",
    "editingStyle": "jump cuts / talking head / montage / b-roll / tutorial / etc",
    "storyStructure": "Hook → Build → Payoff pattern description",
    "emotionalTone": "primary emotion the video evokes",
    "productionQuality": "high OR medium OR low",
    "ctaVisual": "any call-to-action visible",
    "attentionMechanisms": ["pattern interrupt", "curiosity gap", "etc"],
    "frameDescriptions": [
      {
        "index": 0,
        "timestamp": 0.5,
        "description": "exact description of what is happening visually",
        "cameraAngle": "close-up / wide / POV / overhead / etc",
        "energyLevel": "high / medium / low",
        "textOverlays": ["any text you see on screen"],
        "facialExpression": "description or none"
      }
    ]
  }
}

CRITICAL RULES:
- Provide ONLY what you ACTUALLY see and hear — no guessing
- Transcript must be verbatim spoken words
- Include at least 6-10 frameDescriptions at different timestamps
- Return ONLY the JSON, no markdown fences`;

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com");
}

/** Use Gemini 2.5 Flash to natively watch and analyze a YouTube video. */
async function analyzeYouTubeWithGemini(videoUrl: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent([
    { fileData: { fileUri: videoUrl } },
    { text: YOUTUBE_PROMPT },
  ]);

  const text = result.response.text();
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(clean);

  // Normalise visual_analysis into the same shape as /api/media/vision returns
  const va = parsed.visual_analysis || {};
  const frameDescriptions = Array.isArray(va.frameDescriptions)
    ? va.frameDescriptions
    : [];

  return {
    fallback: false,
    source: "gemini-native",
    frames: [],
    transcript: parsed.transcript || "",
    hook_phrase: parsed.hook_phrase || "",
    segments: [],
    ocr_texts: Array.isArray(parsed.ocr_texts)
      ? parsed.ocr_texts
      : [],
    duration_seconds: Number(parsed.duration_seconds) || 0,
    frame_count: frameDescriptions.length,
    scene_count: Number(parsed.scene_count) || 0,
    audio_energy: parsed.audio_energy || "unknown",
    // Embed visual analysis directly (skip separate /api/media/vision call)
    visual_analysis: {
      frameDescriptions,
      overall: {
        hookStrength: va.hookStrength ?? 5,
        pacing: va.pacing || "",
        editingStyle: va.editingStyle || "",
        ctaVisual: va.ctaVisual || "",
        storyStructure: va.storyStructure || "",
        productionQuality: va.productionQuality || "medium",
        emotionalTone: va.emotionalTone || "",
        attentionMechanisms: va.attentionMechanisms || [],
      },
    },
  };
}

/**
 * POST /api/media/process
 *
 * Routing:
 *  - YouTube  → Gemini 2.5 Flash native URL analysis (no download, permanent fix)
 *  - Instagram/TikTok/direct MP4 → Railway Python media-service (yt-dlp + FFmpeg)
 *
 * On any failure returns { fallback: true, error: "..." } so the caller
 * can show targeted guidance instead of silent caption-only analysis.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, maxFrames = 12 } = body as {
      videoUrl?: string;
      maxFrames?: number;
    };

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { error: "videoUrl is required", ...FALLBACK },
        { status: 400 }
      );
    }

    // ── YouTube: Gemini watches the video natively — no Railway needed ────────
    if (isYouTubeUrl(videoUrl)) {
      try {
        console.log("[media/process] YouTube → Gemini native analysis");
        const data = await analyzeYouTubeWithGemini(videoUrl);
        console.log(
          `[media/process] Gemini native OK — transcript:${data.transcript.length}chars scenes:${data.scene_count} dur:${data.duration_seconds}s`
        );
        return NextResponse.json(data);
      } catch (geminiErr) {
        console.warn(
          "[media/process] Gemini native failed, falling back to Railway:",
          String(geminiErr).slice(0, 200)
        );
        // Fall through to Railway below
      }
    }

    // ── Instagram without .mp4: surface clear error for extension guidance ─────
    // Railway yt-dlp cannot download Instagram without login cookies.
    // Return a specific error code the frontend can detect.
    if (
      isInstagramUrl(videoUrl) &&
      !videoUrl.includes(".mp4") &&
      !videoUrl.includes(".jpg")
    ) {
      console.log("[media/process] Instagram page URL → skip Railway, return auth_required");
      return NextResponse.json({
        ...FALLBACK,
        error: "instagram_auth_required",
      });
    }

    // ── All other URLs: Railway Python service (yt-dlp + FFmpeg) ─────────────
    let serviceRes: Response;
    try {
      serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          max_frames: maxFrames,
        }),
      });
    } catch (fetchErr) {
      console.warn("[media/process] Railway unreachable:", fetchErr);
      return NextResponse.json(
        {
          ...FALLBACK,
          error: "media_service_unavailable",
        },
        { status: 200 }
      );
    }

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "unknown error");
      console.warn("[media/process] Railway error:", serviceRes.status, errText.slice(0, 200));

      // Detect auth-related errors
      const needsAuth =
        errText.toLowerCase().includes("login") ||
        errText.toLowerCase().includes("private") ||
        errText.toLowerCase().includes("authentication") ||
        errText.toLowerCase().includes("unauthorized");

      return NextResponse.json(
        {
          ...FALLBACK,
          error: needsAuth ? "instagram_auth_required" : `processing_failed: ${errText.slice(0, 150)}`,
        },
        { status: 200 }
      );
    }

    const data = await serviceRes.json();
    console.log(
      `[media/process] Railway OK — frames:${data.frame_count} scenes:${data.scene_count} dur:${data.duration_seconds}s`
    );
    return NextResponse.json({ ...data, fallback: false });
  } catch (err) {
    console.error("[media/process] Unexpected error:", err);
    return NextResponse.json(
      { ...FALLBACK, error: String(err) },
      { status: 200 }
    );
  }
}
