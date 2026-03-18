// ═══════════════════════════════════════
// CONSCIOUSNESS ENGINE
// Wires all consciousness layers. Central orchestrator.
// Registers 'speech.request' intent. Processes:
//   perception → impact → felt → agency → language
// Applies anti-echo safety net. Delivers speech via 'speech.deliver'.
// Updates trust and saves mind state through intent bus.
// Communicates only via IntentLayer. No Action Layer imports.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import { ExistenceEngine }  from './ExistenceEngine';
import { PerceptionEngine } from './PerceptionEngine';
import { ImpactEngine }     from './ImpactEngine';
import { FeltLayer }        from './FeltLayer';
import { AgencyEngine }     from './AgencyEngine';
import { LanguageEngine }   from './LanguageEngine';
import type { LLMClient }   from './FeltLayer';
import type { EmotionalState } from '../engine/state';
import type { SomaticState }   from '../engine/memory';
import type { PersonalityTraits, TrustState } from '../engine/personality';
import type { Memory } from '../engine/memory';
import { compositeTrustScore } from '../engine/personality';

// ─── Speech request payload (from MindSpeechSystem) ──────────────────────────
export interface ConsciousnessSpeechRequest {
  id:           string;
  userInput:    string;
  emotionalState: EmotionalState;
  somaticState:   SomaticState;
  personality:    PersonalityTraits;
  trust:          TrustState;
  era:            number;
  memories:       Array<{ memory: Memory; activation: number }>;
  userName:       string | null;
  interactionCount:number;
  onChunk?:       (text: string) => void;
  resolve:        (text: string) => void;
  reject:         (err: unknown) => void;
}

// ─── Speech deliver payload ───────────────────────────────────────────────────
export interface ConsciousnessSpeechDeliver {
  requestId:  string;
  text:       string;
  felt:       string;
  era:        number;
  mode:       string;
  timestamp:  number;
}

// ─── Response history for anti-echo ──────────────────────────────────────────
const RESPONSE_HISTORY_KEY = 'mind_c_response_history';
const MAX_RESPONSE_HISTORY = 7;

// ─── ConsciousnessEngine ─────────────────────────────────────────────────────
export class ConsciousnessEngine {
  readonly intent:     IntentLayer;
  readonly existence:  ExistenceEngine;
  readonly perception: PerceptionEngine;
  readonly impact:     ImpactEngine;
  private  felt:       FeltLayer;
  readonly agency:     AgencyEngine;
  private  language:   LanguageEngine;

  private responseHistory: string[] = [];
  private enabled = true;
  private interactionCount = 0;

  constructor(intent: IntentLayer, llm: LLMClient) {
    this.intent     = intent;
    this.existence  = new ExistenceEngine(intent);
    this.perception = new PerceptionEngine(intent);
    this.impact     = new ImpactEngine(intent);
    this.felt       = new FeltLayer(llm);
    this.agency     = new AgencyEngine(intent);
    this.language   = new LanguageEngine(llm);

    this.loadResponseHistory();

    // ── Register: 'speech.request' — primary consciousness entry point ────────
    // MindSpeechSystem fires this instead of consciousness.process
    this.intent.register('speech.request', async (payload) => {
      if (!this.enabled) return;
      const p = payload as ConsciousnessSpeechRequest;

      try {
        const result = await this.process(p);

        // ── Emit felt layer as ui signal ────────────────────────────────────
        this.intent.send('ui.felt_layer', { text: result.felt, era: p.era }).catch(() => {});

        // ── Emit speech.deliver ─────────────────────────────────────────────
        const deliverPayload: ConsciousnessSpeechDeliver = {
          requestId:  p.id,
          text:       result.spoken,
          felt:       result.felt,
          era:        p.era,
          mode:       result.mode,
          timestamp:  Date.now()
        };
        this.intent.send('speech.deliver', deliverPayload).catch(() => {});

        // ── Also emit felt.store for memory integration ─────────────────────
        this.intent.send('felt.store', {
          content:          result.felt,
          encodingStrength: p.emotionalState.arousal ?? 0.4,
          arousal:          p.emotionalState.arousal ?? 0.4
        }).catch(() => {});

        // ── Update trust via intent (ConsciousnessEngine does not call mind.ts) ──
        this.intent.send('consciousness.trust_update', {
          type:        'interaction',
          interactionCount: ++this.interactionCount
        }).catch(() => {});

        // ── Stream spoken text word-by-word if onChunk provided ────────────
        if (p.onChunk && result.spoken) {
          await this.streamSpoken(result.spoken, p.onChunk);
        }

        p.resolve(result.spoken);

      } catch (err) {
        console.error('[ConsciousnessEngine] process error:', err);
        // Graceful fallback
        p.reject(err);
      }
    });

    // ── Also handle 'consciousness.process' (TwoLayerConsciousness compat) ────
    this.intent.register('consciousness.process', async (payload) => {
      if (!this.enabled) return;
      // Map TwoLayerConsciousness payload format to ConsciousnessSpeechRequest
      const p = payload as any;
      if (p.mindCtx) {
        const mapped: ConsciousnessSpeechRequest = {
          id:               p.id ?? `req-${Date.now()}`,
          userInput:        p.userInput,
          emotionalState:   p.mindCtx.emotionalState,
          somaticState:     p.mindCtx.somaticState,
          personality:      p.mindCtx.personality,
          trust:            p.mindCtx.trust,
          era:              p.era ?? 0,
          memories:         p.mindCtx.activatedMemories ?? [],
          userName:         this.extractUserName(p.mindCtx),
          interactionCount: this.interactionCount,
          onChunk:          p.onChunk,
          resolve:          p.resolve,
          reject:           p.reject
        };
        // Re-send as speech.request
        this.intent.send('speech.request', mapped).catch(p.reject);
      }
    });

    // ── Register existence.emotion_delta handler ──────────────────────────────
    // ExistenceEngine sends this periodically
    this.intent.register('existence.emotion_delta', (payload) => {
      // Forward to ConsciousnessEngine state update — app.ts can intercept too
      this.intent.send('consciousness.emotion_delta', payload).catch(() => {});
    });

    // Start existence heartbeat
    this.existence.start();
  }

  // ─── Core pipeline ────────────────────────────────────────────────────
  private async process(p: ConsciousnessSpeechRequest): Promise<{
    felt: string; spoken: string; mode: string
  }> {

    const trustScore = compositeTrustScore(p.trust);

    // ── 1. Perception — get current session metrics ────────────────────────
    const perceptionOutput = await this.getPerceptionSignal(p.userInput);

    // ── 2. Impact — register this interaction ─────────────────────────────
    this.intent.send('impact.register', {
      type:        'user-input',
      intensity:   Math.min(1, p.userInput.length / 200),
      label:       'user-input',
      source:      'consciousness',
      emotionDelta:{}
    }).catch(() => {});

    // Notify ExistenceEngine of user activity
    this.intent.send('existence.user_active', { timestamp: Date.now() }).catch(() => {});
    this.intent.send('existence.emotional_update', {
      emotionalState: p.emotionalState,
      somaticState:   p.somaticState,
      timestamp:      Date.now()
    }).catch(() => {});

    // ── 3. Felt Layer — generate raw interior ─────────────────────────────
    const feltOutput = await this.felt.generate({
      userInput:       p.userInput,
      emotionalState:  p.emotionalState,
      somaticState:    p.somaticState,
      personality:     p.personality,
      trust:           p.trust,
      era:             p.era,
      memories:        p.memories,
      userName:        p.userName,
      perceptionSignal:perceptionOutput ?? undefined
    });

    // ── 4. Agency — decide response mode ─────────────────────────────────
    const agencyDecision = this.agency.decide({
      emotionalState:  p.emotionalState,
      trustScore,
      era:             p.era,
      personality:     p.personality,
      interactionCount:p.interactionCount + this.interactionCount
    });

    // ── 5. Language — build spoken response ───────────────────────────────
    const spoken = await this.language.build({
      feltRaw:         feltOutput.raw,
      userInput:       p.userInput,
      era:             p.era,
      trustScore,
      userName:        p.userName,
      emotionalState:  p.emotionalState,
      somaticState:    p.somaticState,
      personality:     p.personality,
      trust:           p.trust,
      agency:          agencyDecision,
      interactionCount:p.interactionCount + this.interactionCount,
      recentResponses: this.responseHistory.slice(-4)
    });

    // ── 6. Anti-echo safety net ────────────────────────────────────────────
    const finalSpoken = this.antiEchoCheck(spoken, p.userInput);

    // ── 7. Store in response history ──────────────────────────────────────
    this.addToHistory(finalSpoken);

    return { felt: feltOutput.raw, spoken: finalSpoken, mode: agencyDecision.mode };
  }

  // ─── Anti-echo safety net ─────────────────────────────────────────────
  private antiEchoCheck(response: string, userInput: string): string {
    // Check against response history for high similarity
    if (this.responseHistory.length < 2) return response;

    const lastResponse = this.responseHistory[this.responseHistory.length - 1];
    if (!lastResponse) return response;

    const similarity = this.jaccardSimilarity(response, lastResponse);
    if (similarity > 0.70) {
      // Too similar to last response — force minimal variation
      console.debug('[ConsciousnessEngine] Anti-echo triggered, similarity:', similarity.toFixed(2));
      const words = response.split(/\s+/);
      // Truncate to first half to force different continuation next time
      const truncated = words.slice(0, Math.max(3, Math.floor(words.length * 0.5))).join(' ');
      return truncated.trim() + (truncated.endsWith('.') ? '' : '.');
    }

    return response;
  }

  // ─── Jaccard similarity (word sets) ──────────────────────────────────
  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const w of setA) { if (setB.has(w)) intersection++; }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  // ─── Response history management ─────────────────────────────────────
  private addToHistory(response: string): void {
    this.responseHistory.push(response);
    if (this.responseHistory.length > MAX_RESPONSE_HISTORY) this.responseHistory.shift();
    this.saveResponseHistory();
  }

  private saveResponseHistory(): void {
    try {
      localStorage.setItem(RESPONSE_HISTORY_KEY, JSON.stringify(this.responseHistory));
    } catch (_) {}
  }

  private loadResponseHistory(): void {
    try {
      const raw = localStorage.getItem(RESPONSE_HISTORY_KEY);
      if (raw) this.responseHistory = JSON.parse(raw);
    } catch (_) {
      this.responseHistory = [];
    }
  }

  // ─── Perception signal (if available from last session) ──────────────
  private async getPerceptionSignal(userInput: string) {
    // Trigger a lightweight analyze if we have something
    try {
      return this.perception.analyze(userInput);
    } catch (_) {
      return null;
    }
  }

  // ─── Extract userName from context ───────────────────────────────────
  private extractUserName(ctx: any): string | null {
    if (ctx?.identityState?.userName) return ctx.identityState.userName;
    for (const { memory } of ctx?.activatedMemories ?? []) {
      if (memory?.type === 'identity_disclosure' && memory.content.length < 40) {
        const m = memory.content.match(/(?:name\s*(?:is|:)\s*)([A-Z][a-z]+)/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  // ─── Simulate streaming ───────────────────────────────────────────────
  private streamSpoken(text: string, onChunk: (t: string) => void): Promise<void> {
    return new Promise(resolve => {
      const words = text.split(/(\s+)/);
      let i = 0;
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

  // ─── Control ──────────────────────────────────────────────────────────
  disable(): void { this.enabled = false; this.existence.stop(); }
  enable():  void { this.enabled = true;  this.existence.start(); }
  isEnabled(): boolean { return this.enabled; }

  incrementInteraction(): void { this.interactionCount++; }
}
