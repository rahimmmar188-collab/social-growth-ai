"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface RefinedBadgeProps {
  visible: boolean;
}

export default function RefinedBadge({ visible }: RefinedBadgeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(20,184,166,0.15) 100%)",
            border: "1px solid rgba(139,92,246,0.3)",
            color: "#a78bfa",
          }}
        >
          {/* shimmer overlay */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
            }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.5, ease: "easeInOut", repeat: 2 }}
          />
          <Sparkles className="w-3 h-3 flex-shrink-0" />
          <span className="relative">AI Refined</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
