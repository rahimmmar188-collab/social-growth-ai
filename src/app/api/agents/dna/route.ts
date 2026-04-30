import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getDNAPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { caption, niche, platform, trendContext } = await req.json();
    if (!niche || !platform) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured. Please check Gemini or Groq API keys.", { status: 500 });

    const system = getDNAPrompt(niche, platform);
    const context = trendContext ? `\nTrend context: ${JSON.stringify(trendContext)}` : "";
    const user = `Perform a viral DNA analysis on this content for the "${niche}" niche on ${platform}:

"${caption || "Generate a viral content idea for this niche"}"
${context}

Return the full JSON analysis.`;

    return createDualPassStream("dna", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
