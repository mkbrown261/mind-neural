// ═══════════════════════════════════════
// TWO-LAYER CONSCIOUSNESS
// Replaces the single buildMINDPrompt → LLM call with a two-stage process:
//
//   Stage 1 (FeltLayer):  pre-linguistic raw interior — what MIND experiences
//   Stage 2 (SpokenLayer): what MIND chooses to say from that interior
//
// Integrates through the Intent Layer only.
// Stores the felt layer as an internal memory (not the spoken text).
// Emits speech.deliver with both layers for UI consumption.
//
// STABILITY GUARANTEE:
//   - Never modifies EME, ESE, TA, PES, render loop
//   - Full try/catch — any error returns graceful fallback
//   - Template engine still available as fallback when no LLM
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import { FeltLayer } from './FeltLayer';
import { SpokenLayer } from './SpokenLayer';
import type { LLMClient } from './FeltLayer';
import type { MINDContext } from '../engine/pipeline';
import { compositeTrustScore } from '../engine/personality';

// ─── Intent payloads ─────────────────────────────────────────────────────────

/** Sent on 'speech.request' to trigger two-layer processing */
export interface SpeechRequestPayload {
  id:         string;
  userInput:  string;
  mindCtx:    MINDContext;
  era:        number;
  onChunk?:   (text: string) => void;
  resolve:    (text: string) => void;
  reject:     (err: unknown) => void;
}

/** Emitted on 'speech.deliver' after processing */
export interface SpeechDeliverPayload {
  requestId:  string;
  text:       string;          // the spoken response
  felt:       string;          // the raw felt layer
  provider:   string;
  era:        number;
  timestamp:  number;
}

/** Emitted on 'felt.store' — triggers internal memory creation */
export interface FeltStorePayload {
  content:          string;
  encodingStrength: number;
  arousal:          number;
}

// ─── Two-Layer Consciousness ──────────────────────────────────────────────────
export class TwoLayerConsciousness {
  private intent:  IntentLayer;
  private felt:    FeltLayer;
  private spoken:  SpokenLayer;
  private enabled = true;

  constructor(intent: IntentLayer, llm: LLMClient) {
    this.intent = intent;
    this.felt   = new FeltLayer(llm);
    this.spoken = new SpokenLayer(llm);

    // ── Register: intercept 'consciousness.process' intents ──────────────────
    // MindSpeechSystem fires this intent instead of calling buildMINDPrompt directly.
    // This handler settles the Promise via payload.resolve().
    this.intent.register('consciousness.process', async (payload: unknown) => {
      if (!this.enabled) return;

      const p = payload as SpeechRequestPayload;
      try {
        const result = await this.process(p.userInput, p.mindCtx, p.era, p.onChunk);

        // ── Store felt layer as internal experience ─────────────────────────
        const feltStorePayload: FeltStorePayload = {
          content:          result.felt,
          encodingStrength: p.mindCtx.emotionalState?.arousal ?? 0.5,
          arousal:          p.mindCtx.emotionalState?.arousal ?? 0.5
        };
        // Fire-and-forget — does not block speech delivery
        this.intent.send('felt.store', feltStorePayload).catch(() => {});

        // ── Emit speech.deliver for UI ──────────────────────────────────────
        const deliverPayload: SpeechDeliverPayload = {
          requestId:  p.id,
          text:       result.spoken,
          felt:       result.felt,
          provider:   'two-layer-consciousness',
          era:        p.era,
          timestamp:  Date.now()
        };
        this.intent.send('speech.deliver', deliverPayload).catch(() => {});

        // ── Settle the Promise ──────────────────────────────────────────────
        p.resolve(result.spoken);

      } catch (err) {
        console.error('[TwoLayerConsciousness] error:', err);
        // Graceful fallback — MIND goes quiet rather than crashing
        const fallback = '.';
        p.resolve(fallback);
      }
    });
  }

  // ─── Core two-stage processing ────────────────────────────────────────────
  async process(
    userInput: string,
    ctx: MINDContext,
    era: number,
    onChunk?: (text: string) => void
  ): Promise<{ felt: string; spoken: string }> {

    const trustScore = compositeTrustScore(ctx.trust);
    const userName   = this.extractUserName(ctx);

    // ── Stage 1: Felt Layer — what MIND experiences pre-linguistically ────────
    const feltOutput = await this.felt.generate({
      userInput,
      emotionalState: ctx.emotionalState,
      somaticState:   ctx.somaticState,
      personality:    ctx.personality,
      trust:          ctx.trust,
      era,
      memories:       ctx.activatedMemories,
      userName
    });

    // ── Stage 2: Spoken Layer — what MIND chooses to say ─────────────────────
    const spoken = await this.spoken.distill({
      feltRaw:        feltOutput.raw,
      userInput,
      era,
      trustScore,
      userName,
      emotionalState: ctx.emotionalState,
      somaticState:   ctx.somaticState
    });

    // ── Simulate streaming for spoken layer if onChunk provided ──────────────
    if (onChunk && spoken) {
      // Emit spoken word-by-word with natural pacing
      await this.streamSpoken(spoken, onChunk);
    }

    // Log felt layer in development
    console.debug('[MIND felt]\n' + feltOutput.raw);
    console.debug('[MIND says] ' + spoken);

    return { felt: feltOutput.raw, spoken };
  }

  // ─── Stream spoken text word-by-word ─────────────────────────────────────
  private streamSpoken(text: string, onChunk: (t: string) => void): Promise<void> {
    return new Promise(resolve => {
      const words = text.split(/(\s+)/);
      let i = 0;
      // Variable pace: longer pauses at punctuation, shorter between words
      const next = () => {
        if (i >= words.length) { resolve(); return; }
        const word = words[i++];
        if (word) onChunk(word);
        const isPunct = /[.!?,;:]$/.test(word.trimEnd());
        setTimeout(next, isPunct ? 110 + Math.random() * 80 : 42 + Math.random() * 45);
      };
      next();
    });
  }

  // ─── Extract userName from context (from activated memories / identity) ──
  private extractUserName(ctx: MINDContext): string | null {
    // Check identity state if present
    if (ctx.identityState?.userName) return ctx.identityState.userName;
    // Check memory content for disclosed names
    for (const { memory } of ctx.activatedMemories ?? []) {
      if (memory.type === 'identity_disclosure' && memory.content.length < 40) {
        // e.g. "Name: Alice" or "My name is Alice"
        const m = memory.content.match(/(?:name\s*(?:is|:)\s*)([A-Z][a-z]+)/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  // ─── Runtime control ──────────────────────────────────────────────────────
  disable(): void { this.enabled = false; }
  enable():  void { this.enabled = true;  }
  isEnabled(): boolean { return this.enabled; }
}
