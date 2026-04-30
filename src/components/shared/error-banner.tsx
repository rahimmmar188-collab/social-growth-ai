"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CreditCard, Key, RefreshCw, X, Zap } from "lucide-react";

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

function getErrorMeta(msg: string) {
  if (msg.includes("Groq rate limit") || msg.includes("GROQ_API_KEY") || msg.includes("groq"))
    return {
      icon: Zap,
      label: "Groq Rate Limit or Key Error",
      action: { text: "Check Groq", href: "https://console.groq.com" },
      color: "amber",
    };

  if (msg.includes("Gemini") || msg.includes("GEMINI_API_KEY"))
    return {
      icon: Key,
      label: "Gemini API Error",
      action: { text: "Check Gemini", href: "https://aistudio.google.com/app/apikey" },
      color: "amber",
    };
  if (msg.includes("credit") || msg.includes("billing"))
    return {
      icon: CreditCard,
      label: "Billing Required",
      action: { text: "Check Groq/Gemini", href: "https://console.groq.com" },
      color: "amber",
    };
  if (msg.includes("API key") || msg.includes(".env.local"))
    return {
      icon: Key,
      label: "API Key Error",
      action: { text: "Setup Guide", href: "https://aistudio.google.com/app/apikey" },
      color: "red",
    };
  return { icon: AlertCircle, label: "Error", action: null, color: "red" };
}

export default function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  if (!message) return null;
  const { icon: Icon, label, action, color } = getErrorMeta(message);

  const colorMap: Record<string, string> = {
    amber: "border-amber-500/30 bg-amber-500/10",
    red: "border-red-500/30 bg-red-500/10",
  };
  const iconColorMap: Record<string, string> = {
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`rounded-xl border p-4 flex items-start gap-3 ${colorMap[color]}`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[color]}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${iconColorMap[color]}`}>{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{message}</p>
          {action && (
            <a
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 mt-2 text-xs font-medium ${iconColorMap[color]} hover:opacity-80 transition-opacity`}
            >
              {action.text} →
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRetry && (
            <button
              onClick={onRetry}
              className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
              title="Retry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
