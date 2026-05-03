"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, ExternalLink } from "lucide-react";
import ConfidenceBadge from "./confidence-badge";
import { ContentConfidence } from "@/lib/content-pipeline";

interface ContentPreviewCardProps {
  title?: string;
  body?: string;
  url?: string;
  platform?: string;
  confidence: ContentConfidence;
  source: "extension" | "pasted" | "extracted";
  visible: boolean;
  onDismiss?: () => void;
}

const sourceLabels = {
  extension: "Imported from browser extension",
  pasted: "User-provided content",
  extracted: "Extracted from URL",
};

const sourceIcons = {
  extension: "🔌",
  pasted: "✍️",
  extracted: "🔗",
};

export default function ContentPreviewCard({
  title,
  body,
  url,
  platform,
  confidence,
  source,
  visible,
  onDismiss,
}: ContentPreviewCardProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Content Being Analyzed</span>
              <ConfidenceBadge confidence={confidence} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {sourceIcons[source]} {sourceLabels[source]}
              </span>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-0.5 rounded hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-2">
            {title && (
              <p className="text-sm font-medium text-foreground line-clamp-1">{title}</p>
            )}
            {body && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
                {body}
              </p>
            )}
            {!body && !title && (
              <p className="text-xs text-muted-foreground italic">No content preview available</p>
            )}
            <div className="flex items-center gap-3 pt-0.5">
              {platform && (
                <span className="text-xs text-muted-foreground capitalize">📱 {platform}</span>
              )}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet hover:text-violet-light flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View source
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
