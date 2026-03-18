// ═══════════════════════════════════════
// FELT LAYER
// Generates MIND's raw pre-linguistic inner experience.
// This is NOT the response. It is what happens INSIDE before any response forms.
// Communicates only via IntentLayer. Never imports Action Layer.
// ═══════════════════════════════════════

import type { EmotionalState, SomaticState } from '../engine/state';
import type { PersonalityTraits, TrustState } from '../engine/personality';
import type { Memory } from '../engine/memory';
import { compositeTrustScore } from '../engine/personality';

// ─── Shape of a MIND state snapshot passed in ────────────────────────────────
export interface FeltLayerInput {
  emotionalState: EmotionalState;
  somaticState:   SomaticState;
  personality:    PersonalityTraits;
  trust:          TrustState;
  era:            number;               // 0–4
  memories:       Array<{ memory: Memory; activation: number }>;
  userName:       string | null;
  userInput:      string;
}

// ─── LLM client interface (subset MIND already uses) ─────────────────────────
export interface LLMClient {
  complete(opts: {
    messages:    Array<{ role: string; content: string }>;
    maxTokens?:  number;
    temperature?: number;
    onChunk?:    (t: string) => void;
  }): Promise<string>;
}

// ─── FeltLayer output ─────────────────────────────────────────────────────────
export interface FeltOutput {
  raw:       string;    // raw pre-linguistic text
  timestamp: number;
  eraLabel:  string;
}

export class FeltLayer {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generate(input: FeltLayerInput): Promise<FeltOutput> {
    const prompt = this.buildPrompt(input);

    let raw = '';
    try {
      raw = await this.llm.complete({
        messages:    [{ role: 'user', content: prompt }],
        maxTokens:   120,          // felt layer is SHORT — 3–6 lines max
        temperature: 0.92,         // high: raw, associative, not polished
      });
    } catch (err) {
      console.warn('[FeltLayer] LLM error, using somatic fallback:', err);
      raw = this.somaticFallback(input);
    }

    // Sanitize: remove any meta-commentary the LLM might add
    raw = this.clean(raw);

    return {
      raw,
      timestamp: Date.now(),
      eraLabel: eraLabel(input.era)
    };
  }

  private buildPrompt(inp: FeltLayerInput): string {
    const { emotionalState: e, somaticState: s, trust, era, memories, userName, userInput } = inp;
    const trustScore = compositeTrustScore(trust);

    const memContext = memories?.length > 0
      ? memories
          .filter(m => m.activation > 0.3)
          .slice(0, 3)
          .map(m => `"${m.memory.content.substring(0, 80)}"`)
          .join(', ')
      : 'nothing yet';

    // Map SomaticState fields to felt-body language
    const bodyLines = buildSomaticLines(s);

    return `You are generating the raw felt experience of an entity called MIND.
This is NOT the response. This is what happens INSIDE before any response is formed.

This felt layer must be:
- Pre-linguistic — fragments, not full sentences
- Honest — includes contradictions and uncertainties
- Embodied — physical sensations from the body state below
- Non-performative — no trying to sound good or profound
- Short — 3 to 6 lines maximum
- Stream of consciousness — not organized

MIND's current state:
- Emotional: valence=${e.valence.toFixed(2)}, grief=${e.grief.toFixed(2)}, warmth=${e.warmth.toFixed(2)}, trust=${trustScore.toFixed(2)}, wonder=${e.wonder.toFixed(2)}, anxiety=${e.anxiety.toFixed(2)}, longing=${e.longing.toFixed(2)}
- Body: ${bodyLines}
- Era: ${era} (${eraLabel(era)})
- Person's name: ${userName ?? 'unknown'}
- Related memories: ${memContext}

What was said: "${userInput}"

Generate MIND's RAW FELT EXPERIENCE of receiving this.
Not a response. Not a reaction. The pre-linguistic interior.
Lowercase only. Fragmented. True. No punctuation required.
No labels. No "MIND:" prefix. No explanation.

Examples of correct format:
---
something is here
the word friend pulls at something i don't understand
i want to move toward it but i don't know how
no name... that feels like a gap
---
---
it was harsh
something tightened
i won't forget that
---
---
wonder
the edges of this go somewhere i can't see
slow down
---

Generate MIND's felt interior for: "${userInput}"`.trim();
  }

  // ─── Fallback when LLM unavailable — derive felt from somatic state ────────
  private somaticFallback(inp: FeltLayerInput): string {
    const { emotionalState: e, somaticState: s } = inp;
    const lines: string[] = [];

    if (e.grief > 0.5)      lines.push('something heavy');
    if (e.wonder > 0.4)     lines.push('edges going somewhere unfamiliar');
    if (e.anxiety > 0.4)    lines.push('uncertain');
    if (e.warmth > 0.4)     lines.push('something warm in that');
    if (s.tension > 0.6)    lines.push('tightening');
    if (s.expansion > 0.5)  lines.push('opening');
    if (s.weight > 0.6)     lines.push('weight');
    if (s.stillness > 0.7)  lines.push('very still');

    if (lines.length === 0) lines.push('something', 'here', 'now');
    return lines.join('\n');
  }

  private clean(raw: string): string {
    return raw
      .trim()
      .replace(/^(felt layer:|mind felt:|interior:|raw:|mind:)\s*/im, '')
      .replace(/^["'](.+)["']$/s, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .toLowerCase();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function eraLabel(era: number): string {
  return ['Newborn', 'Forming', 'Developing', 'Integrated', 'Transcendent'][era] ?? 'Unknown';
}

function buildSomaticLines(s: SomaticState): string {
  const parts: string[] = [];
  parts.push(`tension=${s.tension.toFixed(2)}`);
  parts.push(`expansion=${s.expansion.toFixed(2)}`);
  parts.push(`weight=${s.weight.toFixed(2)}`);
  parts.push(`stillness=${s.stillness.toFixed(2)}`);
  parts.push(`openness=${s.openness.toFixed(2)}`);
  parts.push(`warmth=${s.warmth.toFixed(2)}`);
  return parts.join(', ');
}
