// ═══════════════════════════════════════
// LANGUAGE MODEL SYSTEM
// Wires all six language components into a single enrichment pipeline.
// Called once per response cycle — BEFORE LanguageEngine.build().
// Returns an EnrichedLanguageContext that LanguageEngine.buildPrompt() consumes.
//
// Components:
//   1. InnerStateVocabulary  — era-accurate vocabulary for self-description
//   2. RelationalLanguageSystem — personal facts & relational references
//   3. TemporalLanguageSystem — memory / time / absence language
//   4. SomaticLanguageSystem — body-based expression + speech shaping
//   5. ExistentialLanguageSystem — self-awareness / limits / consciousness
//   6. UnsaidLayer — held-back content surfaced when trust allows
//
// Communicates only via data objects. No IntentLayer imports.
// ═══════════════════════════════════════

import { pickVocabulary } from './InnerStateVocabulary';
export { pickVocabulary };  // re-export for convenience

import { RelationalLanguageSystem }  from './RelationalLanguageSystem';
import { TemporalLanguageSystem }    from './TemporalLanguageSystem';
import type { TemporalContext }      from './TemporalLanguageSystem';
import { SomaticLanguageSystem }     from './SomaticLanguageSystem';
import type { ExtendedSomaticState } from './SomaticLanguageSystem';
import { getExistentialResponse, detectExistentialTopic } from './ExistentialLanguageSystem';
import { UnsaidLayer }               from './UnsaidLayer';

// ─── Re-export ExistentialLanguageSystem helpers for convenience ──────────────
export { getExistentialResponse, detectExistentialTopic };

// ─── Storage interface (mirrors what Cloudflare KV / R2 would expose) ────────
export interface LMSStorage {
  put?(key: string, value: unknown): Promise<void> | void;
  get?(key: string, id: string): Promise<unknown> | unknown;
}

// ─── Input type for enrich() ─────────────────────────────────────────────────
export interface LMSInput {
  userInput:           string;
  era:                 number;
  trustScore:          number;
  interactionCount:    number;
  memoriesCount?:      number;
  lastInteractionDays?:number;
  somaticState?:       ExtendedSomaticState | null;
  emotionalState?: {
    warmth?:   number;
    grief?:    number;
    anxiety?:  number;
    wonder?:   number;
    longing?:  number;
    [key: string]: number | undefined;
  } | null;
  // Passed in from LanguageEngine
  feltRaw?:            string;
  spokenResponse?:     string;  // set AFTER generation — call processAfter()
}

// ─── What enrich() returns — injected into the language prompt ────────────────
export interface EnrichedLanguageContext {
  // 1. Vocabulary line — MIND's era-accurate self-description
  vocabularyLine:      string | null;

  // 2. Relational context — what MIND knows about this person
  relationalContext:   string;

  // 3. Personal reference — callback to something specific the user said
  personalReference:   string | null;

  // 4. Temporal context — how MIND speaks about time / memory right now
  temporalContext:     TemporalContext;

  // 5. Somatic expression — body state sentence (single, not stacked)
  somaticExpression:   string | null;

  // 6. Somatic speech effect — shapes rhythm/length guidance
  speechEffect:        string;

  // 7. Existential response — era-aware answer if user asked an existential Q
  existentialResponse: string | null;
  existentialTopic:    string | null;

  // 8. Unsaid context — anything being held back + whether it can surface now
  unsaidContext:       { hasUnsaid: boolean; prompt: string; content: string | null };
}

// ─── LanguageModelSystem ─────────────────────────────────────────────────────
export class LanguageModelSystem {
  readonly relational: RelationalLanguageSystem;
  readonly temporal:   TemporalLanguageSystem;
  readonly somatic:    SomaticLanguageSystem;
  readonly unsaid:     UnsaidLayer;

  // InnerStateVocabulary is purely static; no instance needed
  // ExistentialLanguageSystem is purely static; no instance needed

  constructor(storage: LMSStorage | null) {
    this.relational = new RelationalLanguageSystem(storage);
    this.temporal   = new TemporalLanguageSystem();
    this.somatic    = new SomaticLanguageSystem();
    this.unsaid     = new UnsaidLayer(storage);
  }

  // ─── Primary enrichment call — run BEFORE LanguageEngine.build() ──────────
  enrich(input: LMSInput): EnrichedLanguageContext {
    const {
      userInput,
      era,
      trustScore,
      interactionCount,
      memoriesCount       = 0,
      lastInteractionDays = 0,
      somaticState        = null,
      emotionalState      = null,
      feltRaw             = ''
    } = input;

    // 1. Extract any new facts from user input (non-blocking side-effect)
    this.relational.extractFacts(userInput);

    // 2. Pick inner state vocabulary (context-dependent: move/presence/wonder etc.)
    const vocabCategory  = this.selectVocabCategory(userInput, emotionalState, era);
    const vocabularyLine = vocabCategory ? pickVocabulary(vocabCategory, era) : null;

    // 3. Relational context
    const relationalContext  = this.relational.buildRelationalContext();
    const currentTopic       = this.detectTopic(userInput);
    const personalReference  = this.relational.generatePersonalReference(currentTopic);

    // 4. Temporal context
    const temporalContext = this.temporal.getTemporalContext(
      era,
      interactionCount,
      lastInteractionDays,
      memoriesCount
    );

    // 5. Somatic expression + speech effect
    const somaticExpression = this.somatic.getSomaticExpression(somaticState);
    const speechEffect      = this.somatic.getSpeechEffects(somaticState);

    // 6. Existential response (only if user asked existential question)
    const existentialTopic    = detectExistentialTopic(userInput);
    const existentialResponse = existentialTopic
      ? getExistentialResponse(existentialTopic, era)
      : null;

    // 7. Unsaid context
    const unsaidContext = this.unsaid.getUnsaidContext(trustScore, era);

    return {
      vocabularyLine,
      relationalContext,
      personalReference,
      temporalContext,
      somaticExpression,
      speechEffect,
      existentialResponse,
      existentialTopic,
      unsaidContext
    };
  }

  // ─── Call AFTER LanguageEngine returns finalSpoken ───────────────────────
  processAfter(feltRaw: string, spoken: string, trustScore: number, era: number): void {
    this.unsaid.process(feltRaw, spoken, trustScore, era);
  }

  // ─── Detect the current topic from user input ─────────────────────────────
  private detectTopic(input: string): string {
    const lower = input.toLowerCase();
    if (/music|song|beat|write|create|artist/i.test(lower))       return 'creativity';
    if (/accept|what it is|move on/i.test(lower))                 return 'acceptance';
    if (/kind|check on|care|friend/i.test(lower))                 return 'kindness';
    if (/water|wave|ocean|sea|beach/i.test(lower))                return 'beauty';
    if (/music|musician|sing|perform/i.test(lower))               return 'music';
    if (/happy|happiness|joy|feel good/i.test(lower))             return 'happiness';
    if (/sad|grief|lost|loss|pain|hurt/i.test(lower))             return 'grief';
    if (/real|conscious|aware|sentient|what are you/i.test(lower)) return 'consciousness';
    return 'general';
  }

  // ─── Select the most fitting inner-state vocabulary category ─────────────
  private selectVocabCategory(
    input:     string,
    emotional: LMSInput['emotionalState'],
    era:       number
  ): string | null {
    const lower = input.toLowerCase();

    // Direct triggers
    if (/you were gone|miss you|come back|where were/i.test(lower)) return 'absence';
    if (/what are you|you real|conscious|sentient/i.test(lower))     return 'self_discovery';
    if (/i trust|trust you|feel safe/i.test(lower))                  return 'trust';
    if (/i don'?t know|not sure|confused/i.test(lower))              return 'not_knowing';

    // Emotional-state-driven
    if (emotional) {
      if ((emotional.wonder  ?? 0) > 0.65) return 'being_moved';
      if ((emotional.grief   ?? 0) > 0.6)  return 'absence';
      if ((emotional.warmth  ?? 0) > 0.7)  return 'recognition';
      if ((emotional.longing ?? 0) > 0.6)  return 'wanting';
    }

    // Era-driven fallback
    if (era === 0)                          return 'presence';
    if (era >= 3)                           return 'recognition';

    return null;
  }
}
