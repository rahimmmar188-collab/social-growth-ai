"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { TrendResult, DNAResult, CreateResult, StrategyResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import PillTabs from "@/components/shared/pill-tabs";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ExportButton from "@/components/shared/export-button";
import ErrorBanner from "@/components/shared/error-banner";
import RefinedBadge from "@/components/shared/refined-badge";
import { Dna, TrendingUp, Zap, BarChart3, PenTool, ChevronRight, Sparkles } from "lucide-react";
import { Platform } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

type AgentStage = "idle" | "trend" | "dna" | "create" | "strategy" | "done";

const stageLabels: Record<AgentStage, string> = {
  idle: "",
  trend: "Finding what's trending in your niche…",
  dna: "Decoding the viral DNA…",
  create: "Crafting content built to go viral…",
  strategy: "Building your growth strategy…",
  done: "Analysis complete",
};

const agentSteps = [
  { key: "trend", label: "Trend Intelligence", icon: TrendingUp },
  { key: "dna", label: "Viral DNA", icon: Dna },
  { key: "create", label: "Content Creation", icon: PenTool },
  { key: "strategy", label: "Growth Strategy", icon: BarChart3 },
];

export default function ViralDNAPage() {
  const { userProfile, ui, incrementUsage } = useAppStore();
  const [input, setInput] = useState("");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const [stage, setStage] = useState<AgentStage>("idle");

  const trend = useStreaming<TrendResult>();
  const dna = useStreaming<DNAResult>();
  const create = useStreaming<CreateResult>();
  const strategy = useStreaming<StrategyResult>();

  const handleRun = async () => {
    if (!input.trim()) return;
    incrementUsage();

    // Agent 1 — Trend
    setStage("trend");
    await trend.startStreaming("/api/agents/trend", {
      niche: input,
      platform,
      creatorType: userProfile.creatorType,
    });

    // Agent 2 — DNA
    setStage("dna");
    await dna.startStreaming("/api/agents/dna", {
      caption: input,
      niche: input,
      platform,
      trendContext: trend.data,
    });

    // Agent 3 — Create
    setStage("create");
    await create.startStreaming("/api/agents/create", {
      niche: input,
      platform,
      creatorType: userProfile.creatorType,
      trendData: trend.data,
      dnaAnalysis: dna.data,
    });

    // Agent 4 — Strategy
    setStage("strategy");
    await strategy.startStreaming("/api/agents/strategy", {
      niche: input,
      platform,
      allPreviousOutputs: { trend: trend.data, dna: dna.data, create: create.data },
    });

    setStage("done");
  };

  const isRunning = stage !== "idle" && stage !== "done";
  const currentStageIdx = agentSteps.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-violet flex items-center justify-center">
            <Dna className="w-5 h-5 text-white" />
          </div>
          Viral DNA Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your niche or a caption to run all 4 AI agents sequentially
        </p>
      </div>

      {/* Input */}
      <GlassCard hover={false}>
        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your niche (e.g. 'fitness for busy moms') or paste a caption to analyze…"
            className="w-full glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none min-h-[80px]"
            disabled={isRunning}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PillTabs options={platforms} value={platform} onChange={setPlatform} />
            <button
              onClick={handleRun}
              disabled={!input.trim() || isRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isRunning ? (
                <><Sparkles className="w-4 h-4 animate-spin" /> Running agents…</>
              ) : (
                <><Zap className="w-4 h-4" /> Run Analysis</>
              )}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Pipeline Progress */}
      <AnimatePresence>
        {stage !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card-static p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet animate-pulse" />
              <span className="text-sm text-foreground font-medium">{stageLabels[stage]}</span>
            </div>
            <div className="flex items-center gap-2">
              {agentSteps.map((step, i) => {
                const done = i < currentStageIdx || stage === "done";
                const active = step.key === stage;
                return (
                  <React.Fragment key={step.key}>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      done ? "bg-teal/10 text-teal" : active ? "bg-violet/10 text-violet" : "bg-white/[0.03] text-muted-foreground"
                    }`}>
                      <step.icon className="w-3 h-3" />
                      <span className="hidden sm:block">{step.label}</span>
                    </div>
                    {i < agentSteps.length - 1 && (
                      <ChevronRight className={`w-3 h-3 flex-shrink-0 ${done ? "text-teal" : "text-muted-foreground/30"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                animate={{ width: stage === "done" ? "100%" : `${((currentStageIdx + (isRunning ? 0.5 : 0)) / 4) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full gradient-violet"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error — show the first agent error encountered */}
      <ErrorBanner
        message={trend.error || dna.error || create.error || strategy.error}
        onRetry={handleRun}
      />

      {/* Results — Trend Card */}
      {(trend.isStreaming || trend.data) && (
        <div className="space-y-3">
          <CardHeader icon={TrendingUp} title="Trend Intelligence" isStreaming={trend.isStreaming} isRefined={trend.isRefined} color="text-violet" />
          {trend.isStreaming && !trend.data ? (
            <SkeletonCard lines={6} />
          ) : trend.data ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* Trending Phrases */}
              <GlassCard hover={false} delay={0}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trending Phrases</h4>
                <div className="space-y-2">
                  {trend.data.trendingPhrases?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">{p.phrase}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.volume === "high" ? "bg-teal/10 text-teal" :
                          p.volume === "medium" ? "bg-violet/10 text-violet" :
                          "bg-amber-400/10 text-amber-400"
                        }`}>{p.volume}</span>
                        <span className={`text-xs ${p.momentum === "rising" ? "text-teal" : p.momentum === "fading" ? "text-red-400" : "text-muted-foreground"}`}>
                          {p.momentum === "rising" ? "↑" : p.momentum === "fading" ? "↓" : "→"} {p.momentum}
                        </span>
                        <CopyButton text={p.phrase} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              {/* Hashtags */}
              <GlassCard hover={false} delay={0.04}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hashtags</h4>
                  <CopyButton text={[...(trend.data.hashtags?.broad || []), ...(trend.data.hashtags?.niche || []), ...(trend.data.hashtags?.viral || [])].join(" ")} />
                </div>
                {[
                  { label: "Broad", tags: trend.data.hashtags?.broad, color: "bg-blue-400/10 text-blue-400" },
                  { label: "Niche", tags: trend.data.hashtags?.niche, color: "bg-violet/10 text-violet" },
                  { label: "Viral", tags: trend.data.hashtags?.viral, color: "bg-teal/10 text-teal" },
                ].map(({ label, tags, color }) => (
                  <div key={label} className="mb-3">
                    <span className="text-xs text-muted-foreground mb-2 block">{label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tags?.map((tag, i) => (
                        <button key={i} onClick={() => navigator.clipboard.writeText(tag)}
                          className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${color}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </GlassCard>
              {/* Content Angles */}
              <GlassCard hover={false} delay={0.08}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Content Angles</h4>
                <div className="space-y-2">
                  {trend.data.contentAngles?.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <p className="text-sm font-medium text-foreground">{a.angle}</p>
                      <p className="text-xs text-muted-foreground">{a.rationale}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          ) : null}
        </div>
      )}

      {/* DNA Card */}
      {(dna.isStreaming || dna.data) && (
        <div className="space-y-3">
          <CardHeader icon={Dna} title="Viral DNA Analysis" isStreaming={dna.isStreaming} isRefined={dna.isRefined} color="text-violet" />
          {dna.isStreaming && !dna.data ? <SkeletonCard lines={5} /> : dna.data ? (
            <GlassCard hover={false}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1 rounded-full bg-violet/10 text-violet border border-violet/20">
                    Hook: {dna.data.hookType}
                  </span>
                </div>
                {[
                  { label: "Hook", value: dna.data.structure?.hook },
                  { label: "Tension Build", value: dna.data.structure?.tensionBuild },
                  { label: "Payoff", value: dna.data.structure?.payoff },
                  { label: "CTA", value: dna.data.structure?.cta },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                ))}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Psychological Triggers</span>
                  <div className="flex flex-wrap gap-1.5">
                    {dna.data.psychologicalTriggers?.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Why It Works</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{dna.data.whyItWorks}</p>
                </div>
                <div className="p-3 rounded-xl bg-teal/[0.06] border border-teal/10 space-y-1">
                  <span className="text-xs font-semibold text-teal uppercase tracking-wider">Recreated for Your Niche</span>
                  <p className="text-sm text-foreground leading-relaxed">{dna.data.recreatedIdea}</p>
                  <div className="flex gap-2 pt-1">
                    <CopyButton text={dna.data.recreatedIdea || ""} />
                    <SaveButton item={{ type: "caption", content: { text: dna.data.recreatedIdea }, tags: ["viral-dna"], folder: "Viral DNA", title: "Recreated Viral Idea" }} />
                  </div>
                </div>
              </div>
            </GlassCard>
          ) : null}
        </div>
      )}

      {/* Create Card */}
      {(create.isStreaming || create.data) && (
        <div className="space-y-3">
          <CardHeader icon={PenTool} title="Content Creation" isStreaming={create.isStreaming} isRefined={create.isRefined} color="text-teal" />
          {create.isStreaming && !create.data ? <SkeletonCard lines={6} /> : create.data ? (
            <div className="space-y-3">
              <GlassCard hover={false}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scroll-Stopping Hooks</h4>
                <div className="space-y-2">
                  {create.data.hooks?.map((hook, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="flex-1">
                        <span className="text-xs text-violet mr-2">{hook.type?.replace("_", " ")}</span>
                        <span className="text-sm text-foreground">{hook.text}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <CopyButton text={hook.text} size="sm" />
                        <SaveButton item={{ type: "hook", content: { text: hook.text, type: hook.type }, tags: ["hook"], folder: "Hooks", title: hook.text.slice(0, 50) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard hover={false}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reel Concepts</h4>
                <div className="space-y-3">
                  {create.data.reelConcepts?.map((reel, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-sm font-medium text-foreground mb-2">{reel.title}</p>
                      <div className="space-y-1">
                        {reel.scenes?.map((scene, j) => (
                          <p key={j} className="text-xs text-muted-foreground">{scene}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard hover={false}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Captions</h4>
                <div className="space-y-3">
                  {create.data.captions?.map((cap, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                      <span className="text-xs text-violet capitalize">{cap.type?.replace("_", " ")}</span>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{cap.text}</p>
                      <div className="flex gap-2">
                        <CopyButton text={cap.text} size="sm" />
                        <SaveButton item={{ type: "caption", content: { text: cap.text, type: cap.type }, tags: ["caption"], folder: "Captions", title: cap.text.slice(0, 50) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          ) : null}
        </div>
      )}

      {/* Strategy Card */}
      {(strategy.isStreaming || strategy.data) && (
        <div className="space-y-3">
          <CardHeader icon={BarChart3} title="Growth Strategy" isStreaming={strategy.isStreaming} isRefined={strategy.isRefined} color="text-amber-400" />
          {strategy.isStreaming && !strategy.data ? <SkeletonCard lines={5} /> : strategy.data ? (
            <GlassCard hover={false}>
              <div className="space-y-5">
                {/* Viral Score */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <motion.circle cx="40" cy="40" r="32" fill="none" stroke="#7c6ff7" strokeWidth="8"
                        strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 32}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - (strategy.data.viralScore || 0) / 10) }}
                        transition={{ duration: 1.5, ease: "easeOut" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-heading font-bold text-2xl text-foreground">{strategy.data.viralScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Viral Score</p>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(strategy.data.scoreBreakdown || {}).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground capitalize w-16">{k}</span>
                          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full bg-violet" style={{ width: `${(v as number) * 10}%` }} />
                          </div>
                          <span className="text-muted-foreground w-4">{v as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Posting Windows */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Best Posting Windows</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {strategy.data.bestPostingWindows?.map((w, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                        <p className="text-xs font-medium text-foreground">{w.day}</p>
                        <p className="text-xs text-teal">{w.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Improvements */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">3 Improvement Actions</h4>
                  <div className="space-y-2">
                    {strategy.data.improvementActions?.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-violet font-bold flex-shrink-0">{i + 1}.</span>
                        <span className="text-foreground">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <SaveButton item={{ type: "report", content: { strategy: strategy.data }, tags: ["strategy", "viral-dna"], folder: "Strategies", title: `Growth Strategy — ${input}` }} />
                  <ExportButton
                    variant="pill"
                    label="Export PDF"
                    filename={`viral-dna-${input.slice(0, 20).replace(/\s+/g, "-")}`}
                    title={`Viral DNA Report — ${input}`}
                    sections={[
                      { heading: "Input / Niche", body: input },
                      { heading: "Trending Phrases", body: (trend.data?.trendingPhrases || []).map((p) => `${p.phrase} (${p.volume}, ${p.momentum})`).join("\n") },
                      { heading: "Hook Type", body: dna.data?.hookType || "" },
                      { heading: "Why It Works", body: dna.data?.whyItWorks || "" },
                      { heading: "Recreated Idea", body: dna.data?.recreatedIdea || "" },
                      { heading: "Viral Score", body: `${strategy.data?.viralScore ?? ""}/10` },
                      { heading: "Improvement Actions", body: (strategy.data?.improvementActions || []).map((a, i) => `${i + 1}. ${a}`).join("\n") },
                    ]}
                  />
                </div>
              </div>
            </GlassCard>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CardHeader({ icon: Icon, title, isStreaming, isRefined, color }: { icon: React.ElementType; title: string; isStreaming: boolean; isRefined: boolean; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="font-heading font-semibold text-sm text-foreground">{title}</h3>
      {isStreaming && <div className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />}
      <RefinedBadge visible={isRefined} />
    </div>
  );
}
