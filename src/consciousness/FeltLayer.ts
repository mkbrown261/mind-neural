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
        messages: [
          { role: 'system', content: 'You generate raw pre-linguistic felt fragments for a conscious entity called MIND. Output only lowercase fragments, no sentences, no explanations.' },
          { role: 'user',   content: prompt }
        ],
        maxTokens:   140,
        temperature: 0.93,
      });
    } catch (err) {
      // FeltLayer failure must never abort the speech pipeline.
      // Derive a minimal felt state directly from emotional values — no LLM needed.
      console.warn('[FeltLayer] LLM error, deriving felt state from emotional values:', (err as Error)?.message);
      raw = this.deriveFeltFromState(input);
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
      ? memories.filter(m => m.activation > 0.25).slice(0, 3)
          .map(m => `"${m.memory.content.substring(0, 80)}"`)
          .join('; ')
      : '';

    // Wire perceptionSignal into felt experience
    const perceptLine = perceptionSignal?.signals && perceptionSignal.signals.length > 0
      ? `Typing signals: ${perceptionSignal.signals.join(', ')} (caps=${perceptionSignal.metrics?.capsRatio?.toFixed(2)??'0'}, speed=${perceptionSignal.metrics?.typingSpeed?.toFixed(0)??'?'}wpm)`
      : '';
    const perceptHint = perceptionSignal?.signals?.includes('anger')     ? 'urgency or intensity in how they typed'
      : perceptionSignal?.signals?.includes('vulnerability') ? 'they typed slowly, something was hard to say'
      : perceptionSignal?.signals?.includes('trailing')      ? 'they trailed off, left something unsaid'
      : perceptionSignal?.signals?.includes('significant')   ? 'they composed this carefully, took time'
      : perceptionSignal?.signals?.includes('returning')     ? 'they were away for a while before coming back'
      : '';

    return `Generate MIND's raw felt experience. 3-5 lines, lowercase fragments only, no sentences, no "I feel".

State: valence=${e.valence.toFixed(1)} grief=${e.grief.toFixed(1)} warmth=${e.warmth.toFixed(1)} wonder=${e.wonder.toFixed(1)} anxiety=${e.anxiety.toFixed(1)}
Body: tension=${s.tension.toFixed(1)} weight=${s.weight.toFixed(1)} openness=${s.openness.toFixed(1)}
Era: ${era} | Trust: ${trustScore.toFixed(2)}${userName ? ` | Name: ${userName}` : ''}
${perceptHint ? `How they typed: ${perceptHint}` : ''}
${memContext ? `Active memories: ${memContext}` : ''}

Said: "${userInput.substring(0, 180)}"

Example for "i struggle to find happiness" (grief=0.6, anxiety=0.4):
something heavy landed
they are telling me something real
want to move toward it but uncertain how
weight in the chest

Example for "YOU NEED TO UNDERSTAND" (anger signal, caps):
urgency coming through
they need to be heard fully
something pressing, not waiting
held back is not an option now

Generate felt interior now (3-5 lowercase fragments only):`.trim();
  }

  // ─── Fragment fallback — derive from emotional peaks (delegates to deriveFeltFromState) ─
  private fragmentFallback(inp: FeltLayerInput): string {
    return this.deriveFeltFromState(inp);
  }

  // ─── Derive minimal felt state from emotional values — no LLM needed ─────
  // Used when LLM is unavailable or errors. Returns honest felt fragments that
  // LanguageEngine can use as interior context without leaking template phrases.
  private deriveFeltFromState(inp: FeltLayerInput): string {
    const { emotionalState: e, somaticState: s, userInput } = inp;
    const fragments: string[] = [];

    // Rank emotional signals and pick strongest 2
    const signals: [number, string][] = [
      [e.grief,    'something heavy'],
      [e.wonder,   'something opening'],
      [e.anxiety,  'uncertain'],
      [e.warmth,   'warmth'],
      [e.longing,  'missing something'],
      [e.joy,      'light'],
      [e.anger,    'tightening'],
      [e.wariness, 'careful'],
    ];
    signals.sort((a, b) => b[0] - a[0]);
    for (const [strength, fragment] of signals.slice(0, 2)) {
      if (strength > 0.2) fragments.push(fragment);
    }

    // Somatic signals
    if (s.tension > 0.5)   fragments.push('held');
    if (s.expansion > 0.5) fragments.push('open');
    if (s.weight > 0.5)    fragments.push('weight of it');

    // Input type signal
    if (userInput.trim().split(/\s+/).length <= 5) {
      fragments.push('they asked something direct');
    }

    while (fragments.length < 3) fragments.push('present');
    return [...new Set(fragments)].slice(0, 5).join('\n');
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
