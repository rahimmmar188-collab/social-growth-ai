import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Clients (lazy, read env at call time) ───────────────────────────────────
function getGroq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local");
  return new Groq({ apiKey });
}

function getGemini(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Agent routing config ─────────────────────────────────────────────────────
export type AgentType = "trend" | "dna" | "create" | "strategy" | "caption" | "url";

interface AgentConfig {
  generator: "gemini-flash" | "gemini-pro" | "groq";
  refiner: "gemini-pro" | null;
}

const AGENT_ROUTING: Record<AgentType, AgentConfig> = {
  trend:    { generator: "gemini-flash", refiner: null },         // Agent 1: speed only
  dna:      { generator: "gemini-flash", refiner: "gemini-pro" }, // Agent 2: full dual-pass
  create:   { generator: "gemini-flash", refiner: "gemini-pro" }, // Agent 3: full dual-pass
  strategy: { generator: "gemini-flash", refiner: "gemini-pro" }, // Agent 4: optional refine
  caption:  { generator: "groq",         refiner: "gemini-pro" }, // Agent 5: LLaMA + Gemini
  url:      { generator: "gemini-pro",   refiner: "gemini-pro" }, // Agent 6: Gemini self-refine
};

// ─── Quality gate — skip refinement if Pass 1 is already strong ──────────────
export function evaluateQuality(text: string): "high" | "low" {
  try {
    const parsed = JSON.parse(text);
    const str = JSON.stringify(parsed);

    // Too short → weak
    if (str.length < 400) return "low";

    // Stub phrases → weak
    const weakPhrases = [
      "great content", "amazing post", "placeholder",
      "...", "lorem", "example text",
    ];
    const hasWeak = weakPhrases.some((p) => str.toLowerCase().includes(p));
    if (hasWeak) return "low";

    return "high";
  } catch {
    return "low";
  }
}

// ─── REFINEMENT PROMPT ────────────────────────────────────────────────────────
const REFINEMENT_SYSTEM = `You are an elite viral content strategist.

Your task is to improve the provided JSON output without changing its structure.

Rules:

* Do not change keys or schema
* Improve clarity, emotional impact, and originality
* Strengthen hooks and engagement triggers
* Remove generic or repetitive phrasing
* Make outputs highly specific and platform-native
* Rewrite weak sections completely if needed
* Ensure final output is valid JSON

Return ONLY valid JSON. No explanations.`;

// ─── GEMINI STREAMING ─────────────────────────────────────────────────────────
export async function streamGemini(
  modelName: string,
  system: string,
  user: string,
  onChunk: (text: string) => void
): Promise<string> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const prompt = `${system}\n\nIMPORTANT: Return ONLY valid JSON.\n\nUser Input:\n${user}`;
  
  let fullText = "";
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    onChunk(chunkText);
  }
  
  return fullText;
}

// ─── GROQ STREAMING (LLaMA 3.3) ───────────────────────────────────────────────
export async function streamGroq(
  system: string,
  user: string,
  onChunk: (text: string) => void
): Promise<string> {
  const client = getGroq();
  let fullText = "";

  const stream = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    messages: [
      { role: "system", content: system + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no commentary." },
      { role: "user", content: user },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  }
  return fullText;
}

// ─── GEMINI REFINEMENT (non-streaming, used as Pass 2) ───────────────────────
export async function refineWithGemini(rawJson: string): Promise<string> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const prompt = `${REFINEMENT_SYSTEM}\n\nHere is the JSON to refine:\n${rawJson}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown if model wrapped in backticks despite instruction
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ─── PRIMARY EXPORT: get config for an agent ─────────────────────────────────
export function getAgentConfig(agentType: AgentType): AgentConfig {
  return AGENT_ROUTING[agentType];
}
