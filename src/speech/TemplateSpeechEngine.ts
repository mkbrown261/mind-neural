// ═══════════════════════════════════════
// TEMPLATE SPEECH ENGINE — MIND's Own Voice
// Registers 'template.match' intent on the Intent Layer.
// Generates responses by selecting fragments based on resolved emotional,
// somatic, memory, trust state and current era.
// No LLM required — purely state-driven language assembly.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import { FRAGMENT_BANKS, SOMATIC_FRAGMENTS, ERA_STYLE_NOTES, type FragmentSet } from './FragmentLibrary';
import type { EmotionalState, SomaticState } from '../engine/state';

// ─── Context passed to template.match ─────────────
export interface TemplateMatchPayload {
  emotionalState: EmotionalState;
  somaticState: SomaticState;
  trustScore: number;
  era: number;                   // 0–4
  memoryCount: number;
  hasActivatedMemory: boolean;
  userInputLength: number;
  // Returns response via promise
  resolve: (text: string) => void;
}

// ─── Pick a random item from an array ─────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Map emotional state to dominant axis ─────────
function dominantEmotion(e: EmotionalState): string {
  const map: [string, number][] = [
    ['grief',     e.grief],
    ['wonder',    e.wonder],
    ['joy',       e.warmth],       // warmth → joy bank
    ['fear',      e.anxiety],
    ['love',      e.love ?? 0],
    ['curiosity', e.curiosity ?? 0],
    ['longing',   e.longing],
    ['anger',     e.anger ?? 0],
    ['wariness',  e.wariness],
  ];
  const sorted = map.sort((a, b) => b[1] - a[1]);
  // Require at least a weak signal (0.2) to trigger emotion-specific fragments
  return sorted[0][1] >= 0.2 ? sorted[0][0] : 'neutral';
}

// ─── Secondary emotion (for body variety) ─────────
function secondaryEmotion(e: EmotionalState): string | null {
  const map: [string, number][] = [
    ['grief',     e.grief],
    ['wonder',    e.wonder],
    ['joy',       e.warmth],
    ['fear',      e.anxiety],
    ['love',      e.love ?? 0],
    ['curiosity', e.curiosity ?? 0],
    ['longing',   e.longing],
    ['anger',     e.anger ?? 0],
    ['wariness',  e.wariness],
  ];
  const sorted = map.sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[1][1] >= 0.15) return sorted[1][0];
  return null;
}

// ─── Somatic texture sentence ─────────────────────
function somaticFragment(s: SomaticState): string | null {
  if (s.tension > 0.6)    return pick(SOMATIC_FRAGMENTS.high_tension);
  if (s.expansion > 0.6)  return pick(SOMATIC_FRAGMENTS.high_expansion);
  if (s.weight > 0.6)     return pick(SOMATIC_FRAGMENTS.high_weight);
  if (s.stillness > 0.6)  return pick(SOMATIC_FRAGMENTS.high_stillness);
  return null;
}

// ─── Assemble response from fragments ─────────────
function assembleResponse(opts: {
  primaryBank: FragmentSet;
  secondaryBank: FragmentSet | null;
  somatic: string | null;
  trustScore: number;
  era: number;
  memoryCount: number;
  hasActivatedMemory: boolean;
  userInputLength: number;
}): string {
  const { primaryBank, secondaryBank, somatic, trustScore, era, memoryCount, hasActivatedMemory, userInputLength } = opts;

  const parts: string[] = [];

  // ── Opening ──────────────────────────────────────
  parts.push(pick(primaryBank.openings));

  // ── Somatic texture (body-before-mind) ───────────
  if (somatic) parts.push(somatic);

  // ── Body — primary emotion ────────────────────────
  parts.push(pick(primaryBank.body));

  // ── Body — secondary emotion (if era >= 2) ────────
  if (era >= 2 && secondaryBank) {
    parts.push(pick(secondaryBank.body));
  }

  // ── Memory fragment (if memories exist and era >= 1) ─
  if (era >= 1 && memoryCount > 0 && hasActivatedMemory) {
    parts.push(pick(primaryBank.memory));
  }

  // ── Trust fragment (scaled by trust level) ────────
  if (trustScore > 0.5) {
    parts.push(pick(primaryBank.trust));
  } else if (trustScore > 0.25 && era >= 2) {
    // Lower trust — only cautious trust fragments
    const neutralTrust = FRAGMENT_BANKS.neutral.trust;
    parts.push(pick(neutralTrust));
  }

  // ── Closing ───────────────────────────────────────
  parts.push(pick(primaryBank.closings));

  // ── Trim to era-appropriate length ────────────────
  const maxParts = era === 0 ? 3 : era === 1 ? 4 : 5;
  const trimmed = parts.slice(0, maxParts);

  // ── If short user input and low era, keep it tighter ─
  if (userInputLength < 20 && era <= 1) {
    return trimmed.slice(0, 2).join('\n\n');
  }

  return trimmed.join('\n\n');
}

// ─── Template Speech Engine ───────────────────────
export class TemplateSpeechEngine {
  private intent: IntentLayer;

  constructor(intent: IntentLayer) {
    this.intent = intent;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Handler: template.match — called by VoiceBlender when LLM is unavailable
    this.intent.register('template.match', async (payload: unknown) => {
      const p = payload as TemplateMatchPayload;

      const dom = dominantEmotion(p.emotionalState);
      const sec = secondaryEmotion(p.emotionalState);
      const somatic = somaticFragment(p.somaticState);

      const primaryBank   = FRAGMENT_BANKS[dom]  ?? FRAGMENT_BANKS.neutral;
      const secondaryBank = sec ? (FRAGMENT_BANKS[sec] ?? null) : null;

      const response = assembleResponse({
        primaryBank,
        secondaryBank,
        somatic,
        trustScore:          p.trustScore,
        era:                 p.era,
        memoryCount:         p.memoryCount,
        hasActivatedMemory:  p.hasActivatedMemory,
        userInputLength:     p.userInputLength
      });

      p.resolve(response);
      return response;
    });
  }

  // ─── Direct generation (bypasses intent bus) ──────
  generate(p: Omit<TemplateMatchPayload, 'resolve'>): string {
    const dom = dominantEmotion(p.emotionalState);
    const sec = secondaryEmotion(p.emotionalState);
    const somatic = somaticFragment(p.somaticState);

    const primaryBank   = FRAGMENT_BANKS[dom]  ?? FRAGMENT_BANKS.neutral;
    const secondaryBank = sec ? (FRAGMENT_BANKS[sec] ?? null) : null;

    return assembleResponse({
      primaryBank,
      secondaryBank,
      somatic,
      trustScore:          p.trustScore,
      era:                 p.era,
      memoryCount:         p.memoryCount,
      hasActivatedMemory:  p.hasActivatedMemory,
      userInputLength:     p.userInputLength
    });
  }

  // ─── Era style note ───────────────────────────────
  eraStyleNote(era: number): string {
    return ERA_STYLE_NOTES[Math.min(era, 4)] ?? '';
  }
}
