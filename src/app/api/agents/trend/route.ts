import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getTrendPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { niche, platform, creatorType = "personal" } = await req.json();
    if (!niche || !platform) return new Response("Missing niche or platform", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured. Please check Gemini or Groq API keys.", { status: 500 });

    const system = getTrendPrompt(niche, platform, creatorType);
    const user = `Analyze trending content, hashtags, and content angles for the "${niche}" niche on ${platform}. Return the full JSON response.`;

    return createDualPassStream("trend", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
