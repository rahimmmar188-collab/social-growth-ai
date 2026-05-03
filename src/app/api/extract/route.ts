import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── In-memory session store (cleared on server restart, fine for serverless) ──
// Maps sessionId → { content, platform, url, importedAt }
const sessionStore = new Map<string, {
  content: string;
  platform: string;
  url?: string;
  importedAt: number;
}>();

// Also track the "latest" import for easy polling
let latestSessionId: string | null = null;

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── POST /api/extract — Called by browser extension ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { content, platform, url } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (content.trim().length < 10) {
      return NextResponse.json({ error: "content too short" }, { status: 400 });
    }

    const sessionId = generateId();
    sessionStore.set(sessionId, {
      content: content.trim(),
      platform: platform || "unknown",
      url: url || undefined,
      importedAt: Date.now(),
    });
    latestSessionId = sessionId;

    // Cleanup old sessions (older than 30 minutes)
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, session] of sessionStore.entries()) {
      if (session.importedAt < cutoff) sessionStore.delete(id);
    }

    return NextResponse.json({
      sessionId,
      content: content.trim(),
      platform: platform || "unknown",
      url: url || null,
      importedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── GET /api/extract?session=<id>|latest — Poll for imported content ──────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionParam = searchParams.get("session");

  let sessionId = sessionParam;
  if (sessionParam === "latest") {
    sessionId = latestSessionId;
  }

  if (!sessionId) {
    return NextResponse.json({ content: null, sessionId: null });
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return NextResponse.json({ content: null, sessionId: null });
  }

  return NextResponse.json({
    sessionId,
    content: session.content,
    platform: session.platform,
    url: session.url || null,
    importedAt: new Date(session.importedAt).toISOString(),
  });
}

// ── DELETE /api/extract?session=<id> — Clear after use ───────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");
  if (sessionId) {
    sessionStore.delete(sessionId);
    if (latestSessionId === sessionId) latestSessionId = null;
  }
  return NextResponse.json({ ok: true });
}
