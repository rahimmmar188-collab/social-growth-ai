import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getURLPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { metadata, niche, platform, userNote, contentBody, confidence } = await req.json();
    if (!metadata || !niche) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured.", { status: 500 });

    const conf = (confidence || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW";
    const system = getURLPrompt(niche, platform || "instagram", conf);

    // Build the content section — use contentBody (real content) when available
    const contentSection = contentBody
      ? `Full content:\n${contentBody}`
      : `Metadata only:\n${JSON.stringify(metadata, null, 2)}`;

    const user = `Perform a complete viral intelligence analysis on this content:

Platform: ${platform || "Unknown"}
My niche: ${niche}
Content confidence: ${conf}
${userNote ? `What caught my eye: ${userNote}` : ""}

${contentSection}

Generate all 7 intelligence cards: viral autopsy, content DNA map, ethical borrow framework, outperform analysis, recreated version, virality scorecard, and posting playbook. Return full JSON.`;

    return createDualPassStream("url", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
