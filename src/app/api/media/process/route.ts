import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — needed for Gemini video analysis

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

// ── URL helpers ────────────────────────────────────────────────────────────────
function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}
function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com");
}

// ── YouTube prompt — kept short to reduce Gemini latency ─────────────────────
const YOUTUBE_PROMPT = `Watch this video carefully and return ONLY this JSON (no markdown fences):
{
  "transcript": "Complete verbatim transcript of all spoken words. Empty string if no speech.",
  "hook_phrase": "Exact words spoken in first 5 seconds",
  "duration_seconds": 0,
  "scene_count": 0,
  "audio_energy": "high|medium|low",
  "ocr_texts": [{"frame_index": 0, "text": "on-screen text you see"}],
  "visual_analysis": {
    "hookStrength": 8,
    "pacing": "rapid-fire|moderate|slow-burn",
    "editingStyle": "jump cuts|talking head|montage|tutorial|etc",
    "storyStructure": "Hook to Build to Payoff description",
    "emotionalTone": "primary emotion",
    "productionQuality": "high|medium|low",
    "ctaVisual": "call-to-action text or none",
    "attentionMechanisms": ["mechanism1", "mechanism2"],
    "frameDescriptions": [
      {"index": 0, "timestamp": 0.5, "description": "what you see", "cameraAngle": "close-up|wide|POV", "energyLevel": "high|medium|low", "textOverlays": [], "facialExpression": "description or none"}
    ]
  }
}
Rules: Only report what you actually see/hear. Include 6-10 frameDescriptions. Return JSON only.`;

// ── Gemini native YouTube analysis ────────────────────────────────────────────
async function analyzeYouTubeWithGemini(videoUrl: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  // Use Flash for speed — it can watch YouTube URLs natively
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: videoUrl, mimeType: "video/*" } },
          { text: YOUTUBE_PROMPT },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.1, // Low temp = less hallucination, faster
    },
  });

  const text = result.response.text();

  // Strip ALL markdown code fences — Gemini sometimes wraps with ```json\n...\n```
  // Use a global replace to handle any variant (```json, ```, with/without newlines)
  const clean = text
    .replace(/^```[\w]*\r?\n?/im, "")  // strip opening fence ```json or ```
    .replace(/\r?\n?```\s*$/im, "")    // strip closing fence ```
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // If JSON parse fails, Gemini returned a refusal or error text
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 100)}`);
  }

  const va = (parsed.visual_analysis || {}) as Record<string, unknown>;
  const frameDescriptions = Array.isArray(va.frameDescriptions)
    ? va.frameDescriptions
    : [];

  // Detect empty/refusal response
  const hasContent =
    (parsed.transcript as string)?.length > 0 ||
    frameDescriptions.length > 0 ||
    (parsed.hook_phrase as string)?.length > 0;

  if (!hasContent) {
    throw new Error("Gemini returned empty analysis — video may be restricted or unavailable");
  }

  return {
    fallback: false,
    source: "gemini-native",
    frames: [] as unknown[],
    transcript: (parsed.transcript as string) || "",
    hook_phrase: (parsed.hook_phrase as string) || "",
    segments: [],
    ocr_texts: Array.isArray(parsed.ocr_texts) ? parsed.ocr_texts : [],
    duration_seconds: Number(parsed.duration_seconds) || 0,
    frame_count: frameDescriptions.length,
    scene_count: Number(parsed.scene_count) || 0,
    audio_energy: (parsed.audio_energy as string) || "unknown",
    visual_analysis: {
      frameDescriptions,
      overall: {
        hookStrength: (va.hookStrength as number) ?? 5,
        pacing: (va.pacing as string) || "",
        editingStyle: (va.editingStyle as string) || "",
        ctaVisual: (va.ctaVisual as string) || "",
        storyStructure: (va.storyStructure as string) || "",
        productionQuality: (va.productionQuality as string) || "medium",
        emotionalTone: (va.emotionalTone as string) || "",
        attentionMechanisms: (va.attentionMechanisms as string[]) || [],
      },
    },
  };
}

/**
 * POST /api/media/process
 *
 * Routing:
 *  1. YouTube  → Gemini 2.5 Flash native (watches video directly — no download)
 *  2. Instagram → instagram_auth_required (needs browser extension with login)
 *  3. TikTok / .mp4 → Python backend (yt-dlp + FFmpeg + Whisper + OCR)
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

    // ── 1. YouTube → Gemini 2.5 Flash native ─────────────────────────────────
    if (isYouTubeUrl(videoUrl)) {
      console.log("[media/process] YouTube → Gemini 2.5 Flash native analysis");
      try {
        const data = await analyzeYouTubeWithGemini(videoUrl);
        console.log(
          `[media/process] Gemini OK — transcript:${data.transcript.length}chars ` +
          `scenes:${data.scene_count} dur:${data.duration_seconds}s frames:${data.frame_count}`
        );
        return NextResponse.json(data);
      } catch (geminiErr) {
        const errMsg = String(geminiErr);
        console.warn("[media/process] Gemini failed:", errMsg.slice(0, 200));

        // Fall through to Python backend as last resort for YouTube
        console.log("[media/process] Trying Python backend for YouTube as fallback...");
        try {
          const serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_url: videoUrl, max_frames: maxFrames }),
            signal: AbortSignal.timeout(90000),
          });
          if (serviceRes.ok) {
            const data = await serviceRes.json();
            return NextResponse.json({ ...data, fallback: false });
          }
        } catch { /* ignore */ }

        // Both failed — return fallback with error
        return NextResponse.json({
          ...FALLBACK,
          error: `youtube_processing_failed: ${errMsg.slice(0, 150)}`,
        });
      }
    }

    // ── 2. Instagram → needs browser extension ────────────────────────────────
    if (isInstagramUrl(videoUrl) && !videoUrl.includes(".mp4")) {
      console.log("[media/process] Instagram → auth_required");
      return NextResponse.json({ ...FALLBACK, error: "instagram_auth_required" });
    }

    // ── 3. TikTok / direct .mp4 → Python backend ──────────────────────────────
    let serviceRes: Response;
    try {
      console.log(`[media/process] → Python backend: ${MEDIA_SERVICE_URL}/process`);
      serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, max_frames: maxFrames }),
        signal: AbortSignal.timeout(90000),
      });
    } catch (fetchErr) {
      console.warn("[media/process] Python backend unreachable:", String(fetchErr).slice(0, 200));
      return NextResponse.json(
        { ...FALLBACK, error: "media_service_unavailable" },
        { status: 200 }
      );
    }

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "unknown");
      console.warn("[media/process] Backend error:", serviceRes.status, errText.slice(0, 200));

      const isTikTokBlock =
        errText.includes("IP address is blocked") || errText.includes("[TikTok]");
      const needsAuth =
        errText.toLowerCase().includes("login") ||
        errText.toLowerCase().includes("private") ||
        errText.toLowerCase().includes("authentication");

      return NextResponse.json({
        ...FALLBACK,
        error: isTikTokBlock
          ? "tiktok_ip_blocked"
          : needsAuth
          ? "instagram_auth_required"
          : `processing_failed: ${errText.slice(0, 150)}`,
      });
    }

    const data = await serviceRes.json();
    console.log(
      `[media/process] Backend OK — frames:${data.frame_count} scenes:${data.scene_count} dur:${data.duration_seconds}s`
    );
    return NextResponse.json({ ...data, fallback: false });
  } catch (err) {
    console.error("[media/process] Unexpected error:", err);
    return NextResponse.json({ ...FALLBACK, error: String(err) }, { status: 200 });
  }
}
