"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PillTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export default function PillTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: PillTabsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "pill-tab",
            value === option.value && "active",
            size === "sm" && "text-xs px-3 py-1"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
