"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "@/components/auth/auth-modal";
import GlassCard from "@/components/shared/glass-card";
import SkeletonCard from "@/components/shared/skeleton-card";
import ErrorBanner from "@/components/shared/error-banner";
import RefinedBadge from "@/components/shared/refined-badge";
import { useStreaming } from "@/hooks/use-streaming";
import { useAppStore } from "@/lib/store";
import type { GapAnalysisResult } from "@/lib/agents/types";
import type { Competitor, CompetitorPost } from "@/lib/supabase";
import {
  GitCompare, Sparkles, Lock, ChevronDown, Zap,
  TrendingUp, AlertTriangle, CheckCircle2, ArrowRight,
  BarChart2, Target, Brain, Layers, Share2,
} from "lucide-react";
import { Platform } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

function ScoreBar({
  label,
  userScore,
  competitorScore,
}: {
  label: string;
  userScore: number;
  competitorScore: number;
}) {
  const gap = competitorScore - userScore;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-violet font-semibold">You: {userScore}/10</span>
          <span className="text-teal font-semibold">Competitor: {competitorScore}/10</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${userScore * 10}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full bg-violet/60"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute inset-y-0 rounded-full border-r-2 border-teal"
          style={{ width: `${competitorScore * 10}%` }}
        />
      </div>
      {gap > 0 && (
        <p className="text-[10px] text-amber-400">
          ↑ {gap} point gap — close this to increase reach significantly
        </p>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { user, loading: authLoading, session } = useAuth();
  const { userProfile, ui } = useAppStore();
  const [authOpen, setAuthOpen] = useState(false);
  const [niche, setNiche] = useState(userProfile.niche || "");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const [userContent, setUserContent] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [competitorPosts, setCompetitorPosts] = useState<CompetitorPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data, isStreaming, isRefined, error, startStreaming } = useStreaming<GapAnalysisResult>();

  // Load saved competitors
  useEffect(() => {
    if (!session) return;
    fetch("/api/competitors", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.competitors) setCompetitors(d.competitors); })
      .catch(() => {});
  }, [session]);

  // Fetch competitor posts when one is selected
  const handleSelectCompetitor = async (competitor: Competitor) => {
    setSelectedCompetitor(competitor);
    setDropdownOpen(false);
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/competitors/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: competitor.platform,
          name: competitor.name,
          profile_url: competitor.profile_url,
          // Use competitor's own about field — not the user's niche
          about: competitor.about || competitor.name,
        }),
      });
      const d = await res.json();
      if (d.posts) setCompetitorPosts(d.posts);
    } catch {}
    setLoadingPosts(false);
  };

  const handleAnalyze = async () => {
    if (!userContent.trim() || !niche.trim()) return;
    await startStreaming("/api/agents/gap", {
      userContent,
      competitorPosts,
      niche,
      platform,
    });
  };

  const handleApplyFix = () => {
    if (!data?.optimizedVersion) return;
    const optimized = data.optimizedVersion.replace(
      /^Optimized version based on competitor gap analysis — original work:\s*/i,
      ""
    );
    window.location.href = `/caption-studio?prefill=${encodeURIComponent(optimized)}`;
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 max-w-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-violet/10 border border-violet/20 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-violet" />
            </div>
            <h2 className="font-heading font-bold text-xl text-foreground">Sign in for Gap Analysis</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Compare your content against tracked competitors and get a surgical improvement plan.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl gradient-violet text-white font-medium text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Sign In Free
            </button>
          </motion.div>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet/20 to-teal/20 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-violet" />
          </div>
          Gap Analysis
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Compare your content against top competitors — get exact fixes</p>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: User Content */}
        <GlassCard hover={false}>
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet/20 flex items-center justify-center">
              <span className="text-xs font-bold text-violet">You</span>
            </div>
            Your Content
          </h3>
          <div className="space-y-3">
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Your niche (e.g. fitness for busy moms)"
              className="w-full glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <textarea
              value={userContent}
              onChange={e => setUserContent(e.target.value)}
              placeholder="Paste your caption, idea, post text, or URL here..."
              rows={5}
              className="w-full glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none leading-relaxed"
            />
            <div className="flex gap-2 flex-wrap">
              {platforms.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`pill-tab text-xs ${platform === p.value ? "active" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Right: Competitor */}
        <GlassCard hover={false}>
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-teal" />
            </div>
            Benchmark Competitor
          </h3>
          <div className="space-y-3">
            {competitors.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-muted-foreground">No competitors tracked yet</p>
                <a
                  href="/competitors"
                  className="inline-flex items-center gap-1.5 text-xs text-violet hover:text-violet/80 transition-colors"
                >
                  Add competitors first →
                </a>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 glass-input text-sm text-left"
                >
                  <span className={selectedCompetitor ? "text-foreground" : "text-muted-foreground/50"}>
                    {selectedCompetitor ? selectedCompetitor.name : "Select a competitor..."}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 right-0 mt-1 glass-card p-1 z-10 shadow-2xl"
                    >
                      {competitors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectCompetitor(c)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-foreground transition-colors"
                        >
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">{c.platform}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {loadingPosts && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-violet" />
                Fetching competitor posts...
              </p>
            )}

            {competitorPosts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {competitorPosts.length} posts loaded as benchmark
                </p>
                {competitorPosts.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-teal/5 border border-teal/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal mt-1.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-1">{p.title}</p>
                    <span className="text-xs text-teal font-semibold ml-auto flex-shrink-0">{p.engagement_score}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No competitor — allow manual analysis anyway */}
            {competitors.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No competitors? The AI will benchmark against top performers in your niche.
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Analyze Button */}
      <div className="flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={!userContent.trim() || !niche.trim() || isStreaming}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-violet text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity shadow-lg"
        >
          {isStreaming ? (
            <><Sparkles className="w-4 h-4 animate-spin" />Analyzing Gap...</>
          ) : (
            <><GitCompare className="w-4 h-4" />Run Gap Analysis</>
          )}
        </button>
      </div>

      {isStreaming && !data && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={3 + i} />)}</div>
      )}

      <ErrorBanner message={error} onDismiss={() => {}} onRetry={handleAnalyze} />

      {/* Results */}
      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-foreground">Gap Analysis Report</h2>
              <RefinedBadge visible={isRefined} />
            </div>

            {/* Card 1: Gap Summary */}
            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-violet" />
                <h3 className="font-semibold text-sm text-foreground">Gap Summary</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.gapSummary}</p>
            </GlassCard>

            {/* Cards 2 & 3: Hook + Structure side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard hover={false}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="font-semibold text-sm text-foreground">Hook Comparison</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-violet/5 border border-violet/10">
                    <p className="text-xs text-violet font-semibold mb-1">Your Hook</p>
                    <p className="text-xs text-muted-foreground">{data.hookComparison?.userHook}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-teal/5 border border-teal/10">
                    <p className="text-xs text-teal font-semibold mb-1">Competitor Hook</p>
                    <p className="text-xs text-muted-foreground">{data.hookComparison?.competitorHook}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
                    <p className="text-xs text-amber-400 font-semibold mb-1">The Gap</p>
                    <p className="text-xs text-muted-foreground">{data.hookComparison?.gap}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard hover={false}>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm text-foreground">Structure Comparison</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-violet/5 border border-violet/10">
                    <p className="text-xs text-violet font-semibold mb-1">Your Structure</p>
                    <p className="text-xs text-muted-foreground">{data.structureComparison?.userStructure}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-teal/5 border border-teal/10">
                    <p className="text-xs text-teal font-semibold mb-1">Competitor Structure</p>
                    <p className="text-xs text-muted-foreground">{data.structureComparison?.competitorStructure}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
                    <p className="text-xs text-amber-400 font-semibold mb-1">The Gap</p>
                    <p className="text-xs text-muted-foreground">{data.structureComparison?.gap}</p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Card 4: Emotional Trigger Gap */}
            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-pink-400" />
                <h3 className="font-semibold text-sm text-foreground">Emotional Trigger Gap</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-violet font-semibold mb-2 uppercase tracking-wider">Your Triggers</p>
                  <div className="space-y-1.5">
                    {data.emotionalTriggerGap?.userTriggers?.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet/50" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-teal font-semibold mb-2 uppercase tracking-wider">Competitor Triggers</p>
                  <div className="space-y-1.5">
                    {data.emotionalTriggerGap?.competitorTriggers?.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal/50" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-amber-400 font-semibold mb-2 uppercase tracking-wider">You're Missing</p>
                  <div className="space-y-1.5">
                    {data.emotionalTriggerGap?.missingTriggers?.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                  {data.emotionalTriggerGap?.impact && (
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{data.emotionalTriggerGap.impact}</p>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Card 5: Scorecard */}
            <GlassCard hover={false}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet" />
                  <h3 className="font-semibold text-sm text-foreground">Scorecard</h3>
                </div>
                {data.scorecard?.overall && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-violet">{data.scorecard.overall.user}</p>
                      <p className="text-[10px] text-muted-foreground">You</p>
                    </div>
                    <div className="text-muted-foreground text-sm">vs</div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-teal">{data.scorecard.overall.competitor}</p>
                      <p className="text-[10px] text-muted-foreground">Competitor</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {data.scorecard && Object.entries(data.scorecard).filter(([k]) => k !== "overall").map(([key, val]) => (
                  <ScoreBar
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                    userScore={(val as { user: number; competitor: number }).user}
                    competitorScore={(val as { user: number; competitor: number }).competitor}
                  />
                ))}
              </div>
            </GlassCard>

            {/* Card 6: Action Plan */}
            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-teal" />
                <h3 className="font-semibold text-sm text-foreground">Action Plan — 5 Exact Fixes</h3>
              </div>
              <div className="space-y-3">
                {data.actionPlan?.map((action, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-violet/20 transition-all"
                  >
                    <div className="w-7 h-7 rounded-lg gradient-violet flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">{i + 1}</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">{action.fix}</p>
                      <p className="text-xs text-amber-400">{action.why}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{action.how}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>

            {/* Card 7: Optimized Version */}
            <GlassCard hover={false}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-teal" />
                  <h3 className="font-semibold text-sm text-foreground">Optimized Version</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
                    Original Work
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyFix}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl gradient-violet text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Apply in Caption Studio
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Improve Again
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3 italic">
                Optimized based on competitor gap analysis — 100% original content
              </p>
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet/5 to-teal/5 border border-violet/10">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {data.optimizedVersion?.replace(
                    /^Optimized version based on competitor gap analysis — original work:\s*/i,
                    ""
                  )}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
