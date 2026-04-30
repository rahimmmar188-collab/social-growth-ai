"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { CreateResult } from "@/lib/agents/types";
import GlassCard from "@/components/shared/glass-card";
import PillTabs from "@/components/shared/pill-tabs";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import ExportButton from "@/components/shared/export-button";
import RefinedBadge from "@/components/shared/refined-badge";
import { PenTool, Sparkles, Film, Zap, MessageSquare } from "lucide-react";
import { Platform } from "@/lib/store";

const platforms: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
];

type ActiveTab = "hooks" | "reels" | "captions";

export default function CreatePage() {
  const { userProfile, ui, incrementUsage } = useAppStore();
  const [niche, setNiche] = useState(userProfile.niche || "");
  const [platform, setPlatform] = useState<Platform>(ui.activePlatform);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hooks");
  const { data, isStreaming, isRefined, error, startStreaming } = useStreaming<CreateResult>();

  const handleCreate = async () => {
    if (!niche.trim()) return;
    incrementUsage();
    await startStreaming("/api/agents/create", { niche, platform, creatorType: userProfile.creatorType || "personal" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-600/20 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-teal" />
          </div>
          Create Content
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Generate hooks, reel concepts, and captions for your niche</p>
      </div>

      <GlassCard hover={false}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Your niche (e.g. 'productivity for solopreneurs')"
              className="flex-1 glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
            <button onClick={handleCreate} disabled={!niche.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
              {isStreaming ? <><Sparkles className="w-4 h-4 animate-spin" />Generating</> : <><PenTool className="w-4 h-4" />Create</>}
            </button>
          </div>
          <PillTabs options={platforms} value={platform} onChange={setPlatform} />
        </div>
      </GlassCard>

      {isStreaming && !data && <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={4 + i} />)}</div>}
      <ErrorBanner message={error} onDismiss={() => {}} onRetry={handleCreate} />

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
                {([
                  { v: "hooks" as ActiveTab, label: "Hooks", icon: Zap },
                  { v: "reels" as ActiveTab, label: "Reels", icon: Film },
                  { v: "captions" as ActiveTab, label: "Captions", icon: MessageSquare },
                ]).map((t) => (
                  <button key={t.v} onClick={() => setActiveTab(t.v)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.v ? "gradient-violet text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    <t.icon className="w-3.5 h-3.5" />{t.label}
                  </button>
                ))}
                </div>
                <RefinedBadge visible={isRefined} />
              </div>
              <ExportButton
                variant="pill"
                label="Export All"
                filename={`create-content-${niche.replace(/\s+/g, '-')}`}
                title={`Content Pack — ${niche}`}
                sections={[
                  { heading: "Niche", body: niche },
                  { heading: "Hooks", body: (data.hooks || []).map((h, i) => `${i + 1}. [${h.type}] ${h.text}`).join('\n') },
                  { heading: "Reel Concepts", body: (data.reelConcepts || []).map((r) => `${r.title}\n${(r.scenes || []).join('\n')}`).join('\n\n') },
                  { heading: "Captions", body: (data.captions || []).map((c) => `[${c.type}]\n${c.text}`).join('\n\n') },
                  { heading: "Platform Tips", body: (data.platformTips || []).join('\n') },
                ]}
              />
            </div>

            {activeTab === "hooks" && (
              <GlassCard hover={false}>
                <h3 className="font-heading font-semibold text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-violet" />10 Scroll-Stopping Hooks</h3>
                <div className="space-y-2">
                  {data.hooks?.map((hook, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${["bg-violet/10 text-violet","bg-teal/10 text-teal","bg-amber-400/10 text-amber-400","bg-pink-400/10 text-pink-400","bg-blue-400/10 text-blue-400"][i % 5]}`}>
                        {hook.type?.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-foreground flex-1">{hook.text}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <CopyButton text={hook.text} size="sm" />
                        <SaveButton item={{ type: "hook", content: { text: hook.text, type: hook.type }, tags: ["hook", niche], folder: "Hooks", title: hook.text.slice(0, 50) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {activeTab === "reels" && (
              <div className="space-y-3">
                {data.reelConcepts?.map((reel, i) => (
                  <GlassCard key={i} hover={false} delay={i * 0.04}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg gradient-violet flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{i + 1}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">{reel.title}</h4>
                      </div>
                      <SaveButton item={{ type: "report", content: reel, tags: ["reel-concept", niche], folder: "Reel Concepts", title: reel.title }} />
                    </div>
                    <div className="space-y-1.5 ml-9">
                      {reel.scenes?.map((scene, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="text-violet font-semibold flex-shrink-0">{j + 1}</span>
                          <span>{scene}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {activeTab === "captions" && (
              <div className="space-y-3">
                {data.captions?.map((cap, i) => (
                  <GlassCard key={i} hover={false} delay={i * 0.04}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${i === 0 ? "bg-teal/10 text-teal" : i === 1 ? "bg-violet/10 text-violet" : "bg-amber-400/10 text-amber-400"}`}>
                        {cap.type?.replace(/_/g, " ")}
                      </span>
                      <div className="flex gap-1">
                        <CopyButton text={cap.text} />
                        <SaveButton item={{ type: "caption", content: { text: cap.text, type: cap.type }, tags: ["caption", niche], folder: "Captions", title: cap.text.slice(0, 50) }} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{cap.text}</p>
                  </GlassCard>
                ))}
              </div>
            )}

            {data.platformTips && data.platformTips.length > 0 && (
              <GlassCard hover={false}>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Platform Tips</h4>
                <div className="space-y-1.5">
                  {data.platformTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-teal font-bold flex-shrink-0">→</span>
                      <span className="text-muted-foreground">{tip}</span>
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
