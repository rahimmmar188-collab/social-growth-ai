// Agent types for all 6 AI agents
export interface TrendResult {
  trendingPhrases: { phrase: string; volume: "high" | "medium" | "emerging"; momentum: "rising" | "stable" | "fading" }[];
  hashtags: { broad: string[]; niche: string[]; viral: string[] };
  contentAngles: { angle: string; rationale: string }[];
  competitorGaps: string[];
}

export interface DNAResult {
  hookType: string;
  structure: { hook: string; tensionBuild: string; payoff: string; cta: string };
  psychologicalTriggers: string[];
  whyItWorks: string;
  recreatedIdea: string;
  weaknessAudit: string;
}

export interface CreateResult {
  hooks: { text: string; type: string }[];
  reelConcepts: { title: string; scenes: string[] }[];
  captions: { type: string; text: string }[];
  ctaVariations: { text: string; intent: string }[];
  platformTips: string[];
}

export interface StrategyResult {
  viralScore: number;
  scoreBreakdown: { hook: number; structure: number; timing: number };
  bestPostingWindows: { day: string; time: string; platform: string }[];
  improvementActions: string[];
  contentGaps: string[];
  calendarSuggestion: { week: number; theme: string; posts: string[] }[];
  engagementBait: string[];
}

export interface CaptionResult {
  captions: { type: "punchy" | "medium" | "story"; text: string }[];
  hashtags: { broad: string[]; niche: string[]; viral: string[] };
  hookAlternatives: { type: string; text: string }[];
  postingTip: { bestTime: string; coverText: string; subtitles: boolean; firstComment: string };
}

export interface URLResult {
  viralAutopsy: string;
  contentDNA: { hookType: string; pacing: string; tensionPayoff: string; ctaPlacement: string; format: string };
  ethicalBorrow: string[];
  outperformAnalysis: string[];
  recreatedVersion: string;
  viralityScorecard: { hookStrength: number; emotionalResonance: number; shareability: number; ctaClarity: number };
  postingPlaybook: { platform: string; optimalTime: string; hashtagMix: string[]; abTest: string };
}

// ── Multimodal analysis result (from real video processing) ──────────────────
export interface MultimodalURLResult {
  viralAutopsy: string;

  hookAnalysis: {
    first3Seconds: string;
    hookType: string;
    hookPhrase: string;
    emotionalTrigger: string;
    attentionMechanism: string;
  };

  contentDNA: {
    hookType: string;
    pacing: string;
    tensionPayoff: string;
    ctaPlacement: string;
    format: string;
  };

  audioIntelligence: {
    hookPhrase: string;
    fullTranscript: string;
    speakingPace: string;
    emotionTone: string;
    keyPhrases: string[];
  };

  onScreenText: {
    hookText: string;
    ctaText: string;
    subtitles: string;
    otherText: string[];
  };

  retentionStrategy: {
    sceneCount: number;
    avgSceneDuration: string;
    patternInterrupts: string[];
    curiosityLoops: string[];
    pacingStyle: string;
  };

  editingAnalysis: {
    cutStyle: string;
    visualRhythm: string;
    cameraWork: string;
    energyLevel: string;
    productionQuality: string;
  };

  ctaEffectiveness: {
    visualCTA: string;
    spokenCTA: string;
    timing: string;
    strength: "strong" | "moderate" | "weak";
    improvement: string;
  };

  ethicalBorrow: string[];
  outperformAnalysis: string[];
  recreatedVersion: string;

  viralityScorecard: {
    hookStrength: number;
    emotionalResonance: number;
    shareability: number;
    ctaClarity: number;
    productionValue: number;
    overall: number;
  };

  audiencePsychology: string;
  creatorStyleSignature: string;
  weaknessesAndImprovements: string[];

  postingPlaybook: {
    platform: string;
    optimalTime: string;
    hashtagMix: string[];
    abTest: string;
  };

  contentNiche: string;
  dataConfidence: "HIGH" | "MEDIUM" | "LOW";
  dataSource: "multimodal" | "caption-only" | "metadata-only";
}

export interface GapAnalysisResult {
  gapSummary: string;
  hookComparison: {
    userHook: string;
    competitorHook: string;
    gap: string;
    userScore: number;
    competitorScore: number;
  };
  structureComparison: {
    userStructure: string;
    competitorStructure: string;
    gap: string;
    userScore: number;
    competitorScore: number;
  };
  emotionalTriggerGap: {
    userTriggers: string[];
    competitorTriggers: string[];
    missingTriggers: string[];
    impact: string;
  };
  scorecard: {
    hook: { user: number; competitor: number };
    structure: { user: number; competitor: number };
    emotionalResonance: { user: number; competitor: number };
    ctaClarity: { user: number; competitor: number };
    shareability: { user: number; competitor: number };
    overall: { user: number; competitor: number };
  };
  actionPlan: { fix: string; why: string; how: string }[];
  optimizedVersion: string;
}

export interface AgentInput {
  niche: string;
  platform: string;
  creatorType?: string;
  caption?: string;
  idea?: string;
  tone?: string;
  lengthPref?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  userNote?: string;
  previousOutputs?: Record<string, unknown>;
}
