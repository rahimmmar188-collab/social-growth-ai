import { NextRequest } from "next/server";
import { createDualPassStream } from "@/lib/agents/stream";
import { getGapAnalysisPrompt } from "@/lib/agents/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userContent, competitorPosts, niche, platform } = await req.json();

    if (!userContent || !niche) {
      return new Response("Missing required fields", { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return new Response("AI model not configured. Please check Gemini API key.", { status: 500 });
    }

    const system = getGapAnalysisPrompt(niche, platform || "instagram");

    const competitorSummary = competitorPosts?.length
      ? `Top competitor posts analyzed:\n${competitorPosts
          .slice(0, 5)
          .map((p: { title: string; description: string; engagement_score: number }, i: number) =>
            `${i + 1}. "${p.title}" — ${p.description} (engagement score: ${p.engagement_score})`
          )
          .join("\n")}`
      : "No specific competitor posts provided — analyze based on top performers in this niche.";

    const user = `Perform a full competitive gap analysis.

USER'S CONTENT:
${userContent}

COMPETITOR BENCHMARK:
${competitorSummary}

My niche: ${niche}
Platform: ${platform || "instagram"}

Analyze the gap between my content and the competitor benchmark. Generate all 7 gap analysis cards. Return full JSON.`;

    return createDualPassStream("dna", system, user);
  } catch (err) {
    return new Response("Gap agent error: " + String(err), { status: 500 });
  }
}
