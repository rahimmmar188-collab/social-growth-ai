"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export default function StreamingText({
  text,
  isStreaming,
  speed = 20,
  className,
  onComplete,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else if (!isStreaming && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, isStreaming, onComplete]);

  useEffect(() => {
    // When new text comes in from streaming, keep going
    if (text.length > currentIndex) {
      // text grew, continue from where we are
    }
  }, [text, currentIndex]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedText]);

  return (
    <div ref={containerRef} className={cn("whitespace-pre-wrap", className)}>
      {displayedText}
      {(isStreaming || currentIndex < text.length) && (
        <span className="cursor-blink text-violet font-bold ml-0.5">|</span>
      )}
    </div>
  );
}
