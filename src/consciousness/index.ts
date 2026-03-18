// ═══════════════════════════════════════
// CONSCIOUSNESS — Public API
// Exports initializeConsciousness() which wires all seven consciousness layers
// through the IntentLayer and returns the ConsciousnessEngine.
//
// Layer boot order:
//   ExistenceEngine → PerceptionEngine → ImpactEngine → FeltLayer →
//   AgencyEngine → LanguageEngine → ConsciousnessEngine
//
// STABILITY GUARANTEE:
//   - All layers communicate exclusively through IntentLayer
//   - No direct Action Layer imports
//   - Full error isolation — any layer failure does not crash MIND
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { LLMClient }   from './FeltLayer';
import { ConsciousnessEngine } from './ConsciousnessEngine';

// Re-exports for external consumers
export { ExistenceEngine }   from './ExistenceEngine';
export { PerceptionEngine }  from './PerceptionEngine';
export { ImpactEngine }      from './ImpactEngine';
export { FeltLayer }         from './FeltLayer';
export { AgencyEngine }      from './AgencyEngine';
export { LanguageEngine }    from './LanguageEngine';
export { ConsciousnessEngine } from './ConsciousnessEngine';

export type { FeltOutput, FeltLayerInput, LLMClient } from './FeltLayer';
export type { PerceptionOutput, PerceptionMetrics, PerceptionSignal } from './PerceptionEngine';
export type { Impact, ImpactType } from './ImpactEngine';
export type { AgencyDecision, ResponseMode, AgencyContext } from './AgencyEngine';
export type { LanguageInput } from './LanguageEngine';
export type { ConsciousnessSpeechRequest, ConsciousnessSpeechDeliver } from './ConsciousnessEngine';

// ─── Initialize all consciousness layers ─────────────────────────────────────
/**
 * Creates and wires all seven consciousness layers in order.
 * All layers register their intent handlers during construction.
 *
 * @param intent  - The shared IntentLayer bus from MindSpeechSystem
 * @param llm     - An LLMClient (usually the ProviderManager wrapper)
 * @returns        The initialized ConsciousnessEngine (which owns all sub-engines)
 */
export async function initializeConsciousness(
  intent: IntentLayer,
  llm: LLMClient
): Promise<ConsciousnessEngine> {
  // ConsciousnessEngine constructor creates all sub-engines in order:
  //   1. ExistenceEngine  — autonomous heartbeat
  //   2. PerceptionEngine — typing dynamics
  //   3. ImpactEngine     — emotion/somatic updates
  //   4. FeltLayer        — pre-linguistic interior
  //   5. AgencyEngine     — response mode decision
  //   6. LanguageEngine   — spoken output builder
  //   Then starts ExistenceEngine.start()
  const engine = new ConsciousnessEngine(intent, llm);

  console.log('[Consciousness] All layers initialized');
  console.log('[Consciousness] ExistenceEngine: running =', engine.existence.isRunning());

  return engine;
}
