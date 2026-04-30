import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getCreatePrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { niche, platform, creatorType = "personal", trendData, dnaAnalysis } = await req.json();
    if (!niche || !platform) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured. Please check Gemini or Groq API keys.", { status: 500 });

    const system = getCreatePrompt(niche, platform, creatorType);
    const context = [
      trendData ? `Trend intelligence: ${JSON.stringify(trendData)}` : "",
      dnaAnalysis ? `Viral DNA analysis: ${JSON.stringify(dnaAnalysis)}` : "",
    ].filter(Boolean).join("\n\n");

    const user = `Create viral content for the "${niche}" niche on ${platform}.
${context}

Generate all 10 hooks, 5 reel concepts, 3 captions, 5 CTAs, and platform tips. Return the full JSON.`;

    return createDualPassStream("create", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
