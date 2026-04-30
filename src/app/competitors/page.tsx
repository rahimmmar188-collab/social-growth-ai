"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "@/components/auth/auth-modal";
import GlassCard from "@/components/shared/glass-card";
import {
  Users, Plus, Trash2, RefreshCw, ExternalLink, Sparkles,
  Camera, Briefcase, Video, Users2, BarChart2, Lock,
  TrendingUp, Eye, ArrowRight, FileText,
} from "lucide-react";
import type { Competitor, CompetitorPost } from "@/lib/supabase";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Camera, color: "text-pink-400" },
  { value: "linkedin", label: "LinkedIn", icon: Briefcase, color: "text-blue-400" },
  { value: "facebook", label: "Facebook", icon: Users2, color: "text-blue-500" },
  { value: "youtube", label: "YouTube", icon: Video, color: "text-red-400" },
];

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const p = PLATFORMS.find(p => p.value === platform);
  if (!p) return null;
  const Icon = p.icon;
  return <Icon className={`${p.color} ${className}`} />;
}

function EngagementBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-teal" : score >= 60 ? "bg-violet" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

export default function CompetitorsPage() {
  const { user, loading: authLoading, session } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [profileUrl, setProfileUrl] = useState("");
  const [about, setAbout] = useState("");
  const [adding, setAdding] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Data
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [posts, setPosts] = useState<Record<string, CompetitorPost[]>>({});
  const [loadingPosts, setLoadingPosts] = useState<Record<string, boolean>>({});
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  }), [session]);

  // Fetch competitors from Supabase
  const fetchCompetitors = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/competitors", { headers: authHeaders() });
      const data = await res.json();
      if (data.competitors) setCompetitors(data.competitors);
    } catch { /* silent */ }
  }, [session, authHeaders]);

  useEffect(() => {
    if (session) fetchCompetitors();
  }, [session, fetchCompetitors]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !profileUrl.trim() || !about.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name, platform, profile_url: profileUrl, about }),
      });
      const data = await res.json();
      if (data.competitor) {
        setCompetitors(prev => [data.competitor, ...prev]);
        setName("");
        setProfileUrl("");
        setAbout("");
        setFormOpen(false);
      } else {
        setError(data.error || "Failed to add competitor");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/competitors?id=${id}`, { method: "DELETE", headers: authHeaders() });
      setCompetitors(prev => prev.filter(c => c.id !== id));
      setPosts(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch { /* silent */ }
  };

  const fetchPosts = async (competitor: Competitor) => {
    setLoadingPosts(prev => ({ ...prev, [competitor.id]: true }));
    setExpandedCompetitor(competitor.id);
    try {
      const res = await fetch("/api/competitors/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: competitor.platform,
          name: competitor.name,
          profile_url: competitor.profile_url,
          // Use the competitor's OWN "about" — never the user's niche
          about: competitor.about || competitor.name,
        }),
      });
      const data = await res.json();
      if (data.posts) {
        setPosts(prev => ({ ...prev, [competitor.id]: data.posts }));
      }
    } catch { /* silent */ }
    setLoadingPosts(prev => ({ ...prev, [competitor.id]: false }));
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
            <h2 className="font-heading font-bold text-xl text-foreground">Sign in to track competitors</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Save and track competitor accounts, analyze their viral posts, and benchmark against your content.
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            Competitor Tracker
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track competitor accounts and analyze their viral posts</p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Competitor
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassCard hover={false}>
              <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet" />
                Add New Competitor
              </h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Competitor Name / Handle</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. @garyvee, MrBeast, rytham.me"
                      className="w-full glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Profile / Post URL</label>
                    <input
                      value={profileUrl}
                      onChange={e => setProfileUrl(e.target.value)}
                      placeholder="https://instagram.com/username"
                      className="w-full glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    />
                  </div>
                </div>

                {/* About field — this is the key fix */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    What do they post about? <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    value={about}
                    onChange={e => setAbout(e.target.value)}
                    placeholder="e.g. fitness motivation, day trading tips, luxury fashion, cooking recipes..."
                    className="w-full glass-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    This is used to generate accurate viral post simulations. Be specific.
                  </p>
                </div>

                {/* Platform selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Platform</label>
                  <div className="flex gap-2 flex-wrap">
                    {PLATFORMS.map(p => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPlatform(p.value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                            platform === p.value
                              ? "border-violet/40 bg-violet/10 text-foreground"
                              : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${p.color}`} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={adding || !name.trim() || !profileUrl.trim() || !about.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40"
                  >
                    {adding ? <Sparkles className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {adding ? "Adding..." : "Add Competitor"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormOpen(false); setError(null); }}
                    className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Competitors List */}
      {competitors.length === 0 ? (
        <GlassCard hover={false}>
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No competitors yet</p>
            <p className="text-xs text-muted-foreground">Add your first competitor to start analyzing their viral content</p>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-violet hover:bg-violet/10 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Add First Competitor
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {competitors.map((competitor, i) => (
            <motion.div
              key={competitor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard hover={false}>
                {/* Competitor header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <PlatformIcon platform={competitor.platform} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">{competitor.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {competitor.platform}
                        {competitor.about && (
                          <span className="text-muted-foreground/60"> · {competitor.about}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={competitor.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => fetchPosts(competitor)}
                      disabled={loadingPosts[competitor.id]}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet/10 border border-violet/20 text-violet text-xs font-medium hover:bg-violet/20 transition-colors disabled:opacity-50"
                    >
                      {loadingPosts[competitor.id] ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {loadingPosts[competitor.id] ? "Analyzing..." : "Viral Posts"}
                    </button>
                    <button
                      onClick={() => handleDelete(competitor.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Posts */}
                <AnimatePresence>
                  {expandedCompetitor === competitor.id && posts[competitor.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-violet" />
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Top Viral Posts
                          </span>
                          {competitor.platform !== "youtube" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">
                              AI Intelligence
                            </span>
                          )}
                          {competitor.about && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 font-medium ml-auto">
                              Topic: {competitor.about}
                            </span>
                          )}
                        </div>
                        {posts[competitor.id].map((post, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: j * 0.05 }}
                            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-violet/20 transition-all group"
                          >
                            <div className="flex gap-3">
                              {post.thumbnail && (
                                <img
                                  src={post.thumbnail}
                                  alt=""
                                  className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-2">{post.title}</p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.description}</p>
                                {/* Viral factor badge */}
                                {"viralFactor" in post && (post as CompetitorPost & { viralFactor?: string }).viralFactor && (
                                  <p className="text-[11px] text-violet/80 mt-1.5 italic line-clamp-1">
                                    ⚡ {(post as CompetitorPost & { viralFactor?: string }).viralFactor}
                                  </p>
                                )}
                                <div className="mt-2">
                                  <EngagementBar score={post.engagement_score} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 flex-shrink-0">
                                {post.post_url && (
                                  <a
                                    href={post.post_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => {
                                    window.location.href = `/spy-recreate?url=${encodeURIComponent(post.post_url || '')}&title=${encodeURIComponent(post.title)}`;
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-violet/10 text-muted-foreground hover:text-violet transition-colors"
                                  title="Analyze this post"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
