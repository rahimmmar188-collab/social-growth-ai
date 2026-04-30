"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, Platform, CreatorType } from "@/lib/store";
import { Sparkles, ArrowRight, Check } from "lucide-react";

const nicheSuggestions = ["fitness", "finance", "travel", "food", "tech", "beauty", "fashion", "real estate", "health", "education"];

const platformOptions: { value: Platform; label: string; desc: string }[] = [
  { value: "instagram", label: "Instagram", desc: "Reels, Stories & Posts" },
  { value: "linkedin", label: "LinkedIn", desc: "Professional content" },
  { value: "facebook", label: "Facebook", desc: "Groups & Pages" },
];

const creatorTypes: { value: CreatorType; label: string; desc: string }[] = [
  { value: "personal", label: "Personal Brand", desc: "Growing your personal presence" },
  { value: "business", label: "Business", desc: "Marketing for your company" },
  { value: "agency", label: "Agency", desc: "Managing multiple clients" },
  { value: "beginner", label: "Beginner", desc: "Just getting started" },
];

export default function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [creatorType, setCreatorType] = useState<CreatorType>("personal");
  const { setUserProfile, completeOnboarding, setActivePlatform } = useAppStore();

  const handleComplete = () => {
    setUserProfile({ niche, platform, creatorType });
    setActivePlatform(platform);
    completeOnboarding();
  };

  const canProceed = step === 1 ? niche.length > 0 : true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-lg mx-4 glass-card-static overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl gradient-violet flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">Welcome to Social Growth AI</h2>
              <p className="text-xs text-muted-foreground">Let&apos;s personalize your experience</p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    s < step
                      ? "gradient-violet text-white"
                      : s === step
                      ? "border-2 border-violet text-violet"
                      : "border border-white/[0.1] text-muted-foreground"
                  }`}
                >
                  {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-16 h-0.5 rounded-full ${
                      s < step ? "bg-violet" : "bg-white/[0.06]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">
                    What&apos;s your niche?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This helps us tailor every AI output to your audience
                  </p>
                </div>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. fitness, personal finance, travel vlogging"
                  className="w-full glass-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {nicheSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setNiche(suggestion)}
                      className={`pill-tab text-xs ${niche === suggestion ? "active" : ""}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">
                    Primary platform
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll optimize content formats and CTAs for your platform
                  </p>
                </div>
                <div className="space-y-2">
                  {platformOptions.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                        platform === p.value
                          ? "border-violet/40 bg-violet/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          platform === p.value
                            ? "border-violet"
                            : "border-white/20"
                        }`}
                      >
                        {platform === p.value && (
                          <div className="w-2 h-2 rounded-full bg-violet" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">
                    Creator type
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This shapes the tone and depth of AI suggestions
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {creatorTypes.map((ct) => (
                    <button
                      key={ct.value}
                      onClick={() => setCreatorType(ct.value)}
                      className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left ${
                        creatorType === ct.value
                          ? "border-violet/40 bg-violet/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{ct.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{ct.desc}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/[0.06] flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => {
              if (step < 3) setStep(step + 1);
              else handleComplete();
            }}
            disabled={!canProceed}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {step === 3 ? "Get Started" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
