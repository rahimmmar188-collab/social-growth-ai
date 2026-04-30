"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { StrategyResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import PillTabs from "@/components/shared/pill-tabs";
import SkeletonCard from "@/components/shared/skeleton-card";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import ExportButton from "@/components/shared/export-button";
import RefinedBadge from "@/components/shared/refined-badge";
import { BarChart3, Sparkles, Calendar } from "lucide-react";
import { Platform } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

export default function AnalyzerPage() {
  const { userProfile, ui, incrementUsage } = useAppStore();
  const [caption, setCaption] = useState("");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const { data, isStreaming, isRefined, error, startStreaming, reset } = useStreaming<StrategyResult>();

  const handleAnalyze = async () => {
    if (!caption.trim()) return;
    incrementUsage();
    await startStreaming("/api/agents/strategy", {
      niche: userProfile.niche || "general",
      platform,
      allPreviousOutputs: { caption },
    });
  };

  const exportSections = data ? [
    { heading: "Analyzed Content", body: caption },
    { heading: "Viral Score", body: `${data.viralScore ?? "N/A"}/10` },
    { heading: "Score Breakdown", body: Object.entries(data.scoreBreakdown || {}).map(([k, v]) => `${k}: ${v}/10`).join("\n") },
    { heading: "Best Posting Windows", body: (data.bestPostingWindows || []).map((w) => `${w.day} @ ${w.time}`).join("\n") },
    { heading: "Improvement Actions", body: (data.improvementActions || []).map((a, i) => `${i + 1}. ${a}`).join("\n") },
    { heading: "Engagement Strategies", body: (data.engagementBait || []).join("\n") },
    { heading: "30-Day Calendar", body: (data.calendarSuggestion || []).map((w) => `Week ${w.week} — ${w.theme}:\n${(w.posts || []).join("\n")}`).join("\n\n") },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          Analyze Draft
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paste your draft content and get a viral score, posting windows, and a 30-day calendar
        </p>
      </div>

      <GlassCard hover={false}>
        <div className="space-y-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Paste your caption, hook, or post idea here…"
            className="w-full glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none min-h-[100px]"
            disabled={isStreaming}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PillTabs options={platforms} value={platform} onChange={setPlatform} />
            <button
              onClick={handleAnalyze}
              disabled={!caption.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {isStreaming
                ? <><Sparkles className="w-4 h-4 animate-spin" />Analyzing…</>
                : <><BarChart3 className="w-4 h-4" />Analyze</>}
            </button>
          </div>
        </div>
      </GlassCard>

      {isStreaming && !data && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={4 + i} />)}
        </div>
      )}

      <ErrorBanner message={error} onDismiss={reset} onRetry={handleAnalyze} />

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Viral Score */}
            <GlassCard hover={false} delay={0}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-sm text-foreground">Viral Score</h3>
                  <RefinedBadge visible={isRefined} />
                </div>
                <div className="flex items-center gap-2">
                  <SaveButton item={{ type: "analysis", content: { score: data.viralScore, breakdown: data.scoreBreakdown }, tags: ["analysis", platform], folder: "Analyses", title: `Analysis — ${caption.slice(0, 40)}` }} />
                  <ExportButton variant="icon" filename="analyzer-report" title="Draft Analysis Report" sections={exportSections} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <motion.circle
                      cx="40" cy="40" r="32" fill="none" stroke="#7c6ff7" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 32}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - (data.viralScore || 0) / 10) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-heading font-bold text-3xl text-foreground">{data.viralScore}</span>
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {Object.entries(data.scoreBreakdown || {}).map(([k, v]) => (
                    <div key={k} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{k}</span>
                        <span className="text-foreground font-medium">{v as number}/10</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(v as number) * 10}%` }}
                          transition={{ duration: 1, delay: 0.1 }}
                          className="h-full rounded-full gradient-violet"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Posting Windows */}
            <GlassCard hover={false} delay={0.06}>
              <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="text-base">🕐</span> Best Posting Windows
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {data.bestPostingWindows?.map((w, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-sm font-medium text-foreground">{w.day}</p>
                    <p className="text-teal text-xs mt-0.5">{w.time}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Improvement Actions */}
            <GlassCard hover={false} delay={0.1}>
              <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="text-base">🎯</span> 3 Improvement Actions
              </h3>
              <div className="space-y-2">
                {data.improvementActions?.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-violet/[0.04] border border-violet/[0.08]">
                    <span className="text-violet font-bold flex-shrink-0">{i + 1}.</span>
                    <p className="text-sm text-foreground">{a}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* 30-Day Calendar */}
            {data.calendarSuggestion && (
              <GlassCard hover={false} delay={0.14}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal" /> 30-Day Content Calendar
                  </h3>
                  <div className="flex items-center gap-2">
                    <SaveButton item={{ type: "report", content: data.calendarSuggestion as unknown as Record<string, unknown>, tags: ["calendar"], folder: "Strategies", title: "30-Day Content Calendar" }} />
                    <ExportButton
                      variant="pill"
                      label="Export Calendar"
                      filename="30-day-calendar"
                      title="30-Day Content Calendar"
                      sections={[
                        { heading: "Calendar Overview", body: caption },
                        ...(data.calendarSuggestion || []).map((w) => ({
                          heading: `Week ${w.week} — ${w.theme}`,
                          body: (w.posts || []).join("\n"),
                        })),
                      ]}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {data.calendarSuggestion?.map((week, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-violet">Week {week.week}</span>
                        <span className="text-xs text-muted-foreground">Theme: {week.theme}</span>
                      </div>
                      <div className="space-y-1">
                        {week.posts?.map((post, j) => (
                          <p key={j} className="text-xs text-muted-foreground">• {post}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Engagement Bait */}
            {data.engagementBait && (
              <GlassCard hover={false} delay={0.18}>
                <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-base">🔥</span> Engagement Strategies
                </h3>
                <div className="space-y-2">
                  {data.engagementBait.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-400 flex-shrink-0">→</span>
                      <span className="text-foreground">{item}</span>
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
