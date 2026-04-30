"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { URLResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import ExportButton from "@/components/shared/export-button";
import RefinedBadge from "@/components/shared/refined-badge";
import { Search, Link2, AlertCircle, Sparkles, ExternalLink } from "lucide-react";

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "Facebook";
  return "Unknown";
}

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/10 text-red-400 border-red-500/20",
  Instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  TikTok: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  LinkedIn: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Facebook: "bg-blue-600/10 text-blue-400 border-blue-600/20",
  Unknown: "bg-white/[0.06] text-muted-foreground border-white/[0.06]",
};

export default function SpyRecreatePage() {
  const { userProfile, incrementUsage } = useAppStore();
  const [url, setUrl] = useState("");
  const [niche, setNiche] = useState(userProfile.niche || "");
  const [userNote, setUserNote] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaError, setMetaError] = useState("");
  const detectedPlatform = url ? detectPlatform(url) : "";

  const { data, isStreaming, isRefined, error, startStreaming } = useStreaming<URLResult>();

  const handleFetchMeta = async () => {
    if (!url.trim()) return;
    setFetchingMeta(true);
    setMetaError("");
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to fetch metadata");
      const meta = await res.json();
      setMetadata(meta);
    } catch {
      setMetaError("Could not fetch URL metadata. Please paste the content manually.");
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim() || !niche.trim()) return;
    incrementUsage();
    await startStreaming("/api/agents/url", {
      metadata: metadata || { url, title: url },
      niche,
      platform: detectedPlatform,
      userNote,
    });
  };

  const exampleUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-violet flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          Spy & Recreate
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paste any viral reel, post, or video URL — get a 7-card intelligence report
        </p>
      </div>

      {/* Input Card */}
      <GlassCard hover={false}>
        <div className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Content URL</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setMetadata(null); }}
                  placeholder="https://youtube.com/watch?v=… or instagram.com/p/…"
                  className="w-full glass-input pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                  disabled={isStreaming}
                />
              </div>
              {url && (
                <div className={`flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium ${platformColors[detectedPlatform] || platformColors.Unknown}`}>
                  {detectedPlatform}
                </div>
              )}
            </div>
            {!url && (
              <button onClick={() => setUrl(exampleUrl)} className="text-xs text-violet hover:underline">
                Try an example URL
              </button>
            )}
          </div>

          {/* Fetch Metadata */}
          {url && !metadata && (
            <button onClick={handleFetchMeta} disabled={fetchingMeta}
              className="flex items-center gap-2 text-xs text-violet hover:text-violet-light transition-colors disabled:opacity-50">
              {fetchingMeta ? <><Sparkles className="w-3 h-3 animate-spin" /> Fetching preview…</> : <><ExternalLink className="w-3 h-3" /> Fetch preview</>}
            </button>
          )}

          {/* Metadata Preview */}
          {metadata && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex gap-3">
              {metadata.image && (
                <img src={metadata.image} alt="Preview" className="w-16 h-12 rounded-lg object-cover flex-shrink-0 bg-white/[0.04]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{metadata.title || url}</p>
                {metadata.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{metadata.description}</p>
                )}
                {metadata.channelName && (
                  <p className="text-xs text-violet mt-1">{metadata.channelName}</p>
                )}
                {metadata.viewCount && (
                  <p className="text-xs text-muted-foreground">{Number(metadata.viewCount).toLocaleString()} views</p>
                )}
              </div>
            </div>
          )}

          {metaError && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {metaError}
            </div>
          )}

          {/* Niche + Note */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Your niche</label>
              <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. fitness, finance, travel"
                className="w-full glass-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">What caught your eye? (optional)</label>
              <input type="text" value={userNote} onChange={(e) => setUserNote(e.target.value)}
                placeholder="e.g. the hook, the storytelling, the CTA"
                className="w-full glass-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleAnalyze} disabled={!url.trim() || !niche.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              {isStreaming ? <><Sparkles className="w-4 h-4 animate-spin" /> Performing viral autopsy…</> : <><Search className="w-4 h-4" /> Analyze</>}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Loading */}
      {isStreaming && !data && (
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => <SkeletonCard key={i} lines={3 + i % 3} />)}
        </div>
      )}

      {/* Error */}
      <ErrorBanner message={error} onDismiss={() => {}} onRetry={handleAnalyze} />

      {/* 7 Intelligence Cards */}
      <AnimatePresence>
        {data && (
          <motion.div className="space-y-4">
            {/* Export full report */}
            <div className="flex items-center justify-between">
              <RefinedBadge visible={isRefined} />
              <ExportButton
                variant="pill"
                label="Export Full Report"
                filename={`spy-recreate-${url.slice(0,30).replace(/[^a-z0-9]/gi, '-')}`}
                title={`Spy & Recreate Report`}
                sections={[
                  { heading: "Source URL", body: url },
                  { heading: "Your Niche", body: niche },
                  { heading: "Viral Autopsy", body: String(data.viralAutopsy || '') },
                  { heading: "Ethical Borrow", body: (data.ethicalBorrow as string[] || []).join('\n') },
                  { heading: "Outperform Analysis", body: (data.outperformAnalysis as string[] || []).join('\n') },
                  { heading: "Your Recreated Version", body: String(data.recreatedVersion || '') },
                ]}
              />
            </div>
            {[
              { title: "Viral Autopsy", emoji: "🔬", content: data.viralAutopsy, type: "text" },
              { title: "Content DNA Map", emoji: "🧬", content: data.contentDNA, type: "object" },
              { title: "Ethical Borrow Framework", emoji: "💡", content: data.ethicalBorrow, type: "list" },
              { title: "Where You Can Outperform It", emoji: "🎯", content: data.outperformAnalysis, type: "list" },
              { title: "Your Recreated Version", emoji: "✨", content: data.recreatedVersion, type: "text", highlight: true },
              { title: "Virality Scorecard", emoji: "📊", content: data.viralityScorecard, type: "scores" },
              { title: "Posting Playbook", emoji: "📅", content: data.postingPlaybook, type: "object" },
            ].map((card, i) => (
              <GlassCard key={i} hover={false} delay={i * 0.06}
                className={card.highlight ? "border-teal/20 bg-teal/[0.03]" : ""}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{card.emoji}</span>
                    <h3 className="font-heading font-semibold text-sm text-foreground">{card.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    {card.type === "text" && <CopyButton text={card.content as string} />}
                    <SaveButton item={{ type: "report", content: { [card.title]: card.content }, tags: ["spy-recreate"], folder: "Spy & Recreate", title: `${card.title} — ${url.slice(0, 40)}` }} />
                  </div>
                </div>

                {card.type === "text" && (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{card.content as string}</p>
                )}
                {card.type === "list" && (
                  <ul className="space-y-2">
                    {(card.content as string[])?.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-violet mt-0.5 flex-shrink-0">•</span>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {card.type === "object" && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(card.content as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-xs text-muted-foreground capitalize mb-1">{k.replace(/([A-Z])/g, " $1")}</p>
                        <p className="text-sm text-foreground">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {card.type === "scores" && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(card.content as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                          <span className="text-foreground font-semibold">{v}/10</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(v / 10) * 100}%` }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                            className="h-full rounded-full gradient-violet" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
