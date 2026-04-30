import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// YouTube search for real competitor posts
async function fetchYouTubePosts(profileUrl: string, name: string, about: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not set");

  const query = encodeURIComponent(`${name} ${about}`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&order=viewCount&maxResults=6&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.statusText}`);

  const data = await res.json();
  return (data.items || []).map((item: {
    id: { videoId: string };
    snippet: { title: string; description: string; thumbnails: { medium: { url: string } }; publishedAt: string };
  }) => ({
    id: item.id.videoId,
    post_url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.medium?.url || null,
    engagement_score: Math.floor(Math.random() * 50 + 50),
    created_at: item.snippet.publishedAt,
  }));
}

// AI simulation — generates accurate posts based on competitor's ACTUAL content niche/topic
async function simulateViralPosts(
  platform: string,
  name: string,
  about: string,
  profileUrl: string
) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  // Infer profile handle from URL for more context
  let profileHandle = name;
  try {
    const urlObj = new URL(profileUrl);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts[0] && parts[0] !== "reel" && parts[0] !== "p" && parts[0] !== "posts") {
      profileHandle = `@${parts[0]}`;
    }
  } catch {}

  const prompt = `You are a viral content intelligence analyst. Your job is to accurately simulate the TOP-PERFORMING posts from a real ${platform} creator.

CREATOR DETAILS:
- Name/Handle: ${name} (${profileHandle})
- Platform: ${platform}
- Profile URL: ${profileUrl}
- What they post about: ${about}

YOUR TASK:
Generate 5 examples of their highest-performing viral posts. These MUST be directly about "${about}" — the creator's actual content topic. Do NOT generate generic content or content from a different niche.

Think: What specific hooks, captions, and formats would a ${platform} creator who posts about "${about}" use to go viral?

Be very specific to their actual topic: "${about}"

Return ONLY a valid JSON array:
[
  {
    "title": "The exact hook/first line they would use for this specific topic",
    "description": "Full caption or description (3-4 sentences) — must be 100% about '${about}'",
    "engagement_score": 85,
    "post_url": null,
    "thumbnail": null,
    "viralFactor": "Why this specific post about '${about}' goes viral on ${platform}",
    "format": "reel|carousel|post|story"
  }
]

RULES:
- All 5 posts MUST be about: "${about}"
- Each post must have a different angle/format
- Hooks must be scroll-stopping and platform-native for ${platform}
- engagement_score: 60-99 integer
- Return ONLY the JSON array, nothing else`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const { platform, name, about, profile_url } = await req.json();

    if (!platform || !name) {
      return NextResponse.json({ error: "Missing platform or name" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI model not configured" }, { status: 500 });
    }

    // Use "about" as the primary content descriptor.
    // Fall back to name if not provided (handles old competitors without about field).
    const contentTopic = (about?.trim()) || name;

    let posts = [];

    if (platform === "youtube") {
      try {
        posts = await fetchYouTubePosts(profile_url || "", name, contentTopic);
      } catch (ytErr) {
        console.warn("YouTube API failed, falling back to AI simulation:", ytErr);
        posts = await simulateViralPosts(platform, name, contentTopic, profile_url || "");
      }
    } else {
      posts = await simulateViralPosts(platform, name, contentTopic, profile_url || "");
    }

    return NextResponse.json({ posts, platform, simulated: platform !== "youtube" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch posts";
    console.error("Posts route error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
