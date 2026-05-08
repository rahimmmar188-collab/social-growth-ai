import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/media/process
 *
 * Orchestrates the local media pipeline:
 * 1. Warm-up the Python service (handles Render cold-start)
 * 2. Download + process video (FFmpeg + Whisper + OCR) via Python service
 * 3. Return frames (base64), transcript, ocr_texts, scene metadata
 *
 * If the Python service is unavailable or the video URL fails,
 * returns { fallback: true } so the caller can use text-only analysis.
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
        { error: "videoUrl is required", fallback: true },
        { status: 400 }
      );
    }

    // ── Warm-up ping (non-blocking) ────────────────────────────────────────
    // Render free tier spins down after 15min idle. We send a quick /health
    // check before the real request so the container starts waking up.
    try {
      await fetch(`${MEDIA_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // If health fails, we still try the main request — might just be slow
    }

    // ── Call Python media processing service ──────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 52_000); // 52s

    let serviceRes: Response;
    try {
      serviceRes = await fetch(`${MEDIA_SERVICE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url:  videoUrl,
          max_frames: maxFrames,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn("[media/process] Service unreachable:", fetchErr);
      return NextResponse.json(
        {
          fallback: true,
          error:    "Media service unavailable. Using text-only analysis.",
          frames:       [],
          transcript:   "",
          hook_phrase:  "",
          segments:     [],
          ocr_texts:    [],
          duration_seconds: 0,
          frame_count:  0,
          scene_count:  0,
          audio_energy: "unknown",
        },
        { status: 200 } // 200 so client handles gracefully
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "unknown error");
      console.warn("[media/process] Service error:", serviceRes.status, errText);
      return NextResponse.json(
        {
          fallback: true,
          error:    `Processing failed: ${errText.slice(0, 200)}`,
          frames:       [],
          transcript:   "",
          hook_phrase:  "",
          segments:     [],
          ocr_texts:    [],
          duration_seconds: 0,
          frame_count:  0,
          scene_count:  0,
          audio_energy: "unknown",
        },
        { status: 200 }
      );
    }

    const data = await serviceRes.json();
    return NextResponse.json({ ...data, fallback: false });
  } catch (err) {
    console.error("[media/process] Unexpected error:", err);
    return NextResponse.json(
      {
        fallback: true,
        error:    String(err),
        frames:       [],
        transcript:   "",
        hook_phrase:  "",
        segments:     [],
        ocr_texts:    [],
        duration_seconds: 0,
        frame_count:  0,
        scene_count:  0,
        audio_energy: "unknown",
      },
      { status: 200 }
    );
  }
}
