import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Vision analysis prompt ────────────────────────────────────────────────────
const VISION_SYSTEM = `You are an expert video content analyst specializing in viral social media reels.

You will receive keyframes extracted from a social media reel along with its transcript and on-screen text.

For EACH frame provided, analyze:
- What is visually happening (actions, objects, setting)
- Facial expressions and body language (if people present)
- Camera angle and framing (close-up, wide shot, POV, etc.)
- On-screen graphics, text overlays, emojis
- Energy level (high/medium/low)
- Pacing indicator (fast cut / slow / static)

Then provide an OVERALL analysis covering:
- hookStrength: How compelling is the first frame/hook? (1-10)
- pacing: Overall editing pace (rapid-fire / moderate / slow-burn)
- editingStyle: Signature style (jump cuts / smooth / montage / talking head / etc.)
- ctaVisual: What CTA appears visually in the final frames
- storyStructure: Hook → Build → Payoff pattern observed
- productionQuality: (high / medium / low)
- emotionalTone: Primary emotion evoked
- attentionMechanisms: List of pattern interrupts and curiosity hooks observed

IMPORTANT:
- Only describe what you ACTUALLY SEE in the frames
- Quote actual text if you can read it in the frame
- Be specific — no generic filler
- If a frame is blurry/dark, say so

Return ONLY valid JSON in this exact structure:
{
  "frameDescriptions": [
    {
      "index": 0,
      "timestamp": 0.5,
      "description": "...",
      "cameraAngle": "...",
      "energyLevel": "high|medium|low",
      "textOverlays": ["..."],
      "facialExpression": "..."
    }
  ],
  "overall": {
    "hookStrength": 8,
    "pacing": "...",
    "editingStyle": "...",
    "ctaVisual": "...",
    "storyStructure": "...",
    "productionQuality": "high|medium|low",
    "emotionalTone": "...",
    "attentionMechanisms": ["...", "..."]
  }
}`;

/**
 * POST /api/media/vision
 *
 * Sends selected keyframes to Gemini 2.5 Flash for visual analysis.
 * Uses base64-encoded JPEG frames (NOT full video file upload).
 * Max 8 frames to control token cost.
 *
 * Cost: ~258 tokens per image × 8 images = ~2064 image tokens ≈ $0.001-0.002
 */
export async function POST(req: NextRequest) {
  try {
    const { frames, transcript, ocrTexts } = await req.json() as {
      frames: Array<{
        index: number;
        timestamp: number;
        base64: string;
        mime_type: string;
      }>;
      transcript?: string;
      ocrTexts?: Array<{ frame_index: number; text: string }>;
    };

    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: "No frames provided" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
    });

    // ── Build multipart prompt ────────────────────────────────────────────
    // Use max 8 frames to control token consumption
    const selectedFrames = frames.slice(0, 8);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ text: VISION_SYSTEM }];

    for (const frame of selectedFrames) {
      parts.push({ text: `\n--- Frame at ${frame.timestamp}s (index ${frame.index}) ---` });
      parts.push({
        inlineData: {
          mimeType: frame.mime_type || "image/jpeg",
          data: frame.base64,
        },
      });
    }

    // Add transcript + OCR as text context (drastically reduces hallucination)
    if (transcript) {
      parts.push({ text: `\n\n=== AUDIO TRANSCRIPT ===\n${transcript}` });
    }
    if (ocrTexts && ocrTexts.length > 0) {
      const ocrSummary = ocrTexts
        .map((o) => `Frame ${o.frame_index}: ${o.text}`)
        .join("\n");
      parts.push({ text: `\n\n=== OCR TEXT FROM FRAMES ===\n${ocrSummary}` });
    }

    parts.push({ text: "\n\nAnalyze all frames above and return the JSON." });

    const result = await model.generateContent(parts);
    const text = result.response.text();

    // Parse and validate
    let parsed;
    try {
      // Strip markdown code fences if model adds them
      const clean = text
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(clean);
    } catch {
      // Return raw text if JSON parse fails
      return NextResponse.json({ raw: text, parseError: true });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[media/vision] Error:", err);
    return NextResponse.json(
      { error: String(err), fallback: true },
      { status: 500 }
    );
  }
}
