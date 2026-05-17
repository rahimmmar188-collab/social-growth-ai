import { NextRequest } from "next/server";
import { streamGemini } from "@/lib/agents/model-router";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/agents/multimodal-url
 *
 * Final reasoning engine for the multimodal pipeline.
 * Combines: visual_analysis + transcript + OCR + caption + engagement
 * → Streams a comprehensive MultimodalURLResult as JSON.
 *
 * Model: Gemini 2.5 Flash (primary) with Pro fallback.
 * This is the ONLY Gemini Pro call in the pipeline — final synthesis only.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      niche,
      platform,
      caption,
      engagement,
      creator,
      visualAnalysis,
      transcript,
      hookPhrase,
      ocrTexts,
      durationSeconds,
      sceneCount,
      audioEnergy,
      confidence,
      userNote,
      dataMode,
    } = await req.json();

    // ── Build the grounded user message ────────────────────────────────────
    const ocrSummary =
      Array.isArray(ocrTexts) && ocrTexts.length > 0
        ? ocrTexts.map((o: { text: string }) => o.text).join(" | ")
        : "none detected";

    const frameDescriptions =
      visualAnalysis?.frameDescriptions
        ?.map(
          (f: { timestamp: number; description: string; cameraAngle: string; energyLevel: string; textOverlays: string[] }) =>
            `[${f.timestamp}s] ${f.description} | Camera: ${f.cameraAngle} | Energy: ${f.energyLevel} | Overlays: ${(f.textOverlays || []).join(", ") || "none"}`
        )
        .join("\n") || "No frame data available";

    const overallVision = visualAnalysis?.overall
      ? JSON.stringify(visualAnalysis.overall, null, 2)
      : "Not available";

    const userMessage = `
PLATFORM: ${platform || "Unknown"}
NICHE: ${niche || "general"}
CREATOR: ${creator?.username || "unknown"} | ${creator?.profileUrl || ""}
VIDEO DURATION: ${durationSeconds || 0}s | SCENES: ${sceneCount || 0} | AUDIO ENERGY: ${audioEnergy || "unknown"}
ENGAGEMENT: ${engagement?.likes || 0} likes · ${engagement?.views || 0} views
CONFIDENCE LEVEL: ${confidence || "MEDIUM"}
${userNote ? `USER NOTE: ${userNote}` : ""}

=== CAPTION / POST TEXT ===
${caption || "none"}

=== SPOKEN TRANSCRIPT (faster-whisper) ===
${transcript || "none"}

=== HOOK PHRASE (first 5 seconds of audio) ===
${hookPhrase || "none"}

=== ON-SCREEN TEXT (pytesseract OCR) ===
${ocrSummary}

=== VISUAL FRAME ANALYSIS (per-keyframe) ===
${frameDescriptions}

=== OVERALL VISUAL INTELLIGENCE ===
${overallVision}

Based on ALL of the above multimodal signals, generate the complete viral intelligence analysis.
`.trim();

    const systemPrompt = getMultimodalSystemPrompt(niche || "general", platform || "unknown", dataMode || "full-multimodal");

    // ── Stream response ────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    let buffer = "";
    let refined = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: string) => {
          buffer += chunk;
          controller.enqueue(encoder.encode(chunk));
        };

        try {
          // Pass 1: Gemini Flash (fast, cheap)
          await streamGemini("gemini-2.5-flash", systemPrompt, userMessage, send);

          // Quality gate: if output is too short or weak, run Pro pass
          const quality = buffer.length > 800 && !buffer.includes('"error"');
          if (!quality) {
            // Reset and run Pro
            buffer = "";
            controller.enqueue(encoder.encode("\n\n__REFINED__:"));
            refined = true;
            await streamGemini("gemini-2.5-pro", systemPrompt, userMessage, send);
          } else if (confidence === "HIGH" && !refined) {
            // HIGH confidence (real video data): always refine for best output
            controller.enqueue(encoder.encode("\n\n__REFINED__:"));
            await streamGemini("gemini-2.5-pro", systemPrompt, userMessage, (c) => {
              controller.enqueue(encoder.encode(c));
            });
          }
        } catch (err) {
          // Fallback to Flash on Pro error
          try {
            controller.enqueue(encoder.encode("\n__REFINED__\n"));
            await streamGemini("gemini-2.5-flash", systemPrompt, userMessage, (c) => {
              controller.enqueue(encoder.encode(c));
            });
          } catch (err2) {
            controller.enqueue(encoder.encode(`\n{"error": "${err2}"}`));
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── Multimodal system prompt ─────────────────────────────────────────────────
function getMultimodalSystemPrompt(niche: string, platform: string, dataMode: string): string {
  const isFullMultimodal = dataMode === "full-multimodal";

  const dataSourceDescription = isFullMultimodal
    ? `You have received REAL, MACHINE-EXTRACTED data from physically watching, listening to, and reading a ${platform} video using:
- Gemini Vision multimodal analysis (actual video frames)
- Audio transcription (actual spoken words)
- OCR (actual on-screen text)
- Caption/post text

This is NOT speculation. Ground ALL your analysis in the provided data.`
    : `You have received the CAPTION / POST TEXT from a ${platform} post extracted directly by the user's browser extension.
You do NOT have video frame data, audio transcription, or OCR for this post — the video could not be analyzed directly.

Be honest about what data is and isn't available. For visual/audio fields where you have no data, say "not available — based on caption analysis only".
Do NOT fabricate video timestamps, frame descriptions, or spoken quotes that aren't in the provided text.`;

  return `You are an elite Multimodal Viral Intelligence Analyst.

${dataSourceDescription}

STRICT RULES:
1. Quote actual phrases from the transcript when relevant
2. Reference specific timestamps when describing visual elements
3. Use exact OCR text when discussing on-screen text
4. If a field has no data ("none"), acknowledge it and infer from available signals
5. Scores must reflect actual quality — do not inflate

NICHE CONTEXT: ${niche}
PLATFORM: ${platform}

Return ONLY this exact JSON schema — no markdown, no extra keys, no commentary:

{
  "viralAutopsy": "Detailed autopsy grounded in the actual video content. Quote real transcript lines.",

  "hookAnalysis": {
    "first3Seconds": "Specific description of what happens visually and aurally in the first 3 seconds",
    "hookType": "question|shock|contrast|story|curiosity|how-to|social-proof|other",
    "hookPhrase": "Exact spoken or on-screen hook text if available",
    "emotionalTrigger": "Primary emotion activated",
    "attentionMechanism": "Specific technique used to stop the scroll"
  },

  "contentDNA": {
    "hookType": "...",
    "pacing": "Rapid-fire cuts / Moderate / Slow-burn storytelling",
    "tensionPayoff": "How tension builds and where the payoff lands",
    "ctaPlacement": "Timestamp and style of CTA",
    "format": "Talking head / Montage / Tutorial / Storytelling / etc."
  },

  "audioIntelligence": {
    "hookPhrase": "Exact first 5s spoken text",
    "fullTranscript": "Full transcript (truncated to 500 chars if long)",
    "speakingPace": "Slow / Medium / Fast — approximate WPM",
    "emotionTone": "Excited / Calm / Urgent / Inspirational / etc.",
    "keyPhrases": ["phrase1", "phrase2", "phrase3"]
  },

  "onScreenText": {
    "hookText": "Main hook text overlay if any",
    "ctaText": "Call to action text if any",
    "subtitles": "Subtitle text if present",
    "otherText": ["any", "other", "detected", "text"]
  },

  "retentionStrategy": {
    "sceneCount": 0,
    "avgSceneDuration": "~Xs per scene",
    "patternInterrupts": ["technique1", "technique2"],
    "curiosityLoops": ["loop1", "loop2"],
    "pacingStyle": "Description of pacing strategy"
  },

  "editingAnalysis": {
    "cutStyle": "Jump cuts / L-cuts / Hard cuts / Smooth transitions",
    "visualRhythm": "Description of visual rhythm",
    "cameraWork": "Handheld / Stable / Dynamic / Mixed",
    "energyLevel": "high|medium|low",
    "productionQuality": "high|medium|low"
  },

  "ctaEffectiveness": {
    "visualCTA": "What the visual CTA shows",
    "spokenCTA": "Exact spoken CTA if any",
    "timing": "Appears at Xs / End card / Throughout",
    "strength": "strong|moderate|weak",
    "improvement": "How to make the CTA stronger"
  },

  "ethicalBorrow": [
    "Specific structural element #1 to adapt",
    "Specific structural element #2 to adapt",
    "Specific structural element #3 to adapt"
  ],

  "outperformAnalysis": [
    "Specific weakness in the original to exploit",
    "Gap in their approach you can fill",
    "Angle they didn't use that would outperform"
  ],

  "recreatedVersion": "A complete reimagined script/concept for the ${niche} niche. Use the same viral structure but completely original content. Include hook, body, and CTA.",

  "viralityScorecard": {
    "hookStrength": 8,
    "emotionalResonance": 7,
    "shareability": 9,
    "ctaClarity": 6,
    "productionValue": 7,
    "overall": 74
  },

  "audiencePsychology": "Deep explanation of the psychological mechanisms at play in this content",

  "creatorStyleSignature": "What makes this creator's style distinctive based on the observed data",

  "weaknessesAndImprovements": [
    "Specific weakness #1 with improvement suggestion",
    "Specific weakness #2 with improvement suggestion",
    "Specific weakness #3 with improvement suggestion"
  ],

  "postingPlaybook": {
    "platform": "${platform}",
    "optimalTime": "Best day and time to post based on content type",
    "hashtagMix": ["#broad1", "#niche1", "#niche2", "#viral1", "#community1"],
    "abTest": "What to A/B test first (e.g., hook variant)"
  },

  "contentNiche": "Detected content niche/category",
  "dataConfidence": "HIGH|MEDIUM|LOW",
  "dataSource": "multimodal|caption-only|metadata-only"
}`;
}
