// ── Content Confidence Scoring & Pipeline Utilities ───────────────────────────

export type ContentConfidence = "HIGH" | "MEDIUM" | "LOW";

// Platforms that block scraping — always default to LOW confidence
const RESTRICTED_PLATFORMS = ["instagram", "tiktok", "linkedin", "facebook"];

export function isRestrictedPlatform(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("instagram.com") ||
    lower.includes("tiktok.com") ||
    lower.includes("linkedin.com") ||
    lower.includes("facebook.com") ||
    lower.includes("fb.com")
  );
}

/** Score the confidence of extracted content */
export function scoreConfidence(
  metadata: Record<string, unknown>,
  pastedText?: string,
  extensionContent?: string
): ContentConfidence {
  // Extension content is always HIGH — it's real, user-imported content
  if (extensionContent && extensionContent.trim().length > 20) return "HIGH";

  // User pasted content upgrades to HIGH
  if (pastedText && pastedText.trim().length > 50) return "HIGH";

  // Restricted platforms always LOW unless user provided content
  const url = String(metadata.url || "");
  if (isRestrictedPlatform(url)) return "LOW";

  // Measure extracted text richness
  const description = String(metadata.description || "");
  const title = String(metadata.title || "");
  const caption = String(metadata.caption || "");
  const body = String(metadata.body || "");

  const richText = caption || body || description;
  const totalLength = richText.length + title.length;

  if (richText.length > 200) return "HIGH";
  if (totalLength > 80) return "MEDIUM";
  return "LOW";
}

/** Build the content body to send to the AI, respecting priority order */
export function buildContentBody(
  metadata: Record<string, unknown>,
  pastedText?: string,
  extensionContent?: string
): { body: string; source: "extension" | "pasted" | "extracted" } {
  // Priority 1: Extension content (highest trust)
  if (extensionContent && extensionContent.trim().length > 20) {
    return { body: extensionContent.trim(), source: "extension" };
  }

  // Priority 2: User-pasted content
  if (pastedText && pastedText.trim().length > 20) {
    const merged = [
      pastedText.trim(),
      metadata.title ? `Title: ${metadata.title}` : "",
    ].filter(Boolean).join("\n\n");
    return { body: merged, source: "pasted" };
  }

  // Priority 3: Extracted metadata (lowest trust)
  const parts: string[] = [];
  if (metadata.title) parts.push(`Title: ${metadata.title}`);
  if (metadata.channelName) parts.push(`Channel: ${metadata.channelName}`);
  if (metadata.description) parts.push(`Description: ${metadata.description}`);
  if (metadata.tags && Array.isArray(metadata.tags)) {
    parts.push(`Tags: ${(metadata.tags as string[]).join(", ")}`);
  }
  if (metadata.viewCount) parts.push(`Views: ${Number(metadata.viewCount).toLocaleString()}`);
  if (metadata.likeCount) parts.push(`Likes: ${Number(metadata.likeCount).toLocaleString()}`);
  if (metadata.url) parts.push(`URL: ${metadata.url}`);

  return { body: parts.join("\n"), source: "extracted" };
}

/** Confidence label for display */
export function getConfidenceLabel(confidence: ContentConfidence): string {
  switch (confidence) {
    case "HIGH": return "High Accuracy";
    case "MEDIUM": return "Partial Content";
    case "LOW": return "Metadata Only";
  }
}

/** Confidence color classes */
export function getConfidenceColors(confidence: ContentConfidence): {
  bg: string; text: string; border: string; dot: string;
} {
  switch (confidence) {
    case "HIGH":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/20",
        dot: "bg-emerald-400",
      };
    case "MEDIUM":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
        dot: "bg-amber-400",
      };
    case "LOW":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/20",
        dot: "bg-red-400",
      };
  }
}
