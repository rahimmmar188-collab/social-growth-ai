"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Globe, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithMagicLink(email.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="glass-card p-8 relative overflow-hidden">
              {/* Gradient orb */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-teal/10 blur-3xl pointer-events-none" />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl gradient-violet flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg text-foreground">Welcome back</h2>
                  <p className="text-xs text-muted-foreground">Sign in to save & track competitors</p>
                </div>
              </div>

              {magicLinkSent ? (
                /* Magic link sent state */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4 py-4"
                >
                  <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-teal" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Check your email</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      We sent a magic link to <span className="text-foreground font-medium">{email}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setMagicLinkSent(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/* Google OAuth */}
                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-all text-sm font-medium text-foreground disabled:opacity-50 group"
                  >
                    <Globe className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    Continue with Google
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-xs text-muted-foreground">or continue with email</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  {/* Magic Link */}
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full glass-input pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!email.trim() || loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl gradient-violet text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      {loading ? (
                        <Sparkles className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Send Magic Link
                        </>
                      )}
                    </button>
                  </form>

                  {error && (
                    <p className="text-xs text-red-400 text-center">{error}</p>
                  )}

                  {/* Guest note */}
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    All AI features work without signing in.{" "}
                    <button onClick={onClose} className="text-violet hover:text-violet/80 transition-colors">
                      Continue as guest →
                    </button>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
