"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { CaptionResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import PillTabs from "@/components/shared/pill-tabs";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import RefinedBadge from "@/components/shared/refined-badge";
import { Type, Sparkles, Hash, Clock } from "lucide-react";
import { Platform, Tone, CaptionLength } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];
const tones: { value: Tone; label: string }[] = [
  { value: "motivational", label: "Motivational" },
  { value: "funny", label: "Funny" },
  { value: "educational", label: "Educational" },
  { value: "personal", label: "Personal" },
  { value: "professional", label: "Professional" },
];
const lengths: { value: CaptionLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

const examples = [
  "A reel about how I went from 0 to 10k followers in 30 days using only Reels",
  "Sharing the morning routine that changed my productivity completely",
  "Three mistakes beginners make that are killing their growth",
];

export default function CaptionStudioPage() {
  const { userProfile, ui, incrementUsage } = useAppStore();
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const [tone, setTone] = useState<Tone>("motivational");
  const [length, setLength] = useState<CaptionLength>("medium");
  const [activeCaption, setActiveCaption] = useState<string>("");
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data, isStreaming, isRefined, error, startStreaming } = useStreaming<CaptionResult>();

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    incrementUsage();
    setActiveCaption("");
    await startStreaming("/api/agents/caption", {
      idea,
      platform,
      tone,
      lengthPref: length,
      niche: userProfile.niche || "general",
    });
  };

  const handleHookSwap = (hookText: string, captionIdx: number) => {
    if (!data?.captions) return;
    const cap = data.captions[captionIdx];
    if (!cap) return;
    // Replace first sentence/line with hook
    const lines = cap.text.split("\n");
    lines[0] = hookText;
    setActiveCaption(lines.join("\n"));
    setFlashIdx(captionIdx);
    setTimeout(() => setFlashIdx(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-violet flex items-center justify-center">
            <Type className="w-5 h-5 text-white" />
          </div>
          Caption Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe your reel or post idea — get 3 captions, 30 hashtags, 5 hooks, and a posting tip
        </p>
      </div>

      {/* Input Card */}
      <GlassCard hover={false}>
        <div className="space-y-4">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your reel or post idea… e.g. 'A reel about how I went from 0 to 10k followers in 30 days'"
            className="w-full glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none min-h-[90px]"
            disabled={isStreaming}
          />
          {/* Example chips */}
          {!idea && (
            <div className="flex flex-wrap gap-2">
              {examples.map((ex, i) => (
                <button key={i} onClick={() => setIdea(ex)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet/[0.08] border border-violet/[0.15] text-violet hover:bg-violet/[0.14] transition-colors text-left">
                  {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
                </button>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Platform</span>
              <PillTabs options={platforms} value={platform} onChange={setPlatform} size="sm" />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Tone</span>
              <PillTabs options={tones} value={tone} onChange={setTone} size="sm" />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Length</span>
              <PillTabs options={lengths} value={length} onChange={setLength} size="sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleGenerate} disabled={!idea.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              {isStreaming ? <><Sparkles className="w-4 h-4 animate-spin" /> Writing captions…</> : <><Sparkles className="w-4 h-4" /> Generate</>}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Loading */}
      {isStreaming && !data && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={4 + i} />)}
        </div>
      )}

      {/* Error */}
      <ErrorBanner message={error} onDismiss={() => {}} onRetry={handleGenerate} />

      {/* Results */}
      <AnimatePresence>
        {data && (
          <motion.div className="space-y-4">
            {/* Card 1 — Captions */}
            <GlassCard hover={false} delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-4 h-4 text-violet" />
                <h3 className="font-heading font-semibold text-sm text-foreground">3 Caption Variations</h3>
                {isStreaming && <div className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />}
                <RefinedBadge visible={isRefined} />
              </div>
              <div className="space-y-4">
                {data.captions?.map((cap, i) => {
                  const displayText = flashIdx === i && activeCaption ? activeCaption : cap.text;
                  return (
                    <motion.div key={i} ref={(el) => { captionRefs.current[i] = el; }}
                      className={`p-4 rounded-xl border transition-all ${flashIdx === i ? "highlight-flash border-amber-400/30" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${
                          cap.type === "punchy" ? "bg-teal/10 text-teal" :
                          cap.type === "medium" ? "bg-violet/10 text-violet" :
                          "bg-amber-400/10 text-amber-400"
                        }`}>{cap.type}</span>
                        <div className="flex gap-1">
                          <CopyButton text={displayText} />
                          <SaveButton item={{ type: "caption", content: { text: displayText, type: cap.type, platform, tone }, tags: ["caption", platform, tone], folder: "Caption Studio", title: displayText.slice(0, 60) }} />
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{displayText}</p>
                      <p className="text-xs text-muted-foreground/50 mt-3 italic">Add your personality to make this yours.</p>
                    </motion.div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Card 2 — Hashtags */}
            <GlassCard hover={false} delay={0.04}>
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-4 h-4 text-teal" />
                <h3 className="font-heading font-semibold text-sm text-foreground">30 Hashtags</h3>
              </div>
              {[
                { label: "Broad", tags: data.hashtags?.broad, color: "bg-blue-400/10 text-blue-400 border-blue-400/10" },
                { label: "Niche", tags: data.hashtags?.niche, color: "bg-violet/10 text-violet border-violet/10" },
                { label: "Viral", tags: data.hashtags?.viral, color: "bg-teal/10 text-teal border-teal/10" },
              ].map(({ label, tags, color }) => (
                <div key={label} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium">{label} ({tags?.length || 0})</span>
                    <button onClick={() => navigator.clipboard.writeText((tags || []).join(" "))}
                      className="text-xs text-violet hover:text-violet-light transition-colors">Copy all</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags?.map((tag, i) => (
                      <button key={i} onClick={() => navigator.clipboard.writeText(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${color}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </GlassCard>

            {/* Card 3 — Hook Alternatives */}
            <GlassCard hover={false} delay={0.08}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-heading font-semibold text-sm text-foreground">5 Hook Alternatives</h3>
                <span className="text-xs text-muted-foreground">Click to swap into your caption</span>
              </div>
              <div className="space-y-2">
                {data.hookAlternatives?.map((hook, i) => (
                  <button key={i} onClick={() => handleHookSwap(hook.text, 0)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-violet/20 transition-all text-left group">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                      ["bg-violet/10 text-violet", "bg-teal/10 text-teal", "bg-amber-400/10 text-amber-400", "bg-blue-400/10 text-blue-400", "bg-pink-400/10 text-pink-400"][i % 5]
                    }`}>{hook.type}</span>
                    <span className="text-sm text-foreground group-hover:text-white transition-colors">{hook.text}</span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Card 4 — Posting Tip */}
            {data.postingTip && (
              <GlassCard hover={false} delay={0.12}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-teal" />
                  <h3 className="font-heading font-semibold text-sm text-foreground">Posting Tip</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: "Best Time to Post", value: data.postingTip.bestTime },
                    { label: "Cover Text", value: data.postingTip.coverText },
                    { label: "Subtitles", value: data.postingTip.subtitles ? "✓ Recommended" : "✗ Not needed" },
                    { label: "First Comment", value: data.postingTip.firstComment },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm text-foreground">{value}</p>
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
