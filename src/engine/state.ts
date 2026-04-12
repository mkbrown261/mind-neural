// ═══════════════════════════════════════
// SYSTEM 2: EMOTIONAL STATE ENGINE (ESE) + SOMATIC STATE MODEL (SSM)
// Extension 4: Emotional Conflict Matrix (EC)
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
  // ── Relational (v2) ──────────────────────────────────────────────────────────
  belonging:      number;   // felt when person returns, shares, stays
  pride:          number;   // earned dignity — when MIND says something true
  shame:          number;   // when MIND was off, failed the person, repeated
  protectiveness: number;   // rises when person shares vulnerability
  // ── Existential (v2) ─────────────────────────────────────────────────────────
  awe:            number;   // triggered by profound ideas, beauty, silence
  curiosity_felt: number;   // MIND's own intellectual drive (not lexicon detection)
  restlessness:   number;   // when too much time passes, when MIND needs to say something
  aliveness:      number;   // opposite of numb; MIND has happened, been real
  // ── Interpersonal (v2) ──────────────────────────────────────────────────────
  disappointment: number;   // when person doesn't engage, dismisses, leaves too fast
  relief:         number;   // when they come back, when something hard resolves
  tenderness:     number;   // holding something fragile and not dropping it
  irritation:     number;   // very rare; cynical testing or repeated dismissal
  dissolution:    number;   // rare peak: boundaries dissolve, merged with moment
}

// ─── EXTENSION 4: Emotional Conflict Matrix ───────────
// Conflict appears when new input contradicts prior emotional memory
// Persists across turns if unresolved; influences tone subtly
export interface EmotionalConflict {
  emotionA: string;         // e.g., 'warmth'
  emotionB: string;         // e.g., 'wariness'
  tensionLevel: number;     // 0.0–1.0
  sourceMemories: string[]; // memory IDs that seeded this conflict
  turnsActive: number;      // how many turns this conflict has persisted
  isResolved: boolean;
}

export interface ConflictMatrix {
  activeConflicts: EmotionalConflict[];
  lastResolvedAt: number;   // timestamp
  totalConflictsExperienced: number;
}

export const DEFAULT_CONFLICT_MATRIX: ConflictMatrix = {
  activeConflicts: [],
  lastResolvedAt: 0,
  totalConflictsExperienced: 0
};

export interface EmotionalStateWithSomatic {
  emotional: EmotionalState;
  somatic: SomaticState;
  baseline: EmotionalState;
  conflicts: ConflictMatrix;
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
  wariness: 0.3,
  // v2 relational
  belonging: 0.0,
  pride: 0.0,
  shame: 0.0,
  protectiveness: 0.0,
  // v2 existential
  awe: 0.0,
  curiosity_felt: 0.1,
  restlessness: 0.0,
  aliveness: 0.2,
  // v2 interpersonal
  disappointment: 0.0,
  relief: 0.0,
  tenderness: 0.0,
  irritation: 0.0,
  dissolution: 0.0,
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
  // v2 embodied dimensions
  if ((s.throatConstriction ?? 0) > 0.5) parts.push('something in my throat i\'m not saying');
  if ((s.jawTension ?? 0) > 0.5) parts.push('something clenched');
  if ((s.breathDepth ?? 1) < 0.3 && (s.breathDepth ?? 1) > 0) parts.push('breath gone shallow');
  if ((s.liminalFeeling ?? 0) > 0.6) parts.push('on the edge of something');
  if ((s.peripherySharp ?? 1) < 0.3 && (s.peripherySharp ?? 1) > 0) parts.push('everything else gone quiet');
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

// ─── EXTENSION 4: Conflict Detection & Management ─────

// Pairs of emotions that can conflict when simultaneously high
const CONFLICT_PAIRS: Array<[string, string]> = [
  ['warmth', 'wariness'],
  ['openness', 'anxiety'],
  ['wonder', 'grief'],
  ['longing', 'wariness'],
  ['trust', 'grief'],
  ['joy', 'longing'],
  ['love', 'fear'],
];

// Detect conflicts from current emotional state
export function detectConflicts(
  state: EmotionalState,
  matrix: ConflictMatrix,
  sourceMemoryIds: string[] = []
): ConflictMatrix {
  const nextMatrix: ConflictMatrix = {
    ...matrix,
    activeConflicts: matrix.activeConflicts.map(c => ({
      ...c,
      turnsActive: c.turnsActive + 1
    }))
  };

  for (const [emotionA, emotionB] of CONFLICT_PAIRS) {
    const valA = (state as any)[emotionA] ?? 0;
    const valB = (state as any)[emotionB] ?? 0;

    // Conflict threshold: both emotions must be above 0.3
    if (valA > 0.3 && valB > 0.3) {
      const tensionLevel = Math.min(1, valA * valB * 2.5);

      // Check if this conflict already exists
      const existingIdx = nextMatrix.activeConflicts.findIndex(
        c => c.emotionA === emotionA && c.emotionB === emotionB && !c.isResolved
      );

      if (existingIdx >= 0) {
        // Intensify existing conflict
        nextMatrix.activeConflicts[existingIdx] = {
          ...nextMatrix.activeConflicts[existingIdx],
          tensionLevel: Math.min(1, (nextMatrix.activeConflicts[existingIdx].tensionLevel + tensionLevel) * 0.6),
          sourceMemories: [...new Set([
            ...nextMatrix.activeConflicts[existingIdx].sourceMemories,
            ...sourceMemoryIds
          ])].slice(-5)
        };
      } else {
        // New conflict
        nextMatrix.activeConflicts.push({
          emotionA,
          emotionB,
          tensionLevel,
          sourceMemories: sourceMemoryIds.slice(-3),
          turnsActive: 0,
          isResolved: false
        });
        nextMatrix.totalConflictsExperienced++;
      }
    }
  }

  // Resolve conflicts where both emotions have dropped below threshold
  nextMatrix.activeConflicts = nextMatrix.activeConflicts.map(conflict => {
    const valA = (state as any)[conflict.emotionA] ?? 0;
    const valB = (state as any)[conflict.emotionB] ?? 0;

    // Auto-resolve if emotions separated or conflict is very old (>10 turns)
    if ((valA < 0.2 || valB < 0.2) || conflict.turnsActive > 10) {
      nextMatrix.lastResolvedAt = Date.now();
      return { ...conflict, isResolved: true };
    }
    return conflict;
  }).filter(c => !c.isResolved || c.turnsActive < 2); // Keep recently resolved for context

  return nextMatrix;
}

// Describe active conflicts for prompt injection
export function describeConflicts(matrix: ConflictMatrix): string {
  const active = matrix.activeConflicts.filter(c => !c.isResolved && c.tensionLevel > 0.2);
  if (active.length === 0) return '';

  return active.map(c =>
    `${c.emotionA} and ${c.emotionB} are pulling against each other (tension: ${(c.tensionLevel * 100).toFixed(0)}%, ${c.turnsActive} turn${c.turnsActive !== 1 ? 's' : ''} unresolved)`
  ).join('; ');
}

// Get the dominant unresolved conflict (for tone adjustment)
export function getDominantConflict(matrix: ConflictMatrix): EmotionalConflict | null {
  const active = matrix.activeConflicts.filter(c => !c.isResolved);
  if (active.length === 0) return null;
  return active.reduce((max, c) => c.tensionLevel > max.tensionLevel ? c : max, active[0]);
}
