import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getCaptionPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { idea, platform, tone = "motivational", lengthPref = "medium", niche } = await req.json();
    if (!idea || !platform) return new Response("Missing required fields", { status: 400 });
    if (!process.env.GROQ_API_KEY) return new Response("GROQ_API_KEY not configured", { status: 500 });

    const system = getCaptionPrompt(niche || "general", platform, tone, lengthPref);
    const user = `Write captions for this content idea:

"${idea}"

Platform: ${platform}
Tone: ${tone}
Length preference: ${lengthPref}
Niche: ${niche || "general"}

Return 3 caption variations, 30 hashtags (10 per group), 5 hook alternatives, and a posting tip. Return full JSON.`;

    return createDualPassStream("caption", system, user);
  } catch (err) {
    return new Response("Agent error: " + String(err), { status: 500 });
  }
}
