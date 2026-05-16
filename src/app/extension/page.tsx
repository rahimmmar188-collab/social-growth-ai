"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Download, Plug, CheckCircle2, Zap, Shield, ArrowRight, Globe2, Star } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Download the Extension",
    description: 'Click the button below. A ZIP file will download to your computer.',
  },
  {
    number: "02",
    title: "Extract the ZIP",
    description: 'Right-click the ZIP and choose "Extract All". Put the folder somewhere permanent (e.g. Desktop or Documents).',
  },
  {
    number: "03",
    title: "Open Chrome Extensions",
    description: 'In Chrome, type chrome://extensions in the address bar. Toggle on "Developer Mode" in the top-right corner.',
  },
  {
    number: "04",
    title: "Load the Extension",
    description: 'Click "Load unpacked" and select the extracted browser-extension folder. The icon appears in your toolbar.',
  },
  {
    number: "05",
    title: "Pin and Use",
    description: 'Click the puzzle-piece icon, find "Social Growth AI", and click pin. Now go to any social media post and click the extension.',
  },
];

const platforms = [
  { name: "YouTube",   emoji: "▶️", border: "border-red-500/25",    bg: "bg-red-500/10",    text: "text-red-300"   },
  { name: "Instagram", emoji: "📸", border: "border-pink-500/25",   bg: "bg-pink-500/10",   text: "text-pink-300" },
  { name: "TikTok",    emoji: "🎵", border: "border-cyan-500/25",   bg: "bg-cyan-500/10",   text: "text-cyan-300" },
  { name: "LinkedIn",  emoji: "💼", border: "border-blue-500/25",   bg: "bg-blue-500/10",   text: "text-blue-300" },
  { name: "Twitter/X", emoji: "🐦", border: "border-sky-500/25",    bg: "bg-sky-500/10",    text: "text-sky-300"  },
  { name: "Facebook",  emoji: "👥", border: "border-indigo-500/25", bg: "bg-indigo-500/10", text: "text-indigo-300"},
];

const features = [
  { icon: "⚡", title: "Instant Extraction",   desc: "Captions extracted in under a second using smart CSS selectors" },
  { icon: "🎯", title: "Zero Hallucinations",  desc: "AI only analyzes real content you extracted — never guesses" },
  { icon: "🟢", title: "High Accuracy Mode",   desc: "Extension content automatically marked as HIGH confidence" },
  { icon: "🔒", title: "Private & Secure",     desc: "Content stays in your session only — deleted after analysis" },
];

export default function ExtensionPage() {
  const [downloaded, setDownloaded] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#0d0d1c] to-[#0a0a12]">
      <div className="max-w-4xl mx-auto px-5 py-16 space-y-14">

        {/* ── Hero ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6">
            <Zap size={13} /> Smart Content Import Extension
          </div>

          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-violet-500/30">
            <Plug size={36} className="text-white" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Social Growth AI<br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Chrome Extension
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            One click on any social media post. Content sends to the AI instantly.
            No copy-pasting. No weak metadata. Just real analysis.
          </p>
        </motion.div>

        {/* ── Platform pills ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {platforms.map((p) => (
            <span key={p.name} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${p.border} ${p.bg} ${p.text} text-sm font-medium`}>
              {p.emoji} {p.name}
            </span>
          ))}
        </motion.div>

        {/* ── Download Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 md:p-10 text-center backdrop-blur"
        >
          <div className="flex items-center justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
            ))}
            <span className="text-white/40 text-xs ml-2">100% Free</span>
          </div>

          <a
            id="download-extension-btn"
            href="/extension-download/social-growth-ai-extension.zip"
            download="social-growth-ai-extension.zip"
            onClick={() => setDownloaded(true)}
            className={`group inline-flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-white text-lg transition-all duration-200 ${
              downloaded
                ? "bg-emerald-600 shadow-lg shadow-emerald-600/25"
                : "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-xl shadow-violet-600/30 hover:shadow-violet-600/50 hover:-translate-y-0.5 active:translate-y-0"
            }`}
          >
            {downloaded ? (
              <><CheckCircle2 size={22} /> Downloaded — Now follow the steps below</>
            ) : (
              <><Download size={22} className="group-hover:animate-bounce" /> Download Extension (.zip)</>
            )}
          </a>

          <p className="mt-5 text-white/30 text-xs flex items-center justify-center gap-1.5">
            <Shield size={11} /> Chrome Manifest V3 &bull; Developer Mode &bull; No account required
          </p>
        </motion.div>

        {/* ── Features grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-white mb-5">Why use the extension?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/20 transition-colors">
                <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Installation steps ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Globe2 size={20} className="text-violet-400" /> Installation Guide
          </h2>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.28 + i * 0.06 }}
                className="flex gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600/25 to-indigo-600/25 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-violet-400 font-bold text-xs">{step.number}</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm">{step.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── How it works flow ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/[0.07] to-indigo-500/[0.07] border border-violet-500/15"
        >
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Zap size={16} className="text-violet-400" /> Full workflow
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/55">
            {[
              "Go to a post",
              "Click extension",
              "Caption extracted",
              "Click Send",
              "App auto-loads content",
              "Click Analyze",
              "Real AI results",
            ].map((label, i, arr) => (
              <React.Fragment key={label}>
                <span className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/65 text-xs font-medium">
                  {label}
                </span>
                {i < arr.length - 1 && <ArrowRight size={12} className="text-white/25 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

      </div>
    </main>
  );
}
