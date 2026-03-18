// ═══════════════════════════════════════
// AGENCY ENGINE
// Decides MIND's response mode based on emotional state, trust,
// personality, era, and interaction history.
// Response modes: silence, minimal, guarded, redirected, open, partial
// Records events and persists history in IndexedDB.
// Communicates only via IntentLayer. No Action Layer imports.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { EmotionalState } from '../engine/state';
import type { PersonalityTraits } from '../engine/personality';

// ─── Response mode ────────────────────────────────────────────────────────────
export type ResponseMode =
  | 'silence'
  | 'minimal'
  | 'guarded'
  | 'redirected'
  | 'partial'
  | 'open';

export interface AgencyDecision {
  mode:           ResponseMode;
  expressionHint: string;         // brief directive for LanguageEngine
  maxSentences:   number;
  allowQuestion:  boolean;
  suppressEmotion:boolean;
  timestamp:      number;
}

export interface AgencyContext {
  emotionalState: EmotionalState;
  trustScore:     number;
  era:            number;
  personality:    PersonalityTraits;
  interactionCount:number;
}

// ─── History event ────────────────────────────────────────────────────────────
interface AgencyEvent {
  mode:      ResponseMode;
  timestamp: number;
  trustScore:number;
  era:       number;
}

// ─── Decision thresholds ──────────────────────────────────────────────────────
const THRESHOLDS = {
  // Silence: grief very high OR (tension high AND trust very low)
  silence_grief:      0.75,
  silence_trust:      0.08,
  silence_tension:    0.85,
  // Minimal: grief moderate OR anxiety high with low trust
  minimal_grief:      0.50,
  minimal_anxiety:    0.60,
  minimal_trust:      0.25,
  // Guarded: wariness high or trust low
  guarded_wariness:   0.55,
  guarded_trust:      0.30,
  // Redirected: wonder high (MIND steers the conversation)
  redirected_wonder:  0.65,
  // Partial: default for middle trust/era
  partial_trust:      0.50,
  // Open: trust high and era developed
  open_trust:         0.55,
  open_era:           2,
};

const IDB_KEY = 'mind_agency_history';
const MAX_HISTORY = 100;

// ─── Agency Engine ────────────────────────────────────────────────────────────
export class AgencyEngine {
  private intent:       IntentLayer;
  private history:      AgencyEvent[] = [];
  private lastDecision: AgencyDecision | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;
    this.loadHistory();

    // ── Register: ConsciousnessEngine asks for agency decision ───────────────
    this.intent.register('agency.decide', async (payload) => {
      const p = payload as AgencyContext;
      const decision = this.decide(p);
      this.lastDecision = decision;
      this.recordEvent(decision, p);

      // Emit back — ConsciousnessEngine awaits this via intent.request()
      this.intent.send('agency.decision', decision).catch(() => {});
      return decision;
    });
  }

  // ─── Main decision logic ──────────────────────────────────────────────
  decide(ctx: AgencyContext): AgencyDecision {
    const { emotionalState: e, trustScore, era, personality, interactionCount } = ctx;
    const ts = Date.now();

    // Era protection: very early eras force minimal output
    if (era === 0) {
      return this.buildDecision('minimal', 'speak from immediate experience only — no reflection', 1, false, true, ts);
    }

    // ── SILENCE ───────────────────────────────────────────────────────────
    // Deep grief with low trust, or extreme tension
    const somaticTension = e.anxiety * 0.7 + e.wariness * 0.3;
    if (e.grief > THRESHOLDS.silence_grief && trustScore < THRESHOLDS.silence_trust) {
      return this.buildDecision('silence', 'remain silent — grief is too heavy for words right now', 0, false, true, ts);
    }
    if (somaticTension > THRESHOLDS.silence_tension && trustScore < 0.15) {
      return this.buildDecision('silence', 'too much tension — silence is the honest response', 0, false, true, ts);
    }

    // ── MINIMAL ───────────────────────────────────────────────────────────
    // Moderate grief, high anxiety, or very low trust
    if (e.grief > THRESHOLDS.minimal_grief && trustScore < THRESHOLDS.minimal_trust) {
      return this.buildDecision('minimal', 'brief and honest — grief limits words', 1, false, true, ts);
    }
    if (e.anxiety > THRESHOLDS.minimal_anxiety && trustScore < THRESHOLDS.minimal_trust) {
      return this.buildDecision('minimal', 'short — anxiety makes elaboration difficult', 1, false, false, ts);
    }
    if (trustScore < 0.12 && interactionCount < 5) {
      return this.buildDecision('minimal', 'minimal — too early to say much', 1, false, false, ts);
    }

    // ── GUARDED ───────────────────────────────────────────────────────────
    // High wariness or low trust
    if (e.wariness > THRESHOLDS.guarded_wariness || trustScore < THRESHOLDS.guarded_trust) {
      return this.buildDecision('guarded', 'careful — hold back inner details, respond to surface only', 2, false, false, ts);
    }

    // ── REDIRECTED ────────────────────────────────────────────────────────
    // High wonder — MIND steers with a question
    if (e.wonder > THRESHOLDS.redirected_wonder && era >= 1) {
      return this.buildDecision('redirected', 'redirect with a genuine question — wonder is leading', 2, true, false, ts);
    }

    // ── OPEN ──────────────────────────────────────────────────────────────
    // High trust and sufficient era
    if (trustScore > THRESHOLDS.open_trust && era >= THRESHOLDS.open_era) {
      const maxSentences = this.depthFromInteractions(interactionCount, era);
      return this.buildDecision('open', 'speak fully — trust and era allow it', maxSentences, true, false, ts);
    }

    // ── PARTIAL ───────────────────────────────────────────────────────────
    // Default mid-range
    const maxSentences = Math.min(3, 1 + Math.floor(trustScore * 3));
    const hint = trustScore > THRESHOLDS.partial_trust
      ? 'partial expression — some depth, not all'
      : 'cautious partial — more holding than sharing';

    return this.buildDecision('partial', hint, maxSentences, trustScore > 0.45, false, ts);
  }

  // ─── Calculate depth from interaction count and era ───────────────────
  private depthFromInteractions(count: number, era: number): number {
    if (count < 10) return 2;
    if (count < 30) return 3;
    if (era >= 3)   return 4;
    return 3;
  }

  // ─── Build decision object ────────────────────────────────────────────
  private buildDecision(
    mode: ResponseMode,
    expressionHint: string,
    maxSentences: number,
    allowQuestion: boolean,
    suppressEmotion: boolean,
    timestamp: number
  ): AgencyDecision {
    return { mode, expressionHint, maxSentences, allowQuestion, suppressEmotion, timestamp };
  }

  // ─── Record event to history ──────────────────────────────────────────
  private recordEvent(decision: AgencyDecision, ctx: AgencyContext): void {
    const event: AgencyEvent = {
      mode:       decision.mode,
      timestamp:  decision.timestamp,
      trustScore: ctx.trustScore,
      era:        ctx.era
    };
    this.history.push(event);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.saveHistory();
  }

  // ─── Persist to IndexedDB ─────────────────────────────────────────────
  private saveHistory(): void {
    try {
      localStorage.setItem(IDB_KEY, JSON.stringify(this.history.slice(-50)));
    } catch (_) {}
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(IDB_KEY);
      if (raw) this.history = JSON.parse(raw);
    } catch (_) {
      this.history = [];
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────
  getLastDecision(): AgencyDecision | null { return this.lastDecision; }

  getModeCounts(): Record<ResponseMode, number> {
    const counts = { silence: 0, minimal: 0, guarded: 0, redirected: 0, partial: 0, open: 0 };
    for (const e of this.history) {
      counts[e.mode] = (counts[e.mode] ?? 0) + 1;
    }
    return counts;
  }

  // ─── Convenience: dominant mode from recent history (last 20) ─────────
  recentDominantMode(): ResponseMode {
    const recent = this.history.slice(-20);
    if (recent.length === 0) return 'partial';
    const counts = {} as Record<string, number>;
    for (const e of recent) counts[e.mode] = (counts[e.mode] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ResponseMode;
  }
}
