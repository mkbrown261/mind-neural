// ═══════════════════════════════════════
// CORE INTENT WIRING
// Governor layer — intercepts 'speech.deliver' BEFORE the UI handler.
// Mutates payload.text in-place so every downstream handler sees the
// modified (de-repeated, evolved) response without any breaking changes.
//
// Rules:
//   • Non-destructive: if process() throws, original text is preserved.
//   • Non-blocking: no awaiting LLM calls, pure CPU work only.
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
// Registration order = dispatch order → CORE fires first, mutates payload.text,
// then the UI handler reads the already-evolved text.
//
// @param intent  — the shared IntentLayer instance
// @param isDev   — enables console logging and window.CORE_DEBUG exposure
// ─────────────────────────────────────────────────────────────────────────────
export function registerCoreIntent(
  intent: IntentLayer,
  isDev = false
): void {

  intent.register('speech.deliver', async (payload: unknown) => {
    // Type-guard: payload must be a mutable object with a text field
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as Record<string, unknown>).text !== 'string'
    ) {
      return; // not a recognised speech.deliver payload — pass through unchanged
    }

    const p = payload as Record<string, unknown>;

    try {
      // Build context from whatever is available in the payload
      const context = {
        era:              typeof p.era          === 'number' ? p.era          : undefined,
        trustScore:       typeof p.trustScore   === 'number' ? p.trustScore   : undefined,
        interactionCount: typeof p.interaction  === 'number' ? p.interaction  : undefined,
        mode:             typeof p.mode         === 'string' ? p.mode         : undefined,
        felt:             typeof p.felt         === 'string' ? p.felt         : undefined,
      };

      const result = coreEngine.process(p.text as string, context);

      // ── Mutate payload in-place so all later handlers see evolved text ──────
      p.text       = result.response;
      p.coreMeta   = result.meta;   // extra field for any handler that wants it

      // ── Observability ───────────────────────────────────────────────────────
      if (isDev) {
        console.log('[CORE]', result.meta);

        // Expose live snapshot on window for DevTools inspection
        if (typeof window !== 'undefined') {
          window.CORE_DEBUG  = coreEngine.getSnapshot();
          window._coreEngine = coreEngine; // full access for debugging
        }
      }

    } catch (err) {
      // ── Fail-safe: log and leave payload.text completely untouched ──────────
      console.warn('[CORE] process() threw — original response preserved:', err);
    }

    // No return value needed.  IntentLayer.send() dispatches to the next
    // registered handler automatically after this one resolves.
  });
}

// ─── Named export so consumers can inspect state without window ───────────────
export { coreEngine };
