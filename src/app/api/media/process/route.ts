import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL || "http://127.0.0.1:8000";

/**
 * POST /api/media/process
 *
 * Orchestrates the local media pipeline:
 * 1. Download + process video (FFmpeg + Whisper + OCR) via Python service
 * 2. Return frames (base64), transcript, ocr_texts, scene metadata
 *
 * If the Python service is unavailable or the video URL fails,
 * returns { fallback: true } so the caller can use text-only analysis.
 */
export async function POST(req: NextRequest) {
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

    // ── Call Python media processing service ─────────────────────────────
    let serviceRes: Response;
    try {
      serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          max_frames: maxFrames,
        }),
        // No AbortController — Next.js route timeout handles the deadline
      });
    } catch (fetchErr) {
      console.warn("[media/process] Service unreachable:", fetchErr);
      return NextResponse.json(
        { ...FALLBACK, error: "Media service unavailable. Using text-only analysis." },
        { status: 200 }
      );
    }

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "unknown error");
      console.warn("[media/process] Service error:", serviceRes.status, errText);
      return NextResponse.json(
        { ...FALLBACK, error: `Processing failed: ${errText.slice(0, 200)}` },
        { status: 200 }
      );
    }

    const data = await serviceRes.json();
    console.log(
      `[media/process] OK — frames:${data.frame_count} scenes:${data.scene_count} duration:${data.duration_seconds}s`
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
