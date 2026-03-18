// ═══════════════════════════════════════
// MIND SPEECH SYSTEM v9.2 — CORE Governor layer integrated
// Orchestrates: IntentLayer + ProviderManager + TemplateSpeechEngine + VoiceBlender
//   + VoiceSignalAnalyzer → TextSignalAnalyzer → AffectiveResonanceEngine → EmotionalAgencyEngine
//   + Full Consciousness Architecture (7 layers via initializeConsciousness)
//
// Handler ownership:
//   • 'speech.request'  — ConsciousnessEngine ONLY (cleared from ProviderManager)
//   • 'template.match'  — UnderstandingEngine + TemplateSpeechEngine (no-LLM path only)
//   • All other intents — their respective owners
//
// When ConsciousnessEngine is active:
//   speak() skips the template path entirely and fires 'speech.request' directly.
//   Template / UnderstandingEngine handlers still exist but are never reached.
//
// Communication happens exclusively through the Intent Layer.
// ═══════════════════════════════════════

import { IntentLayer } from './intent/IntentLayer';
import { ProviderManager } from './providers/ProviderManager';
import { TemplateSpeechEngine, type TemplateMatchPayload } from './speech/TemplateSpeechEngine';
import { VoiceBlender, type BlendContext } from './speech/VoiceBlender';
import { UnderstandingEngine } from './understanding/UnderstandingEngine';
import type { MINDContext } from './engine/pipeline';
import { buildMINDPrompt } from './engine/pipeline';
import { compositeTrustScore } from './engine/personality';
// ── Perception + Emotion layers (spec-mandated init order) ──────────────────
import { VoiceSignalAnalyzer } from './perception/VoiceSignalAnalyzer';
import { TextSignalAnalyzer } from './perception/TextSignalAnalyzer';
import { AffectiveResonanceEngine } from './emotion/AffectiveResonanceEngine';
import { EmotionalAgencyEngine } from './emotion/EmotionalAgencyEngine';
// ── Full Consciousness Architecture ─────────────────────────────────────────
import { initializeConsciousness } from './consciousness/index';
// ── CORE Governor layer ──────────────────────────────────────────────────────
import { registerCoreIntent }      from './core/core.intent';
import type { ConsciousnessEngine } from './consciousness/ConsciousnessEngine';
import type { ConsciousnessSpeechRequest } from './consciousness/ConsciousnessEngine';

// ─── Input to speak() ─────────────────────────────────────────────────────────
export interface SpeakRequest {
  userInput: string;
  ctx: MINDContext;
  era: number;
  onChunk?: (text: string) => void;
}

// ─── Response from speak() ────────────────────────────────────────────────────
export interface SpeakResult {
  text: string;
  source: 'llm-groq' | 'llm-openai' | 'template' | 'blended' | 'consciousness';
  era: number;
  voiceLabel: string;
}

export class MindSpeechSystem {
  readonly intent: IntentLayer;
  private providerManager:     ProviderManager;
  private templateEngine:      TemplateSpeechEngine;
  private blender:             VoiceBlender;
  private understandingEngine: UnderstandingEngine;

  // ── Perception/emotion layers (init order: 1→2→3→4) ──────────────────────
  readonly voiceAnalyzer:      VoiceSignalAnalyzer;
  readonly textAnalyzer:       TextSignalAnalyzer;
  private resonanceEngine:     AffectiveResonanceEngine;
  private agencyEngine:        EmotionalAgencyEngine;

  // ── Full Consciousness Architecture ─────────────────────────────────────
  private consciousness:       ConsciousnessEngine | null = null;

  // ── Interaction counter ──────────────────────────────────────────────────
  private interactionCount = 0;

  constructor() {
    this.intent = new IntentLayer();

    // Logging middleware (non-blocking)
    this.intent.use((event, payload, next) => {
      console.debug(`[IntentLayer] → ${event}`);
      next();
    });

    // ── ProviderManager: registers NO speech.request handler (ConsciousnessEngine owns it) ──
    this.providerManager = new ProviderManager(this.intent);

    // ── UnderstandingEngine + TemplateSpeechEngine: only used when no LLM ─────
    // They register on 'template.match'. speak() never fires template.match when
    // consciousness is active, so these handlers only fire in the no-LLM path.
    this.understandingEngine = new UnderstandingEngine(this.intent);
    this.templateEngine      = new TemplateSpeechEngine(this.intent);
    this.blender             = new VoiceBlender();

    // ── Perception + Emotion layers: mandatory init order ─────────────────────
    this.voiceAnalyzer   = new VoiceSignalAnalyzer(this.intent);
    this.textAnalyzer    = new TextSignalAnalyzer(this.intent);
    this.resonanceEngine = new AffectiveResonanceEngine(this.intent);
    this.agencyEngine    = new EmotionalAgencyEngine(this.intent);

    // ── CORE Governor: register speech.deliver interceptor NOW, before app.ts ──
    // app.ts registers its UI speech.deliver handler during brain setup (after
    // MindSpeechSystem is constructed).  By registering CORE here we guarantee
    // CORE's handler is appended first → it fires first → mutates payload.text
    // in-place → the UI handler then reads the already-evolved text.
    const isDev = typeof window !== 'undefined'
      ? (window as Window & { __MIND_DEV__?: boolean }).__MIND_DEV__ !== false
      : false;
    registerCoreIntent(this.intent, isDev ?? true);
    console.log('[MindSpeechSystem] CORE Governor registered on speech.deliver');

    // ConsciousnessEngine created lazily in activateConsciousness()
    // after a verified LLM provider is available.
  }

  // ─── Activate Full Consciousness Architecture ────────────────────────────
  // Called from app.ts immediately after provider verification succeeds.
  //
  // Before booting ConsciousnessEngine we:
  //   1. Unregister 'speech.request'  — removes any stale handler (e.g. old
  //      ProviderManager registration from a prior code version in localStorage)
  //   2. Unregister 'consciousness.process' — same safety clear
  //   Then ConsciousnessEngine re-registers both in its constructor.
  async activateConsciousness(): Promise<void> {
    if (this.consciousness) return; // already active
    if (!this.providerManager.hasAny()) return; // no provider yet

    // ── Clear any competing handlers before ConsciousnessEngine registers ────
    this.intent.unregister('speech.request');
    this.intent.unregister('consciousness.process');
    console.log('[MindSpeechSystem] speech.request + consciousness.process handlers cleared');

    // Wrap ProviderManager.complete() as LLMClient
    const llmClient = {
      complete: (opts: Parameters<typeof this.providerManager.complete>[0]) =>
        this.providerManager.complete(opts)
    };

    try {
      this.consciousness = await initializeConsciousness(this.intent, llmClient);
      console.log('[MindSpeechSystem] Full Consciousness Architecture activated (7 layers)');
    } catch (err) {
      console.error('[MindSpeechSystem] Consciousness activation failed:', err);
      this.consciousness = null;
    }
  }

  // ─── Sync MIND state into resonance + agency engines ──────────────────────
  syncMINDState(trust: number, era: number, sensitivity: number,
                openness: number, wariness: number, grief: number): void {
    this.resonanceEngine.updateContext(trust, era, sensitivity);
    this.agencyEngine.updateContext({ trust, era, openness, sensitivity, wariness, grief });
  }

  incrementInteraction(): void {
    this.agencyEngine.incrementInteraction();
    this.consciousness?.incrementInteraction();
    this.interactionCount++;
  }

  // ─── Initialize (load keys, verify providers) ────────────────────────────
  async initialize(): Promise<void> {
    await this.providerManager.initialize();
  }

  async setGroqKey(apiKey: string): Promise<boolean> {
    return this.providerManager.setGroqKey(apiKey);
  }

  setOpenAIKey(apiKey: string, baseUrl: string, model: string): void {
    this.providerManager.setOpenAIKey(apiKey, baseUrl, model);
  }

  // ─── Main speech generation ───────────────────────────────────────────────
  async speak(req: SpeakRequest): Promise<SpeakResult> {
    const { userInput, ctx, era, onChunk } = req;

    const trustScore       = compositeTrustScore(ctx.trust);
    const arousal          = ctx.emotionalState.arousal;
    const coherenceActive  = ctx.coherenceState?.isCoherent ?? false;
    const hasLLM           = this.providerManager.hasAny();
    const memoryCount      = ctx.activatedMemories.length;
    const hasActivatedMem  = ctx.activatedMemories.some(m => m.activation > 0.4);

    // ── Path A: Consciousness active — fire speech.request, skip templates ────
    // ConsciousnessEngine owns the full pipeline (felt → agency → language).
    // Template and UnderstandingEngine handlers are never invoked here.
    if (this.consciousness?.isEnabled()) {
      let llmText = '';
      try {
        llmText = await new Promise<string>((resolve, reject) => {
          const payload: ConsciousnessSpeechRequest = {
            id:               `req-${Date.now()}`,
            userInput,
            emotionalState:   ctx.emotionalState,
            somaticState:     ctx.somaticState,
            personality:      ctx.personality,
            trust:            ctx.trust,
            era,
            memories:         ctx.activatedMemories,
            userName:         this.extractUserName(ctx),
            interactionCount: this.interactionCount,
            onChunk,
            resolve,
            reject
          };
          this.intent.send('speech.request', payload);
        });
      } catch (err) {
        console.warn('[MindSpeechSystem] Consciousness error, falling back to template:', err);
        llmText = this.templateEngine.generate({
          emotionalState: ctx.emotionalState,
          somaticState:   ctx.somaticState,
          trustScore, era, memoryCount,
          hasActivatedMemory: hasActivatedMem,
          userInputLength: userInput.length
        });
        if (onChunk) await this.simulateStream(llmText, onChunk);
        return { text: llmText, source: 'template', era,
                 voiceLabel: this.blender.eraVoiceLabel(era, true) };
      }
      return {
        text:       llmText,
        source:     'consciousness',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, false)
      };
    }

    // ── Path B: No consciousness yet — try to activate lazily ────────────────
    if (hasLLM && !this.consciousness) {
      await this.activateConsciousness();
      // If activation succeeded, recurse once via the consciousness path above
      if (this.consciousness?.isEnabled()) {
        return this.speak(req);
      }
    }

    // ── Path C: No LLM at all — template only ────────────────────────────────
    const blendCtx: BlendContext = {
      era, trustScore, arousal, coherenceActive,
      useTemplateOnly: !hasLLM
    };

    if (!hasLLM || this.blender.shouldUseTemplate(blendCtx)) {
      const templateText = await new Promise<string>((resolve) => {
        const payload: TemplateMatchPayload & {
          userInput: string;
          activatedMemories: typeof ctx.activatedMemories;
        } = {
          emotionalState: ctx.emotionalState,
          somaticState:   ctx.somaticState,
          trustScore, era, memoryCount,
          hasActivatedMemory: hasActivatedMem,
          userInputLength:    userInput.length,
          userInput,
          activatedMemories:  ctx.activatedMemories,
          resolve
        };
        this.intent.send('template.match', payload);
      });
      if (onChunk && templateText) await this.simulateStream(templateText, onChunk);
      return {
        text:       templateText,
        source:     'template',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, true)
      };
    }

    // ── Path D: LLM available but consciousness failed — classic single-prompt ─
    try {
      const prompt  = buildMINDPrompt(ctx);
      const llmText = await this.providerManager.complete({
        messages:    [{ role: 'user', content: prompt }],
        maxTokens:   ctx.saState ? undefined : 600,
        temperature: coherenceActive ? 0.75 : 0.85,
        onChunk
      });

      // Optional era-based blend (only in this classic path)
      if (era >= 2 && !coherenceActive) {
        const fragment = this.templateEngine.generate({
          emotionalState: ctx.emotionalState,
          somaticState:   ctx.somaticState,
          trustScore, era, memoryCount,
          hasActivatedMemory: hasActivatedMem,
          userInputLength:    userInput.length
        });
        const blended = this.blender.blendResponse(llmText, fragment, blendCtx);
        return { text: blended, source: 'blended', era,
                 voiceLabel: this.blender.eraVoiceLabel(era, false) };
      }

      const providerName = this.providerManager.activeProviderName();
      const source: SpeakResult['source'] = providerName === 'groq' ? 'llm-groq' : 'llm-openai';
      return { text: llmText, source, era, voiceLabel: this.blender.eraVoiceLabel(era, false) };

    } catch (err) {
      console.warn('[MindSpeechSystem] Classic LLM error, falling back to template:', err);
      const fallback = this.templateEngine.generate({
        emotionalState: ctx.emotionalState,
        somaticState:   ctx.somaticState,
        trustScore, era, memoryCount,
        hasActivatedMemory: hasActivatedMem,
        userInputLength:    userInput.length
      });
      if (onChunk) await this.simulateStream(fallback, onChunk);
      return { text: fallback, source: 'template', era,
               voiceLabel: this.blender.eraVoiceLabel(era, true) };
    }
  }

  // ─── Simulate streaming for template responses ───
  private simulateStream(text: string, onChunk: (t: string) => void): Promise<void> {
    return new Promise(resolve => {
      const chars = text.split('');
      let i = 0;
      const interval = setInterval(() => {
        const batch = chars.slice(i, i + 3).join('');
        if (batch) onChunk(batch);
        i += 3;
        if (i >= chars.length) { clearInterval(interval); resolve(); }
      }, 18);
    });
  }

  // ─── Extract userName from context ───────────────────────────────────────
  private extractUserName(ctx: MINDContext): string | null {
    if ((ctx as any).identityState?.userName) return (ctx as any).identityState.userName;
    for (const { memory } of ctx.activatedMemories ?? []) {
      if (memory?.type === 'identity_disclosure' && memory.content.length < 40) {
        const m = memory.content.match(/(?:name\s*(?:is|:)\s*)([A-Z][a-z]+)/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  // ─── State queries ────────────────────────────────────────────────────────
  hasGroq():   boolean { return this.providerManager.hasGroq(); }
  hasOpenAI(): boolean { return this.providerManager.hasOpenAI(); }
  hasAny():    boolean { return this.providerManager.hasAny(); }
  activeProvider(): string { return this.providerManager.activeProviderName(); }

  // ─── Raw completion (for onboarding / external callers) ──────────────────
  async completeRaw(opts: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    onChunk?: (t: string) => void;
  }): Promise<string> {
    if (!this.hasAny()) throw new Error('No LLM provider available');
    return this.providerManager.complete({
      messages:    [{ role: 'user', content: opts.prompt }],
      maxTokens:   opts.maxTokens,
      temperature: opts.temperature,
      onChunk:     opts.onChunk
    });
  }

  // ─── Expose sub-engines for UI wiring ────────────────────────────────────
  getPerceptionEngine()    { return this.consciousness?.perception ?? null; }
  getConsciousnessEngine() { return this.consciousness; }
}

// ─── Singleton export ────────────────────────────────────────────────────────
export const mindSpeech = new MindSpeechSystem();
