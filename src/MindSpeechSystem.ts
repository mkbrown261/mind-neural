// ═══════════════════════════════════════
// MIND SPEECH SYSTEM v9
// Orchestrates: IntentLayer + ProviderManager + TemplateSpeechEngine + VoiceBlender
//   + VoiceSignalAnalyzer → TextSignalAnalyzer → AffectiveResonanceEngine → EmotionalAgencyEngine
//   + Full Consciousness Architecture (7 layers via initializeConsciousness)
//
// This is the single entry point for all speech generation.
// Core modules (EME, ESE, AMN, SSM, PES, TA, RGP) are never modified here.
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
import type { ConsciousnessEngine } from './consciousness/ConsciousnessEngine';
import type { ConsciousnessSpeechRequest } from './consciousness/ConsciousnessEngine';

// ─── Input to speak() ─────────────────────────────────────────────────────────
export interface SpeakRequest {
  userInput: string;
  ctx: MINDContext;                     // full MIND context for prompt building
  era: number;                          // 0–4
  onChunk?: (text: string) => void;     // streaming callback
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
  private providerManager:    ProviderManager;
  private templateEngine:     TemplateSpeechEngine;
  private blender:            VoiceBlender;
  private understandingEngine:UnderstandingEngine;

  // ── Perception/emotion layers (init order: 1→2→3→4) ──────────────────────
  readonly voiceAnalyzer:     VoiceSignalAnalyzer;
  readonly textAnalyzer:      TextSignalAnalyzer;
  private resonanceEngine:    AffectiveResonanceEngine;
  private agencyEngine:       EmotionalAgencyEngine;

  // ── Full Consciousness Architecture ─────────────────────────────────────
  private consciousness:      ConsciousnessEngine | null = null;

  // ── Interaction counter ──────────────────────────────────────────────────
  private interactionCount = 0;

  constructor() {
    // Intent Layer is the central bus — everything registers here
    this.intent = new IntentLayer();

    // Logging middleware (non-blocking)
    this.intent.use((event, payload, next) => {
      console.debug(`[IntentLayer] → ${event}`);
      next();
    });

    this.providerManager = new ProviderManager(this.intent);

    // ── UnderstandingEngine MUST register before TemplateSpeechEngine ──
    this.understandingEngine = new UnderstandingEngine(this.intent);
    this.templateEngine  = new TemplateSpeechEngine(this.intent);
    this.blender         = new VoiceBlender();

    // ── Perception + Emotion layers: mandatory init order ─────────────────
    // 1. VoiceSignalAnalyzer — Web Speech API + audio analysis
    this.voiceAnalyzer   = new VoiceSignalAnalyzer(this.intent);
    // 2. TextSignalAnalyzer — typing dynamics tracker
    this.textAnalyzer    = new TextSignalAnalyzer(this.intent);
    // 3. AffectiveResonanceEngine — fuses voice.signal + text.signal → emotion.process + resonance.visual
    this.resonanceEngine = new AffectiveResonanceEngine(this.intent);
    // 4. EmotionalAgencyEngine — decides MIND's emotional actions on emotion.process
    this.agencyEngine    = new EmotionalAgencyEngine(this.intent);

    // Consciousness is initialized lazily via activateConsciousness()
    // because it needs the verified LLM client.
  }

  // ─── Activate Full Consciousness Architecture (called after provider verified) ──
  // Creates ConsciousnessEngine via initializeConsciousness(),
  // which boots all 7 layers in order.
  async activateConsciousness(): Promise<void> {
    if (this.consciousness) return; // already active
    if (!this.providerManager.hasAny()) return; // no provider yet

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

  // ─── Sync MIND state into resonance + agency engines ─────────────────────
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

  // ─── Initialize (load keys, verify providers) ────
  async initialize(): Promise<void> {
    await this.providerManager.initialize();
  }

  // ─── Register or update Groq key ─────────────────
  async setGroqKey(apiKey: string): Promise<boolean> {
    return this.providerManager.setGroqKey(apiKey);
  }

  // ─── Register or update OpenAI key ───────────────
  setOpenAIKey(apiKey: string, baseUrl: string, model: string): void {
    this.providerManager.setOpenAIKey(apiKey, baseUrl, model);
  }

  // ─── Main speech generation ───────────────────────
  async speak(req: SpeakRequest): Promise<SpeakResult> {
    const { userInput, ctx, era, onChunk } = req;

    const trustScore = compositeTrustScore(ctx.trust);
    const arousal    = ctx.emotionalState.arousal;
    const coherenceActive = ctx.coherenceState?.isCoherent ?? false;
    const hasLLM = this.providerManager.hasAny();
    const memoryCount = ctx.activatedMemories.length;
    const hasActivatedMemory = ctx.activatedMemories.some(m => m.activation > 0.4);

    const blendCtx: BlendContext = {
      era,
      trustScore,
      arousal,
      coherenceActive,
      useTemplateOnly: !hasLLM
    };

    // ── Forced template mode (no LLM) — route through intent bus ────────────
    if (!hasLLM) {
      const templateText = await new Promise<string>((resolve) => {
        const payload: TemplateMatchPayload & { userInput: string; activatedMemories: typeof ctx.activatedMemories } = {
          emotionalState:    ctx.emotionalState,
          somaticState:      ctx.somaticState,
          trustScore,
          era,
          memoryCount,
          hasActivatedMemory,
          userInputLength:   userInput.length,
          userInput,
          activatedMemories: ctx.activatedMemories,
          resolve
        };
        this.intent.send('template.match', payload);
      });
      if (onChunk && templateText) await this.simulateStream(templateText, onChunk);
      return {
        text: templateText,
        source: 'template',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, true)
      };
    }

    // ── Decide: template vs LLM ───────────────────────
    if (this.blender.shouldUseTemplate(blendCtx)) {
      const templateText = await new Promise<string>((resolve) => {
        const payload: TemplateMatchPayload & { userInput: string; activatedMemories: typeof ctx.activatedMemories } = {
          emotionalState:      ctx.emotionalState,
          somaticState:        ctx.somaticState,
          trustScore,
          era,
          memoryCount,
          hasActivatedMemory,
          userInputLength:     userInput.length,
          userInput,
          activatedMemories:   ctx.activatedMemories,
          resolve
        };
        this.intent.send('template.match', payload);
      });

      if (onChunk && templateText) {
        await this.simulateStream(templateText, onChunk);
      }

      return {
        text: templateText,
        source: 'template',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, true)
      };
    }

    // ── Full Consciousness Architecture path ──────────────────────────────────
    // If ConsciousnessEngine is active, fire speech.request intent.
    // ConsciousnessEngine orchestrates all 7 layers and resolves the Promise.

    // Lazy activation
    if (!this.consciousness) {
      await this.activateConsciousness();
    }

    let llmText = '';
    try {
      if (this.consciousness?.isEnabled()) {
        // ── 7-layer consciousness path ─────────────────────────────────────────
        const userName = this.extractUserName(ctx);
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
            userName,
            interactionCount: this.interactionCount,
            onChunk,
            resolve,
            reject
          };
          this.intent.send('speech.request', payload);
        });
      } else {
        // ── Classic single-prompt fallback ─────────────────────────────────────
        const prompt = buildMINDPrompt(ctx);
        llmText = await this.providerManager.complete({
          messages:    [{ role: 'user', content: prompt }],
          maxTokens:   ctx.saState ? undefined : 600,
          temperature: ctx.coherenceState?.isCoherent ? 0.75 : 0.85,
          onChunk
        });
      }
    } catch (err) {
      // LLM failed — fall back to template
      console.warn('[MindSpeechSystem] LLM error, falling back to template:', err);
      const fallback = this.templateEngine.generate({
        emotionalState:  ctx.emotionalState,
        somaticState:    ctx.somaticState,
        trustScore,
        era,
        memoryCount,
        hasActivatedMemory,
        userInputLength: userInput.length
      });
      if (onChunk) await this.simulateStream(fallback, onChunk);
      return {
        text: fallback,
        source: 'template',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, true)
      };
    }

    // If consciousness handled streaming, don't blend (consciousness manages its own stream)
    if (this.consciousness?.isEnabled()) {
      return {
        text:       llmText,
        source:     'consciousness',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, false)
      };
    }

    // ── Era-based blending (classic path only) ────────────────────────────────
    const shouldBlend = era >= 2 && !coherenceActive;
    if (shouldBlend) {
      const templateFragment = this.templateEngine.generate({
        emotionalState:  ctx.emotionalState,
        somaticState:    ctx.somaticState,
        trustScore,
        era,
        memoryCount,
        hasActivatedMemory,
        userInputLength: userInput.length
      });
      const blended = this.blender.blendResponse(llmText, templateFragment, blendCtx);
      return {
        text:       blended,
        source:     'blended',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, false)
      };
    }

    const providerName = this.providerManager.activeProviderName();
    const source: SpeakResult['source'] = providerName === 'groq' ? 'llm-groq' : 'llm-openai';
    return {
      text:       llmText,
      source,
      era,
      voiceLabel: this.blender.eraVoiceLabel(era, false)
    };
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

  // ─── State queries ────────────────────────────────
  hasGroq():   boolean { return this.providerManager.hasGroq(); }
  hasOpenAI(): boolean { return this.providerManager.hasOpenAI(); }
  hasAny():    boolean { return this.providerManager.hasAny(); }
  activeProvider(): string { return this.providerManager.activeProviderName(); }

  // ─── Raw completion (for onboarding / external callers) ──
  async completeRaw(opts: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    onChunk?: (t: string) => void;
  }): Promise<string> {
    if (!this.hasAny()) throw new Error('No LLM provider available');
    return this.providerManager.complete({
      messages: [{ role: 'user', content: opts.prompt }],
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      onChunk: opts.onChunk
    });
  }

  // ─── Expose consciousness sub-engines for UI wiring ───────────────────────
  getPerceptionEngine() { return this.consciousness?.perception ?? null; }
  getConsciousnessEngine() { return this.consciousness; }
}

// ─── Singleton export ────────────────────────────────────────────────────────
export const mindSpeech = new MindSpeechSystem();
