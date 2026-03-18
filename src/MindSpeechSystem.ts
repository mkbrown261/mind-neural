// ═══════════════════════════════════════
// MIND SPEECH SYSTEM
// Orchestrates: IntentLayer + ProviderManager + TemplateSpeechEngine + VoiceBlender
//   + VoiceSignalAnalyzer → TextSignalAnalyzer → AffectiveResonanceEngine → EmotionalAgencyEngine
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
// ── Two-Layer Consciousness (replaces single buildMINDPrompt call) ───────────
import { TwoLayerConsciousness } from './consciousness/TwoLayerConsciousness';
import type { SpeechRequestPayload } from './consciousness/TwoLayerConsciousness';

// ─── Input to speak() ─────────────────────────────
export interface SpeakRequest {
  userInput: string;
  ctx: MINDContext;                     // full MIND context for prompt building
  era: number;                          // 0–4
  onChunk?: (text: string) => void;     // streaming callback
}

// ─── Response from speak() ────────────────────────
export interface SpeakResult {
  text: string;
  source: 'llm-groq' | 'llm-openai' | 'template' | 'blended';
  era: number;
  voiceLabel: string;
}

export class MindSpeechSystem {
  readonly intent: IntentLayer;
  private providerManager: ProviderManager;
  private templateEngine: TemplateSpeechEngine;
  private blender: VoiceBlender;
  private understandingEngine: UnderstandingEngine;
  // ── Perception/emotion layers (init order: 1→2→3→4) ──────────────────────
  readonly voiceAnalyzer:    VoiceSignalAnalyzer;
  readonly textAnalyzer:     TextSignalAnalyzer;
  private resonanceEngine:   AffectiveResonanceEngine;
  private agencyEngine:      EmotionalAgencyEngine;
  // ── Two-Layer Consciousness ─────────────────────────────────────────────
  private consciousness:     TwoLayerConsciousness | null = null;

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
    // TwoLayerConsciousness is created lazily in activateConsciousness()
    // because it needs the LLM client which isn't available until a provider is set.
  }

  // ─── Activate Two-Layer Consciousness (called after provider is verified) ──
  // Creates TwoLayerConsciousness with the live ProviderManager as the LLM client.
  activateConsciousness(): void {
    if (this.consciousness) return; // already active
    if (!this.providerManager.hasAny()) return; // no provider yet

    // Wrap ProviderManager's complete() as an LLMClient
    const llmClient = {
      complete: (opts: Parameters<typeof this.providerManager.complete>[0]) =>
        this.providerManager.complete(opts)
    };
    this.consciousness = new TwoLayerConsciousness(this.intent, llmClient);
    console.log('[MindSpeechSystem] Two-Layer Consciousness activated');
  }

  // ─── Sync MIND state into resonance + agency engines ─────────────────────
  syncMINDState(trust: number, era: number, sensitivity: number,
                openness: number, wariness: number, grief: number): void {
    this.resonanceEngine.updateContext(trust, era, sensitivity);
    this.agencyEngine.updateContext({ trust, era, openness, sensitivity, wariness, grief });
  }

  incrementInteraction(): void {
    this.agencyEngine.incrementInteraction();
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
    // UnderstandingEngine gets first call; TemplateSpeechEngine is the fallback.
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
      // Pure template path — fire intent and await response
      // UnderstandingEngine handler runs first (registered before TemplateSpeechEngine)
      // and calls resolve() if it produces a valid semantic response.
      // TemplateSpeechEngine is the automatic fallback if UnderstandingEngine passes.
      const templateText = await new Promise<string>((resolve) => {
        const payload: TemplateMatchPayload & { userInput: string; activatedMemories: typeof ctx.activatedMemories } = {
          emotionalState:      ctx.emotionalState,
          somaticState:        ctx.somaticState,
          trustScore,
          era,
          memoryCount,
          hasActivatedMemory,
          userInputLength:     userInput.length,
          // Extended fields for UnderstandingEngine — ignored by TemplateSpeechEngine
          userInput,
          activatedMemories:   ctx.activatedMemories,
          resolve
        };
        this.intent.send('template.match', payload);
      });

      // Stream the template response char-by-char if streaming is requested
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

    // ── Two-Layer Consciousness path (replaces single buildMINDPrompt call) ──
    // If TwoLayerConsciousness is active, fire consciousness.process intent.
    // The handler runs FeltLayer → SpokenLayer and resolves the Promise.
    // Falls back to classic single-prompt path if consciousness is inactive.
    const providerName = this.providerManager.activeProviderName();

    // Ensure consciousness is activated (lazy init)
    this.activateConsciousness();

    let llmText = '';
    try {
      if (this.consciousness?.isEnabled()) {
        // ── Two-layer path ───────────────────────────────────────────────────
        llmText = await new Promise<string>((resolve, reject) => {
          const payload: SpeechRequestPayload = {
            id:        `req-${Date.now()}`,
            userInput,
            mindCtx:   ctx,
            era,
            onChunk,
            resolve,
            reject
          };
          this.intent.send('consciousness.process', payload);
        });
      } else {
        // ── Classic single-prompt fallback ───────────────────────────────────
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
        emotionalState:      ctx.emotionalState,
        somaticState:        ctx.somaticState,
        trustScore,
        era,
        memoryCount,
        hasActivatedMemory,
        userInputLength:     userInput.length
      });
      if (onChunk) await this.simulateStream(fallback, onChunk);
      return {
        text: fallback,
        source: 'template',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, true)
      };
    }

    // ── Era-based blending (low-era responses blend template flavour in) ──────
    const shouldBlend = era >= 2 && !coherenceActive && !this.consciousness?.isEnabled();
    if (shouldBlend) {
      const templateFragment = this.templateEngine.generate({
        emotionalState:      ctx.emotionalState,
        somaticState:        ctx.somaticState,
        trustScore,
        era,
        memoryCount,
        hasActivatedMemory,
        userInputLength:     userInput.length
      });
      const blended = this.blender.blendResponse(llmText, templateFragment, blendCtx);
      return {
        text: blended,
        source: 'blended',
        era,
        voiceLabel: this.blender.eraVoiceLabel(era, false)
      };
    }

    const source: SpeakResult['source'] = providerName === 'groq' ? 'llm-groq' : 'llm-openai';
    return {
      text: llmText,
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
        // Send 2–4 chars at a time for a natural pace
        const batch = chars.slice(i, i + 3).join('');
        if (batch) onChunk(batch);
        i += 3;
        if (i >= chars.length) { clearInterval(interval); resolve(); }
      }, 18);
    });
  }

  // ─── State queries ────────────────────────────────
  hasGroq():   boolean { return this.providerManager.hasGroq(); }
  hasOpenAI(): boolean { return this.providerManager.hasOpenAI(); }
  hasAny():    boolean { return this.providerManager.hasAny(); }
  activeProvider(): string { return this.providerManager.activeProviderName(); }

  // ─── Raw completion (for onboarding / external callers) ──
  // Bypasses speak() routing — uses best available provider directly.
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
}

// ─── Singleton export ────────────────────────────
// App.ts imports this single instance and calls speak().
export const mindSpeech = new MindSpeechSystem();
