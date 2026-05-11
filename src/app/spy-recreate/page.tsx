"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useStreaming } from "@/hooks/use-streaming";
import { MultimodalURLResult } from "@/lib/agents/types";
import {
  scoreConfidence,
  isRestrictedPlatform,
  type ContentConfidence,
} from "@/lib/content-pipeline";
import GlassCard from "@/components/shared/glass-card";
import SkeletonCard from "@/components/shared/skeleton-card";
import CopyButton from "@/components/shared/copy-button";
import SaveButton from "@/components/shared/save-button";
import ErrorBanner from "@/components/shared/error-banner";
import ExportButton from "@/components/shared/export-button";
import RefinedBadge from "@/components/shared/refined-badge";
import ConfidenceBadge from "@/components/shared/confidence-badge";
import ContentPreviewCard from "@/components/shared/content-preview-card";
import {
  Search,
  Link2,
  Sparkles,
  ExternalLink,
  Plug,
  CheckCircle2,
  ClipboardPaste,
  ChevronRight,
  AlertTriangle,
  Download,
} from "lucide-react";

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "Facebook";
  return "Unknown";
}

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/10 text-red-400 border-red-500/20",
  Instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  TikTok: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  LinkedIn: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Facebook: "bg-blue-600/10 text-blue-400 border-blue-600/20",
  Unknown: "bg-white/[0.06] text-muted-foreground border-white/[0.06]",
};

export default function SpyRecreatePage() {
  const { userProfile, incrementUsage } = useAppStore();

  // ── Input state ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [niche, setNiche] = useState(userProfile.niche || "");
  const [userNote, setUserNote] = useState("");

  // ── Content pipeline state ───────────────────────────────────────────────────
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [confidence, setConfidence] = useState<ContentConfidence | null>(null);

  // Extension import
  const [extensionContent, setExtensionContent] = useState<string | null>(null);
  const [extensionPlatform, setExtensionPlatform] = useState<string | null>(null);
  const [extensionSessionId, setExtensionSessionId] = useState<string | null>(null);
  const [importingExt, setImportingExt] = useState(false);
  const didAutoImport = useRef(false);

  // User fallback paste
  const [pastedContent, setPastedContent] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackSubmitted, setFallbackSubmitted] = useState(false);

  // Preview card
  const [showPreview, setShowPreview] = useState(false);

  const detectedPlatform = url ? detectPlatform(url) : "";
  const { data, isStreaming, isRefined, error, startStreaming, reset } = useStreaming<MultimodalURLResult>();

  // ── Multimodal pipeline state ─────────────────────────────────────────────
  type PipelineStage = "idle"|"downloading"|"transcribing"|"extracting_text"|"analyzing_vision"|"reasoning"|"done"|"error";
  const PIPELINE_STAGES: { key: PipelineStage; icon: string; label: string }[] = [
    { key: "downloading",      icon: "📥", label: "Downloading video" },
    { key: "transcribing",     icon: "🎤", label: "Extracting speech (Whisper)" },
    { key: "extracting_text",  icon: "🔤", label: "Reading on-screen text (OCR)" },
    { key: "analyzing_vision", icon: "🎬", label: "Analyzing scenes & keyframes" },
    { key: "reasoning",        icon: "🧠", label: "Generating viral intelligence" },
  ];
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [pipelineError, setPipelineError] = useState("");
  const [instagramAuthRequired, setInstagramAuthRequired] = useState(false);
  const [tiktokBlocked, setTiktokBlocked] = useState(false);
  const [mediaSignals, setMediaSignals] = useState<{
    transcript?: string; hookPhrase?: string; ocrTexts?: {frame_index:number;text:string}[];
    durationSeconds?: number; sceneCount?: number; audioEnergy?: string;
    visualAnalysis?: Record<string,unknown>; fallback?: boolean;
  } | null>(null);

  // Extension video + engagement
  const [extensionVideoUrl, setExtensionVideoUrl] = useState("");
  const [extensionEngagement, setExtensionEngagement] = useState<{likes:string;views:string}|null>(null);
  const [extensionCreator, setExtensionCreator] = useState<{username:string;profileUrl:string}|null>(null);

  // ── Auto-import extension content on page load ──────────────────────────────
  useEffect(() => {
    if (didAutoImport.current) return;
    didAutoImport.current = true;
    fetch("/api/extract?session=latest")
      .then((r) => r.json())
      .then((ext) => {
        if (ext.content && ext.content.length > 10) {
          setExtensionContent(ext.content);
          setExtensionPlatform(ext.platform || null);
          setExtensionSessionId(ext.sessionId || null);
          setConfidence("HIGH");
          setShowFallback(false);
          if (ext.videoUrl) setExtensionVideoUrl(ext.videoUrl);
          if (ext.engagement) setExtensionEngagement(ext.engagement);
          if (ext.creator) setExtensionCreator(ext.creator);
        }
      })
      .catch(() => {});
  }, []);

  // ── Part 9: Session cleanup after analysis completes ──────────────────────────
  useEffect(() => {
    if (data && !isStreaming && extensionSessionId) {
      fetch(`/api/extract?session=${extensionSessionId}`, { method: "DELETE" })
        .catch(() => {});
      setExtensionSessionId(null);
    }
  }, [data, isStreaming, extensionSessionId]);

  // ── Fetch metadata from URL ──────────────────────────────────────────────────
  const handleFetchMeta = useCallback(async () => {
    if (!url.trim()) return;
    setFetchingMeta(true);
    setMetaError("");
    setExtensionContent(null);
    setPastedContent("");
    setFallbackSubmitted(false);
    setShowFallback(false);
    setShowPreview(false);

    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to fetch metadata");
      const meta = await res.json();
      setMetadata(meta);

      const conf = (meta.confidence || "LOW") as ContentConfidence;
      setConfidence(conf);

      // Only show paste-content fallback for truly unknown/non-downloadable URLs.
      // Restricted social platforms (Instagram/TikTok/YouTube etc.) are handled
      // directly by yt-dlp in the media service — no paste needed.
      const isDownloadable = isRestrictedPlatform(url) || url.includes("youtube.com") || url.includes("youtu.be");
      if (conf === "LOW" && !isDownloadable) setShowFallback(true);
    } catch {
      // Only show paste fallback for non-social URLs
      const isDownloadable = isRestrictedPlatform(url) || url.includes("youtube.com") || url.includes("youtu.be");
      if (!isDownloadable) {
        setMetaError("Could not fetch URL metadata. Paste the content manually below.");
        setShowFallback(true);
      }
      setConfidence("LOW");
    } finally {
      setFetchingMeta(false);
    }
  }, [url]);

  // ── Import from browser extension (manual button) ────────────────────────────
  const handleImportFromExtension = useCallback(async () => {
    setImportingExt(true);
    try {
      const res = await fetch("/api/extract?session=latest");
      const ext = await res.json();
      if (ext.content) {
        setExtensionContent(ext.content);
        setExtensionPlatform(ext.platform || null);
        setExtensionSessionId(ext.sessionId || null);
        setConfidence("HIGH");
        setShowFallback(false);
        setFallbackSubmitted(false);
        if (ext.videoUrl)   setExtensionVideoUrl(ext.videoUrl);
        if (ext.engagement) setExtensionEngagement(ext.engagement);
        if (ext.creator)    setExtensionCreator(ext.creator);
      } else {
        alert("No content found from extension. Open the Social Growth AI extension on a social media post first.");
      }
    } catch {
      alert("Could not connect to extension import. Try again.");
    } finally {
      setImportingExt(false);
    }
  }, []);

  const handleClearExtension = () => {
    setExtensionContent(null);
    setExtensionPlatform(null);
    setExtensionVideoUrl("");
    setExtensionEngagement(null);
    setExtensionCreator(null);
    // Recompute confidence from metadata
    if (metadata) {
      const conf = isRestrictedPlatform(url) ? "LOW" : scoreConfidence(metadata);
      setConfidence(conf);
      if (conf === "LOW") setShowFallback(true);
    }
  };

  // ── User submits pasted fallback ─────────────────────────────────────────────
  const handleFallbackSubmit = () => {
    if (!pastedContent.trim()) return;
    setFallbackSubmitted(true);
    setShowFallback(false);
    setConfidence("HIGH");
  };

  // ── Main analyze handler — full multimodal pipeline ─────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!niche.trim()) return;
    if (!url.trim() && !extensionContent) return;

    incrementUsage();
    setShowPreview(true);
    reset();
    setPipelineError("");
    setMediaSignals(null);
    setInstagramAuthRequired(false);
    setTiktokBlocked(false);

    const platform = detectedPlatform || extensionPlatform || "Unknown";
    const caption   = extensionContent || pastedContent || (metadata as Record<string,string>|null)?.description || "";
    const videoUrl  = extensionVideoUrl || url || "";

    let signals: typeof mediaSignals = null;

    // ── Step 1: Process video via media service ───────────────────────────────
    if (videoUrl) {
      try {
        setPipelineStage("downloading");
        const pRes = await fetch("/api/media/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrl, maxFrames: 12 }),
        });
        const pData = await pRes.json();

        // Instagram requires login — show guidance, STOP pipeline
        if (pData.error === "instagram_auth_required") {
          setInstagramAuthRequired(true);
          setPipelineStage("done");
          return; // ← CRITICAL: do NOT run streaming with empty data
        }

        // TikTok IP block — show guidance, STOP pipeline
        if (pData.error === "tiktok_ip_blocked") {
          setTiktokBlocked(true);
          setPipelineStage("done");
          return; // ← CRITICAL: do NOT run streaming with empty data
        }

        if (!pData.fallback) {
          setPipelineStage("transcribing");
          await new Promise(r => setTimeout(r, 300));

          setPipelineStage("extracting_text");
          await new Promise(r => setTimeout(r, 300));

          setPipelineStage("analyzing_vision");

          // Gemini-native responses already include visual_analysis embedded.
          // Only call /api/media/vision for Railway responses (raw frames).
          let visualAnalysis: Record<string,unknown> | null =
            pData.visual_analysis || null;

          if (!visualAnalysis && pData.frames?.length > 0) {
            try {
              const vRes = await fetch("/api/media/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  frames:     pData.frames,
                  transcript: pData.transcript,
                  ocrTexts:   pData.ocr_texts,
                }),
              });
              visualAnalysis = await vRes.json();
            } catch { /* vision is non-fatal */ }
          }

          signals = {
            transcript:      pData.transcript,
            hookPhrase:      pData.hook_phrase,
            ocrTexts:        pData.ocr_texts,
            durationSeconds: pData.duration_seconds,
            sceneCount:      pData.scene_count,
            audioEnergy:     pData.audio_energy,
            visualAnalysis:  visualAnalysis ?? undefined,
            fallback:        false,
          };
        } else {
          signals = { fallback: true };
        }
      } catch {
        signals = { fallback: true };
      }
    } else {
      signals = { fallback: true };
    }

    setMediaSignals(signals);

    // ── Step 3: Final reasoning (streaming) ──────────────────────────────────
    // Only run if we actually have signals (not a blocked/auth-required case)
    if (!signals) {
      setPipelineStage("done");
      return;
    }

    // ── Step 3: Final reasoning (streaming) ──────────────────────────────────
    setPipelineStage("reasoning");
    await startStreaming("/api/agents/multimodal-url", {
      niche,
      platform,
      caption,
      engagement:      extensionEngagement,
      creator:         extensionCreator,
      visualAnalysis:  signals?.visualAnalysis || null,
      transcript:      signals?.transcript || "",
      hookPhrase:      signals?.hookPhrase || "",
      ocrTexts:        signals?.ocrTexts || [],
      durationSeconds: signals?.durationSeconds || 0,
      sceneCount:      signals?.sceneCount || 0,
      audioEnergy:     signals?.audioEnergy || "unknown",
      confidence:      signals?.fallback ? "LOW" : "HIGH",
      userNote,
    });

    setPipelineStage("done");
  }, [
    url, niche, userNote, metadata, extensionContent, extensionPlatform,
    extensionVideoUrl, extensionEngagement, extensionCreator,
    pastedContent, fallbackSubmitted, confidence, detectedPlatform,
    incrementUsage, startStreaming, reset,
  ]);

  // ── Effective confidence for display ─────────────────────────────────────────
  const effectiveConfidence: ContentConfidence = extensionContent
    ? "HIGH"
    : fallbackSubmitted
    ? "HIGH"
    : confidence || "LOW";

  const contentSource = extensionContent
    ? "extension"
    : fallbackSubmitted
    ? "pasted"
    : "extracted";

  // ── Preview body text ────────────────────────────────────────────────────────
  const previewBody = extensionContent
    || pastedContent
    || (metadata as Record<string, string> | null)?.description
    || "";

  const exampleUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const canAnalyze = (url.trim() || extensionContent) && niche.trim() && !isStreaming;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-violet flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          Spy &amp; Recreate
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real multimodal video intelligence — FFmpeg · Whisper · OCR · Vision AI
        </p>
      </div>

      {/* Input Card */}
      <GlassCard hover={false}>
        <div className="space-y-4">

          {/* ── Extension Import Banner ── */}
          <AnimatePresence>
            {extensionContent && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-emerald-400 font-medium">
                    Imported real content from browser
                  </span>
                  <ConfidenceBadge confidence="HIGH" />
                </div>
                <button
                  onClick={handleClearExtension}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── URL Input Row ── */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Content URL</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setMetadata(null);
                    setConfidence(null);
                    setShowFallback(false);
                    setShowPreview(false);
                  }}
                  placeholder="https://youtube.com/watch?v=… or instagram.com/p/…"
                  className="w-full glass-input pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                  disabled={isStreaming}
                />
              </div>
              {url && (
                <div className={`flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium ${platformColors[detectedPlatform] || platformColors.Unknown}`}>
                  {detectedPlatform}
                </div>
              )}
            </div>

            {/* Platform message for supported platforms (YouTube only — others require extension) */}
            {url && url.includes("youtube.com") && !url.includes("youtu.be") === false && !extensionContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 text-xs text-emerald-400/80"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  YouTube video will be analyzed directly using Gemini AI — full transcript, scenes &amp; audio.
                  For even richer analysis,{" "}
                  <button
                    onClick={() => setShowFallback(true)}
                    className="underline hover:text-emerald-300 transition-colors"
                  >
                    paste the description too
                  </button>
                </span>
              </motion.div>
            )}

            {url && (url.includes("instagram.com") || url.includes("tiktok.com")) && !extensionContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 text-xs text-amber-400/80"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  {detectedPlatform} requires the browser extension for video analysis.
                  Use the{" "}
                  <button
                    onClick={handleImportFromExtension}
                    className="underline hover:text-amber-300 transition-colors"
                  >
                    Import from Extension
                  </button>{" "}
                  button above, or paste the caption manually.
                </span>
              </motion.div>
            )}

            {!url && !extensionContent && (
              <button onClick={() => setUrl(exampleUrl)} className="text-xs text-violet hover:underline">
                Try an example URL
              </button>
            )}
          </div>

          {/* ── Action Buttons Row ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Fetch Metadata */}
            {url && !metadata && !extensionContent && (
              <button
                onClick={handleFetchMeta}
                disabled={fetchingMeta}
                className="flex items-center gap-1.5 text-xs text-violet hover:text-violet-light transition-colors disabled:opacity-50"
              >
                {fetchingMeta
                  ? <><Sparkles className="w-3 h-3 animate-spin" /> Fetching preview…</>
                  : <><ExternalLink className="w-3 h-3" /> Fetch preview</>}
              </button>
            )}

            {/* Import from Extension */}
            <button
              onClick={handleImportFromExtension}
              disabled={importingExt || isStreaming}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
                extensionContent
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-violet/10 text-violet border-violet/20 hover:bg-violet/20"
              }`}
            >
              {importingExt
                ? <><Sparkles className="w-3 h-3 animate-spin" /> Checking…</>
                : extensionContent
                ? <><CheckCircle2 className="w-3 h-3" /> Extension Active</>
                : <><Plug className="w-3 h-3" /> Import from Extension</>}
            </button>

            {/* Paste manually */}
            {url && !showFallback && !fallbackSubmitted && !extensionContent && (
              <button
                onClick={() => setShowFallback(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ClipboardPaste className="w-3 h-3" /> Paste content manually
              </button>
            )}
          </div>

          {/* ── Metadata Preview ── */}
          {metadata && !extensionContent && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex gap-3">
              {(metadata as Record<string, string>).image && (
                <img
                  src={(metadata as Record<string, string>).image}
                  alt="Preview"
                  className="w-16 h-12 rounded-lg object-cover flex-shrink-0 bg-white/[0.04]"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {(metadata as Record<string, string>).title || url}
                  </p>
                  {confidence && <ConfidenceBadge confidence={confidence} />}
                </div>
                {(metadata as Record<string, string>).description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {(metadata as Record<string, string>).description}
                  </p>
                )}
                {(metadata as Record<string, string>).channelName && (
                  <p className="text-xs text-violet mt-1">{(metadata as Record<string, string>).channelName}</p>
                )}
                {(metadata as Record<string, string>).viewCount && (
                  <p className="text-xs text-muted-foreground">
                    {Number((metadata as Record<string, string>).viewCount).toLocaleString()} views
                  </p>
                )}
              </div>
            </div>
          )}

          {metaError && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {metaError}
            </div>
          )}

          {/* ── LOW Confidence Fallback Input ── */}
          <AnimatePresence>
            {showFallback && !extensionContent && !fallbackSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">Couldn't extract full content</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      We couldn't extract the full content from this link. Paste the caption or post text for accurate analysis.
                    </p>
                  </div>
                </div>
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste the caption, script, or post text here…"
                  rows={4}
                  className="w-full glass-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setShowFallback(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleFallbackSubmit}
                    disabled={!pastedContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Continue Analysis
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fallback submitted confirmation */}
          {fallbackSubmitted && !extensionContent && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Content added — analysis will use your pasted text
              <ConfidenceBadge confidence="HIGH" />
            </div>
          )}

          {/* ── Niche + Note ── */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Your niche</label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. fitness, finance, travel"
                className="w-full glass-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">What caught your eye? (optional)</label>
              <input
                type="text"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="e.g. the hook, the storytelling, the CTA"
                className="w-full glass-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {confidence && <ConfidenceBadge confidence={effectiveConfidence} />}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isStreaming
                ? <><Sparkles className="w-4 h-4 animate-spin" /> Performing viral autopsy…</>
                : <><Search className="w-4 h-4" /> Analyze</>}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ── Instagram Auth Required Banner ── */}
      <AnimatePresence>
        {instagramAuthRequired && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard hover={false}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📲</span>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Instagram requires the browser extension</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Instagram blocks direct video downloads from servers. To analyze Instagram Reels, open the post
                    in your browser where you&apos;re already logged in, then click the{" "}
                    <strong className="text-violet-400">Smart Import</strong> extension button — it runs in
                    your authenticated session and extracts the real video + caption instantly.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="/extension"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg gradient-violet text-white font-medium hover:opacity-90 transition-opacity"
                    >
                      <Download className="w-3 h-3" /> Get the Extension
                    </a>
                    <button
                      onClick={() => { setInstagramAuthRequired(false); setShowFallback(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      or paste the caption manually
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TikTok IP Blocked Banner ── */}
      <AnimatePresence>
        {tiktokBlocked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard hover={false}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🎵</span>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-foreground">TikTok requires the browser extension</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    TikTok is blocking our server&apos;s IP from downloading this video. To analyze TikTok videos,
                    open the video in your browser, then click the{" "}
                    <strong className="text-violet-400">Smart Import</strong> extension button — it
                    extracts the real video, audio, and caption directly from your authenticated session.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="/extension"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg gradient-violet text-white font-medium hover:opacity-90 transition-opacity"
                    >
                      <Download className="w-3 h-3" /> Get the Extension
                    </a>
                    <button
                      onClick={() => { setTiktokBlocked(false); setShowFallback(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      or paste the caption manually
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Animated Pipeline Stages ── */}
      {(isStreaming || (pipelineStage !== "idle" && pipelineStage !== "done" && pipelineStage !== "error")) && (
        <GlassCard hover={false}>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Multimodal Processing Pipeline</p>
            <div className="space-y-2">
              {PIPELINE_STAGES.map((s, i) => {
                const stageOrder = ["downloading","transcribing","extracting_text","analyzing_vision","reasoning"];
                const currentIdx = stageOrder.indexOf(pipelineStage);
                const stageIdx = stageOrder.indexOf(s.key);
                const isDone    = stageIdx < currentIdx || (pipelineStage === "done");
                const isActive  = stageIdx === currentIdx;
                return (
                  <motion.div
                    key={s.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive  ? "bg-violet/10 border border-violet/20" :
                      isDone    ? "bg-emerald-500/5 border border-emerald-500/10" :
                      "bg-white/[0.02] border border-white/[0.04]"
                    }`}
                  >
                    <span className={isActive ? "animate-pulse" : ""}>{s.icon}</span>
                    <span className={`text-sm flex-1 ${
                      isActive ? "text-violet font-medium" :
                      isDone   ? "text-emerald-400" :
                      "text-muted-foreground"
                    }`}>{s.label}</span>
                    {isDone    && <span className="text-emerald-400 text-xs">✓</span>}
                    {isActive  && <span className="text-violet text-xs animate-pulse">running…</span>}
                  </motion.div>
                );
              })}
            </div>
            {pipelineStage === "reasoning" && !data && (
              <div className="space-y-2 pt-1">
                {[...Array(3)].map((_,i) => <SkeletonCard key={i} lines={2} />)}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Simple skeleton when no videoUrl (text-only mode) */}
      {isStreaming && !data && pipelineStage === "idle" && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} lines={3 + (i % 3)} />)}
        </div>
      )}

      {/* Error */}
      <ErrorBanner message={error} onDismiss={() => {}} onRetry={handleAnalyze} />

      {/* Results */}
      <AnimatePresence>
        {data && (
          <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Content Being Analyzed Card */}
            <ContentPreviewCard
              title={(metadata as Record<string, string> | null)?.title || url}
              body={previewBody}
              url={url || undefined}
              platform={detectedPlatform || extensionPlatform || undefined}
              confidence={effectiveConfidence}
              source={contentSource}
              visible={showPreview}
              onDismiss={() => setShowPreview(false)}
            />

            {/* Export */}
            <div className="flex items-center justify-between">
              <RefinedBadge visible={isRefined} />
              <ExportButton
                variant="pill"
                label="Export Full Report"
                filename={`spy-recreate-${url.slice(0, 30).replace(/[^a-z0-9]/gi, "-")}`}
                title="Spy &amp; Recreate Report"
                sections={[
                  { heading: "Source URL", body: url },
                  { heading: "Your Niche", body: niche },
                  { heading: "Content Confidence", body: effectiveConfidence },
                  { heading: "Viral Autopsy", body: String(data.viralAutopsy || "") },
                  { heading: "Ethical Borrow", body: (data.ethicalBorrow as string[] || []).join("\n") },
                  { heading: "Outperform Analysis", body: (data.outperformAnalysis as string[] || []).join("\n") },
                  { heading: "Your Recreated Version", body: String(data.recreatedVersion || "") },
                ]}
              />
            </div>

            {/* ── Multimodal Signal Cards (when video was processed) ── */}
            {mediaSignals && !mediaSignals.fallback && [
              {
                title: "Hook Analysis", emoji: "🎯",
                content: data.hookAnalysis, type: "object",
              },
              {
                title: "Audio Intelligence", emoji: "🎤",
                content: data.audioIntelligence, type: "object",
              },
              {
                title: "On-Screen Text (OCR)", emoji: "🔤",
                content: data.onScreenText, type: "object",
              },
              {
                title: "Retention Strategy", emoji: "🔄",
                content: data.retentionStrategy, type: "object",
              },
              {
                title: "Editing Analysis", emoji: "✂️",
                content: data.editingAnalysis, type: "object",
              },
              {
                title: "CTA Effectiveness", emoji: "📣",
                content: data.ctaEffectiveness, type: "object",
              },
            ].map((card, i) => card?.content ? (
              <GlassCard key={`mm-${i}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <span>{card.emoji}</span>{card.title}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Multimodal</span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(card.content as Record<string,unknown>).map(([k,v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground font-medium capitalize">{k.replace(/([A-Z])/g," $1").trim()}</span>
                      {Array.isArray(v)
                        ? <ul className="space-y-0.5">{(v as string[]).map((item,j) => <li key={j} className="text-sm text-foreground/90 pl-3 border-l border-violet/20">{item}</li>)}</ul>
                        : <p className="text-sm text-foreground/90">{String(v)}</p>
                      }
                    </div>
                  ))}
                </div>
              </GlassCard>
            ) : null)}

            {/* Data confidence banner */}
            {data.dataConfidence && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                data.dataConfidence === "HIGH" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                data.dataConfidence === "MEDIUM" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                "bg-white/[0.04] border-white/[0.06] text-muted-foreground"
              }`}>
                <span>{data.dataConfidence === "HIGH" ? "🟢" : data.dataConfidence === "MEDIUM" ? "🟡" : "⚪"}</span>
                <span>Data confidence: <strong>{data.dataConfidence}</strong> · Source: {data.dataSource || "unknown"}</span>
              </div>
            )}

            {/* ── Core 7 Intelligence Cards ── */}
            {[
              { title: "Viral Autopsy", emoji: "🔬", content: data.viralAutopsy, type: "text" },
              { title: "Content DNA Map", emoji: "🧬", content: data.contentDNA, type: "object" },
              { title: "Ethical Borrow Framework", emoji: "💡", content: data.ethicalBorrow, type: "list" },
              { title: "Where You Can Outperform It", emoji: "🎯", content: data.outperformAnalysis, type: "list" },
              { title: "Your Recreated Version", emoji: "✨", content: data.recreatedVersion, type: "text", highlight: true },
              { title: "Virality Scorecard", emoji: "📊", content: data.viralityScorecard, type: "scores" },
              { title: "Posting Playbook", emoji: "📅", content: data.postingPlaybook, type: "object" },
            ].map((card, i) => (
              <GlassCard
                key={i}
                hover={false}
                delay={i * 0.06}
                className={card.highlight ? "border-teal/20 bg-teal/[0.03]" : ""}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{card.emoji}</span>
                    <h3 className="font-heading font-semibold text-sm text-foreground">{card.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    {card.type === "text" && <CopyButton text={card.content as string} />}
                    <SaveButton
                      item={{
                        type: "report",
                        content: { [card.title]: card.content },
                        tags: ["spy-recreate"],
                        folder: "Spy & Recreate",
                        title: `${card.title} — ${url.slice(0, 40)}`,
                      }}
                    />
                  </div>
                </div>

                {card.type === "text" && (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{card.content as string}</p>
                )}
                {card.type === "list" && (
                  <ul className="space-y-2">
                    {(card.content as string[])?.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-violet mt-0.5 flex-shrink-0">•</span>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {card.type === "object" && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(card.content as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-xs text-muted-foreground capitalize mb-1">{k.replace(/([A-Z])/g, " $1")}</p>
                        <p className="text-sm text-foreground">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {card.type === "scores" && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(card.content as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                          <span className="text-foreground font-semibold">{v}/10</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(v / 10) * 100}%` }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                            className="h-full rounded-full gradient-violet"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
