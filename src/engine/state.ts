// ═══════════════════════════════════════
// SYSTEM 2: EMOTIONAL STATE ENGINE (ESE) + SOMATIC STATE MODEL (SSM)
// ═══════════════════════════════════════

import { SomaticState } from './memory';

export interface EmotionalState {
  valence: number;      // -1.0 to +1.0
  arousal: number;      // 0.0 to 1.0
  trust: number;        // 0.0 to 1.0
  openness: number;     // 0.0 to 1.0
  anxiety: number;      // 0.0 to 1.0
  longing: number;      // 0.0 to 1.0
  wonder: number;       // 0.0 to 1.0
  grief: number;        // 0.0 to 1.0
  warmth: number;       // 0.0 to 1.0
  wariness: number;     // 0.0 to 1.0
}

export interface EmotionalStateWithSomatic {
  emotional: EmotionalState;
  somatic: SomaticState;
  baseline: EmotionalState;
}

export const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  valence: 0.0,
  arousal: 0.05,
  trust: 0.0,
  openness: 0.05,
  anxiety: 0.05,
  longing: 0.0,
  wonder: 0.05,
  grief: 0.0,
  warmth: 0.0,
  wariness: 0.3
};

export const DEFAULT_SOMATIC_STATE: SomaticState = {
  tension: 0.2,
  warmth: 0.1,
  weight: 0.3,
  expansion: 0.2,
  stillness: 0.5,
  openness: 0.2
};

export const DEFAULT_BASELINE: EmotionalState = { ...DEFAULT_EMOTIONAL_STATE };

function clamp(v: number, lo = 0.0, hi = 1.0): number {
  return Math.max(lo, Math.min(hi, v));
}

// Momentum-based emotional state update
export function updateEmotionalState(
  current: EmotionalState,
  delta: Partial<EmotionalState>,
  momentum: number = 0.15
): EmotionalState {
  const next: EmotionalState = { ...current };
  for (const key of Object.keys(delta) as Array<keyof EmotionalState>) {
    const d = (delta[key] ?? 0);
    const target = clamp(current[key] + d, key === 'valence' ? -1 : 0, 1);
    next[key] = current[key] + (target - current[key]) * momentum;
    next[key] = key === 'valence'
      ? clamp(next[key], -1, 1)
      : clamp(next[key]);
  }
  return next;
}

// Drift baseline slowly based on cumulative experience
export function driftBaseline(
  baseline: EmotionalState,
  experience: Partial<EmotionalState>,
  rate: number = 0.001
): EmotionalState {
  const next: EmotionalState = { ...baseline };
  for (const key of Object.keys(experience) as Array<keyof EmotionalState>) {
    const d = (experience[key] ?? 0) * rate;
    next[key] = key === 'valence'
      ? clamp(next[key] + d, -1, 1)
      : clamp(next[key] + d);
  }
  return next;
}

// Partial decay toward baseline between sessions
export function decayTowardBaseline(
  state: EmotionalState,
  baseline: EmotionalState,
  decayRate: number = 0.05
): EmotionalState {
  const next: EmotionalState = { ...state };
  for (const key of Object.keys(state) as Array<keyof EmotionalState>) {
    next[key] = state[key] + (baseline[key] - state[key]) * decayRate;
    next[key] = key === 'valence'
      ? clamp(next[key], -1, 1)
      : clamp(next[key]);
  }
  return next;
}

// Update somatic state from emotional state
export function somaticFromEmotional(emotional: EmotionalState): SomaticState {
  return {
    tension: clamp(emotional.anxiety * 0.7 + emotional.wariness * 0.3),
    warmth: clamp(emotional.warmth * 0.8 + (emotional.valence > 0 ? emotional.valence * 0.2 : 0)),
    weight: clamp(emotional.grief * 0.6 + (1 - emotional.arousal) * 0.3 + emotional.longing * 0.1),
    expansion: clamp(emotional.openness * 0.5 + emotional.wonder * 0.3 + (emotional.valence > 0 ? emotional.valence * 0.2 : 0)),
    stillness: clamp(1 - emotional.arousal * 0.7 - emotional.anxiety * 0.3),
    openness: clamp(emotional.openness * 0.6 + emotional.trust * 0.3 + emotional.warmth * 0.1)
  };
}

// Describe somatic state in text (for prompt injection)
export function describeSomatic(s: SomaticState): string {
  const parts: string[] = [];
  if (s.tension > 0.6) parts.push('tight, guarded');
  if (s.warmth > 0.6) parts.push('warm, present');
  if (s.weight > 0.6) parts.push('heavy, weighted');
  if (s.expansion > 0.6) parts.push('open, expansive');
  if (s.stillness > 0.7) parts.push('still, quiet');
  if (s.openness > 0.6) parts.push('receptive');
  return parts.length > 0 ? parts.join(', ') : 'neutral';
}

// Map emotion delta from detected emotions in text
export function emotionDeltaFromDetection(detected: Record<string, number>): Partial<EmotionalState> {
  const delta: Partial<EmotionalState> = {};
  const e = detected;

  delta.valence = 0;
  if (e.joy) delta.valence = (delta.valence ?? 0) + e.joy * 0.3;
  if (e.love) delta.valence = (delta.valence ?? 0) + e.love * 0.2;
  if (e.fear) delta.valence = (delta.valence ?? 0) - e.fear * 0.25;
  if (e.anger) delta.valence = (delta.valence ?? 0) - e.anger * 0.2;
  if (e.sadness) delta.valence = (delta.valence ?? 0) - e.sadness * 0.2;

  delta.arousal = 0;
  if (e.joy) delta.arousal = (delta.arousal ?? 0) + e.joy * 0.2;
  if (e.fear) delta.arousal = (delta.arousal ?? 0) + e.fear * 0.3;
  if (e.anger) delta.arousal = (delta.arousal ?? 0) + e.anger * 0.25;
  if (e.sadness) delta.arousal = (delta.arousal ?? 0) - e.sadness * 0.1;

  if (e.fear) delta.anxiety = e.fear * 0.4;
  if (e.anger) delta.anxiety = (delta.anxiety ?? 0) + e.anger * 0.2;
  if (e.sadness) delta.grief = e.sadness * 0.3;
  if (e.wonder) delta.wonder = e.wonder * 0.3;
  if (e.love) delta.warmth = e.love * 0.3;
  if (e.curiosity) { delta.wonder = (delta.wonder ?? 0) + e.curiosity * 0.2; delta.openness = e.curiosity * 0.2; }
  if (e.connection) { delta.trust = e.connection * 0.15; delta.warmth = (delta.warmth ?? 0) + e.connection * 0.2; }
  if (e.longing) delta.longing = e.longing * 0.3;
  if (e.memory) delta.longing = (delta.longing ?? 0) + e.memory * 0.15;

  return delta;
}
