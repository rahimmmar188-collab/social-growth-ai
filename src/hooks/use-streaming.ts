"use client";

import { useState, useCallback } from "react";

const REFINED_SENTINEL = "\n\n__REFINED__:";

interface StreamingState<T> {
  data: T | null;
  rawText: string;
  isStreaming: boolean;
  isRefined: boolean;
  error: string | null;
  startStreaming: (endpoint: string, payload: Record<string, unknown>) => Promise<void>;
  reset: () => void;
}

function parseApiError(msg: string): string {
  // Groq errors
  if (msg.includes("rate_limit_exceeded") && msg.toLowerCase().includes("groq"))
    return "Groq rate limit reached. Please wait a moment before trying again.";
  if (msg.includes("GROQ_API_KEY"))
    return "Groq API key missing. Add GROQ_API_KEY to .env.local.";
  if (msg.includes("insufficient_quota") || msg.includes("exceeded your current quota"))
    return "Groq quota exceeded. Please check your Groq account usage.";
  if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key"))
    return "AI model not configured. Please check Gemini or Groq API keys.";

  // Gemini errors
  if (msg.includes("GEMINI_API_KEY"))
    return "Gemini API key missing. Add GEMINI_API_KEY to .env.local.";
  if (msg.includes("quota") && msg.toLowerCase().includes("gemini"))
    return "Gemini API quota exceeded. Check aistudio.google.com for limits.";

  // Generic
  if (msg.includes("credit balance is too low") || msg.includes("Please go to Plans"))
    return "Insufficient API credits. Please top up your account.";
  if (msg.includes("API key"))
    return "AI model not configured. Please check Gemini or Groq API keys.";
  if (msg.includes("overloaded"))
    return "AI model is overloaded right now. Please try again in a moment.";
  if (msg.includes("rate limit"))
    return "Rate limit reached. Please wait a minute before trying again.";
  if (msg.includes("HTTP 500"))
    return "Server error. Check your API keys are set in .env.local.";
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

export function useStreaming<T>(): StreamingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [rawText, setRawText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRefined, setIsRefined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStreaming = useCallback(async (endpoint: string, payload: Record<string, unknown>) => {
    setIsStreaming(true);
    setError(null);
    setData(null);
    setRawText("");
    setIsRefined(false);
    let accumulated = "";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(parseApiError(errText || `HTTP ${res.status}`));
      }

      if (!res.body) throw new Error("No response body from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Surface inline errors from the stream
        if (chunk.includes("[ERROR]:")) {
          const errMsg = chunk.split("[ERROR]:")[1]?.trim() ?? chunk;
          throw new Error(parseApiError(errMsg));
        }

        accumulated += chunk;
        setRawText(accumulated);

        // ── Check for REFINED sentinel (Pass 2 result) ─────────────────────
        if (accumulated.includes(REFINED_SENTINEL)) {
          const sentinelIdx = accumulated.indexOf(REFINED_SENTINEL);
          const pass1Part = accumulated.slice(0, sentinelIdx);
          const refinedPart = accumulated.slice(sentinelIdx + REFINED_SENTINEL.length).trim();

          // Parse pass1 for display while refined loads
          try {
            const pass1Match = pass1Part.match(/\{[\s\S]*\}/);
            if (pass1Match) setData(JSON.parse(pass1Match[0]) as T);
          } catch { /* keep existing data */ }

          // Parse refined JSON
          if (refinedPart) {
            try {
              const refinedMatch = refinedPart.match(/\{[\s\S]*\}/);
              if (refinedMatch) {
                const refined = JSON.parse(refinedMatch[0]);
                setData(refined as T);
                setIsRefined(true);
              }
            } catch { /* refined JSON incomplete, wait for more chunks */ }
          }
          continue;
        }

        // ── Progressive JSON parse (Pass 1 streaming) ─────────────────────
        // Only parse the Pass 1 portion (before sentinel if any)
        const parseTarget = accumulated.split(REFINED_SENTINEL)[0];
        try {
          const jsonMatch = parseTarget.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            setData(parsed as T);
          }
        } catch {
          // Still accumulating — not valid JSON yet
        }
      }

      // ── Final parse on stream close ─────────────────────────────────────
      if (accumulated.includes(REFINED_SENTINEL)) {
        const refinedPart = accumulated
          .slice(accumulated.indexOf(REFINED_SENTINEL) + REFINED_SENTINEL.length)
          .trim();
        try {
          const refinedMatch = refinedPart.match(/\{[\s\S]*\}/);
          if (refinedMatch) {
            setData(JSON.parse(refinedMatch[0]) as T);
            setIsRefined(true);
          }
        } catch { /* use pass1 data */ }
      } else {
        try {
          const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            setData(JSON.parse(jsonMatch[0]) as T);
          } else if (accumulated.trim()) {
            throw new Error("AI response was not valid JSON. Please try again.");
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes("JSON")) {
            setError("AI response was not valid JSON. Please try again.");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(parseApiError(msg));
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setRawText("");
    setIsStreaming(false);
    setIsRefined(false);
    setError(null);
  }, []);

  return { data, rawText, isStreaming, isRefined, error, startStreaming, reset };
}
