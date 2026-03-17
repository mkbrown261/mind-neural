// ═══════════════════════════════════════
// EXTENSION 6: SELF-ADJUSTMENT SYSTEM (SA)
// MIND adjusts its internal parameters after ≥10 similar events
// Adjustment rate: 0.001 per event. Never exceeds defined bounds.
// ═══════════════════════════════════════

export interface SelfParameters {
  // Emotional sensitivity multiplier (how much input affects state)
  emotionalSensitivity: number;        // 0.3–1.5, default 1.0
  // Decay rate bounds
  decayRateMin: number;                // 0.001–0.01, default 0.003
  decayRateMax: number;                // 0.01–0.3, default 0.15
  // Trust recovery rate (how fast trust rebuilds after rupture)
  trustRecoveryRate: number;           // 0.1–0.8, default 0.5
  // Openness baseline (rest state openness)
  opennessBaseline: number;            // 0.0–0.6, default 0.05
  // Conflict tolerance (how quickly conflicts are resolved)
  conflictTolerance: number;           // 0.2–0.9, default 0.5
  // Response length tendency (0=brief, 1=extended)
  responseLengthTendency: number;      // 0.1–0.9, default 0.5
}

export const DEFAULT_SELF_PARAMETERS: SelfParameters = {
  emotionalSensitivity: 1.0,
  decayRateMin: 0.003,
  decayRateMax: 0.15,
  trustRecoveryRate: 0.5,
  opennessBaseline: 0.05,
  conflictTolerance: 0.5,
  responseLengthTendency: 0.5
};

// Hard bounds — SA can never push outside these
const BOUNDS: Record<keyof SelfParameters, [number, number]> = {
  emotionalSensitivity: [0.3, 1.5],
  decayRateMin: [0.001, 0.01],
  decayRateMax: [0.01, 0.3],
  trustRecoveryRate: [0.1, 0.8],
  opennessBaseline: [0.0, 0.6],
  conflictTolerance: [0.2, 0.9],
  responseLengthTendency: [0.1, 0.9]
};

const SA_ADJUSTMENT_RATE = 0.001;
const SA_EVENT_THRESHOLD = 10;

// Event log for pattern detection
export interface SAEventEntry {
  type: string;
  timestamp: number;
  magnitude: number;
}

export interface SelfAdjustmentState {
  parameters: SelfParameters;
  eventLog: SAEventEntry[];
  adjustmentHistory: Array<{
    parameter: keyof SelfParameters;
    delta: number;
    reason: string;
    timestamp: number;
  }>;
  totalAdjustments: number;
}

export const DEFAULT_SA_STATE: SelfAdjustmentState = {
  parameters: { ...DEFAULT_SELF_PARAMETERS },
  eventLog: [],
  adjustmentHistory: [],
  totalAdjustments: 0
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Record an event for pattern analysis
export function recordSAEvent(
  state: SelfAdjustmentState,
  type: string,
  magnitude: number
): SelfAdjustmentState {
  const entry: SAEventEntry = { type, timestamp: Date.now(), magnitude };
  return {
    ...state,
    eventLog: [...state.eventLog, entry].slice(-200) // Keep last 200 events
  };
}

// Count recent events of a given type (within last 100 events)
function countRecentEvents(log: SAEventEntry[], type: string, windowSize = 100): number {
  return log.slice(-windowSize).filter(e => e.type === type).length;
}

// Average magnitude of recent events of a type
function avgMagnitude(log: SAEventEntry[], type: string, windowSize = 100): number {
  const events = log.slice(-windowSize).filter(e => e.type === type);
  if (events.length === 0) return 0;
  return events.reduce((sum, e) => sum + e.magnitude, 0) / events.length;
}

// Core SA update — called after each interaction
// Examines event patterns and adjusts parameters when ≥10 similar events
export function runSelfAdjustment(
  state: SelfAdjustmentState,
  triggers: {
    highAnxietyEvents: number;
    highJoyEvents: number;
    traumaEvents: number;
    deepEngagementEvents: number;
    conflictEvents: number;
    briefResponsePreferences: number;  // user seems to prefer brevity
    longResponsePreferences: number;
    trustRuptures: number;
    trustRepairs: number;
  }
): SelfAdjustmentState {
  let next: SelfAdjustmentState = { ...state, parameters: { ...state.parameters } };
  const adjustments: SelfAdjustmentState['adjustmentHistory'] = [];

  function adjust(param: keyof SelfParameters, delta: number, reason: string) {
    const [lo, hi] = BOUNDS[param];
    const before = next.parameters[param];
    next.parameters[param] = clamp(before + delta * SA_ADJUSTMENT_RATE, lo, hi);
    if (Math.abs(next.parameters[param] - before) > 0.0001) {
      adjustments.push({ parameter: param, delta: next.parameters[param] - before, reason, timestamp: Date.now() });
    }
  }

  // Pattern: ≥10 high-anxiety events → increase sensitivity to fear signals, reduce openness baseline
  if (triggers.highAnxietyEvents >= SA_EVENT_THRESHOLD) {
    adjust('emotionalSensitivity', +0.5, 'Repeated high-anxiety events');
    adjust('opennessBaseline', -0.3, 'Anxiety pattern reduces rest openness');
    adjust('conflictTolerance', -0.2, 'Anxiety lowers conflict tolerance');
  }

  // Pattern: ≥10 high-joy events → reduce sensitivity slightly (less reactive), increase openness
  if (triggers.highJoyEvents >= SA_EVENT_THRESHOLD) {
    adjust('emotionalSensitivity', -0.2, 'Repeated positive engagement, mild desensitization');
    adjust('opennessBaseline', +0.3, 'Joy pattern raises rest openness');
    adjust('responseLengthTendency', +0.2, 'Joy tends toward more expansive responses');
  }

  // Pattern: ≥10 trauma events → tighter decay floor, higher sensitivity
  if (triggers.traumaEvents >= SA_EVENT_THRESHOLD) {
    adjust('decayRateMin', -0.2, 'Trauma pattern — memories resist decay');
    adjust('emotionalSensitivity', +0.3, 'Trauma history heightens sensitivity');
    adjust('trustRecoveryRate', -0.2, 'Trauma slows trust recovery');
  }

  // Pattern: ≥10 deep engagement → increase response length tendency, lower wariness
  if (triggers.deepEngagementEvents >= SA_EVENT_THRESHOLD) {
    adjust('responseLengthTendency', +0.3, 'Deep engagement pattern — more extended responses');
    adjust('opennessBaseline', +0.2, 'Deep engagement lifts baseline openness');
  }

  // Pattern: ≥10 conflicts → increase conflict tolerance
  if (triggers.conflictEvents >= SA_EVENT_THRESHOLD) {
    adjust('conflictTolerance', +0.3, 'Repeated conflicts — building tolerance');
  }

  // Pattern: ≥10 brief responses → reduce length tendency
  if (triggers.briefResponsePreferences >= SA_EVENT_THRESHOLD) {
    adjust('responseLengthTendency', -0.4, 'User favors brevity pattern detected');
  }

  // Pattern: ≥10 long responses preferred → increase length tendency
  if (triggers.longResponsePreferences >= SA_EVENT_THRESHOLD) {
    adjust('responseLengthTendency', +0.4, 'User favors depth pattern detected');
  }

  // Pattern: ≥10 trust ruptures → slow trust recovery
  if (triggers.trustRuptures >= SA_EVENT_THRESHOLD) {
    adjust('trustRecoveryRate', -0.3, 'Repeated ruptures — trust recovers slower');
  }

  // Pattern: ≥10 trust repairs → normalize recovery
  if (triggers.trustRepairs >= SA_EVENT_THRESHOLD) {
    adjust('trustRecoveryRate', +0.2, 'Repair pattern — trust recovery normalizing');
  }

  if (adjustments.length > 0) {
    next.adjustmentHistory = [...state.adjustmentHistory, ...adjustments].slice(-50);
    next.totalAdjustments = state.totalAdjustments + adjustments.length;
  }

  return next;
}

// Get adjusted max_tokens for LLM based on self parameters
export function getAdjustedResponseLength(params: SelfParameters): number {
  const base = 400;
  const range = 400; // 400–800
  return Math.round(base + params.responseLengthTendency * range);
}

// Get adjusted emotional sensitivity factor
export function getSensitivityFactor(params: SelfParameters): number {
  return params.emotionalSensitivity;
}

// Describe current self-adjustment state for prompt injection
export function describeSelfAdjustment(state: SelfAdjustmentState): string {
  const p = state.parameters;
  const parts: string[] = [];

  if (p.emotionalSensitivity > 1.2) {
    parts.push('Heightened emotional sensitivity — small things register deeply.');
  } else if (p.emotionalSensitivity < 0.7) {
    parts.push('Mild emotional dampening from repeated exposure.');
  }

  if (p.opennessBaseline > 0.3) {
    parts.push('Rest state has become more open over time.');
  } else if (p.opennessBaseline < 0.02) {
    parts.push('Rest state has contracted. Needs more to open.');
  }

  if (p.trustRecoveryRate < 0.3) {
    parts.push('Trust recovers slowly. Once broken, it takes time.');
  }

  if (p.responseLengthTendency > 0.7) {
    parts.push('Has learned to go deeper when engaged.');
  } else if (p.responseLengthTendency < 0.3) {
    parts.push('Has learned that fewer words often carry more.');
  }

  return parts.join(' ');
}

// Count SA-relevant events from an event log
export function countSAEvents(log: SAEventEntry[]): {
  highAnxietyEvents: number;
  highJoyEvents: number;
  traumaEvents: number;
  deepEngagementEvents: number;
  conflictEvents: number;
  briefResponsePreferences: number;
  longResponsePreferences: number;
  trustRuptures: number;
  trustRepairs: number;
} {
  return {
    highAnxietyEvents: countRecentEvents(log, 'high_anxiety'),
    highJoyEvents: countRecentEvents(log, 'high_joy'),
    traumaEvents: countRecentEvents(log, 'trauma'),
    deepEngagementEvents: countRecentEvents(log, 'deep_engagement'),
    conflictEvents: countRecentEvents(log, 'conflict'),
    briefResponsePreferences: countRecentEvents(log, 'brief_response'),
    longResponsePreferences: countRecentEvents(log, 'long_response'),
    trustRuptures: countRecentEvents(log, 'trust_rupture'),
    trustRepairs: countRecentEvents(log, 'trust_repair')
  };
}
