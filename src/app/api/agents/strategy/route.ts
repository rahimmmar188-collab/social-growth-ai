import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getStrategyPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { niche, platform, allPreviousOutputs } = await req.json();
    if (!niche || !platform) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GEMINI_API_KEY) return new Response("AI model not configured. Please check Gemini or Groq API keys.", { status: 500 });

    const system = getStrategyPrompt(niche, platform);
    const user = `Build a growth strategy for the "${niche}" niche on ${platform}.

Previous agent outputs:
${JSON.stringify(allPreviousOutputs || {})}

Create a complete 30-day strategy with viral scoring, posting windows, and content calendar. Return the full JSON.`;

    return createDualPassStream("strategy", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
