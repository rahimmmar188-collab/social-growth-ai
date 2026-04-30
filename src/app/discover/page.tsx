"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { TrendResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import PillTabs from "@/components/shared/pill-tabs";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import ExportButton from "@/components/shared/export-button";
import RefinedBadge from "@/components/shared/refined-badge";
import { TrendingUp, Sparkles, Hash, Lightbulb, RefreshCw } from "lucide-react";
import { Platform } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

const trendingNiches = ["fitness", "personal finance", "travel", "food", "tech", "beauty", "mindset", "real estate", "parenting", "crypto"];

export default function DiscoverPage() {
  const { userProfile, ui, incrementUsage } = useAppStore();
  const [niche, setNiche] = useState(userProfile.niche || "");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const { data, isStreaming, isRefined, error, startStreaming, reset } = useStreaming<TrendResult>();

  const handleDiscover = async () => {
    if (!niche.trim()) return;
    incrementUsage();
    reset();
    await startStreaming("/api/agents/trend", {
      niche,
      platform,
      creatorType: userProfile.creatorType || "personal",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          Discover Trends
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Find what&apos;s trending in any niche — phrases, hashtags, and content gaps</p>
      </div>

      <GlassCard hover={false}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
              placeholder="Enter your niche…"
              className="flex-1 glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
            <button onClick={handleDiscover} disabled={!niche.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
              {isStreaming ? <><Sparkles className="w-4 h-4 animate-spin" /> Scanning</> : <><TrendingUp className="w-4 h-4" /> Discover</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingNiches.map((n) => (
              <button key={n} onClick={() => setNiche(n)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${niche === n ? "gradient-violet text-white border-transparent" : "bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"}`}>
                {n}
              </button>
            ))}
          </div>
          <PillTabs options={platforms} value={platform} onChange={setPlatform} />
        </div>
      </GlassCard>

      {isStreaming && !data && <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={4 + i} />)}</div>}
      <ErrorBanner message={error} onDismiss={reset} onRetry={handleDiscover} />

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Results for <span className="text-foreground font-medium">{niche}</span> on <span className="text-foreground font-medium capitalize">{platform}</span></p>
              <button onClick={handleDiscover} className="flex items-center gap-1 text-xs text-violet hover:underline">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Trending Phrases */}
            <GlassCard hover={false} delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Trending Phrases</h3>
                {isStreaming && <div className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />}
                <RefinedBadge visible={isRefined} />
              </div>
              <div className="space-y-2">
                {data.trendingPhrases?.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}.</span>
                      <span className="text-sm text-foreground truncate">{p.phrase}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.volume === "high" ? "bg-teal/10 text-teal" : p.volume === "medium" ? "bg-violet/10 text-violet" : "bg-amber-400/10 text-amber-400"}`}>{p.volume}</span>
                      <span className={`text-xs ${p.momentum === "rising" ? "text-teal" : p.momentum === "fading" ? "text-red-400" : "text-muted-foreground"}`}>
                        {p.momentum === "rising" ? "↑" : p.momentum === "fading" ? "↓" : "→"}
                      </span>
                      <CopyButton text={p.phrase} size="sm" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>

            {/* Hashtags */}
            <GlassCard hover={false} delay={0.06}>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-teal" />
                  <h3 className="font-heading font-semibold text-sm text-foreground">Trending Hashtags</h3>
                </div>
                <div className="flex items-center gap-2">
                  <SaveButton item={{ type: "report", content: data.hashtags as unknown as Record<string, unknown>, tags: ["hashtags", niche], folder: "Hashtag Sets", title: `${niche} Hashtags — ${platform}` }} />
                  <ExportButton
                    variant="icon"
                    filename={`hashtags-${niche.replace(/\s+/g, "-")}`}
                    title={`${niche} Hashtags — ${platform}`}
                    sections={[
                      { heading: "Niche", body: niche },
                      { heading: "Broad Hashtags", body: (data.hashtags?.broad || []).join(" ") },
                      { heading: "Niche Hashtags", body: (data.hashtags?.niche || []).join(" ") },
                      { heading: "Viral Hashtags", body: (data.hashtags?.viral || []).join(" ") },
                      { heading: "Content Angles", body: (data.contentAngles || []).map((a) => `${a.angle}: ${a.rationale}`).join("\n") },
                    ]}
                  />
                </div>
              </div>
              {[
                { label: "🔵 Broad", tags: data.hashtags?.broad, copyColor: "bg-blue-400/10 text-blue-400" },
                { label: "🟣 Niche", tags: data.hashtags?.niche, copyColor: "bg-violet/10 text-violet" },
                { label: "🟢 Viral", tags: data.hashtags?.viral, copyColor: "bg-teal/10 text-teal" },
              ].map(({ label, tags, copyColor }) => (
                <div key={label} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <button onClick={() => navigator.clipboard.writeText((tags || []).join(" "))} className="text-xs text-violet hover:underline">Copy all</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags?.map((tag, i) => (
                      <button key={i} onClick={() => navigator.clipboard.writeText(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${copyColor}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </GlassCard>

            {/* Content Angles */}
            <GlassCard hover={false} delay={0.12}>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-violet" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Content Angles</h3>
              </div>
              <div className="space-y-3">
                {data.contentAngles?.map((a, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1 group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{a.angle}</p>
                      <CopyButton text={a.angle} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">{a.rationale}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Competitor Gaps */}
            {data.competitorGaps && (
              <GlassCard hover={false} delay={0.18}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">🎯</span>
                  <h3 className="font-heading font-semibold text-sm text-foreground">Content Gaps You Can Own</h3>
                </div>
                <div className="space-y-2">
                  {data.competitorGaps?.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-violet/[0.04] border border-violet/[0.1]">
                      <span className="text-violet text-sm font-bold flex-shrink-0">{i + 1}.</span>
                      <p className="text-sm text-foreground">{gap}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
