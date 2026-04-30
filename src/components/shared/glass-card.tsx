"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export default function GlassCard({
  children,
  className,
  hover = true,
  delay = 0,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={
        hover
          ? {
              y: -2,
              boxShadow: "0 8px 32px rgba(124, 111, 247, 0.08)",
            }
          : undefined
      }
      className={cn(
        "glass-card p-5",
        !hover && "glass-card-static",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
