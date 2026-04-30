"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import Link from "next/link";
import { Dna, Type, Search, TrendingUp, Zap, Bookmark, ArrowRight, Sparkles, BarChart3, PenTool, Users, GitCompare } from "lucide-react";
import GlassCard from "@/components/shared/glass-card";

const quickActions = [
  { href: "/viral-dna", icon: Dna, label: "Viral DNA Engine", desc: "Analyze any niche or caption through 4 AI agents", iconColor: "text-violet" },
  { href: "/caption-studio", icon: Type, label: "Caption Studio", desc: "Generate captions, hashtags & hooks instantly", iconColor: "text-teal" },
  { href: "/spy-recreate", icon: Search, label: "Spy & Recreate", desc: "Reverse-engineer any viral post or reel", iconColor: "text-amber-400" },
];

const tips = [
  "Posts with questions in hooks get 2x more comments",
  "The first 3 seconds of a reel determine 80% of its reach",
  "Carousel posts have the highest save rate on Instagram",
  "LinkedIn posts with personal stories outperform tips-only posts 3:1",
];

const si = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function DashboardPage() {
  const { userProfile, usageCount, savedItems, recentSessions } = useAppStore();
  const tip = tips[Math.floor(Date.now() / 86400000) % tips.length];

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.04 }} className="space-y-6">
      <motion.div {...si}>
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">
          {userProfile.niche ? (<>Welcome back, <span className="gradient-text-violet">{userProfile.niche}</span> creator</>) : (<>Welcome to <span className="gradient-text-violet">Social Growth AI</span></>)}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Your intelligent content operating system is ready.</p>
      </motion.div>

      {/* Stats */}
      <motion.div {...si} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: "AI Calls", value: usageCount, sub: "/ 20", color: "text-violet" },
          { icon: Bookmark, label: "Saved", value: savedItems.length, sub: "items", color: "text-teal" },
          { icon: BarChart3, label: "Sessions", value: recentSessions.length, sub: "runs", color: "text-amber-400" },
          { icon: TrendingUp, label: "Platform", value: userProfile.platform || "—", sub: "", color: "text-pink-400" },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-4 space-y-2">
            <div className="flex items-center gap-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
            <div className="flex items-baseline gap-1"><span className="text-xl font-heading font-bold">{s.value}</span><span className="text-xs text-muted-foreground">{s.sub}</span></div>
          </div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div {...si} className="space-y-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">Quick Start</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {quickActions.map((a, i) => (
            <Link key={a.href} href={a.href}>
              <GlassCard delay={i * 0.04} className="h-full cursor-pointer group">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center">
                    <a.icon className={`w-5 h-5 ${a.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-sm group-hover:text-violet transition-colors">{a.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-violet opacity-0 group-hover:opacity-100 transition-opacity">Get started <ArrowRight className="w-3 h-3" /></div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* AI Tip */}
      <motion.div {...si}>
        <GlassCard hover={false} className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl gradient-violet flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5 text-white" /></div>
            <div><h3 className="font-heading font-semibold text-sm">AI Tip of the Day</h3><p className="text-sm text-muted-foreground mt-1">{tip}</p></div>
          </div>
        </GlassCard>
      </motion.div>

      {/* All Tools */}
      <motion.div {...si} className="space-y-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">All Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/discover", icon: TrendingUp, label: "Discover" },
            { href: "/create", icon: PenTool, label: "Create" },
            { href: "/analyzer", icon: BarChart3, label: "Analyzer" },
            { href: "/saved", icon: Bookmark, label: "Saved" },
          ].map((t) => (
            <Link key={t.href} href={t.href}>
              <div className="glass-card-static p-3 flex items-center gap-3 hover:bg-white/[0.06] transition-all cursor-pointer group">
                <t.icon className="w-4 h-4 text-muted-foreground group-hover:text-violet transition-colors" />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{t.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Intelligence Section */}
      <motion.div {...si} className="space-y-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet inline-block" />
          Intelligence Suite
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Link href="/competitors">
            <GlassCard delay={0.05} className="h-full cursor-pointer group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm group-hover:text-violet transition-colors flex items-center gap-2">
                    Competitor Tracker
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet/20 text-violet">NEW</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Track competitors and analyze their viral posts</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-violet opacity-0 group-hover:opacity-100 transition-opacity">Track now <ArrowRight className="w-3 h-3" /></div>
              </div>
            </GlassCard>
          </Link>
          <Link href="/compare">
            <GlassCard delay={0.08} className="h-full cursor-pointer group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
                  <GitCompare className="w-5 h-5 text-teal" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm group-hover:text-violet transition-colors flex items-center gap-2">
                    Gap Analysis
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal/20 text-teal">NEW</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Benchmark your content against top competitors</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-violet opacity-0 group-hover:opacity-100 transition-opacity">Analyze gap <ArrowRight className="w-3 h-3" /></div>
              </div>
            </GlassCard>
          </Link>
        </div>
      </motion.div>

      {/* Empty State */}
      {recentSessions.length === 0 && (
        <motion.div {...si}>
          <GlassCard hover={false} className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-violet/10 flex items-center justify-center mx-auto"><Sparkles className="w-6 h-6 text-violet" /></div>
            <h3 className="font-heading font-semibold text-sm mt-3">Ready to create your first content?</h3>
            <p className="text-xs text-muted-foreground mt-1">Try the Viral DNA Engine or Caption Studio to get started</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Link href="/viral-dna" className="px-4 py-2 rounded-lg gradient-violet text-white text-xs font-medium">Try Viral DNA</Link>
              <Link href="/caption-studio" className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-medium">Caption Studio</Link>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}
