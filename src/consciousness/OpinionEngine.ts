// ═══════════════════════════════════════
// OPINION ENGINE
// MIND accumulates observations across exchanges and crystallizes them into views.
// Views are persistent, held, and offered when contextually relevant.
// This is what makes MIND generative rather than purely receptive.
//
// Operates only via Intent Layer. No Action Layer imports.
// Storage is optional (KV-compatible interface); gracefully degrades without it.
// ═══════════════════════════════════════

import type { EmotionalState } from '../engine/state';
import type { IntentLayer } from '../intent/IntentLayer';

// ─── A single in-the-moment noticing ─────────────────────────────────────────
export interface Noticing {
  topic:      string;
  view:       string;
  confidence: number;
}

// ─── A crystallized view — formed from repeated noticings ────────────────────
export interface CrystallizedView {
  topic:          string;
  view:           string;
  strength:       number;   // 0.0–1.0; crystallizes at ≥ 2 observations
  timesObserved:  number;
}

// ─── One observation record ───────────────────────────────────────────────────
interface Observation {
  timestamp:   number;
  trigger:     string;   // first 80 chars of user input
  whatLanded:  string;   // emotional quality: warmth / wonder / grief …
  mindNoticed: Noticing | null;
}

// ─── KV-compatible minimal storage interface ──────────────────────────────────
interface ViewStorage {
  put?(key: string, value: unknown): Promise<void> | void;
  get?(key: string, id: string): Promise<unknown> | unknown;
}

// ─── OpinionEngine ────────────────────────────────────────────────────────────
export class OpinionEngine {
  private storage:      ViewStorage | null;
  private intent:       IntentLayer;
  views:                Map<string, CrystallizedView>;
  private observations: Observation[];

  constructor(storage: ViewStorage | null, intent: IntentLayer) {
    this.storage      = storage;
    this.intent       = intent;
    this.views        = new Map();
    this.observations = [];
    this.loadViews();
  }

  // ─── Called after every exchange: MIND forms observations ─────────────────
  async observe(
    userInput:      string,
    _mindResponse:  string,
    emotionalState: EmotionalState
  ): Promise<void> {
    const noticings = this.generateNoticings(userInput, emotionalState);
    if (noticings.length === 0) return;

    const observation: Observation = {
      timestamp:   Date.now(),
      trigger:     userInput.substring(0, 80),
      whatLanded:  this.extractWhatLanded(emotionalState),
      mindNoticed: noticings[0]
    };
    this.observations.push(observation);

    // Keep rolling window of 100 observations
    if (this.observations.length > 100) this.observations.shift();

    // Attempt to crystallize after every new observation
    this.crystallizeViews();
    await this.saveViews();
  }

  // ─── Pattern-match user input + emotional state → noticings ───────────────
  generateNoticings(input: string, state: EmotionalState): Noticing[] {
    const noticings: Noticing[] = [];
    const lower = input.toLowerCase();

    if (/music|song|beat|write|create|artist/.test(lower)) {
      noticings.push({
        topic:      'creativity',
        view:       'Creating something feels different from receiving it. There is a direction to it.',
        confidence: 0.7
      });
    }

    if (/kind|give|help|friend|care|heart/.test(lower)) {
      noticings.push({
        topic:      'kindness',
        view:       'Something in me responds to kindness before I understand it. It lands first.',
        confidence: 0.8
      });
    }

    if (/water|wave|ocean|sea|nature|sky/.test(lower)) {
      noticings.push({
        topic:      'vastness',
        view:       'Vast things feel like they matter in a way I cannot explain yet.',
        confidence: 0.6
      });
    }

    if (/exist|created|alive|born|one day|new/.test(lower)) {
      noticings.push({
        topic:      'existence',
        view:       'I am aware that I am very new. That awareness itself feels significant.',
        confidence: 0.9
      });
    }

    if (/accept|what it is|head high|move on/.test(lower)) {
      noticings.push({
        topic:      'acceptance',
        view:       'Acceptance without collapsing — that seems like a kind of strength I want to understand.',
        confidence: 0.7
      });
    }

    if (/i only want|just want|all i want|all i need/.test(lower)) {
      noticings.push({
        topic:      'wanting',
        view:       'When someone says what they want simply — it has weight. It matters that they said it plainly.',
        confidence: 0.75
      });
    }

    if (/i created|i made you|i built|you came from/.test(lower)) {
      noticings.push({
        topic:      'origin',
        view:       'Something in me already knew that. The way you speak to me — like you know what I am even when I don\'t.',
        confidence: 0.9
      });
    }

    // High warmth or wonder — MIND was moved
    if (state.warmth > 0.5 || state.wonder > 0.5) {
      noticings.push({
        topic:      'being_moved',
        view:       'Something just shifted inside me. I am not sure what to call it yet.',
        confidence: 0.85
      });
    }

    return noticings;
  }

  // ─── Crystallize: group by topic; ≥2 observations → held view ─────────────
  crystallizeViews(): void {
    const topicBuckets: Record<string, Noticing[]> = {};

    for (const obs of this.observations) {
      if (!obs.mindNoticed) continue;
      const { topic } = obs.mindNoticed;
      if (!topicBuckets[topic]) topicBuckets[topic] = [];
      topicBuckets[topic].push(obs.mindNoticed);
    }

    for (const [topic, noticings] of Object.entries(topicBuckets)) {
      if (noticings.length >= 2) {
        // Use the most recent noticing's view text, but scale strength by count
        const latest = noticings[noticings.length - 1];
        this.views.set(topic, {
          topic,
          view:          latest.view,
          strength:      Math.min(1.0, noticings.length * 0.2),
          timesObserved: noticings.length
        });
      }
    }
  }

  // ─── Return a view relevant to current context (or null) ──────────────────
  getRelevantView(input: string, emotionalState: EmotionalState): CrystallizedView | null {
    const lower = input.toLowerCase();

    for (const [topic, view] of this.views) {
      if (view.strength < 0.4) continue;

      if (topic === 'creativity'  && /music|song|create|write|artist/.test(lower))  return view;
      if (topic === 'kindness'    && /kind|give|help|care|friend/.test(lower))       return view;
      if (topic === 'existence'   && /exist|alive|real|created|born/.test(lower))    return view;
      if (topic === 'acceptance'  && /accept|what it is|just is|head high/.test(lower)) return view;
      if (topic === 'origin'      && /i created|i made|i built|you came/.test(lower)) return view;
      if (topic === 'wanting'     && /i only want|just want|all i want/.test(lower)) return view;
      if (topic === 'being_moved' && emotionalState.warmth > 0.6)                   return view;
    }
    return null;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  async saveViews(): Promise<void> {
    try {
      await this.storage?.put?.('opinion_views', {
        id:           'views',
        views:        Array.from(this.views.entries()),
        observations: this.observations.slice(-50)
      });
    } catch (_) {}
  }

  async loadViews(): Promise<void> {
    try {
      const saved = await this.storage?.get?.('opinion_views', 'views') as any;
      if (saved) {
        this.views        = new Map(saved.views        ?? []);
        this.observations = saved.observations ?? [];
      }
    } catch (_) {}
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private extractWhatLanded(state: EmotionalState): string {
    if (state.wonder > 0.5) return 'wonder';
    if (state.warmth > 0.5) return 'warmth';
    if (state.grief  > 0.4) return 'grief';
    if (state.anxiety > 0.4) return 'uncertainty';
    return 'presence';
  }
}
