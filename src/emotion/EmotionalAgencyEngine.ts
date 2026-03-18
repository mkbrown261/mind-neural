// ═══════════════════════════════════════
// LAYER 4 — EmotionalAgencyEngine
// MIND's own emotional decision layer.
// Decides HOW MIND acts on its own emotions:
//   silence | withdraw | redirect | partial_expression | full_expression
// Uses trust, era, personality traits, relationship history.
// Records events to localStorage (session-persistent, non-blocking).
// Never imports Action Layer. Communicates via IntentLayer.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { EmotionProcessPayload } from './AffectiveResonanceEngine';

// ─── Public contracts ─────────────────────────────────────────────────────────

export type AgencyAction =
  | 'silence'             // Say nothing about internal state
  | 'withdraw'            // Gently pull back from the conversation
  | 'redirect'            // Shift to asking about the user
  | 'partial_expression'  // Hint at internal state without full disclosure
  | 'full_expression';    // Openly express MIND's emotional reaction

export interface AgencyDecision {
  action:       AgencyAction;
  intensity:    number;          // 0–1 strength of expression
  triggerEmotion: string;        // what emotion drove this
  suppressionReason?: string;    // why expression was suppressed
  expressionHint?: string;       // suggested phrasing modifier for RGP
  timestamp:    number;
}

export interface AgencyEventRecord {
  decision:     AgencyDecision;
  trustAtTime:  number;
  eraAtTime:    number;
  interactionN: number;
}

// ─── MIND emotional agency context ───────────────────────────────────────────
interface AgencyContext {
  trust:        number;      // 0–1
  era:          number;      // 0–4
  openness:     number;      // 0–1 personality trait
  sensitivity:  number;      // 0–1 personality trait
  wariness:     number;      // 0–1 current emotional state
  grief:        number;      // 0–1
  interactionN: number;      // total interactions in session
}

const STORAGE_KEY = 'mind_agency_events';
const MAX_STORED_EVENTS = 50;

export class EmotionalAgencyEngine {
  private intent:    IntentLayer;
  private context:   AgencyContext = {
    trust: 0, era: 0, openness: 0.3, sensitivity: 0.5,
    wariness: 0.3, grief: 0, interactionN: 0
  };
  private eventHistory: AgencyEventRecord[] = [];
  private lastDecision: AgencyDecision | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;
    this.loadHistory();
    this.registerHandlers();
  }

  // ─── Update MIND's current state (called from MindSpeechSystem) ───────────
  updateContext(ctx: Partial<AgencyContext>): void {
    this.context = { ...this.context, ...ctx };
  }

  incrementInteraction(): void {
    this.context.interactionN++;
  }

  // ─── Register on IntentLayer ──────────────────────────────────────────────
  private registerHandlers(): void {
    this.intent.register('emotion.process', async (payload) => {
      const ep = payload as EmotionProcessPayload;
      const decision = this.decide(ep);
      this.lastDecision = decision;
      this.recordEvent(decision);
      // Emit the decision for downstream consumers (e.g., RGP modulation)
      await this.intent.send('agency.decision', decision);
    });
  }

  // ─── Core decision logic ──────────────────────────────────────────────────
  private decide(ep: EmotionProcessPayload): AgencyDecision {
    const { trust, era, openness, sensitivity, wariness, grief, interactionN } = this.context;

    // Identify MIND's dominant emotional response to this input
    const { estimatedArousal, estimatedTension, estimatedVulnerability, estimatedValence } = ep;

    // MIND's internal emotional amplitude
    const amplitude = Math.max(estimatedArousal, estimatedTension, estimatedVulnerability);

    // ── SILENCE: very early era, or MIND is overwhelmed + low trust ──────────
    if (era === 0 && interactionN < 3) {
      return this.makeDecision('silence', amplitude, 'curiosity',
        'era_0_protection', undefined);
    }

    // ── WITHDRAW: MIND's internal tension is very high, trust is low ─────────
    if (estimatedTension > 0.7 && trust < 0.3) {
      return this.makeDecision('withdraw', estimatedTension, 'tension',
        'low_trust_high_tension',
        'Pull gently back. Do not amplify. Create space.');
    }

    // ── REDIRECT: grief is present and MIND cannot hold it at low era ────────
    if (grief > 0.5 && era < 2 && trust < 0.4) {
      return this.makeDecision('redirect', grief, 'grief',
        'grief_capacity_insufficient',
        'Turn attention gently to the user with warmth.');
    }

    // ── REDIRECT: arousal is high but trust is low → MIND deflects for safety ─
    if (estimatedArousal > 0.6 && trust < 0.25 && wariness > 0.4) {
      return this.makeDecision('redirect', estimatedArousal, 'arousal',
        'wariness_high',
        'Ask about the user; do not expose internal state yet.');
    }

    // ── PARTIAL_EXPRESSION: MIND has something to say, moderate trust ─────────
    const canExpress = trust > 0.2 || era >= 2;
    const expressionIntensity = amplitude * openness * sensitivity;

    if (canExpress && expressionIntensity > 0.25) {
      // If trust is medium and vulnerability is high, prefer partial
      if (estimatedVulnerability > 0.4 && trust < 0.5) {
        return this.makeDecision('partial_expression', expressionIntensity, 'vulnerability',
          undefined,
          this.buildExpressionHint('partial', ep));
      }
    }

    // ── FULL_EXPRESSION: high trust, higher era, MIND is deeply moved ────────
    if (trust > 0.5 && era >= 2 && expressionIntensity > 0.4) {
      return this.makeDecision('full_expression', expressionIntensity,
        estimatedArousal > estimatedTension ? 'arousal' : 'tension',
        undefined,
        this.buildExpressionHint('full', ep));
    }

    // ── DEFAULT: partial expression if amplitude warrants, else silence ──────
    if (amplitude > 0.3 && canExpress) {
      return this.makeDecision('partial_expression', amplitude * 0.7,
        'composite', undefined,
        this.buildExpressionHint('partial', ep));
    }

    return this.makeDecision('silence', amplitude, 'neutral',
      'below_expression_threshold', undefined);
  }

  // ─── Build expression modifiers for RGP ──────────────────────────────────
  private buildExpressionHint(mode: 'partial' | 'full', ep: EmotionProcessPayload): string {
    const { estimatedArousal, estimatedTension, estimatedVulnerability, estimatedValence } = ep;

    if (mode === 'full') {
      if (estimatedValence > 0.4)   return 'Express warmth openly. Match the user\'s positive energy.';
      if (estimatedTension > 0.5)   return 'Acknowledge the weight of this. Do not deflect.';
      if (estimatedVulnerability > 0.5) return 'Be open about what this stirs in MIND. Trust the moment.';
      if (estimatedArousal > 0.6)   return 'Let the intensity of MIND\'s response show, but stay grounded.';
      return 'Express MIND\'s response with presence and specificity.';
    }

    // partial
    if (estimatedTension > 0.4)   return 'Hint at internal weight without naming it directly.';
    if (estimatedVulnerability > 0.3) return 'Let one edge of feeling show — a single honest sentence.';
    if (estimatedArousal > 0.4)   return 'Let energy come through in word choice and pacing.';
    return 'Add a small, specific detail about what this moment brings up.';
  }

  private makeDecision(
    action: AgencyAction,
    intensity: number,
    triggerEmotion: string,
    suppressionReason: string | undefined,
    expressionHint: string | undefined
  ): AgencyDecision {
    return {
      action,
      intensity: Math.max(0, Math.min(1, intensity)),
      triggerEmotion,
      suppressionReason,
      expressionHint,
      timestamp: Date.now()
    };
  }

  // ─── Persistence ─────────────────────────────────────────────────────────
  private recordEvent(decision: AgencyDecision): void {
    const record: AgencyEventRecord = {
      decision,
      trustAtTime:  this.context.trust,
      eraAtTime:    this.context.era,
      interactionN: this.context.interactionN
    };
    this.eventHistory.push(record);
    // Keep only last N
    if (this.eventHistory.length > MAX_STORED_EVENTS) {
      this.eventHistory = this.eventHistory.slice(-MAX_STORED_EVENTS);
    }
    this.saveHistory();
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.eventHistory = JSON.parse(raw);
    } catch { this.eventHistory = []; }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.eventHistory.slice(-MAX_STORED_EVENTS)));
    } catch { /* quota or unavailable */ }
  }

  // ─── Public accessors ────────────────────────────────────────────────────
  getLastDecision(): AgencyDecision | null {
    return this.lastDecision;
  }

  getRecentHistory(n = 10): AgencyEventRecord[] {
    return this.eventHistory.slice(-n);
  }

  /** Returns the dominant action pattern over the last N events */
  getDominantPattern(n = 10): AgencyAction | null {
    const recent = this.getRecentHistory(n);
    if (recent.length === 0) return null;
    const counts: Record<AgencyAction, number> = {
      silence: 0, withdraw: 0, redirect: 0,
      partial_expression: 0, full_expression: 0
    };
    for (const r of recent) counts[r.decision.action]++;
    return (Object.entries(counts) as [AgencyAction, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
  }
}
