// ═══════════════════════════════════════
// CORE INTENT WIRING  v2
// Governor layer — intercepts 'speech.deliver' BEFORE the UI handler.
// Mutates payload in-place so every downstream handler sees the enriched object.
//
// v2 changes:
//   • Attaches coreDirective + coreNote to payload when repetition is detected.
//     ConsciousnessEngine reads these on the NEXT speech cycle to shift conditions.
//   • detectRepetition() now uses word-set similarity (prevents false positives
//     from common opening words like "Something" or "I notice").
//   • applyVariation() no longer rewrites the string — sets governance directives only.
//
// Rules (unchanged):
//   • Non-destructive: if process() throws, original text is preserved.
//   • Non-blocking: pure CPU work, no LLM calls.
//   • Modular: removing this file leaves zero side-effects.
//   • Observability: window.CORE_DEBUG + console.log in dev mode.
// ═══════════════════════════════════════

import { CoreEngine }    from './CoreEngine';
import type { IntentLayer } from '../intent/IntentLayer';

// ─── Extend Window for debug exposure ────────────────────────────────────────
declare global {
  interface Window {
    CORE_DEBUG?: ReturnType<CoreEngine['getSnapshot']>;
    _coreEngine?: CoreEngine;
  }
}

// ─── Singleton CoreEngine shared across the session ──────────────────────────
const coreEngine = new CoreEngine();

// ─── registerCoreIntent ───────────────────────────────────────────────────────
//
// Call this ONCE, inside MindSpeechSystem constructor, so that CORE's handler
// is appended to the IntentLayer BEFORE app.ts appends the UI handler.
// Registration order = dispatch order → CORE fires first, mutates payload,
// then the UI handler reads the already-enriched object.
//
// @param intent  — the shared IntentLayer instance
// @param isDev   — enables console logging and window.CORE_DEBUG exposure
// ─────────────────────────────────────────────────────────────────────────────
export function registerCoreIntent(
  intent: IntentLayer,
  isDev = false
): void {

  // NOTE: IntentLayer handlers receive (payload) only — there is no next() param.
  // Downstream handlers are called automatically after this one resolves.
  // To pass the directive forward we mutate the shared payload object.
  intent.register('speech.deliver', async (payload: unknown) => {
    // Type-guard: payload must be a mutable object with a text field
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as Record<string, unknown>).text !== 'string'
    ) {
      return; // unrecognised payload — leave untouched
    }

    const p = payload as Record<string, unknown>;

    // Carry any existing context or start fresh
    const context: Record<string, unknown> = {
      era:              typeof p.era         === 'number' ? p.era         : undefined,
      trustScore:       typeof p.trustScore  === 'number' ? p.trustScore  : undefined,
      interactionCount: typeof p.interaction === 'number' ? p.interaction : undefined,
      mode:             typeof p.mode        === 'string' ? p.mode        : undefined,
      felt:             typeof p.felt        === 'string' ? p.felt        : undefined,
    };

    try {
      const result = coreEngine.process(p.text as string, context);

      // ── Mutate payload in-place ───────────────────────────────────────────
      // text: CoreEngine only touches it when it appends a depth probe;
      //       for directive-based governance it passes the original through.
      p.text         = result.response;
      p.coreMeta     = result.meta;

      // ── Forward governance directives to the next speech cycle ───────────
      // ConsciousnessEngine (or LanguageEngine) reads these on the next
      // 'speech.request' to shift generation conditions without rewriting voice.
      if (context.coreDirective) {
        p.coreDirective = context.coreDirective;
        p.coreNote      = context.coreNote ?? null;
      } else {
        // Clear stale directives so old signals don't bleed into stable periods
        p.coreDirective = null;
        p.coreNote      = null;
      }

      // ── Observability ─────────────────────────────────────────────────────
      console.log('[CORE]', result.meta,
        context.coreDirective ? `→ directive: ${context.coreDirective}` : '');

      if (isDev && typeof window !== 'undefined') {
        window.CORE_DEBUG  = coreEngine.getSnapshot();
        window._coreEngine = coreEngine;
      }

    } catch (err) {
      // ── Fail-safe: leave payload completely untouched ─────────────────────
      console.warn('[CORE] process() threw — original response preserved:', err);
    }

    // Returning undefined: IntentLayer dispatches remaining handlers automatically.
  });
}

// ─── Named export so consumers can inspect state without window ───────────────
export { coreEngine };
