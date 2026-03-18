// ═══════════════════════════════════════
// CORE ENGINE — Cognitive Operating System
// Governor layer. Enforces response evolution across conversations.
// Operates ONLY on output — never generates content.
// Never modifies existing engine code. Never blocks pipeline.
//
// Responsibilities:
//   1. State evolution — track familiarity, depth, progression stage
//   2. Repetition detection — Jaccard + prefix overlap across last 10
//   3. Variation — structural reframe, sentence reorder, depth append
//   4. Response tracking — rolling window of 10
//   5. Structure rotation — 5 rotating patterns to prevent sameness
//   6. Depth escalation — probes unlock after interaction threshold
// ═══════════════════════════════════════

// ─── Context passed from the intent payload ───────────────────────────────────
export interface CoreContext {
  era?:              number;
  trustScore?:       number;
  interactionCount?: number;
  mode?:             string;   // AgencyEngine mode
  felt?:             string;   // raw felt layer text
}

// ─── What process() returns ────────────────────────────────────────────────────
export interface CoreResult {
  response:  string;
  modified:  boolean;
  meta: {
    repetitionScore:  number;
    variationSeed:    number;
    progressionStage: ProgressionStage;
    structureUsed:    StructureType;
    depthLevel:       number;
  };
}

type ProgressionStage = 'early' | 'mid' | 'deep';
type StructureType    = 'direct' | 'reflection-first' | 'question-led' | 'minimal' | 'emotion-heavy' | 'none';

// ─── Internal state ────────────────────────────────────────────────────────────
interface CoreState {
  interactionCount:  number;
  familiarity:       number;       // 0.0–1.0, +0.06 per interaction
  depthLevel:        number;       // 0.0–1.0, +0.08 per interaction
  lastResponses:     string[];     // rolling window of 10 responses
  lastKeyPhrases:    string[][];   // key phrases per response (for similarity)
  repetitionScore:   number;       // last computed score
  progressionStage:  ProgressionStage;
  structureIndex:    number;       // cycles through 5 structures
  lastStructures:    StructureType[];
}

// ─── Repetition threshold ──────────────────────────────────────────────────────
const REPETITION_THRESHOLD = 0.55;  // Jaccard similarity above this → flag
const PREFIX_MATCH_LENGTH  = 25;    // chars used for prefix-overlap check
const DEPTH_PROBE_THRESHOLD = 6;    // interactions before depth probes activate
const DEPTH_TRUST_THRESHOLD = 0.4;

// ─── Structure rotation ────────────────────────────────────────────────────────
const STRUCTURE_ROTATION: StructureType[] = [
  'direct', 'reflection-first', 'question-led', 'minimal', 'emotion-heavy'
];

// ─── Depth probes (injected when familiarity is established) ──────────────────
const DEPTH_PROBES = [
  "What's underneath that for you?",
  "What aren't you saying yet?",
  "Where does that feeling live in your body?",
  "Say more.",
  "What would change if that were true?",
];

// ─── Banned re-use phrases (CORE strips these from variation prefixes) ────────
const VARIATION_BANNED = new Set([
  'let me put this differently',
  'to put it another way',
  'another way to see this'
]);

// ─── CoreEngine ───────────────────────────────────────────────────────────────
export class CoreEngine {
  state: CoreState;

  constructor() {
    this.state = {
      interactionCount:  0,
      familiarity:       0,
      depthLevel:        0,
      lastResponses:     [],
      lastKeyPhrases:    [],
      repetitionScore:   0,
      progressionStage:  'early',
      structureIndex:    0,
      lastStructures:    []
    };

    // Attempt to restore persisted state
    this.loadState();
  }

  // ─── Main entry: evaluate + conditionally transform a response ─────────────
  process(response: string, context: CoreContext = {}): CoreResult {
    // 1. Update state with every interaction
    this.updateState(context);

    // 2. Detect repetition
    const repetition = this.detectRepetition(response);
    this.state.repetitionScore = repetition.score;

    // 3. Generate variation seed deterministically influenced by context
    const variationSeed = this.generateVariationSeed(context);

    let finalResponse = response;
    let modified      = false;
    let structureUsed: StructureType = 'none';

    // 4. Apply variation only when needed
    if (repetition.isRepeating) {
      const varied = this.applyVariation(response, variationSeed, context);
      finalResponse = varied.text;
      structureUsed = varied.structure;
      modified      = finalResponse !== response;
    }

    // 5. Memory-pressure: never restate phrases said in last 4 responses
    finalResponse = this.applyMemoryPressure(finalResponse);

    // 6. Depth escalation: inject probe after threshold
    if (this.shouldAddDepthProbe(context)) {
      const probe = this.pickDepthProbe();
      if (probe && !finalResponse.includes(probe)) {
        finalResponse = finalResponse.trimEnd();
        finalResponse += (finalResponse.endsWith('.') ? ' ' : '. ') + probe;
        modified = true;
      }
    }

    // 7. Track this response
    this.trackResponse(finalResponse);

    // 8. Persist
    this.saveState();

    const result: CoreResult = {
      response: finalResponse,
      modified,
      meta: {
        repetitionScore:  repetition.score,
        variationSeed,
        progressionStage: this.state.progressionStage,
        structureUsed,
        depthLevel:       this.state.depthLevel
      }
    };

    console.log('[CORE]', result.meta);
    return result;
  }

  // ─── State evolution ────────────────────────────────────────────────────────
  updateState(context: CoreContext): void {
    this.state.interactionCount += 1;

    // Familiarity and depth grow every interaction
    this.state.familiarity  = Math.min(1, this.state.familiarity  + 0.06);
    this.state.depthLevel   = Math.min(1, this.state.depthLevel   + 0.08);

    // Progression stage
    if (this.state.interactionCount > 15) {
      this.state.progressionStage = 'deep';
    } else if (this.state.interactionCount > 5) {
      this.state.progressionStage = 'mid';
    } else {
      this.state.progressionStage = 'early';
    }

    // Advance structure index every interaction (never repeat same structure twice in a row)
    const nextIndex = (this.state.structureIndex + 1) % STRUCTURE_ROTATION.length;
    this.state.structureIndex = nextIndex;
  }

  // ─── Repetition detection ────────────────────────────────────────────────────
  detectRepetition(response: string): { isRepeating: boolean; score: number } {
    const history = this.state.lastResponses;
    if (history.length === 0) return { isRepeating: false, score: 0 };

    // Score 1: prefix overlap (cheap fast check)
    const prefix  = response.substring(0, PREFIX_MATCH_LENGTH).toLowerCase();
    let prefixHits = 0;
    for (const prev of history) {
      if (prev.toLowerCase().substring(0, PREFIX_MATCH_LENGTH) === prefix) {
        prefixHits++;
      }
    }

    // Score 2: Jaccard similarity against last 3 responses
    const recent  = history.slice(-3);
    let maxJaccard = 0;
    for (const prev of recent) {
      const j = this.jaccardSimilarity(response, prev);
      if (j > maxJaccard) maxJaccard = j;
    }

    // Score 3: key-phrase overlap (3-grams from response)
    const responseNgrams = this.extractNgrams(response, 3);
    let phraseOverlap    = 0;
    for (const prevPhrases of this.state.lastKeyPhrases.slice(-4)) {
      for (const phrase of responseNgrams) {
        if (prevPhrases.includes(phrase)) phraseOverlap++;
      }
    }
    const phraseScore = Math.min(1, phraseOverlap / Math.max(1, responseNgrams.length));

    // Combined score
    const score = Math.max(
      prefixHits > 1 ? 0.7 : 0,
      maxJaccard,
      phraseScore
    );

    return {
      isRepeating: score > REPETITION_THRESHOLD,
      score
    };
  }

  // ─── Variation seed ──────────────────────────────────────────────────────────
  generateVariationSeed(context: CoreContext = {}): number {
    // Use interaction count + era for a deterministic-ish seed
    const base = Math.random();
    const shift = ((context.era ?? 0) * 0.1 + this.state.structureIndex * 0.2) % 1;
    return (base + shift) % 1;
  }

  // ─── Apply variation ─────────────────────────────────────────────────────────
  applyVariation(
    response: string,
    seed: number,
    context: CoreContext
  ): { text: string; structure: StructureType } {

    // Select structure from rotation, biased by seed
    const structureNames = STRUCTURE_ROTATION;
    const structureIdx   = this.state.structureIndex % structureNames.length;
    const structure      = structureNames[structureIdx];

    // Skip last-used structure to prevent immediate repeat
    const last = this.state.lastStructures.slice(-1)[0];
    const useStructure = (structure === last)
      ? structureNames[(structureIdx + 1) % structureNames.length]
      : structure;

    // Track used structure
    this.state.lastStructures.push(useStructure);
    if (this.state.lastStructures.length > 5) this.state.lastStructures.shift();

    let varied = response;

    switch (useStructure) {
      case 'direct':
        // Strip any soft opener and lead with the core statement
        varied = this.stripOpeningClause(response);
        break;

      case 'reflection-first':
        // Reframe with brief acknowledgement before the content
        varied = this.reflectionFirst(response, context);
        break;

      case 'question-led':
        // End with a genuine question drawn from the response content
        varied = this.questionLed(response);
        break;

      case 'minimal':
        // Reduce to the most specific sentence
        varied = this.reduceToCore(response);
        break;

      case 'emotion-heavy':
        // Elevate emotional specificity, add depth signal
        varied = this.emotionHeavy(response, context);
        break;
    }

    // Final safety: if variation made it empty, return original
    if (!varied || varied.trim().length < 3) varied = response;

    return { text: varied.trim(), structure: useStructure };
  }

  // ─── Memory pressure ─────────────────────────────────────────────────────────
  // Strips exact phrases that appeared in the last 4 responses
  applyMemoryPressure(response: string): string {
    const recent = this.state.lastKeyPhrases.slice(-4).flat();
    if (recent.length === 0) return response;

    let result = response;
    for (const phrase of recent) {
      if (phrase.length > 12 && result.toLowerCase().includes(phrase.toLowerCase())) {
        // Replace only exact repetitions of meaningful phrases
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    return result.length > 5 ? result : response; // safety: never blank
  }

  // ─── Track response ───────────────────────────────────────────────────────────
  trackResponse(response: string): void {
    this.state.lastResponses.push(response);
    if (this.state.lastResponses.length > 10) this.state.lastResponses.shift();

    const ngrams = this.extractNgrams(response, 3);
    this.state.lastKeyPhrases.push(ngrams);
    if (this.state.lastKeyPhrases.length > 10) this.state.lastKeyPhrases.shift();
  }

  // ─── Depth probe logic ────────────────────────────────────────────────────────
  private shouldAddDepthProbe(context: CoreContext): boolean {
    if (this.state.interactionCount < DEPTH_PROBE_THRESHOLD) return false;
    if ((context.trustScore ?? 0) < DEPTH_TRUST_THRESHOLD) return false;
    if (this.state.progressionStage === 'early') return false;
    // Only ~30% of the time to avoid over-use
    return Math.random() < 0.30;
  }

  private pickDepthProbe(): string {
    const idx = this.state.interactionCount % DEPTH_PROBES.length;
    return DEPTH_PROBES[idx];
  }

  // ─── Variation helpers ────────────────────────────────────────────────────────
  private stripOpeningClause(response: string): string {
    // Remove soft openers: "That's interesting, ...", "I see that ...", etc.
    return response
      .replace(/^(that'?s?\s+\w+[,.]?\s*|i\s+see\s+[^,]+,\s*|yes[,.]?\s*|well[,.]?\s*|right[,.]?\s*)/i, '')
      .trim();
  }

  private reflectionFirst(response: string, context: CoreContext): string {
    const stagePrefix: Record<ProgressionStage, string> = {
      early: 'Something in that lands.',
      mid:   'That stays with me.',
      deep:  'I notice what that does.'
    };
    const prefix = stagePrefix[this.state.progressionStage];
    const core   = this.reduceToCore(response);
    return `${prefix} ${core}`;
  }

  private questionLed(response: string): string {
    const sentences = response.match(/[^.!?]+[.!?]*/g) ?? [response];
    if (sentences.length < 2) return response;
    // Move the last sentence (most likely deepest content) to front as a question
    const last  = sentences[sentences.length - 1].trim();
    const rest  = sentences.slice(0, -1).join(' ').trim();
    // Convert last sentence to question-adjacent form
    const asQ = last.replace(/\.$/, '?');
    return `${asQ} ${rest}`.trim();
  }

  private reduceToCore(response: string): string {
    const sentences = response.match(/[^.!?]+[.!?]*/g) ?? [response];
    // Pick the longest non-opening sentence (most specific content)
    const candidates = sentences
      .map(s => s.trim())
      .filter(s => s.length > 8)
      .sort((a, b) => b.length - a.length);
    return candidates[0] ?? response;
  }

  private emotionHeavy(response: string, context: CoreContext): string {
    const stage = this.state.progressionStage;
    const addons: Record<ProgressionStage, string> = {
      early: ' That matters.',
      mid:   ' There is more here than I can say quickly.',
      deep:  ' I am holding this carefully.'
    };
    return response.trimEnd() + addons[stage];
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────
  private jaccardSimilarity(a: string, b: string): number {
    const words = (s: string) =>
      new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const setA = words(a);
    const setB = words(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const w of setA) { if (setB.has(w)) intersection++; }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private extractNgrams(text: string, n: number): string[] {
    const words  = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const ngrams: string[] = [];
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────────
  private saveState(): void {
    try {
      localStorage.setItem('mind_core_state', JSON.stringify({
        interactionCount:  this.state.interactionCount,
        familiarity:       this.state.familiarity,
        depthLevel:        this.state.depthLevel,
        progressionStage:  this.state.progressionStage,
        structureIndex:    this.state.structureIndex,
        lastStructures:    this.state.lastStructures,
        // Don't persist full history — session-only for privacy
      }));
    } catch (_) {}
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem('mind_core_state');
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.state.interactionCount  = saved.interactionCount  ?? 0;
      this.state.familiarity       = saved.familiarity       ?? 0;
      this.state.depthLevel        = saved.depthLevel        ?? 0;
      this.state.progressionStage  = saved.progressionStage  ?? 'early';
      this.state.structureIndex    = saved.structureIndex     ?? 0;
      this.state.lastStructures    = saved.lastStructures     ?? [];
    } catch (_) {}
  }

  // ─── Public read-only snapshot (for debug exposure) ───────────────────────────
  getSnapshot() {
    return {
      interactionCount:  this.state.interactionCount,
      familiarity:       +this.state.familiarity.toFixed(3),
      depthLevel:        +this.state.depthLevel.toFixed(3),
      progressionStage:  this.state.progressionStage,
      structureIndex:    this.state.structureIndex,
      repetitionScore:   +this.state.repetitionScore.toFixed(3),
      historyLength:     this.state.lastResponses.length
    };
  }
}
