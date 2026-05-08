import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Extended session store — now includes multimodal fields ───────────────────
interface ExtractSession {
  content: string;
  caption: string;
  videoUrl: string;
  platform: string;
  url?: string;
  engagement: { likes: string; views: string; commentsCount?: string };
  creator: { username: string; profileUrl: string };
  postMeta: { postUrl: string; timestamp: string };
  importedAt: number;
}

const sessionStore = new Map<string, ExtractSession>();
let latestSessionId: string | null = null;

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── POST /api/extract — Called by browser extension ───────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support both legacy (content-only) and new structured payloads
    const content: string  = body.content || body.caption || "";
    const caption: string  = body.caption  || body.content || "";
    const videoUrl: string = body.videoUrl || "";
    const platform: string = body.platform || "unknown";
    const url: string      = body.url      || body.postMeta?.postUrl || "";

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (content.trim().length < 10) {
      return NextResponse.json({ error: "content too short" }, { status: 400 });
    }

    const sessionId = generateId();
    sessionStore.set(sessionId, {
      content: content.trim(),
      caption: caption.trim(),
      videoUrl,
      platform,
      url:      url || undefined,
      engagement: body.engagement || { likes: "0", views: "0", commentsCount: "0" },
      creator:    body.creator    || { username: "", profileUrl: "" },
      postMeta:   body.postMeta   || { postUrl: url, timestamp: new Date().toISOString() },
      importedAt: Date.now(),
    });
    latestSessionId = sessionId;

    // Cleanup sessions older than 30 minutes
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, session] of sessionStore.entries()) {
      if (session.importedAt < cutoff) sessionStore.delete(id);
    }

    return NextResponse.json({
      sessionId,
      content: content.trim(),
      caption: caption.trim(),
      videoUrl,
      platform,
      url: url || null,
      engagement: body.engagement || null,
      creator:    body.creator    || null,
      importedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── GET /api/extract?session=<id>|latest ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionParam = searchParams.get("session");

  let sessionId = sessionParam;
  if (sessionParam === "latest") sessionId = latestSessionId;

  if (!sessionId) return NextResponse.json({ content: null, sessionId: null });

  const session = sessionStore.get(sessionId);
  if (!session) return NextResponse.json({ content: null, sessionId: null });

  return NextResponse.json({
    sessionId,
    content:    session.content,
    caption:    session.caption,
    videoUrl:   session.videoUrl,
    platform:   session.platform,
    url:        session.url || null,
    engagement: session.engagement,
    creator:    session.creator,
    postMeta:   session.postMeta,
    importedAt: new Date(session.importedAt).toISOString(),
  });
}

// ── DELETE /api/extract?session=<id> ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");
  if (sessionId) {
    sessionStore.delete(sessionId);
    if (latestSessionId === sessionId) latestSessionId = null;
  }
  return NextResponse.json({ ok: true });
}
