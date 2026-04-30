"use client";

import React, { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: "sm" | "md";
}

export default function CopyButton({ text, className, size = "md" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-md hover:bg-white/[0.06] transition-all duration-200",
        copied && "text-teal",
        !copied && "text-muted-foreground hover:text-foreground",
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn(iconSize, "transition-transform scale-110")} />
      ) : (
        <Copy className={iconSize} />
      )}
    </button>
  );
}
