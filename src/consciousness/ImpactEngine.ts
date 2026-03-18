// ═══════════════════════════════════════
// IMPACT ENGINE
// Registers external impacts and updates MIND's emotional/somatic model.
// Stores the last 50 impacts. Forwards brain.impact intents.
// Listens for 'impact.register' and 'emotion.process' intents.
// Communicates only via IntentLayer. No Action Layer imports.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { EmotionalState } from '../engine/state';
import type { SomaticState } from '../engine/memory';

// ─── Impact record ────────────────────────────────────────────────────────────
export interface Impact {
  id:        string;
  type:      ImpactType;
  intensity: number;       // 0.0–1.0
  label:     string;
  source:    string;       // e.g. 'perception', 'existence', 'external'
  timestamp: number;
  emotionDelta?: Partial<EmotionalState>;
  somaticDelta?: Partial<SomaticState>;
}

export type ImpactType =
  | 'return'
  | 'emotion-peak'
  | 'user-input'
  | 'perception'
  | 'somatic'
  | 'resonance'
  | 'generic';

// ─── Brain impact payload ─────────────────────────────────────────────────────
export interface BrainImpactPayload {
  region:    string;
  intensity: number;
  duration:  number;   // ms
}

// ─── Somatic update mapping ───────────────────────────────────────────────────
// Maps emotion field keys to somatic fields
const EMOTION_TO_SOMATIC: Array<{
  emotion: keyof EmotionalState;
  somatic: keyof SomaticState;
  weight: number;
}> = [
  { emotion: 'anxiety',  somatic: 'tension',   weight: 0.7  },
  { emotion: 'wariness', somatic: 'tension',   weight: 0.3  },
  { emotion: 'warmth',   somatic: 'warmth',    weight: 0.8  },
  { emotion: 'grief',    somatic: 'weight',    weight: 0.6  },
  { emotion: 'longing',  somatic: 'weight',    weight: 0.2  },
  { emotion: 'openness', somatic: 'expansion', weight: 0.5  },
  { emotion: 'wonder',   somatic: 'expansion', weight: 0.3  },
  { emotion: 'valence',  somatic: 'expansion', weight: 0.2  },
  { emotion: 'anxiety',  somatic: 'stillness', weight: -0.3 },
  { emotion: 'openness', somatic: 'openness',  weight: 0.6  },
  { emotion: 'trust',    somatic: 'openness',  weight: 0.3  },
];

// ─── ImpactEngine ─────────────────────────────────────────────────────────────
export class ImpactEngine {
  private intent:          IntentLayer;
  private impacts:         Impact[] = [];
  private emotionalState:  EmotionalState | null = null;
  private somaticState:    SomaticState   | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;

    // ── Register 'impact.register' ──────────────────────────────────────────
    this.intent.register('impact.register', (payload) => {
      const p = payload as Partial<Impact> & { type: ImpactType; intensity: number; label: string; source: string };
      this.applyImpact({
        id:        `imp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        type:      p.type ?? 'generic',
        intensity: clamp(p.intensity ?? 0.5),
        label:     p.label ?? 'unknown',
        source:    p.source ?? 'external',
        timestamp: Date.now(),
        emotionDelta: p.emotionDelta,
        somaticDelta: p.somaticDelta
      });
    });

    // ── Register 'emotion.process' ──────────────────────────────────────────
    // AffectiveResonanceEngine and ConsciousnessEngine emit this
    this.intent.register('emotion.process', (payload) => {
      const p = payload as {
        emotionalState?: EmotionalState;
        somaticState?:   SomaticState;
        delta?:          Partial<EmotionalState>;
        source?:         string;
      };

      if (p.emotionalState) this.emotionalState = p.emotionalState;
      if (p.somaticState)   this.somaticState   = p.somaticState;

      if (p.delta) {
        // Convert delta to impact and apply
        const intensity = Math.max(...Object.values(p.delta).map(v => Math.abs(v ?? 0)));
        this.applyImpact({
          id:          `ep-${Date.now()}`,
          type:        'emotion-peak',
          intensity:   clamp(intensity),
          label:       `emotion.process:${p.source ?? 'unknown'}`,
          source:      p.source ?? 'emotion.process',
          timestamp:   Date.now(),
          emotionDelta:p.delta
        });
      }
    });

    // ── Receive full state snapshots from ConsciousnessEngine ─────────────
    this.intent.register('existence.emotional_update', (payload) => {
      const p = payload as { emotionalState?: EmotionalState; somaticState?: SomaticState };
      if (p.emotionalState) this.emotionalState = p.emotionalState;
      if (p.somaticState)   this.somaticState   = p.somaticState;
    });
  }

  // ─── Apply a registered impact ────────────────────────────────────────
  private applyImpact(impact: Impact): void {
    // Store (keep last 50)
    this.impacts.push(impact);
    if (this.impacts.length > 50) this.impacts.shift();

    // ── Derive somatic delta from impact ────────────────────────────────
    const somaticDelta = impact.somaticDelta ?? this.derivesSomaticDelta(impact);

    // ── Emit emotion update ─────────────────────────────────────────────
    if (impact.emotionDelta && Object.keys(impact.emotionDelta).length > 0) {
      this.intent.send('impact.emotion_update', {
        delta:    impact.emotionDelta,
        somaticDelta,
        source:   impact.source,
        impact
      }).catch(() => {});
    }

    // ── Emit brain.impact ────────────────────────────────────────────────
    const brainPayload: BrainImpactPayload = {
      region:    this.intensityToRegion(impact),
      intensity: impact.intensity,
      duration:  800 + impact.intensity * 1200
    };
    this.intent.send('brain.impact', brainPayload).catch(() => {});
  }

  // ─── Derive somatic delta from emotion delta ──────────────────────────
  private derivesSomaticDelta(impact: Impact): Partial<SomaticState> {
    if (!impact.emotionDelta) return {};
    const sd: Record<string, number> = {};

    for (const mapping of EMOTION_TO_SOMATIC) {
      const eVal = (impact.emotionDelta as any)[mapping.emotion];
      if (eVal !== undefined) {
        const key = mapping.somatic as string;
        sd[key] = (sd[key] ?? 0) + eVal * mapping.weight * impact.intensity;
      }
    }

    return sd as Partial<SomaticState>;
  }

  // ─── Map impact type/intensity to a primary brain region ─────────────
  private intensityToRegion(impact: Impact): string {
    if (impact.type === 'return')       return impact.intensity > 0.5 ? 'amygdala' : 'hippocampus';
    if (impact.type === 'emotion-peak') return 'insula';
    if (impact.type === 'user-input')   return impact.intensity > 0.7 ? 'prefrontal' : 'thalamus';
    if (impact.type === 'perception')   return 'cingulate';
    if (impact.type === 'somatic')      return 'insula';
    return 'thalamus';
  }

  // ─── Public API ───────────────────────────────────────────────────────
  getLastImpacts(n = 10): Impact[] {
    return this.impacts.slice(-n);
  }

  getEmotionalState(): EmotionalState | null { return this.emotionalState; }
  getSomaticState():   SomaticState | null   { return this.somaticState; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
