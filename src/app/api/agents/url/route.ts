import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getURLPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { metadata, niche, platform, userNote } = await req.json();
    if (!metadata || !niche) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured. Please check Gemini or Groq API keys.", { status: 500 });

    const system = getURLPrompt(niche, platform || "instagram");
    const user = `Perform a complete viral intelligence analysis on this content:

Content metadata:
${JSON.stringify(metadata)}

My niche: ${niche}
${userNote ? `What caught my eye: ${userNote}` : ""}

Generate all 7 intelligence cards: viral autopsy, content DNA map, ethical borrow framework, outperform analysis, recreated version, virality scorecard, and posting playbook. Return full JSON.`;

    return createDualPassStream("url", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
