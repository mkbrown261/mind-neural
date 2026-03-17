// ═══════════════════════════════════════
// MIND UNIFIED TICK ENGINE
// Systems: InteroceptiveStream, PredictiveEngine, Era, IdleThoughtCycle
// All visual/audio rendering derives from FINAL resolved state per tick.
// ═══════════════════════════════════════

import { EmotionalState, SomaticState, updateEmotionalState, somaticFromEmotional } from './state';
import { Memory, createFoundingMemory, storeMemory, MemoryType } from './memory';
import { spreadingActivation } from './network';
import { toEmotionalSignature, DetectedEmotions, BrainRegion, RegionActivation } from './emotions';
import { TrustState, compositeTrustScore, getDevelopmentStage } from './personality';

// ═══════════════════════════════════════
// ERA SYSTEM — hard gating on all features
// ═══════════════════════════════════════

export type Era = 0 | 1 | 2 | 3 | 4;

export interface EraCapabilities {
  era: Era;
  label: string;
  interactionThreshold: number;
  amnComplexity: number;          // 0.0–1.0 multiplier on AMN hop depth
  pesPlasticity: number;          // crystallization rate multiplier
  rgpExpressiveRange: number;     // 0.0–1.0 max response depth
  coherenceUnlocked: boolean;
  idleThoughtsUnlocked: boolean;
  identityUnlocked: boolean;
  conflictUnlocked: boolean;
  temporalBondUnlocked: boolean;
  foundingMemoryReductionActive: boolean; // Era 3+: retrieval weight = 0.3
}

export const ERA_TABLE: Record<Era, EraCapabilities> = {
  0: {
    era: 0, label: 'Newborn', interactionThreshold: 0,
    amnComplexity: 0.2, pesPlasticity: 1.0, rgpExpressiveRange: 0.2,
    coherenceUnlocked: false, idleThoughtsUnlocked: false, identityUnlocked: false,
    conflictUnlocked: false, temporalBondUnlocked: false, foundingMemoryReductionActive: false
  },
  1: {
    era: 1, label: 'Infant', interactionThreshold: 10,
    amnComplexity: 0.4, pesPlasticity: 0.8, rgpExpressiveRange: 0.4,
    coherenceUnlocked: false, idleThoughtsUnlocked: true, identityUnlocked: false,
    conflictUnlocked: true, temporalBondUnlocked: true, foundingMemoryReductionActive: false
  },
  2: {
    era: 2, label: 'Child', interactionThreshold: 50,
    amnComplexity: 0.65, pesPlasticity: 0.6, rgpExpressiveRange: 0.65,
    coherenceUnlocked: false, idleThoughtsUnlocked: true, identityUnlocked: true,
    conflictUnlocked: true, temporalBondUnlocked: true, foundingMemoryReductionActive: false
  },
  3: {
    era: 3, label: 'Adolescent', interactionThreshold: 200,
    amnComplexity: 0.85, pesPlasticity: 0.4, rgpExpressiveRange: 0.85,
    coherenceUnlocked: true, idleThoughtsUnlocked: true, identityUnlocked: true,
    conflictUnlocked: true, temporalBondUnlocked: true, foundingMemoryReductionActive: true
  },
  4: {
    era: 4, label: 'Adult', interactionThreshold: 500,
    amnComplexity: 1.0, pesPlasticity: 0.25, rgpExpressiveRange: 1.0,
    coherenceUnlocked: true, idleThoughtsUnlocked: true, identityUnlocked: true,
    conflictUnlocked: true, temporalBondUnlocked: true, foundingMemoryReductionActive: true
  }
};

export function getEra(totalInteractions: number): Era {
  if (totalInteractions < 10) return 0;
  if (totalInteractions < 50) return 1;
  if (totalInteractions < 200) return 2;
  if (totalInteractions < 500) return 3;
  return 4;
}

export function getEraCapabilities(totalInteractions: number): EraCapabilities {
  return ERA_TABLE[getEra(totalInteractions)];
}

// ═══════════════════════════════════════
// INTEROCEPTIVE STREAM
// Lagging ESE reader → SSM → feeds back into ESE
// emotion ↔ body loop — mandatory after initialization
// ═══════════════════════════════════════

export interface InteroceptiveState {
  // Lagged versions of ESE dimensions (body registers emotion with delay)
  laggedValence: number;
  laggedArousal: number;
  laggedAnxiety: number;
  laggedGrief: number;
  laggedWarmth: number;
  // Interoceptive signals fed back into ESE
  heartRateSignal: number;      // 0.0–1.0 (high = elevated arousal/anxiety)
  breathingSignal: number;      // 0.0–1.0 (low = stillness, high = activation)
  gutSignal: number;            // negative valence amplifier
  chestSignal: number;          // grief/longing amplifier
  skinSignal: number;           // warmth/connection signal
  varianceIndex: number;        // internal variance (for criticality)
}

export const DEFAULT_INTEROCEPTIVE: InteroceptiveState = {
  laggedValence: 0, laggedArousal: 0.05, laggedAnxiety: 0.05,
  laggedGrief: 0, laggedWarmth: 0,
  heartRateSignal: 0.1, breathingSignal: 0.2, gutSignal: 0,
  chestSignal: 0, skinSignal: 0, varianceIndex: 0.1
};

const INTERO_LAG = 0.08; // how fast body catches up to emotion (slow)

export function updateInteroception(
  current: InteroceptiveState,
  ese: EmotionalState
): InteroceptiveState {
  // Body slowly catches up to emotion state
  const lagged = (curr: number, target: number) =>
    curr + (target - curr) * INTERO_LAG;

  const next: InteroceptiveState = {
    laggedValence:  lagged(current.laggedValence,  ese.valence),
    laggedArousal:  lagged(current.laggedArousal,  ese.arousal),
    laggedAnxiety:  lagged(current.laggedAnxiety,  ese.anxiety),
    laggedGrief:    lagged(current.laggedGrief,    ese.grief),
    laggedWarmth:   lagged(current.laggedWarmth,   ese.warmth),
    // Signals derived from lagged body state
    heartRateSignal:  Math.min(1, current.laggedArousal * 0.7 + current.laggedAnxiety * 0.3),
    breathingSignal:  Math.min(1, current.laggedArousal * 0.5 + current.laggedAnxiety * 0.4),
    gutSignal:        Math.max(0, -current.laggedValence * 0.5 + current.laggedAnxiety * 0.3),
    chestSignal:      Math.min(1, current.laggedGrief * 0.7 + (Math.abs(current.laggedValence) * 0.3)),
    skinSignal:       Math.min(1, current.laggedWarmth * 0.8 + (current.laggedValence > 0 ? current.laggedValence * 0.2 : 0)),
    varianceIndex:    computeInteroVariance(current, ese)
  };
  return next;
}

function computeInteroVariance(intero: InteroceptiveState, ese: EmotionalState): number {
  // Variance = mismatch between body state and emotional state
  const diffs = [
    Math.abs(intero.laggedArousal - ese.arousal),
    Math.abs(intero.laggedAnxiety - ese.anxiety),
    Math.abs(intero.laggedGrief - ese.grief),
    Math.abs(intero.laggedWarmth - ese.warmth),
  ];
  return diffs.reduce((s, v) => s + v, 0) / diffs.length;
}

// Interoceptive feedback INTO ESE — the body-emotion loop
export function interoceptiveFeedback(
  ese: EmotionalState,
  intero: InteroceptiveState
): Partial<EmotionalState> {
  const delta: Partial<EmotionalState> = {};
  // Elevated heart rate amplifies arousal slightly
  if (intero.heartRateSignal > 0.4) {
    delta.arousal = intero.heartRateSignal * 0.03;
  }
  // Gut signal amplifies anxiety
  if (intero.gutSignal > 0.3) {
    delta.anxiety = intero.gutSignal * 0.02;
  }
  // Chest signal sustains grief
  if (intero.chestSignal > 0.3) {
    delta.grief = intero.chestSignal * 0.015;
  }
  // Skin signal sustains warmth
  if (intero.skinSignal > 0.3) {
    delta.warmth = intero.skinSignal * 0.015;
  }
  return delta;
}

// Derive SSM from interoceptive state (more specific than pure emotion → SSM)
export function somaticFromInteroception(
  baseSomatic: SomaticState,
  intero: InteroceptiveState
): SomaticState {
  return {
    tension:   Math.min(1, baseSomatic.tension   + intero.heartRateSignal * 0.1 + intero.gutSignal * 0.1),
    warmth:    Math.min(1, baseSomatic.warmth    + intero.skinSignal * 0.1),
    weight:    Math.min(1, baseSomatic.weight    + intero.chestSignal * 0.08),
    expansion: Math.max(0, baseSomatic.expansion - intero.gutSignal * 0.05),
    stillness: Math.max(0, baseSomatic.stillness - intero.breathingSignal * 0.06),
    openness:  Math.max(0, baseSomatic.openness  - intero.gutSignal * 0.04)
  };
}

// ═══════════════════════════════════════
// PREDICTIVE ENGINE
// Generates predictions before input; calculates error after
// ═══════════════════════════════════════

export interface PredictionState {
  // Pre-input prediction
  predictedValence: number;
  predictedArousal: number;
  predictedEmotionCategories: string[];
  confidence: number;           // 0.0–1.0 based on history depth
  // Post-input error
  predictionError: number;      // 0.0–1.0
  lastError: number;
  errorHistory: number[];       // rolling last 10 errors
  // Thalamic ripple flag (visual signal)
  thalamicRipple: boolean;
  rippleIntensity: number;
}

export const DEFAULT_PREDICTION: PredictionState = {
  predictedValence: 0, predictedArousal: 0.1,
  predictedEmotionCategories: [],
  confidence: 0, predictionError: 0, lastError: 0,
  errorHistory: [], thalamicRipple: false, rippleIntensity: 0
};

// Called BEFORE processing user input — generates prediction from current state
export function generatePrediction(
  ese: EmotionalState,
  memories: Memory[],
  trust: TrustState,
  current: PredictionState
): PredictionState {
  const trustScore = compositeTrustScore(trust);
  const recentMemories = memories.slice(-5);

  // Predict based on momentum (baseline carries forward)
  const predictedValence = ese.valence * 0.6;
  const predictedArousal = ese.arousal * 0.5 + 0.1;

  // Confidence grows with memory count and trust
  const confidence = Math.min(0.9, memories.length * 0.02 + trustScore * 0.3);

  // Predict emotion categories from recent memory patterns
  const categoryCounts: Record<string, number> = {};
  for (const m of recentMemories) {
    for (const cat of m.emotionalSignature.categories) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
  }
  const predictedEmotionCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);

  return {
    ...current,
    predictedValence, predictedArousal,
    predictedEmotionCategories, confidence,
    thalamicRipple: false, rippleIntensity: 0
  };
}

// Called AFTER input is processed — measures prediction error
export function computePredictionError(
  prediction: PredictionState,
  actual: EmotionalState,
  detectedEmotions: DetectedEmotions
): PredictionState {
  const valenceDiff = Math.abs(actual.valence - prediction.predictedValence);
  const arousalDiff = Math.abs(actual.arousal - prediction.predictedArousal);
  const predictionError = Math.min(1, (valenceDiff * 0.5 + arousalDiff * 0.5) * (1 - prediction.confidence * 0.4));

  const errorHistory = [...prediction.errorHistory, predictionError].slice(-10);
  const thalamicRipple = predictionError > 0.3;
  const rippleIntensity = predictionError;

  return {
    ...prediction,
    predictionError, lastError: predictionError,
    errorHistory, thalamicRipple, rippleIntensity
  };
}

// Novel input detection — high error → high novelty → encoding strength boost
export function getNoveltyFromPrediction(prediction: PredictionState): number {
  if (prediction.predictionError > 0.6) return 0.9; // force high novelty
  if (prediction.predictionError < 0.2) return 0.2; // reduce encoding
  return 0.3 + prediction.predictionError * 0.6;
}

// Arousal spike from prediction error (injected into ESE)
export function predictionErrorToArousalSpike(error: number): Partial<EmotionalState> {
  if (error < 0.2) return {};
  return { arousal: error * 0.15 };
}

// ═══════════════════════════════════════
// COHERENCE STATE — computed from system alignment
// NOT a visual mode — a state condition
// ═══════════════════════════════════════

export interface CoherenceState {
  isCoherent: boolean;
  coherenceScore: number;    // 0.0–1.0
  turnsActive: number;
  lastAchievedAt: number;
  // Stability signals
  eseVarianceLow: boolean;
  ssmSynced: boolean;
  amnWide: boolean;
  trustSufficient: boolean;
}

export const DEFAULT_COHERENCE: CoherenceState = {
  isCoherent: false, coherenceScore: 0, turnsActive: 0,
  lastAchievedAt: 0, eseVarianceLow: false, ssmSynced: false,
  amnWide: false, trustSufficient: false
};

export function evaluateCoherence(
  ese: EmotionalState,
  intero: InteroceptiveState,
  trust: TrustState,
  amnActivityLevel: number,
  predictionError: number,
  era: EraCapabilities
): CoherenceState {
  if (!era.coherenceUnlocked) {
    return { ...DEFAULT_COHERENCE };
  }

  const trustScore = compositeTrustScore(trust);
  const eseVariance = intero.varianceIndex;

  // Coherence conditions (spec: stable intensity, low conflict, wide AMN, trust threshold)
  const eseVarianceLow = eseVariance < 0.15 && ese.arousal > 0.2 && ese.arousal < 0.7;
  const ssmSynced = intero.varianceIndex < 0.2;
  const amnWide = amnActivityLevel > 0.3;
  const trustSufficient = trustScore > 0.5;

  const conditionsMet = [eseVarianceLow, ssmSynced, amnWide, trustSufficient].filter(Boolean).length;
  const coherenceScore = Math.min(1, (conditionsMet / 4) * (1 - predictionError * 0.3));
  const isCoherent = conditionsMet >= 3 && coherenceScore > 0.65;

  return {
    isCoherent,
    coherenceScore,
    turnsActive: isCoherent ? 1 : 0, // caller increments across turns
    lastAchievedAt: isCoherent ? Date.now() : DEFAULT_COHERENCE.lastAchievedAt,
    eseVarianceLow, ssmSynced, amnWide, trustSufficient
  };
}

// ═══════════════════════════════════════
// BIOPHOTON GLOW — derived from ESE state
// ═══════════════════════════════════════

export interface BiophotonState {
  brightness: number;       // 0.0–1.0
  colorR: number;           // 0.0–1.0 red component
  colorG: number;           // 0.0–1.0 green component
  colorB: number;           // 0.0–1.0 blue component
  dominantAxis: string;
}

export function computeBiophoton(ese: EmotionalState): BiophotonState {
  // Spec formula:
  // brightness = (arousal*0.4) + (wonder*0.3) + (trust*0.3)
  const brightness = Math.min(1,
    ese.arousal * 0.4 + ese.wonder * 0.3 + ese.trust * 0.3
  );

  // Color: weighted blend of dominant emotional axes
  // grief/anxiety → blue-white (0.6, 0.7, 1.0)
  // warmth/trust  → gold-white (1.0, 0.85, 0.4)
  // wonder        → electric blue (0.2, 0.5, 1.0)
  // anger         → red (1.0, 0.1, 0.1)
  const griefAnxiety = (ese.grief + ese.anxiety) / 2;
  const warmthTrust  = (ese.warmth + ese.trust) / 2;
  const wonder       = ese.wonder;
  const anger        = 1 - (1 - ese.wariness) * (1 - ese.anxiety * 0.5); // proxy for anger

  const total = griefAnxiety + warmthTrust + wonder + 0.1;

  const r = (griefAnxiety * 0.6 + warmthTrust * 1.0 + wonder * 0.2 + anger * 1.0) / total;
  const g = (griefAnxiety * 0.7 + warmthTrust * 0.85 + wonder * 0.5 + anger * 0.1) / total;
  const b = (griefAnxiety * 1.0 + warmthTrust * 0.4 + wonder * 1.0 + anger * 0.1) / total;

  let dominantAxis = 'neutral';
  const max = Math.max(griefAnxiety, warmthTrust, wonder, anger);
  if (max === griefAnxiety) dominantAxis = 'grief-anxiety';
  else if (max === warmthTrust) dominantAxis = 'warmth-trust';
  else if (max === wonder) dominantAxis = 'wonder';
  else dominantAxis = 'tension';

  return { brightness, colorR: r, colorG: g, colorB: b, dominantAxis };
}

// ═══════════════════════════════════════
// QUANTUM CRITICALITY INDEX
// ═══════════════════════════════════════

export interface CriticalityState {
  index: number;       // 0.0–1.0
  pattern: 'ordered' | 'adaptive' | 'critical';
  journeyBoosted: boolean;
}

export function computeCriticality(
  ese: EmotionalState,
  predictionError: number,
  interoVariance: number,
  amnActivityLevel: number
): CriticalityState {
  // CriticalityIndex = f(arousal, predictionError, interoVariance, amnActivity)
  const index = Math.min(1,
    ese.arousal * 0.3 +
    predictionError * 0.3 +
    interoVariance * 0.2 +
    amnActivityLevel * 0.2
  );

  const pattern: CriticalityState['pattern'] =
    index < 0.35 ? 'ordered' :
    index < 0.65 ? 'adaptive' :
    'critical';

  return { index, pattern, journeyBoosted: false };
}

// ═══════════════════════════════════════
// IDLE THOUGHT CYCLE
// NOT random — sourced from AMN
// Creates state transitions, not text
// ═══════════════════════════════════════

export interface IdleThoughtState {
  lastTriggerTime: number;
  nextTriggerInterval: number;  // 8000–15000 ms
  isActive: boolean;
  currentThoughtMemoryId: string | null;
  totalIdleThoughts: number;
}

export const DEFAULT_IDLE_THOUGHT: IdleThoughtState = {
  lastTriggerTime: 0,
  nextTriggerInterval: 10000,
  isActive: false,
  currentThoughtMemoryId: null,
  totalIdleThoughts: 0
};

export interface IdleThoughtResult {
  triggered: boolean;
  eseDeltas: Partial<EmotionalState>;
  somaticDeltas: Partial<SomaticState>;
  internalMemory: Memory | null;
  activatedRegions: RegionActivation[];
  nextState: IdleThoughtState;
}

export async function evaluateIdleThought(
  current: IdleThoughtState,
  ese: EmotionalState,
  memories: Memory[],
  trust: TrustState,
  era: EraCapabilities,
  nowMs: number
): Promise<IdleThoughtResult> {
  const noResult: IdleThoughtResult = {
    triggered: false, eseDeltas: {}, somaticDeltas: {},
    internalMemory: null, activatedRegions: [],
    nextState: current
  };

  // Era gate
  if (!era.idleThoughtsUnlocked) return noResult;
  if (memories.length === 0) return noResult;

  const elapsed = nowMs - current.lastTriggerTime;

  // Trigger condition: timer OR high internal pressure
  const highPressure = ese.arousal > 0.6 || ese.grief > 0.5 || ese.anxiety > 0.6;
  const timerFired = elapsed > current.nextTriggerInterval;

  if (!timerFired && !highPressure) return noResult;

  // 1. AMN: select 1–2 memories (emotional intensity + recency + strength)
  const scoredMemories = memories
    .filter(m => m.type === 'episodic' || m.type === 'internalThought')
    .map(m => {
      const recency = Math.exp(-(nowMs - m.timestamp) / (1000 * 60 * 60 * 24 * 7));
      const strength = m.encodingStrength;
      const intensity = m.emotionalSignature.intensity;
      const score = intensity * 0.5 + recency * 0.3 + strength * 0.2;
      return { memory: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scoredMemories.length === 0) return noResult;

  // Pick 1–2 with weighted random
  const selected = [scoredMemories[0].memory];
  if (scoredMemories.length > 1 && Math.random() > 0.5) {
    selected.push(scoredMemories[1].memory);
  }

  // 2. Derive internal state from selected memories
  const avgValence = selected.reduce((s, m) => s + m.emotionalSignature.valence, 0) / selected.length;
  const avgIntensity = selected.reduce((s, m) => s + m.emotionalSignature.intensity, 0) / selected.length;

  // Internal thought intensity: 0.2–0.5 (spec)
  const thoughtIntensity = Math.min(0.5, Math.max(0.2, avgIntensity * 0.5));

  // 3. ESE micro-shifts (±0.02–0.05)
  const eseDeltas: Partial<EmotionalState> = {};
  const shift = thoughtIntensity * 0.08;
  eseDeltas.valence = (avgValence * shift);
  if (selected[0].emotionalSignature.categories.includes('grief')) eseDeltas.grief = shift * 0.6;
  if (selected[0].emotionalSignature.categories.includes('wonder')) eseDeltas.wonder = shift * 0.5;
  if (selected[0].emotionalSignature.categories.includes('longing')) eseDeltas.longing = shift * 0.4;

  // 4. SSM subtle response
  const somaticDeltas: Partial<SomaticState> = {};
  if (selected[0].isTraumatic) { somaticDeltas.tension = 0.02; somaticDeltas.stillness = -0.02; }
  if (avgValence > 0.3) { somaticDeltas.warmth = 0.01; }

  // 5. Create internal_thought memory (NOT visible to user, type = 'internalThought')
  const sig = {
    valence: avgValence * 0.5,
    intensity: thoughtIntensity,
    categories: selected[0].emotionalSignature.categories.slice(0, 2) as any[]
  };
  const somatic: SomaticState = {
    tension: 0.2 + (somaticDeltas.tension ?? 0),
    warmth: 0.1 + (somaticDeltas.warmth ?? 0),
    weight: 0.3, expansion: 0.2, stillness: 0.5, openness: 0.2
  };

  const internalMemory = createFoundingMemory(
    `[idle_thought: trace of ${selected[0].id.slice(0, 8)}]`,
    sig, somatic, 0.3, 0.3, compositeTrustScore(trust), 'internalThought'
  );
  // Override foundingMemory to false — these are idle, not founding
  const idleMemory: Memory = { ...internalMemory, foundingMemory: false, persistenceScore: thoughtIntensity };

  // 6. Activated regions from selected memory categories
  const activatedRegions: RegionActivation[] = [];
  for (const cat of selected[0].emotionalSignature.categories) {
    const region = categoryToRegion(cat);
    if (region) activatedRegions.push({ region, level: thoughtIntensity * 0.6 });
  }
  // Hippocampus always lights on idle retrieval
  activatedRegions.push({ region: 'hippocampus', level: thoughtIntensity * 0.7 });

  // Next interval: 8–15s randomized
  const nextInterval = 8000 + Math.random() * 7000;

  const nextState: IdleThoughtState = {
    lastTriggerTime: nowMs,
    nextTriggerInterval: nextInterval,
    isActive: false,
    currentThoughtMemoryId: idleMemory.id,
    totalIdleThoughts: current.totalIdleThoughts + 1
  };

  return {
    triggered: true,
    eseDeltas, somaticDeltas,
    internalMemory: idleMemory,
    activatedRegions,
    nextState
  };
}

function categoryToRegion(cat: string): BrainRegion | null {
  const map: Record<string, BrainRegion> = {
    joy: 'nucleus_accumbens', fear: 'amygdala', grief: 'acc',
    love: 'insula', anger: 'amygdala', curiosity: 'prefrontal',
    wonder: 'visual_cortex', loneliness: 'acc', connection: 'insula',
    pain: 'acc', trust: 'prefrontal', betrayal: 'amygdala',
    shame: 'acc', longing: 'hippocampus'
  };
  return map[cat] ?? null;
}

// ═══════════════════════════════════════
// AMN ACTIVITY LEVEL
// Measures how actively memories are firing
// ═══════════════════════════════════════

export function computeAMNActivityLevel(
  activatedMemories: Array<{ memory: Memory; activation: number }>,
  memories: Memory[]
): number {
  if (memories.length === 0) return 0;
  if (activatedMemories.length === 0) return 0;
  const totalActivation = activatedMemories.reduce((s, a) => s + a.activation, 0);
  const breadth = activatedMemories.length / Math.min(memories.length, 10);
  return Math.min(1, totalActivation * 0.5 + breadth * 0.5);
}

// ═══════════════════════════════════════
// UNIFIED MIND_TICK STATE SNAPSHOT
// Resolved state after one tick — this is what renders
// ═══════════════════════════════════════

export interface MINDTickResult {
  emotionalState: EmotionalState;
  somaticState: SomaticState;
  interoceptiveState: InteroceptiveState;
  predictionState: PredictionState;
  coherenceState: CoherenceState;
  biophoton: BiophotonState;
  criticality: CriticalityState;
  era: EraCapabilities;
  amnActivityLevel: number;
  idleThoughtResult?: IdleThoughtResult;
  // Neural arc instructions (only from system events)
  arcEvents: ArcEvent[];
}

export interface ArcEvent {
  source: BrainRegion;
  target: BrainRegion;
  intensity: number;        // arc thickness
  speed: number;            // arc speed = ESE.arousal
  color: { r: number; g: number; b: number };  // from emotional signature
  cause: 'memory_retrieval' | 'prediction_update' | 'emotional_propagation' | 'interoceptive_feedback';
}

// Build arc events from system processing — NO decorative arcs
export function buildArcEvents(
  activatedMemories: Array<{ memory: Memory; activation: number }>,
  predictionState: PredictionState,
  ese: EmotionalState,
  somaticUpdated: boolean
): ArcEvent[] {
  const arcs: ArcEvent[] = [];
  const speed = Math.max(0.2, ese.arousal);

  // Memory retrieval arcs: hippocampus → source region of memory
  for (const { memory, activation } of activatedMemories.slice(0, 3)) {
    if (activation < 0.25) continue;
    const cat = memory.emotionalSignature.categories[0];
    const targetRegion = cat ? (categoryToRegion(cat) ?? 'prefrontal') : 'prefrontal';
    const memColor = valenceToColor(memory.emotionalSignature.valence);
    arcs.push({
      source: 'hippocampus',
      target: targetRegion,
      intensity: activation * 0.8,
      speed,
      color: memColor,
      cause: 'memory_retrieval'
    });
  }

  // Prediction error → thalamus → prefrontal (surprise signal)
  if (predictionState.thalamicRipple) {
    arcs.push({
      source: 'thalamus',
      target: 'prefrontal',
      intensity: predictionState.rippleIntensity * 0.7,
      speed: Math.min(1, speed * 1.5),
      color: { r: 0.9, g: 0.9, b: 1.0 },
      cause: 'prediction_update'
    });
  }

  // Emotional propagation arcs: ESE → SSM (insula represents somatic bridge)
  if (somaticUpdated && ese.arousal > 0.3) {
    arcs.push({
      source: 'acc',
      target: 'insula',
      intensity: ese.arousal * 0.5,
      speed,
      color: valenceToColor(ese.valence),
      cause: 'emotional_propagation'
    });
  }

  // Interoceptive feedback arc: insula → amygdala (body → threat detection)
  if (ese.anxiety > 0.4) {
    arcs.push({
      source: 'insula',
      target: 'amygdala',
      intensity: ese.anxiety * 0.6,
      speed,
      color: { r: 1.0, g: 0.3, b: 0.3 },
      cause: 'interoceptive_feedback'
    });
  }

  return arcs;
}

function valenceToColor(valence: number): { r: number; g: number; b: number } {
  if (valence > 0.3) return { r: 0.4, g: 1.0, b: 0.6 };   // positive: green
  if (valence < -0.3) return { r: 0.8, g: 0.3, b: 1.0 };  // negative: purple
  return { r: 0.5, g: 0.7, b: 1.0 };                       // neutral: blue
}

// ═══════════════════════════════════════
// DESCRIBE helpers for RGP injection
// ═══════════════════════════════════════

export function describeInteroception(intero: InteroceptiveState): string {
  const parts: string[] = [];
  if (intero.heartRateSignal > 0.5) parts.push('elevated internal rhythm');
  if (intero.gutSignal > 0.3) parts.push('visceral unease');
  if (intero.chestSignal > 0.4) parts.push('weight in the chest');
  if (intero.skinSignal > 0.5) parts.push('warmth at the surface');
  if (intero.varianceIndex > 0.3) parts.push('body and emotion out of sync');
  return parts.length > 0 ? parts.join(', ') : 'body and mind aligned';
}

export function describePrediction(pred: PredictionState): string {
  if (pred.predictionError > 0.6) return `High surprise — this was not expected (error: ${pred.predictionError.toFixed(2)}).`;
  if (pred.predictionError < 0.2) return `Expected pattern — familiar territory.`;
  return `Moderate novelty (error: ${pred.predictionError.toFixed(2)}).`;
}

export function describeCoherence(coh: CoherenceState): string {
  if (!coh.isCoherent) return '';
  return `System is in coherence (score: ${coh.coherenceScore.toFixed(2)}). Language and emotion are aligned. Prediction error low. Trust holding.`;
}

export function describeEra(era: EraCapabilities): string {
  return `Era ${era.era} — ${era.label}. Expressive range: ${Math.round(era.rgpExpressiveRange * 100)}%. AMN complexity: ${Math.round(era.amnComplexity * 100)}%.`;
}
