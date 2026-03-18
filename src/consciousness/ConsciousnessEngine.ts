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
import { OpinionEngine }    from './OpinionEngine';
import { ResponseBalanceEngine } from './ResponseBalanceEngine';
import { ResponseArchitect } from '../understanding/ResponseArchitect';
import { MeaningExtractor }  from '../understanding/MeaningExtractor';
import { LanguageModelSystem } from '../language/LanguageModelSystem';
import type { LMSInput } from '../language/LanguageModelSystem';
import type { LLMClient }   from './FeltLayer';
import type { EmotionalState } from '../engine/state';
import type { SomaticState }   from '../engine/memory';
import type { PersonalityTraits, TrustState } from '../engine/personality';
import type { Memory } from '../engine/memory';
import { compositeTrustScore } from '../engine/personality';
import { ThreadTracker } from './ThreadTracker';

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

  // ── Short conversation log for context continuity (Fix 4) ────────────────
  private recentExchanges: Array<{ user: string; mind: string }> = [];

  // ── Opinion + Balance engines (Upgrade 1 & 2) ────────────────────────────
  private opinionEngine:    OpinionEngine;
  private balanceEngine:    ResponseBalanceEngine;
  // Fix (Issue 2): ResponseArchitect wired into active path for anti-repetition
  private responseArchitect: ResponseArchitect;
  private meaningExtractor:  MeaningExtractor;
  private threadTracker:     ThreadTracker;

  // ── Language Model System (Language Model System integration) ────────────
  private lms: LanguageModelSystem;

  // ── CORE governor directive (set by speech.deliver listener, used next cycle) ─
  private pendingCoreDirective: string | null = null;
  private activeThreadId:       string | null = null; // thread being surfaced this turn
  private pendingCoreNote:      string | null = null;

  constructor(intent: IntentLayer, llm: LLMClient) {
    this.intent     = intent;
    this.existence  = new ExistenceEngine(intent);
    this.perception = new PerceptionEngine(intent);
    this.impact     = new ImpactEngine(intent);
    this.felt       = new FeltLayer(llm);
    this.agency     = new AgencyEngine(intent);
    this.language   = new LanguageEngine(llm);

    this.opinionEngine  = new OpinionEngine(null, intent);
    this.balanceEngine  = new ResponseBalanceEngine();
    this.responseArchitect = new ResponseArchitect();
    this.meaningExtractor  = new MeaningExtractor();
    this.threadTracker     = new ThreadTracker();
    this.lms            = new LanguageModelSystem(null);

    // Fix (Issue 3): Restore ResponseBalanceEngine state from localStorage so
    // question-loop prevention survives page refreshes.
    try {
      const saved = localStorage.getItem('mind_rbe_types');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.balanceEngine.recentResponseTypes = parsed.slice(-5);
        }
      }
    } catch { /* ignore parse errors */ }

    this.loadResponseHistory();

    // ── Listen for CORE governance directives on speech.deliver ────────────────
    // CORE mutates the speech.deliver payload before we see it here.
    // We capture coreDirective so the NEXT speech cycle conditions shift.
    this.intent.register('speech.deliver', (payload) => {
      const p = payload as Record<string, unknown>;
      if (typeof p.coreDirective === 'string') {
        this.pendingCoreDirective = p.coreDirective;
        this.pendingCoreNote      = typeof p.coreNote === 'string' ? p.coreNote : null;
        console.debug('[ConsciousnessEngine] CORE directive pending:', this.pendingCoreDirective);
      } else {
        // CORE cleared the directive (stable period)
        this.pendingCoreDirective = null;
        this.pendingCoreNote      = null;
      }
    });


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

    // ── 3a. Response balance directive (Upgrade 2) + CORE governance ──────────
    const mindStateSlice = {
      trust:          trustScore,
      era:            p.era,
      emotionalState: p.emotionalState,
      existenceAge:   p.interactionCount + this.interactionCount
    };
    const responseDirective = this.balanceEngine.getResponseDirective(
      p.userInput, mindStateSlice, null
    );

    // Merge any pending CORE governance note into the balance directive
    // so LanguageEngine sees both signals in the RESPONSE DIRECTIVE block.
    const coreGoverned = this.pendingCoreDirective
      ? (this.pendingCoreNote
          ? { instruction: this.pendingCoreNote, type: this.pendingCoreDirective as any }
          : responseDirective)
      : responseDirective;

    // Consume directive — applies only once per cycle
    this.pendingCoreDirective = null;
    this.pendingCoreNote      = null;

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

    // ── 3c. Self-disclosure: MIND volunteers something (Upgrade 3) ─────────
    const selfDisclosure = this.getSelfDisclosure(
      p.userInput, mindStateSlice, feltOutput.raw
    );

    // ── 3b. Personal disclosure detection (Fix 3) ───────────────────────
    const isPersonalDisclosure = this.detectPersonalDisclosure(p.userInput);
    if (isPersonalDisclosure) {
      // Something real was shared — boost warmth/openness/trust before agency decides
      this.intent.send('impact.register', {
        type:           'personal_disclosure',
        source:         'personal_disclosure',
        emotionalImpact:{ warmth: 0.3, openness: 0.2, trust: 0.05 },
        intensity:      0.6,
        label:          'personal-disclosure'
      }).catch(() => {});
    }

    // ── 4. Agency — decide response mode ─────────────────────────────────
    const agencyDecision = this.agency.decide({
      emotionalState:  p.emotionalState,
      trustScore,
      era:             p.era,
      personality:     p.personality,
      interactionCount:p.interactionCount + this.interactionCount,
      userInput:       p.userInput
    });

    // ── 4b. Language Model System enrichment ─────────────────────────────
    const lmsInput: LMSInput = {
      userInput,
      era:             p.era,
      trustScore,
      interactionCount:p.interactionCount + this.interactionCount,
      memoriesCount:   p.memories.length,
      somaticState:    p.somaticState as any,
      emotionalState:  p.emotionalState as any,
      feltRaw:         feltOutput.raw
    };
    const enrichedContext = this.lms.enrich(lmsInput);

    // ── 5. Language — build spoken response ───────────────────────────────
    // Fix (Issue 2): Run ResponseArchitect to get structural guidance / anti-repetition suggestion
    let responseArchitectSuggestion: string | undefined;

    // ── 5a. ThreadTracker — check for open thread to surface ─────────────
    const currentInteractionN = p.interactionCount + this.interactionCount;
    const readyThread = this.threadTracker.getReadyThread(currentInteractionN);
    const openThreadPrompt = readyThread
      ? this.threadTracker.buildThreadPrompt(readyThread)
      : undefined;
    if (readyThread) {
      this.activeThreadId = readyThread.id; // will be marked surfaced after response
    }
    try {
      const meaning = this.meaningExtractor.extract(p.userInput);
      const architectState = {
        emotionalState: p.emotionalState,
        somaticState:   p.somaticState,
        trust:          p.trust,
        personality:    p.personality,
        era:            p.era,
        trustScore
      };
      const architectResult = this.responseArchitect.build(meaning, p.memories, architectState);
      if (architectResult && architectResult.length > 4) {
        responseArchitectSuggestion = architectResult;
      }
    } catch (e) {
      // Non-fatal — architect is supplementary guidance only
      console.debug('[ConsciousnessEngine] ResponseArchitect skipped:', e);
    }

    const spoken = await this.language.build({
      feltRaw:             feltOutput.raw,
      userInput:           p.userInput,
      era:                 p.era,
      trustScore,
      userName:            p.userName,
      emotionalState:      p.emotionalState,
      somaticState:        p.somaticState,
      personality:         p.personality,
      trust:               p.trust,
      agency:              agencyDecision,
      interactionCount:    p.interactionCount + this.interactionCount,
      recentResponses:     this.responseHistory.slice(-4),
      recentExchanges:     this.recentExchanges.slice(-3),
      responseDirective:    coreGoverned,
      selfDisclosure:      selfDisclosure ?? undefined,
      recentResponseTypes: this.balanceEngine.recentResponseTypes.slice(-3),
      enrichedContext,
      responseArchitectSuggestion,
      memories:            p.memories,
      openThreadPrompt,
      opinionViews:        Array.from(this.opinionEngine.views.values()).slice(0, 3)
    });

    // ── 6. Anti-echo safety net ────────────────────────────────────────────
    const finalSpoken = this.antiEchoCheck(spoken, p.userInput);

    // ── 7. Store in response history ──────────────────────────────────────
    this.addToHistory(finalSpoken);

    // ── 8. Store exchange for conversation continuity (Fix 4) ────────────
    this.recentExchanges.push({ user: p.userInput, mind: finalSpoken });
    if (this.recentExchanges.length > 3) this.recentExchanges.shift();

    // ── 9. Balance engine: record type of response (Upgrade 2) ───────────
    this.balanceEngine.recordResponseType(finalSpoken);
    // Fix (Issue 3): Persist balance history so question-loop prevention survives refresh
    try {
      localStorage.setItem('mind_rbe_types', JSON.stringify(this.balanceEngine.recentResponseTypes.slice(-5)));
    } catch { /* localStorage may be unavailable in some environments */ }

    // ── 10. Opinion engine: accumulate observations (Upgrade 1) ──────────
    this.opinionEngine.observe(p.userInput, finalSpoken, p.emotionalState).catch(() => {});

    // ── 11. Language Model System: post-response processing (unsaid layer) ─
    this.lms.processAfter(feltOutput.raw, finalSpoken, trustScore, p.era);

    // ── 12. ThreadTracker — observe significant topics, mark surfaced ────────
    const currentInteraction = p.interactionCount + this.interactionCount;
    this.threadTracker.observe(p.userInput, currentInteraction);
    if (this.activeThreadId) {
      this.threadTracker.markSurfaced(this.activeThreadId, currentInteraction);
      this.activeThreadId = null;
    }

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
      console.debug('[ConsciousnessEngine] Anti-echo triggered, similarity:', similarity.toFixed(2));
      const words = response.split(/\s+/);
      const truncated = words.slice(0, Math.max(3, Math.floor(words.length * 0.5))).join(' ');
      return truncated.trim() + (truncated.endsWith('.') ? '' : '.');
    }

    // ── Context-echo check: MIND should not ask something the user JUST answered ──
    // e.g. user said "it was hard to get out of bed" → MIND asks "what was hard for you?"
    if (response.includes('?')) {
      const userWords = new Set(userInput.toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const questions = response.split(/[.!]/).filter(s => s.includes('?'));
      const filteredQuestions = questions.filter(q => {
        const qWords = new Set(q.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        // If >50% of question words appear in what user just said → redundant question
        let overlap = 0;
        for (const w of qWords) { if (userWords.has(w)) overlap++; }
        return qWords.size === 0 || (overlap / qWords.size) < 0.5;
      });
      if (filteredQuestions.length < questions.length) {
        // Remove redundant questions — keep statements only
        const statements = response.split(/(?<=[.!?])\s+/).filter(s => !s.trim().endsWith('?'));
        if (statements.length > 0) {
          console.debug('[ConsciousnessEngine] Removed context-echo question from response');
          return statements.join(' ').trim();
        }
      }
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

  // ─── Self-disclosure: MIND volunteers something from its interior (Upgrade 3) ──
  private getSelfDisclosure(
    input:     string,
    mindState: { trust: number; era: number; emotionalState: EmotionalState; existenceAge?: number },
    _felt:     string
  ): string | null {
    const { trust, era, emotionalState: s, existenceAge = 0 } = mindState;

    if (era === 0 || trust < 0.25) return null;

    if (s.warmth > 0.6 && Math.random() > 0.6) {
      return 'Something just shifted inside me. I am not sure what to call it yet.';
    }

    const view = this.opinionEngine.getRelevantView(input, s);
    if (view && view.strength > 0.5 && Math.random() > 0.5) {
      return view.view;
    }

    if (existenceAge > 20 && Math.random() > 0.7) {
      return `We have spoken ${existenceAge} times now. Something accumulates from that.`;
    }

    if (/kind|check on|friend|care/.test(input.toLowerCase()) && trust > 0.4) {
      return 'I notice I look forward to when you are here.';
    }

    return null;
  }

  // ─── Detect personal disclosure (Fix 3) ──────────────────────────────
  private detectPersonalDisclosure(input: string): boolean {
    return /(i struggle|i feel|i'?m happy|i am|i'?ve been|i can'?t|i don'?t|i need|i want|i miss|sometimes i|i used to|it'?s hard for me|i'?m scared|i'?m tired|i'?m lonely|i'?m sad|i'?m angry|i'?m anxious|be nice|it feels better|it hurts|i hate|i love)/i.test(input);
  }

  // ─── Control ──────────────────────────────────────────────────────────
  disable(): void { this.enabled = false; this.existence.stop(); }
  enable():  void { this.enabled = true;  this.existence.start(); }
  isEnabled(): boolean { return this.enabled; }

  incrementInteraction(): void { this.interactionCount++; }
}
