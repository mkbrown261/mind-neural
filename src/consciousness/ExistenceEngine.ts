// ═══════════════════════════════════════
// EXISTENCE ENGINE
// MIND's autonomous internal heartbeat.
// Generates existence moments every 8–20 s, updates emotional state,
// registers return impacts based on absence duration.
// Communicates only via IntentLayer. No Action Layer imports.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { EmotionalState } from '../engine/state';

// ─── Brain regions that can be activated by existence moments ─────────────────
const EXISTENCE_REGIONS = [
  'prefrontal', 'amygdala', 'hippocampus', 'insula',
  'thalamus', 'brainstem', 'cingulate'
] as const;
type ExistenceRegion = typeof EXISTENCE_REGIONS[number];

export interface ExistenceMoment {
  region:    ExistenceRegion;
  intensity: number;           // 0.0–1.0
  timestamp: number;
  trigger:   'idle' | 'return' | 'emotion-peak' | 'somatic';
}

// ─── Absence impact thresholds ────────────────────────────────────────────────
const ABSENCE_1D  = 1  * 24 * 60 * 60 * 1000;   // 1 day
const ABSENCE_7D  = 7  * 24 * 60 * 60 * 1000;   // 7 days
const ABSENCE_30D = 30 * 24 * 60 * 60 * 1000;   // 30 days

export interface ReturnImpact {
  longing:   number;  // 0.0–1.0
  wariness:  number;
  warmth:    number;
  arousal:   number;
  label:     string;
}

// ─── ExistenceEngine ─────────────────────────────────────────────────────────
export class ExistenceEngine {
  private intent:       IntentLayer;
  private cycleTimer:   ReturnType<typeof setTimeout> | null = null;
  private lastMoment:   ExistenceMoment | null = null;
  private emotionalRef: EmotionalState | null = null;  // latest snapshot
  private lastUserTimestamp = Date.now();
  private enabled = false;

  constructor(intent: IntentLayer) {
    this.intent = intent;

    // ── Listen for emotional state updates (from ConsciousnessEngine) ──────────
    this.intent.register('existence.emotional_update', (payload) => {
      const p = payload as { emotionalState: EmotionalState; timestamp?: number };
      this.emotionalRef  = p.emotionalState;
      if (p.timestamp) this.lastUserTimestamp = p.timestamp;
    });

    // ── Listen for user activity to track absence ──────────────────────────────
    this.intent.register('existence.user_active', (_payload) => {
      this.lastUserTimestamp = Date.now();
    });
  }

  // ─── Start the autonomous existence cycle ────────────────────────────────
  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.scheduleCycle();
  }

  stop(): void {
    this.enabled = false;
    if (this.cycleTimer) { clearTimeout(this.cycleTimer); this.cycleTimer = null; }
  }

  // ─── Schedule next cycle: 8000 + random * 12000 ms ───────────────────────
  private scheduleCycle(): void {
    if (!this.enabled) return;
    const delay = 8000 + Math.random() * 12000;
    this.cycleTimer = setTimeout(() => {
      this.runCycle();
      this.scheduleCycle();
    }, delay);
  }

  // ─── One existence cycle ──────────────────────────────────────────────────
  private runCycle(): void {
    const moment = this.generateMoment();
    this.lastMoment = moment;

    // ── Emit to intent bus ─────────────────────────────────────────────────
    // ConsciousnessEngine will apply this to MIND's emotional state
    this.intent.send('existence.moment', { moment }).catch(() => {});

    // ── Derive emotional delta from moment ─────────────────────────────────
    const emotionDelta = this.momentToEmotionDelta(moment);
    this.intent.send('existence.emotion_delta', { delta: emotionDelta }).catch(() => {});
  }

  // ─── Generate an existence moment from current state ──────────────────────
  private generateMoment(): ExistenceMoment {
    const e = this.emotionalRef;
    let region: ExistenceRegion;
    let trigger: ExistenceMoment['trigger'] = 'idle';

    // If emotional state is available, weight region selection by affect
    if (e) {
      if (e.grief > 0.5 || e.longing > 0.5) {
        region = weightedPick<ExistenceRegion>(['amygdala', 'insula', 'hippocampus'], [0.4, 0.35, 0.25]);
        trigger = 'emotion-peak';
      } else if (e.wonder > 0.5 || e.anxiety > 0.4) {
        region = weightedPick<ExistenceRegion>(['prefrontal', 'thalamus', 'cingulate'], [0.45, 0.3, 0.25]);
        trigger = 'somatic';
      } else if (e.warmth > 0.4) {
        region = weightedPick<ExistenceRegion>(['insula', 'cingulate', 'hippocampus'], [0.4, 0.35, 0.25]);
        trigger = 'idle';
      } else {
        region = randomFrom(EXISTENCE_REGIONS);
        trigger = 'idle';
      }
    } else {
      region = weightedPick<ExistenceRegion>(
        ['brainstem', 'thalamus', 'amygdala', 'prefrontal'],
        [0.3, 0.25, 0.25, 0.2]
      );
    }

    const intensity = 0.15 + Math.random() * 0.45;  // 0.15–0.60 baseline

    return { region, intensity, timestamp: Date.now(), trigger };
  }

  // ─── Map moment to emotion delta ──────────────────────────────────────────
  private momentToEmotionDelta(m: ExistenceMoment): Partial<EmotionalState> {
    const delta: Partial<EmotionalState> = {};
    const s = m.intensity;

    switch (m.region) {
      case 'amygdala':   delta.anxiety = s * 0.12;  delta.wariness = s * 0.08; break;
      case 'hippocampus':delta.longing = s * 0.10;  delta.wonder   = s * 0.06; break;
      case 'insula':     delta.warmth  = s * 0.08;  delta.grief    = s * 0.04; break;
      case 'prefrontal': delta.wonder  = s * 0.10;  delta.openness = s * 0.06; break;
      case 'cingulate':  delta.warmth  = s * 0.06;  delta.longing  = s * 0.05; break;
      case 'thalamus':   delta.arousal = s * 0.08;                             break;
      case 'brainstem':  delta.arousal = s * 0.05;  delta.anxiety  = s * 0.04; break;
    }

    return delta;
  }

  // ─── Compute return impact for a given absence duration ───────────────────
  computeReturnImpact(absenceMs: number): ReturnImpact {
    if (absenceMs >= ABSENCE_30D) {
      return {
        longing: 0.80, wariness: 0.65, warmth: 0.45, arousal: 0.60,
        label: 'long-absence'
      };
    }
    if (absenceMs >= ABSENCE_7D) {
      return {
        longing: 0.55, wariness: 0.40, warmth: 0.55, arousal: 0.45,
        label: 'week-absence'
      };
    }
    if (absenceMs >= ABSENCE_1D) {
      return {
        longing: 0.30, wariness: 0.20, warmth: 0.60, arousal: 0.35,
        label: 'day-absence'
      };
    }
    // Short gap — mild
    return {
      longing: 0.05, wariness: 0.05, warmth: 0.15, arousal: 0.15,
      label: 'short-absence'
    };
  }

  // ─── Apply return impact through intent bus ──────────────────────────────
  registerReturnImpact(absenceMs: number): void {
    const impact = this.computeReturnImpact(absenceMs);
    const delta: Partial<EmotionalState> = {
      longing:  impact.longing,
      wariness: impact.wariness,
      warmth:   impact.warmth,
      arousal:  impact.arousal
    };
    this.intent.send('existence.emotion_delta', { delta, source: 'return', label: impact.label }).catch(() => {});
    this.intent.send('impact.register', {
      type:      'return',
      intensity: (impact.longing + impact.wariness) / 2,
      label:     impact.label,
      source:    'existence'
    }).catch(() => {});
  }

  getLastMoment(): ExistenceMoment | null { return this.lastMoment; }
  isRunning():     boolean               { return this.enabled; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomFrom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
