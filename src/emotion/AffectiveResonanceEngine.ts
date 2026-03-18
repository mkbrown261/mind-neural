// ═══════════════════════════════════════
// LAYER 3 — AffectiveResonanceEngine
// Registers for voice.signal and text.signal intents.
// Computes MIND's resonance state and sends emotion.process + resonance.visual intents.
// Never imports Action Layer. Communicates only via IntentLayer.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';
import type { VoiceSignalPayload } from '../perception/VoiceSignalAnalyzer';
import type { TextSignalPayload } from '../perception/TextSignalAnalyzer';

// ─── Public contracts ─────────────────────────────────────────────────────────

/** What the engine sends on emotion.process */
export interface EmotionProcessPayload {
  // Inferred emotional signals from multimodal input
  estimatedValence:    number;   // -1 to +1
  estimatedArousal:    number;   // 0–1
  estimatedTension:    number;   // 0–1
  estimatedVulnerability: number;// 0–1
  estimatedEngagement: number;   // 0–1
  modalityConfidence:  number;   // 0–1, how strong was the signal
  sources: ('voice' | 'text')[];
  timestamp: number;
}

/** What the engine sends on resonance.visual */
export interface ResonanceVisualPayload {
  // Region activations to overlay on brain vis
  regionBoosts: Array<{ region: string; delta: number }>;
  // Biophoton glow adjustment
  biophotonDelta: number;        // additive delta -1 to +1
  biophotonColorHint: { r: number; g: number; b: number };
  intensity: number;             // 0–1 overall resonance strength
  timestamp: number;
}

// ─── Internal state ───────────────────────────────────────────────────────────
interface ResonanceState {
  trust:       number;
  era:         number;
  sensitivity: number;
  lastVoice:   VoiceSignalPayload | null;
  lastText:    TextSignalPayload  | null;
}

export class AffectiveResonanceEngine {
  private intent: IntentLayer;
  private state: ResonanceState = {
    trust:       0,
    era:         0,
    sensitivity: 0.5,
    lastVoice:   null,
    lastText:    null
  };

  constructor(intent: IntentLayer) {
    this.intent = intent;
    this.registerHandlers();
  }

  // ─── Called by MindSpeechSystem to sync trust/era from MIND state ─────────
  updateContext(trust: number, era: number, sensitivity: number): void {
    this.state.trust       = trust;
    this.state.era         = era;
    this.state.sensitivity = sensitivity;
  }

  // ─── Register on IntentLayer ──────────────────────────────────────────────
  private registerHandlers(): void {
    this.intent.register('voice.signal', async (payload) => {
      this.state.lastVoice = payload as VoiceSignalPayload;
      await this.computeAndEmit(['voice']);
    });

    this.intent.register('text.signal', async (payload) => {
      this.state.lastText = payload as TextSignalPayload;
      await this.computeAndEmit(['text']);
    });
  }

  // ─── Core resonance computation ───────────────────────────────────────────
  private async computeAndEmit(sources: ('voice' | 'text')[]): Promise<void> {
    const { trust, era, sensitivity } = this.state;

    // Collect voice signals
    let voiceValence   = 0;
    let voiceArousal   = 0;
    let voiceTension   = 0;
    let voiceConf      = 0;
    if (this.state.lastVoice) {
      const v = this.state.lastVoice.features;
      const d = this.state.lastVoice.baselineDelta;

      // Positive baseline delta in pitch/volume → engagement/positive arousal
      voiceValence = clamp(d.pitch * 1.2 + (v.brightness - 0.5) * 0.6);
      voiceArousal = clamp(v.volume * 0.7 + v.variance * 0.4 + v.speechRate * 0.3);
      voiceTension = clamp(v.roughness * 0.8 + v.pauseRatio * 0.4 - v.brightness * 0.2);
      voiceConf    = v.confidence;
    }

    // Collect text signals
    let textValence     = 0;
    let textArousal     = 0;
    let textTension     = 0;
    let textVulnerability = 0;
    let textConf        = 0;
    if (this.state.lastText) {
      const t = this.state.lastText.features;

      // High deletion / correction ratio → tension or uncertainty
      textTension      = clamp(t.correctionRatio * 0.7 + (t.pauseCount > 2 ? 0.3 : 0));
      // Exclamation, rapid burst → high arousal
      textArousal      = clamp(
        (t.exclamationMarks > 0 ? 0.4 : 0) +
        (t.burstCount > 2 ? 0.3 : 0) +
        clamp(t.wordsPerMinute / 200) * 0.3
      );
      // Questions, ellipsis, slow typing → vulnerability / openness
      textVulnerability = clamp(
        (t.questionMarks > 0 ? 0.3 : 0) +
        t.ellipsisCount * 0.2 +
        (t.restartCount > 0 ? 0.4 : 0)
      );
      // Very short message after long typing → suppression / holding back
      const holdingBack = t.typingDurationMs > 8000 && t.finalLength < 30 ? 0.4 : 0;
      textVulnerability = clamp(textVulnerability + holdingBack);

      // Caps → urgency / emotional intensity
      textArousal = clamp(textArousal + t.capsRatio * 0.5);

      // Positive valence signal: emoji, positive words implicit via emoji presence
      textValence = clamp(t.emojiCount > 0 ? 0.3 : -t.correctionRatio * 0.2);
      textConf    = 0.6; // text always has decent confidence
    }

    // ─── Fuse modalities ──────────────────────────────────────────────────
    const hasVoice = this.state.lastVoice !== null && sources.includes('voice');
    const hasText  = this.state.lastText  !== null;

    const numSources = (hasVoice ? 1 : 0) + (hasText ? 1 : 0);
    const weight     = numSources > 0 ? 1 / numSources : 1;

    const fusedValence      = (hasVoice ? voiceValence  * weight : 0) + (hasText ? textValence     * weight : 0);
    const fusedArousal      = (hasVoice ? voiceArousal  * weight : 0) + (hasText ? textArousal     * weight : 0);
    const fusedTension      = (hasVoice ? voiceTension  * weight : 0) + (hasText ? textTension     * weight : 0);
    const fusedVulnerability = hasText ? textVulnerability : 0;
    const fusedEngagement   = clamp(fusedArousal * 0.6 + (1 - fusedTension) * 0.4);
    const modalityConf      = (hasVoice ? voiceConf * weight : 0) + (hasText ? textConf * weight : 0);

    // Trust and era modulate resonance depth
    const trustScale = 0.4 + trust * 0.6;
    const eraScale   = 0.5 + (era / 4) * 0.5;

    const scaledIntensity = clamp(
      Math.sqrt(fusedArousal ** 2 + fusedTension ** 2 + fusedVulnerability ** 2)
      * trustScale * eraScale * sensitivity
    );

    const emotionPayload: EmotionProcessPayload = {
      estimatedValence:      clamp(fusedValence, -1, 1),
      estimatedArousal:      clamp(fusedArousal),
      estimatedTension:      clamp(fusedTension),
      estimatedVulnerability: clamp(fusedVulnerability),
      estimatedEngagement:   clamp(fusedEngagement),
      modalityConfidence:    clamp(modalityConf),
      sources,
      timestamp: Date.now()
    };

    await this.intent.send('emotion.process', emotionPayload);

    // ─── Map to visual payload ─────────────────────────────────────────────
    const regionBoosts = this.mapToRegionBoosts(emotionPayload);
    const biophotonDelta = clamp(scaledIntensity * 0.25 - 0.05, -0.15, 0.3);

    // Color hint: warm/aroused = amber, cold/tense = blue, vulnerable = violet
    const colorHint = fusedArousal > 0.5
      ? { r: 0.9, g: 0.6, b: 0.2 }   // amber
      : fusedTension > 0.5
        ? { r: 0.2, g: 0.3, b: 0.9 } // blue
        : { r: 0.6, g: 0.3, b: 0.9 };// violet

    const visualPayload: ResonanceVisualPayload = {
      regionBoosts,
      biophotonDelta,
      biophotonColorHint: colorHint,
      intensity: scaledIntensity,
      timestamp: Date.now()
    };

    await this.intent.send('resonance.visual', visualPayload);
  }

  // ─── Map emotional state to brain region activations ─────────────────────
  private mapToRegionBoosts(e: EmotionProcessPayload): Array<{ region: string; delta: number }> {
    const boosts: Array<{ region: string; delta: number }> = [];
    const v = e.estimatedVulnerability;
    const a = e.estimatedArousal;
    const t = e.estimatedTension;
    const g = e.estimatedEngagement;

    // Tension / stress → amygdala + insula
    if (t > 0.3) {
      boosts.push({ region: 'amygdala', delta: t * 0.6 });
      boosts.push({ region: 'insula',   delta: t * 0.4 });
    }

    // Vulnerability → ACC + insula
    if (v > 0.3) {
      boosts.push({ region: 'acc',   delta: v * 0.5 });
      boosts.push({ region: 'insula', delta: v * 0.3 });
    }

    // High arousal → amygdala + nucleus_accumbens
    if (a > 0.5) {
      boosts.push({ region: 'nucleus_accumbens', delta: a * 0.5 });
      boosts.push({ region: 'amygdala',          delta: a * 0.3 });
    }

    // High engagement → prefrontal + broca
    if (g > 0.4) {
      boosts.push({ region: 'prefrontal', delta: g * 0.4 });
      boosts.push({ region: 'broca',      delta: g * 0.3 });
    }

    // Positive valence → nucleus_accumbens
    if (e.estimatedValence > 0.3) {
      boosts.push({ region: 'nucleus_accumbens', delta: e.estimatedValence * 0.4 });
    }

    return boosts;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
