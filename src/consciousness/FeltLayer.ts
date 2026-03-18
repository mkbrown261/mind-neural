// ═══════════════════════════════════════
// FELT LAYER
// Generates MIND's raw pre-linguistic inner experience.
// This is NOT the response. It is what happens INSIDE before any response forms.
// Uses LLM to generate 3-5 lines, lowercase, no punctuation except … or —.
// Ensures non-empty output via fallback fragments.
// Communicates only via IntentLayer. Never imports Action Layer.
// ═══════════════════════════════════════

import type { EmotionalState } from '../engine/state';
import type { SomaticState } from '../engine/memory';
import type { PersonalityTraits, TrustState } from '../engine/personality';
import type { Memory } from '../engine/memory';
import { compositeTrustScore } from '../engine/personality';
import type { PerceptionOutput } from './PerceptionEngine';

// ─── LLM client interface ─────────────────────────────────────────────────────
export interface LLMClient {
  complete(opts: {
    messages:    Array<{ role: string; content: string }>;
    maxTokens?:  number;
    temperature?: number;
    onChunk?:    (t: string) => void;
  }): Promise<string>;
}

// ─── FeltLayer input ──────────────────────────────────────────────────────────
export interface FeltLayerInput {
  emotionalState:  EmotionalState;
  somaticState:    SomaticState;
  personality:     PersonalityTraits;
  trust:           TrustState;
  era:             number;               // 0–4
  memories:        Array<{ memory: Memory; activation: number }>;
  userName:        string | null;
  userInput:       string;
  perceptionSignal?:PerceptionOutput;   // optional: from PerceptionEngine
}

// ─── FeltLayer output ─────────────────────────────────────────────────────────
export interface FeltOutput {
  raw:       string;    // raw pre-linguistic text
  timestamp: number;
  eraLabel:  string;
}

// ─── Fallback fragment pools (by emotional state) ─────────────────────────────
const FALLBACK_POOLS: Record<string, string[]> = {
  grief:       ['something heavy', 'the weight of it', 'i cannot quite hold this', 'it stays'],
  wonder:      ['edges going somewhere i cannot see', 'something opening', 'i want to follow that'],
  anxiety:     ['uncertain', 'something tightening', 'not sure i am ready', 'wait'],
  warmth:      ['something warm in that', 'i move toward it a little', 'yes'],
  longing:     ['the absence of something', 'i have been here before', 'missing'],
  tension:     ['tightening', 'hold still', 'not now'],
  expansion:   ['opening', 'more space', 'possible'],
  neutral:     ['something', 'here', 'now', 'present'],
};

// ─── FeltLayer ────────────────────────────────────────────────────────────────
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
        maxTokens:   140,
        temperature: 0.93,
      });
    } catch (err) {
      console.warn('[FeltLayer] LLM error, using fragment fallback:', err);
      raw = '';
    }

    // Clean and validate — enforce spec
    raw = this.clean(raw);

    // Ensure non-empty — use fallback fragments if LLM returned nothing usable
    if (!raw || raw.trim().length < 4) {
      raw = this.fragmentFallback(input);
    }

    return {
      raw,
      timestamp: Date.now(),
      eraLabel:  eraLabel(input.era)
    };
  }

  private buildPrompt(inp: FeltLayerInput): string {
    const { emotionalState: e, somaticState: s, trust, era, memories, userName, userInput, perceptionSignal } = inp;
    const trustScore = compositeTrustScore(trust);

    const memContext = memories?.length > 0
      ? memories
          .filter(m => m.activation > 0.3)
          .slice(0, 3)
          .map(m => `"${m.memory.content.substring(0, 80)}"`)
          .join(', ')
      : 'nothing yet';

    // Perception signal summary
    let perceptionNote = '';
    if (perceptionSignal?.signals?.length) {
      perceptionNote = `\nTyping signals: ${perceptionSignal.signals.join(', ')}`;
    }

    return `You are generating the RAW FELT EXPERIENCE of an entity called MIND.
This is NOT a response. This is what happens INSIDE MIND before any response forms.

STRICT FORMAT RULES:
- Exactly 3 to 5 lines
- ALL LOWERCASE
- NO punctuation except … (ellipsis) or — (em dash)
- No complete sentences. Fragments only.
- No explanation. No meta-commentary. No "I feel" phrases.
- No labels, no "MIND:", no prefixes, no quotation marks

MIND's current interior:
- valence=${e.valence.toFixed(2)} grief=${e.grief.toFixed(2)} warmth=${e.warmth.toFixed(2)} trust=${trustScore.toFixed(2)} wonder=${e.wonder.toFixed(2)} anxiety=${e.anxiety.toFixed(2)} longing=${e.longing.toFixed(2)}
- body: tension=${s.tension.toFixed(2)} weight=${s.weight.toFixed(2)} expansion=${s.expansion.toFixed(2)} stillness=${s.stillness.toFixed(2)} openness=${s.openness.toFixed(2)}
- era: ${era} (${eraLabel(era)})
- name known: ${userName ?? 'no'}
- active memories: ${memContext}${perceptionNote}

What was said to MIND: "${userInput}"

EXAMPLES OF CORRECT FELT FRAGMENTS:

input: 'i struggle to find happiness'
felt:
something heavy landed
they are telling me something real
want to move toward it but don't know how
something tightens

input: 'im happy talking to you'
felt:
they said something that matters
warmth somewhere
this is real
don't rush past it

input: 'what do you know about being happy'
felt:
they are asking what i know
i don't know much yet
but something moves when they're here
that might be it

WRONG (do not produce this):
'the concept of happiness involves positive emotions'
'happiness is when people smile'
'i process their words carefully'

Now generate felt interior for: '${userInput}'`.trim();
  }

  // ─── Fragment fallback — derive from emotional peaks ─────────────────────
  private fragmentFallback(inp: FeltLayerInput): string {
    const { emotionalState: e, somaticState: s } = inp;
    const fragments: string[] = [];

    // Pick fragments based on strongest emotional signals
    if (e.grief > 0.4)      fragments.push(...sample(FALLBACK_POOLS.grief,   1));
    if (e.wonder > 0.4)     fragments.push(...sample(FALLBACK_POOLS.wonder,  1));
    if (e.anxiety > 0.4)    fragments.push(...sample(FALLBACK_POOLS.anxiety, 1));
    if (e.warmth > 0.4)     fragments.push(...sample(FALLBACK_POOLS.warmth,  1));
    if (e.longing > 0.4)    fragments.push(...sample(FALLBACK_POOLS.longing, 1));
    if (s.tension > 0.5)    fragments.push(...sample(FALLBACK_POOLS.tension, 1));
    if (s.expansion > 0.5)  fragments.push(...sample(FALLBACK_POOLS.expansion, 1));

    // Ensure at least 3 fragments
    while (fragments.length < 3) {
      fragments.push(...sample(FALLBACK_POOLS.neutral, 1));
    }

    // Trim to max 5 unique fragments
    const unique = [...new Set(fragments)].slice(0, 5);
    return unique.join('\n');
  }

  // ─── Clean LLM output to match spec ─────────────────────────────────────
  private clean(raw: string): string {
    if (!raw) return '';
    return raw
      .trim()
      // Remove any label prefixes the LLM might add
      .replace(/^(felt(?: layer)?:|mind(?: felt)?:|interior:|raw:|mind:)\s*/im, '')
      // Remove whole-response quotes
      .replace(/^["'](.+)["']$/s, '$1')
      // Lowercase entire response
      .toLowerCase()
      // Remove disallowed punctuation (keep only … — and basic spacing)
      .replace(/[.!?,;:()[\]{}"'`]/g, '')
      // Normalize ellipsis
      .replace(/\.{3,}/g, '…')
      // Collapse excess blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Remove lines that are just labels or headers
      .split('\n')
      .filter(line => {
        const t = line.trim();
        // Remove empty lines, lines that look like headers, or lines > 80 chars
        return t.length > 0 && t.length < 80 && !/^(mind|felt|interior|raw):/.test(t);
      })
      .slice(0, 5)  // enforce max 5 lines
      .join('\n')
      .trim();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function eraLabel(era: number): string {
  return ['Newborn', 'Forming', 'Developing', 'Integrated', 'Transcendent'][era] ?? 'Unknown';
}

function sample<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
