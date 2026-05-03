"use client";

import { ContentConfidence, getConfidenceColors, getConfidenceLabel } from "@/lib/content-pipeline";

interface ConfidenceBadgeProps {
  confidence: ContentConfidence;
  showLabel?: boolean;
  className?: string;
}

export default function ConfidenceBadge({
  confidence,
  showLabel = true,
  className = "",
}: ConfidenceBadgeProps) {
  const colors = getConfidenceColors(confidence);
  const label = getConfidenceLabel(confidence);

  const emoji = confidence === "HIGH" ? "🟢" : confidence === "MEDIUM" ? "🟡" : "🔴";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border} ${className}`}
    >
      <span className="text-xs leading-none">{emoji}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
}
