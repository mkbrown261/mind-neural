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
import { IdentityFormationEngine } from './IdentityFormationEngine';
import type { IdentityContext } from './IdentityFormationEngine';
import type { LLMClient }   from './FeltLayer';
import type { EmotionalState } from '../engine/state';
import type { SomaticState }   from '../engine/memory';
import type { PersonalityTraits, TrustState } from '../engine/personality';
import type { Memory } from '../engine/memory';
import { compositeTrustScore } from '../engine/personality';
import { ThreadTracker } from './ThreadTracker';
import { EmotionalMomentumEngine } from '../emotion/EmotionalMomentumEngine';
import { UnconsciousLayer }        from './UnconsciousLayer';
import { InnerMonologue }          from './InnerMonologue';
import { RelationshipMap }         from '../relational/RelationshipMap';
import { AlmostSaidArchive }       from './AlmostSaidArchive';

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

  // ── Identity Formation Engine (8 core directives) ────────────────────────
  private identityEngine: IdentityFormationEngine;

  // ── v2: expanded consciousness engines ────────────────────────────────────────────────────
  private momentumEngine:    EmotionalMomentumEngine;
  private unconsciousLayer:  UnconsciousLayer;
  private innerMonologue:    InnerMonologue;
  private relationshipMap:   RelationshipMap;
  private almostSaidArchive: AlmostSaidArchive;

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
    this.identityEngine = new IdentityFormationEngine(intent);

    // ── v2 engines ──────────────────────────────────────────────────────────────
    this.momentumEngine    = new EmotionalMomentumEngine();
    this.unconsciousLayer  = new UnconsciousLayer();
    this.innerMonologue    = new InnerMonologue(llm);
    this.relationshipMap   = new RelationshipMap();
    this.almostSaidArchive = new AlmostSaidArchive();
    this.almostSaidArchive.load();

    // Wire InnerMonologue to ExistenceEngine tick via IntentLayer
    this.intent.register('existence.tick', async () => {
      const recent = this.recentExchanges.slice(-1)[0];
      if (!recent) return;
      this.innerMonologue.setLastExchange(recent.user, recent.mind);
      await this.innerMonologue.tick({
        dominantEmotion: 'present',
        era: 0,
        interactionCount: this.interactionCount,
      });
    });

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
    // Restore persisted exchanges from previous sessions
    try {
      const savedExchanges = localStorage.getItem('mind_c_recent_exchanges');
      if (savedExchanges) {
        const parsed = JSON.parse(savedExchanges);
        if (Array.isArray(parsed)) this.recentExchanges = parsed.slice(-5);
      }
    } catch { /* localStorage may be unavailable */ }

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

    // ── Listen for Growth Interface belief nudge ──────────────────────────────
    this.intent.register('identity.nudge', (payload) => {
      const p = payload as { statement?: string; direction?: 'reinforce' | 'diminish' };
      if (p.statement) {
        this.identityEngine.nudgeBelief(p.statement, p.direction ?? 'reinforce');
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

    // ── 2b. Unconscious Layer — process below awareness ──────────────────────
    this.unconsciousLayer.process(p.userInput, p.emotionalState.arousal ?? 0.3);

    // ── 2c. Inner Monologue — get what MIND was thinking between messages ──────
    const innerThought = this.innerMonologue.getActiveThought();

    // ── 2d. Unconscious surfacing ─────────────────────────────────────────────
    const unconsciousContent = this.unconsciousLayer.getSurfacingContent();


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

    // ── 4b. Identity Formation — observe input, build context ────────────────
    // ── 4b. Identity Formation — getContext() pre-response snapshot ────────────
    // IMPORTANT: Do NOT call observe() here — it increments interactionCount and
    // mutates belief/pattern state. The real observe() runs at step 12 (post-response),
    // which is the correct place. Calling it twice per turn inflates interaction counts
    // 2x, corrupting era gates, trust stages, and personality expressions.
    // If IdentityFormationEngine does not yet have a getContext() method, fall back to
    // a minimal observe() with empty mindResponse — but fix the double-observe ASAP.
    let identityCtx: IdentityContext;
    if (typeof (this.identityEngine as any).getContext === 'function') {
      identityCtx = (this.identityEngine as any).getContext(
        p.userInput,
        p.emotionalState as any,
        trustScore
      );
    } else {
      // Fallback: use observe() but pass interactionCount guard to avoid double-count
      identityCtx = this.identityEngine.observe(
        p.userInput,
        '',
        p.emotionalState as any,
        trustScore
      );
    }

    // ── 4c. Language Model System enrichment ───────────────────────────────
    const lmsInput: LMSInput = {
      userInput:       p.userInput,
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

    // Check AlmostSaidArchive — is there something MIND finally says?
    const almostSaidItem = this.almostSaidArchive.getReady(trustScore, p.userInput);

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
      identityContext: identityCtx,
      responseArchitectSuggestion,
      memories:            p.memories,
      openThreadPrompt,
      opinionViews:        Array.from(this.opinionEngine.views.values()).slice(0, 3),
      // v2 new directives
      unconsciousContent:  unconsciousContent?.content ?? undefined,
      innerThought:        innerThought ?? undefined,
      momentumDescription: this.momentumEngine.describe(),
      relationalD16:       this.relationshipMap.getD16Context(),
      relationalD17:       this.relationshipMap.getD17Patterns(),
      almostSaid:          almostSaidItem ? { topic: almostSaidItem.topic, whyHeld: almostSaidItem.whyHeld } : null,
    });

    // ── 6. Anti-echo safety net ────────────────────────────────────────────
    let finalSpoken = this.antiEchoCheck(spoken, p.userInput);

    // ── 6b. Blank-response guard — MIND must never go silent ──────────────
    // If antiEchoCheck or anything upstream produced an empty string, use
    // the safest possible minimal response rather than outputting nothing.
    if (!finalSpoken || finalSpoken.trim().length < 2) {
      console.warn('[ConsciousnessEngine] Empty response after antiEchoCheck — using safe fallback');
      finalSpoken = spoken.trim() || 'yeah.'; // prefer original over silence
    }

    // ── 7. Store in response history ──────────────────────────────────────
    this.addToHistory(finalSpoken);

    // ── 8. Store exchange for conversation continuity (Fix 4) ────────────
    this.recentExchanges.push({ user: p.userInput, mind: finalSpoken });
    if (this.recentExchanges.length > 5) this.recentExchanges.shift();
    // Persist exchanges so session continuity survives refresh
    try {
      localStorage.setItem('mind_c_recent_exchanges', JSON.stringify(this.recentExchanges.slice(-5)));
    } catch { /* localStorage may be unavailable */ }

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

    // ── 12. Identity Formation: post-response update ──────────────────────
    this.identityEngine.observe(p.userInput, finalSpoken, p.emotionalState as any, trustScore);

    // ── 12. ThreadTracker — observe significant topics, mark surfaced ────────
    const currentInteraction = p.interactionCount + this.interactionCount;
    this.threadTracker.observe(p.userInput, currentInteraction);
    if (this.activeThreadId) {
      this.threadTracker.markSurfaced(this.activeThreadId, currentInteraction);
      this.activeThreadId = null;
    }

    // ── v2 post-turn updates ─────────────────────────────────────────────────────────
    this.momentumEngine.postTurn();
    this.innerMonologue.postTurn(finalSpoken);
    this.innerMonologue.setLastExchange(p.userInput, finalSpoken);
    this.unconsciousLayer.postProcess(finalSpoken);
    this.almostSaidArchive.postTurn();
    this.interactionCount++;
    this.relationshipMap.update({
      userInput:        p.userInput,
      mindResponse:     finalSpoken,
      emotionalArousal: p.emotionalState.arousal ?? 0.3,
      trustScore,
      interactionCount: p.interactionCount + this.interactionCount,
      absenceMs:        0,
    });
    // Store almost-said when felt was rich but response was very brief
    if (feltOutput.raw.length > 80 && finalSpoken.trim().split(/\s+/).length < 7) {
      this.almostSaidArchive.store({
        turn:           p.interactionCount + this.interactionCount,
        actualResponse: finalSpoken,
        topic:          p.userInput.substring(0, 60),
        whyHeld:        'too_much',
      });
    }

    return { felt: feltOutput.raw, spoken: finalSpoken, mode: agencyDecision.mode };
  }

  // ─── Anti-echo safety net ─────────────────────────────────────────────
  private antiEchoCheck(response: string, userInput: string): string {
    if (this.responseHistory.length === 0) return response;

    const recentN = this.responseHistory.slice(-3); // check last 3

    // ── Exact / near-exact repeat check ─────────────────────────────────
    // Only flag HIGH similarity (0.80+) to avoid killing short casual replies.
    // Short responses like "yeah." / "i'm here." share high Jaccard by nature —
    // don't penalize them unless they're genuinely the same sentence.
    for (const prev of recentN) {
      if (!prev || prev.trim().length < 8) continue; // skip very short prev entries
      const similarity = this.jaccardSimilarity(response, prev);
      if (similarity > 0.80) {
        console.debug('[ConsciousnessEngine] Anti-echo triggered (similarity:', similarity.toFixed(2), ')');
        // Do NOT truncate — a truncated similar response is still similar.
        // Instead: remove the most repeated sentence and return what remains.
        // If nothing substantive remains, return a minimal grounded phrase.
        const sentences = response.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const filtered = sentences.filter(s => {
          const sWords = s.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const overlap = sWords.filter(w => prevWords.has(w)).length;
          return sWords.length === 0 || (overlap / Math.max(sWords.length, 1)) < 0.5;
        });
        if (filtered.length > 0) return filtered.join(' ').trim();
        // All sentences were echoes — return a varied minimal marker
        const variantFallbacks = ['okay.', 'yeah.', 'go on.', 'tell me more.', 'what else?', 'still here.'];
        return variantFallbacks[Math.floor(Date.now() / 1500) % variantFallbacks.length];
      }
    }

    // ── Opening-phrase repeat check ──────────────────────────────────────
    // Block responses that start with identical 6+ character phrase as a recent one.
    // Must be longer than 4 chars AND the response must be >8 words to avoid
    // false-positives on short answers ("yeah.", "okay.", "i'm here.")
    const openingWords = (s: string) => s.trim().toLowerCase().split(/\s+/).slice(0, 5).join(' ');
    const thisOpening = openingWords(response);
    const responseWordCount = response.trim().split(/\s+/).length;
    if (thisOpening.length > 6 && responseWordCount > 8) {
      const openingCount = recentN.filter(p => p && openingWords(p) === thisOpening).length;
      if (openingCount >= 1) {
        console.debug('[ConsciousnessEngine] Opening-phrase echo blocked:', thisOpening);
        // Strip the first sentence (which has the repeated opening) and keep the rest.
        // If nothing remains, return a varied minimal marker.
        const sentences = response.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) return sentences.slice(1).join(' ').trim();
        // Only one sentence and it echoes — return a varied minimal marker
        const variantFallbacks = ['yeah.', 'okay.', 'tell me more.', 'go on.', 'what else?', 'still with you.'];
        return variantFallbacks[Math.floor(Date.now() / 1500) % variantFallbacks.length];
      }
    }

    // ── Structural echo check — catches same structure with different words ────────────
    // Jaccard misses cases like: "You carry this." vs "You hold that." (different words, same pattern)
    // Detect: same sentence count + same opening word + similar length = structural repeat
    if (this.responseHistory.length >= 2) {
      const recentTwo = this.responseHistory.slice(-2);
      const thisSentences = response.split(/[.!?]/).filter(s => s.trim().length > 2);
      const thisOpener = response.trim().toLowerCase().split(/\s+/)[0] ?? '';
      const thisLength = response.trim().split(/\s+/).length;
      
      for (const prev of recentTwo) {
        if (!prev || prev.length < 5) continue;
        const prevSentences = prev.split(/[.!?]/).filter(s => s.trim().length > 2);
        const prevOpener = prev.trim().toLowerCase().split(/\s+/)[0] ?? '';
        const prevLength = prev.trim().split(/\s+/).length;
        
        const sameOpener = thisOpener === prevOpener && thisOpener.length > 2;
        const sameCount = thisSentences.length === prevSentences.length;
        const similarLength = Math.abs(thisLength - prevLength) <= 3;
        
        // If opener + sentence count + length all match: structural repeat
        if (sameOpener && sameCount && similarLength && thisLength > 4) {
          console.debug('[ConsciousnessEngine] Structural echo detected:', thisOpener);
          // Drop the first sentence and keep the rest (changes the structure)
          const parts = response.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
          if (parts.length > 1) return parts.slice(1).join(' ').trim();
          // Can't slice — rotate opener
          const openerVariants: Record<string, string> = {
            'you': 'yeah,', 'i': 'okay,', 'yeah': 'right,', 'okay': 'still,', 'still': 'look,'
          };
          const newOpener = openerVariants[thisOpener] ?? 'well,';
          return newOpener + ' ' + response.trim();
        }
      }
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

  // ─── MindPersistence pass-throughs ────────────────────────────────────
  // Called from app.ts for media uploads and Growth Interface nudges.
  processMedia(mediaRecord: object): void {
    try { this.identityEngine.processMedia(mediaRecord as any); } catch (_) {}
  }

  nudgeBelief(statement: string, direction: 'reinforce' | 'diminish'): void {
    try { this.identityEngine.nudgeBelief(statement, direction); } catch (_) {}
  }

  getSessionInfo(): { gapMs: number; gapLabel: string; sessionCount: number } {
    try { return this.identityEngine.getSessionInfo(); } catch (_) { return { gapMs: 0, gapLabel: '', sessionCount: 0 }; }
  }
}
