// ═══════════════════════════════════════
// MIND SPEECH SYSTEM
// Orchestrates: IntentLayer + ProviderManager + TemplateSpeechEngine + VoiceBlender
// This is the single entry point for all speech generation.
// Core modules (EME, ESE, AMN, SSM, PES, TA, RGP) are never modified here.
// Communication happens exclusively through the Intent Layer.
// ═══════════════════════════════════════

import { IntentLayer } from './intent/IntentLayer';
import { ProviderManager } from './providers/ProviderManager';
import { TemplateSpeechEngine, type TemplateMatchPayload } from './speech/TemplateSpeechEngine';
import { VoiceBlender, type BlendContext } from './speech/VoiceBlender';
import type { MINDContext } from './engine/pipeline';
import { buildMINDPrompt } from './engine/pipeline';
import { compositeTrustScore } from './engine/personality';

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

  constructor() {
    // Intent Layer is the central bus — everything registers here
    this.intent = new IntentLayer();

    // Logging middleware (non-blocking)
    this.intent.use((event, payload, next) => {
      console.debug(`[IntentLayer] → ${event}`);
      next();
    });

    this.providerManager = new ProviderManager(this.intent);
    this.templateEngine  = new TemplateSpeechEngine(this.intent);
    this.blender         = new VoiceBlender();
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

    // ── Forced template mode (no LLM) ────────────────
    if (!hasLLM) {
      const templateText = this.templateEngine.generate({
        emotionalState:      ctx.emotionalState,
        somaticState:        ctx.somaticState,
        trustScore,
        era,
        memoryCount,
        hasActivatedMemory,
        userInputLength:     userInput.length
      });
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
      const templateText = await new Promise<string>((resolve) => {
        const payload: TemplateMatchPayload = {
          emotionalState:      ctx.emotionalState,
          somaticState:        ctx.somaticState,
          trustScore,
          era,
          memoryCount,
          hasActivatedMemory,
          userInputLength:     userInput.length,
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

    // ── LLM path ─────────────────────────────────────
    const prompt = buildMINDPrompt(ctx);

    // Determine active provider name before call
    const providerName = this.providerManager.activeProviderName();

    let llmText = '';
    try {
      llmText = await this.providerManager.complete({
        messages:    [{ role: 'user', content: prompt }],
        maxTokens:   ctx.saState ? undefined : 600,
        temperature: ctx.coherenceState?.isCoherent ? 0.75 : 0.85,
        onChunk
      });
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

    // ── Blend if era warrants mixing ──────────────────
    const shouldBlend = era >= 2 && !coherenceActive;
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
}

// ─── Singleton export ────────────────────────────
// App.ts imports this single instance and calls speak().
export const mindSpeech = new MindSpeechSystem();
