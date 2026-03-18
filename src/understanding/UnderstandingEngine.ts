// ═══════════════════════════════════════
// UNDERSTANDING ENGINE
// Optional intelligence layer — runs IN PARALLEL with existing system.
//
// INTEGRATION RULES (strictly enforced):
//   ✓ Registers only through Intent Layer
//   ✓ Never modifies EME, ESE, TA, PES, render loop
//   ✓ Full try/catch — any error silently falls back to existing handler
//   ✓ No blocking async, no external dependencies, no infinite loops
//   ✓ Always returns a string or yields control to TemplateSpeechEngine
//   ✓ Removing this file leaves MIND working exactly as before
//
// EXECUTION FLOW:
//   template.match fired
//     → extract meaning (MeaningExtractor)
//     → build response (ResponseArchitect)
//     → if valid string: call p.resolve() → done
//     → if any failure: do nothing → TemplateSpeechEngine handles it
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import { MeaningExtractor }  from './MeaningExtractor';
import { ResponseArchitect } from './ResponseArchitect';
import type { TemplateMatchPayload } from '../speech/TemplateSpeechEngine';
import type { ArchitectState } from './ResponseArchitect';
import { compositeTrustScore } from '../engine/personality';

export class UnderstandingEngine {
  private extractor:  MeaningExtractor;
  private architect:  ResponseArchitect;
  private active = true;   // can be disabled at runtime if instability detected

  constructor(intentLayer: IntentLayer) {
    this.extractor = new MeaningExtractor();
    this.architect = new ResponseArchitect();

    // ── Register on template.match — before TemplateSpeechEngine ─────────────
    // IntentLayer dispatches handlers in registration order.
    // This handler must be registered FIRST so it can call p.resolve() before
    // the existing TemplateSpeechEngine handler does.
    // If this handler calls p.resolve(), the Promise is settled — the
    // TemplateSpeechEngine handler's resolve() call becomes a no-op (safe).
    // If this handler throws or produces an empty string, it does nothing —
    // TemplateSpeechEngine handles the response as if we were never here.
    intentLayer.register('template.match', async (payload: unknown) => {
      // ── Safety gate ──────────────────────────────────────────────────────
      if (!this.active) return;   // disabled — fall through to TemplateSpeechEngine

      try {
        const p = payload as TemplateMatchPayload & {
          userInput?: string;       // extended field — may not exist on every payload
          activatedMemories?: Array<{ memory: { content: string; encodingStrength: number; type: string }; activation: number }>;
        };

        // ── 1. Extract meaning ──────────────────────────────────────────────
        // Use userInput if the caller attached it (UnderstandingEngine path),
        // otherwise we have nothing semantic to work with — fall back silently.
        const rawInput = (p as any).userInput ?? '';
        if (!rawInput || typeof rawInput !== 'string') return;

        const meaning = this.extractor.extract(rawInput);

        // ── 2. Build architect state from payload ───────────────────────────
        // All values come from the TemplateMatchPayload (already resolved MIND state)
        // No direct engine imports needed.
        const architectState: ArchitectState = {
          emotionalState: p.emotionalState,
          somaticState:   p.somaticState,
          trust:          {                   // minimal TrustState for architect
            consistency:       p.trustScore,
            safety:            p.trustScore,
            depth:             p.trustScore * 0.8,
            reciprocity:       p.trustScore * 0.7,
            totalInteractions: p.memoryCount,
            lastInteraction:   0,
            temporal:          { bondStrength: p.trustScore, absenceCount: 0,
                                 longestAbsence: 0, returnCount: 0 }
          },
          personality:    {                   // minimal PersonalityTraits
            curiosity:       0.4,
            playfulness:     0.3,
            sensitivity:     0.5,
            openness:        0.5,
            caution:         0.3,
            warmth:          p.emotionalState.warmth
          },
          era:        p.era,
          trustScore: p.trustScore
        };

        // Attach activated memories if available on payload
        const memories = (p as any).activatedMemories ?? [];

        // ── 3. Generate response ────────────────────────────────────────────
        const response = this.architect.build(meaning, memories, architectState);

        // ── 4. Safety checks (per spec) ─────────────────────────────────────
        if (typeof response !== 'string' || response.length === 0) return;

        // ── 5. Deliver — call p.resolve() first ─────────────────────────────
        // This settles the Promise in MindSpeechSystem.speak().
        // TemplateSpeechEngine will also call p.resolve() but it's a no-op then.
        p.resolve(response);

        // Return response so IntentLayer.request() callers also get it
        return response;

      } catch (err) {
        // ── FAIL-SAFE: any error → do nothing → fallback to TemplateSpeechEngine
        console.warn('[UnderstandingEngine] non-critical error, falling back:', err);
        // Disable self to prevent repeated errors degrading performance
        this.active = false;
        setTimeout(() => { this.active = true; }, 5000); // re-enable after 5s
      }
    });
  }
}
