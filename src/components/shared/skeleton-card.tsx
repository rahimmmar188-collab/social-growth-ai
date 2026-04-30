"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  lines?: number;
  className?: string;
  hasHeader?: boolean;
}

export default function SkeletonCard({
  lines = 4,
  className,
  hasHeader = true,
}: SkeletonCardProps) {
  return (
    <div className={cn("glass-card-static p-5 space-y-4", className)}>
      {hasHeader && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-32 rounded bg-white/[0.06] shimmer" />
            <div className="h-2 w-20 rounded bg-white/[0.04] shimmer" />
          </div>
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 rounded bg-white/[0.04] shimmer"
            style={{
              width: `${85 - i * 12}%`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
