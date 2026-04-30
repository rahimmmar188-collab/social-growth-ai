"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Lightbulb, X } from "lucide-react";

const quickTips = [
  "Post Reels between 7–9 PM for maximum reach",
  "Use 3-5 hashtags for optimal Instagram engagement",
  "Start your hook with a number or bold claim",
  "Reply to every comment in the first hour",
  "Share behind-the-scenes content weekly",
];

export default function RightPanel() {
  const { ui, setRightPanel, usageCount } = useAppStore();
  const tip = quickTips[Math.floor(Date.now() / 86400000) % quickTips.length];

  if (!ui.rightPanelOpen) return null;

  return (
    <aside className="h-full flex flex-col border-l border-white/[0.06] bg-[#080c18]/80 backdrop-blur-xl overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="font-heading font-semibold text-sm text-foreground">Insights</h3>
          <button
            onClick={() => setRightPanel(false)}
            className="p-1 rounded-md hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Usage Meter */}
        <div className="glass-card-static p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet" />
            <span className="text-xs font-medium text-foreground">Usage Today</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{usageCount} / 20 calls</span>
              <span className="text-violet">{Math.round((usageCount / 20) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((usageCount / 20) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full gradient-violet"
              />
            </div>
          </div>
        </div>

        {/* Daily Tip */}
        <div className="glass-card-static p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-teal" />
            <span className="text-xs font-medium text-foreground">Daily Tip</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
        </div>

        {/* Trending Topics */}
        <div className="glass-card-static p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet" />
            <span className="text-xs font-medium text-foreground">Quick Trends</span>
          </div>
          <div className="space-y-2">
            {["Content hooks", "Story time format", "POV transitions", "Carousel posts", "Raw & authentic"].map(
              (trend, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <div className="w-1 h-1 rounded-full bg-violet/50 flex-shrink-0" />
                  {trend}
                </div>
              )
            )}
          </div>
        </div>

        {/* Niche Context */}
      </div>
    </aside>
  );
}
