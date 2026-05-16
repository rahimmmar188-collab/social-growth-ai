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

// ── URL type helpers ──────────────────────────────────────────────────────────
function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}
function isTikTokUrl(url: string): boolean {
  return url.includes("tiktok.com");
}
function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com");
}
function isDirectMp4(url: string): boolean {
  return url.toLowerCase().includes(".mp4") && url.startsWith("http");
}
// URLs Gemini can watch natively (YouTube + any direct video link)
function isGeminiNative(url: string): boolean {
  return isYouTubeUrl(url) || isTikTokUrl(url);
}

// ── Prompt for Gemini video analysis ─────────────────────────────────────────
const VIDEO_ANALYSIS_PROMPT = `Watch this video carefully from start to finish. Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "transcript": "Complete verbatim transcript of ALL spoken words, lyrics, or narration. If no speech, return empty string.",
  "hook_phrase": "Exact words spoken or shown in first 3-5 seconds",
  "duration_seconds": 0,
  "scene_count": 0,
  "audio_energy": "high|medium|low",
  "ocr_texts": [{"frame_index": 0, "text": "any text shown on screen"}],
  "visual_analysis": {
    "hookStrength": 8,
    "pacing": "rapid-fire|moderate|slow-burn",
    "editingStyle": "jump cuts|talking head|montage|tutorial|b-roll|documentary",
    "storyStructure": "Describe the Hook → Build → Payoff or problem → solution arc",
    "emotionalTone": "primary emotion of the content",
    "productionQuality": "high|medium|low",
    "ctaVisual": "Any call-to-action text shown, or 'none'",
    "attentionMechanisms": ["list", "of", "techniques", "used"],
    "frameDescriptions": [
      {
        "index": 0,
        "timestamp": 0.5,
        "description": "Detailed description of what is visible",
        "cameraAngle": "close-up|wide|medium|POV|overhead",
        "energyLevel": "high|medium|low",
        "textOverlays": ["any text shown on screen at this moment"],
        "facialExpression": "description of person's expression, or 'no face visible'"
      }
    ]
  }
}
Important rules:
- Report ONLY what you actually see and hear — never guess or hallucinate
- Include 6-10 frameDescriptions evenly spaced through the video
- Transcript must include all spoken words, even if it is a song
- Return pure JSON only — no backticks, no markdown`;

// ── Gemini video analysis (works for YouTube + TikTok URLs) ──────────────────
async function analyzeWithGemini(videoUrl: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: videoUrl, mimeType: "video/*" } },
          { text: VIDEO_ANALYSIS_PROMPT },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  });

  const text = result.response.text();

  // Strip markdown fences (Gemini sometimes wraps with ```json ... ```)
  const clean = text
    .replace(/^```[\w]*\r?\n?/im, "")
    .replace(/\r?\n?```\s*$/im, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Gemini non-JSON response: ${text.slice(0, 120)}`);
  }

  const va = (parsed.visual_analysis || {}) as Record<string, unknown>;
  const frameDescriptions = Array.isArray(va.frameDescriptions)
    ? va.frameDescriptions
    : [];

  // Check for empty/refusal response
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

// ── Fetch from Python backend ─────────────────────────────────────────────────
async function fetchFromPythonBackend(videoUrl: string, maxFrames: number) {
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
    const errCode = isTikTokBlock ? "tiktok_ip_blocked"
      : needsAuth ? "instagram_auth_required"
      : `processing_failed: ${errText.slice(0, 150)}`;
    throw new Error(errCode);
  }

  const data = await serviceRes.json();
  return { ...data, fallback: false };
}

/**
 * POST /api/media/process
 *
 * Routing strategy:
 *  1. YouTube  → Gemini 2.5 Flash native (always, no download needed)
 *  2. TikTok   → Gemini 2.5 Flash native first, fallback to Python backend
 *  3. Instagram → instagram_auth_required (needs browser extension)
 *  4. Direct .mp4 → Python backend (download + Whisper + OCR)
 *  5. Everything else → Python backend
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

    // ── 1 & 2: YouTube + TikTok → Gemini native ──────────────────────────────
    if (isGeminiNative(videoUrl)) {
      const platform = isYouTubeUrl(videoUrl) ? "YouTube" : "TikTok";
      console.log(`[media/process] ${platform} → Gemini 2.5 Flash native`);
      try {
        const data = await analyzeWithGemini(videoUrl);
        console.log(
          `[media/process] Gemini OK — transcript:${data.transcript.length}ch ` +
          `scenes:${data.scene_count} dur:${data.duration_seconds}s frames:${data.frame_count}`
        );
        return NextResponse.json(data);
      } catch (geminiErr) {
        const errMsg = String(geminiErr);
        console.warn(`[media/process] Gemini failed for ${platform}:`, errMsg.slice(0, 200));

        // Fallback to Python backend if available
        try {
          console.log("[media/process] Falling back to Python backend...");
          const data = await fetchFromPythonBackend(videoUrl, maxFrames);
          return NextResponse.json(data);
        } catch (backendErr) {
          console.warn("[media/process] Python backend also failed:", String(backendErr).slice(0, 100));
        }

        return NextResponse.json({
          ...FALLBACK,
          error: `${platform.toLowerCase()}_processing_failed: ${errMsg.slice(0, 150)}`,
        });
      }
    }

    // ── 3. Instagram without direct .mp4 → needs extension ───────────────────
    if (isInstagramUrl(videoUrl) && !isDirectMp4(videoUrl)) {
      console.log("[media/process] Instagram → instagram_auth_required");
      return NextResponse.json({ ...FALLBACK, error: "instagram_auth_required" });
    }

    // ── 4 & 5: Direct .mp4 / other → Python backend ───────────────────────────
    try {
      console.log(`[media/process] → Python backend: ${MEDIA_SERVICE_URL}/process`);
      const data = await fetchFromPythonBackend(videoUrl, maxFrames);
      console.log(
        `[media/process] Backend OK — frames:${data.frame_count} scenes:${data.scene_count} dur:${data.duration_seconds}s`
      );
      return NextResponse.json(data);
    } catch (err) {
      const errMsg = String(err);
      console.warn("[media/process] Backend failed:", errMsg.slice(0, 200));
      return NextResponse.json(
        { ...FALLBACK, error: errMsg.includes("fetch") ? "media_service_unavailable" : errMsg },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("[media/process] Unexpected error:", err);
    return NextResponse.json({ ...FALLBACK, error: String(err) }, { status: 200 });
  }
}
