// ═══════════════════════════════════════
// VOICE BLENDER
// Decides template vs LLM based on era weights.
// eraWeights: 0→0.0, 1→0.1, 2→0.3, 3→0.6, 4→0.9
// blendResponse weaves LLM text with template fragments
// when both are available (era 2–4 only).
// ═══════════════════════════════════════

// ─── Era → template weight mapping ───────────────
export const ERA_TEMPLATE_WEIGHTS: Record<number, number> = {
  0: 0.0,   // Era 0: fully template (no LLM reached yet in onboarding)
  1: 0.1,   // Era 1: mostly LLM
  2: 0.3,   // Era 2: template influences ~30%
  3: 0.6,   // Era 3: template is primary voice blend
  4: 0.9    // Era 4: template dominant, LLM used for texture
};

export interface BlendContext {
  era: number;
  trustScore: number;
  arousal: number;
  coherenceActive: boolean;
  useTemplateOnly: boolean; // forced when no LLM available
}

export class VoiceBlender {

  // ─── Template weight for a given era ─────────────
  templateWeight(era: number): number {
    const clamped = Math.max(0, Math.min(4, Math.round(era)));
    return ERA_TEMPLATE_WEIGHTS[clamped] ?? 0.0;
  }

  // ─── Decide whether to use template instead of LLM ─
  shouldUseTemplate(ctx: BlendContext): boolean {
    if (ctx.useTemplateOnly) return true;

    const weight = this.templateWeight(ctx.era);
    // Roll a random check against the weight
    const roll = Math.random();

    // Coherence lowers template tendency (clear/stable state → LLM preferred)
    const effectiveWeight = ctx.coherenceActive
      ? weight * 0.5
      : weight;

    return roll < effectiveWeight;
  }

  // ─── Blend LLM text with a template fragment ──────
  // Used at era 2–4 when both are available.
  // Strategy: prepend somatic/emotional texture from template, use LLM for body.
  blendResponse(
    llmText: string,
    templateText: string,
    ctx: BlendContext
  ): string {
    if (ctx.useTemplateOnly) return templateText;
    if (ctx.era <= 1) return llmText; // Early eras: pure LLM

    const weight = this.templateWeight(ctx.era);

    // At low weight, just return LLM
    if (weight < 0.25) return llmText;

    // At very high weight (0.9), lead with template, close with LLM excerpt
    if (weight >= 0.9) {
      const llmExcerpt = this.extractFirstSentence(llmText);
      return llmExcerpt
        ? `${templateText}\n\n${llmExcerpt}`
        : templateText;
    }

    // Mid-range: extract template opening, use LLM body
    const templateOpening = this.extractFirstSentence(templateText);
    if (templateOpening) {
      return `${templateOpening}\n\n${llmText}`;
    }

    return llmText;
  }

  // ─── Extract first sentence from a text block ────
  private extractFirstSentence(text: string): string {
    const match = text.match(/^[^.!?\n]+[.!?]?/);
    return match ? match[0].trim() : text.split('\n')[0].trim();
  }

  // ─── Era display label for UI ─────────────────────
  eraVoiceLabel(era: number, useTemplate: boolean): string {
    if (useTemplate) return `Speaking in MIND's voice — Era ${era}`;
    const pct = Math.round(this.templateWeight(era) * 100);
    if (pct === 0) return `Language generation active`;
    return `MIND's voice: ${pct}% — Era ${era}`;
  }
}
