import { NextRequest } from "next/server";
import { scoreConfidence } from "@/lib/content-pipeline";

export const runtime = "nodejs";

const RESTRICTED = ["instagram", "tiktok", "linkedin", "facebook"];

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "facebook";
  return "unknown";
}

async function fetchOpenGraph(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialGrowthAI/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const getMeta = (name: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"));
      return match ? match[1] : "";
    };

    return {
      title: getMeta("og:title") || getMeta("twitter:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "",
      description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || "",
      image: getMeta("og:image") || getMeta("twitter:image") || "",
      siteName: getMeta("og:site_name") || "",
      type: getMeta("og:type") || "",
    };
  } catch {
    return { title: "", description: "", image: "", siteName: "", type: "" };
  }
}

async function fetchYouTubeData(url: string) {
  const videoId = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
  if (!videoId || !process.env.YOUTUBE_API_KEY) return null;

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,statistics`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      title: item.snippet?.title || "",
      description: item.snippet?.description?.slice(0, 500) || "",
      channelName: item.snippet?.channelTitle || "",
      publishDate: item.snippet?.publishedAt || "",
      tags: item.snippet?.tags?.slice(0, 10) || [],
      viewCount: item.statistics?.viewCount || "0",
      likeCount: item.statistics?.likeCount || "0",
      commentCount: item.statistics?.commentCount || "0",
      thumbnail: item.snippet?.thumbnails?.high?.url || "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return new Response("URL required", { status: 400 });

    const platform = detectPlatform(url);
    const isRestricted = RESTRICTED.includes(platform);
    let metadata: Record<string, unknown> = { url, platform };

    if (platform === "youtube") {
      const ytData = await fetchYouTubeData(url);
      if (ytData) {
        metadata = { ...metadata, ...ytData };
      } else {
        const og = await fetchOpenGraph(url);
        metadata = { ...metadata, ...og };
      }
    } else {
      const og = await fetchOpenGraph(url);
      metadata = { ...metadata, ...og };
    }

    // Compute confidence — restricted platforms are always LOW regardless of what we extracted
    const confidence = isRestricted ? "LOW" : scoreConfidence(metadata);

    return new Response(JSON.stringify({ ...metadata, confidence }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response("Metadata fetch error: " + String(err), { status: 500 });
  }
}
