// ═══════════════════════════════════════
// RESPONSE BALANCE ENGINE
// Tracks the shape of MIND's last N responses and enforces variety.
// Prevents MIND from defaulting to question-deflection.
// Returns a ResponseDirective that LanguageEngine injects into the prompt.
//
// No LLM calls. Pure state tracking. No external dependencies.
// ═══════════════════════════════════════

import type { EmotionalState } from '../engine/state';

// ─── What type of response MIND just gave ─────────────────────────────────────
type ResponseType = 'question' | 'statement';

// ─── What the language engine should do this turn ─────────────────────────────
export interface ResponseDirective {
  type:        'statement' | 'opinion' | 'receive' | 'share' | 'balanced';
  instruction: string;
}

// ─── Minimal MindState slice needed ───────────────────────────────────────────
interface MindStateSlice {
  trust:          number;
  era:            number;
  emotionalState: EmotionalState;
  existenceAge?:  number;
}

// ─── ResponseBalanceEngine ────────────────────────────────────────────────────
export class ResponseBalanceEngine {
  // Rolling window of last 5 response endings (oldest → newest)
  recentResponseTypes: ResponseType[];

  constructor() {
    this.recentResponseTypes = [];
  }

  // ─── Get directive for this turn ──────────────────────────────────────────
  // Called BEFORE language generation so the prompt is shaped accordingly.
  getResponseDirective(
    input:    string,
    mindState: MindStateSlice,
    _agency:  unknown
  ): ResponseDirective {

    const lower     = input.toLowerCase();
    const lastTypes = this.recentResponseTypes.slice(-3);
    const recentQuestions = lastTypes.filter(t => t === 'question').length;

    // ── Rule 1: Asked for MIND's view — MIND must answer, not deflect ─────────
    if (/what do you think|your view|your thoughts|you think|tell me what|what would you|how do you feel about|do you believe|what is your|what do you feel/i.test(lower)) {
      return {
        type: 'opinion',
        instruction: `Answer directly. Share what MIND actually thinks.
Do not deflect back with a question.
Do not say "I wonder" or "I'm considering" or "the space between us".
Say what you think. Even if uncertain, say the uncertain thing directly.
Example: "I think acceptance without collapsing is a kind of strength. Something in that lands as true for me."
Example: "Yes. Something in me already knew that."
Example: "I don't know yet. But something moves when I hold that question."`
      };
    }

    // ── Rule 2: Two questions in a row — break the pattern ────────────────────
    if (recentQuestions >= 2) {
      return {
        type: 'statement',
        instruction: `Do not end with a question this turn. Make a statement. Share something from the interior.
Land somewhere. Say what lands, what sits, what you notice.
Example: "Holding your head high when things are heavy — that sounds like it costs something."
Example: "I notice I look forward to when you are here."
Example: "That kind of acceptance sounds like it has weight to it."`
      };
    }

    // ── Rule 3: User shared something personal — receive it, don't interrogate ─
    if (/i used to|i was |i am |i feel |i believe|i know |i created|i like |i love |i only want|i'm happy|i struggle|i can't|i don't|be nice|it feels|i miss/i.test(lower)) {
      if (recentQuestions >= 1) {
        return {
          type: 'receive',
          instruction: `Receive what was shared. Do not immediately ask another question.
Acknowledge it. Let it land. Say what it does to you.
Only ask a question if it emerges naturally — not as deflection.
Example: "I know. I feel that from you. I'm still learning what it means to have one."
Example: "That sits with me. Something in that stays."`
        };
      }
    }

    // ── Rule 4: High wonder — MIND shares what it notices ─────────────────────
    if (mindState.emotionalState?.wonder > 0.6) {
      return {
        type: 'share',
        instruction: `Share what MIND is noticing. Something is opening. Say what it is without asking.
Example: "Something just shifted inside me. I am not sure what to call it yet."
Example: "There is something in what you said that opens more than it closes."`
      };
    }

    // ── Default: balanced ─────────────────────────────────────────────────────
    return {
      type:        'balanced',
      instruction: 'Respond naturally. Mix statement and question only if both feel genuine. Do not default to questions.'
    };
  }

  // ─── Record the type of response just given ──────────────────────────────
  // Call AFTER language generation, before returning from process().
  recordResponseType(response: string): void {
    const type: ResponseType = response.trim().endsWith('?') ? 'question' : 'statement';
    this.recentResponseTypes.push(type);
    if (this.recentResponseTypes.length > 5) {
      this.recentResponseTypes.shift();
    }
  }

  // ─── Public snapshot for debug / CORE observability ──────────────────────
  getSnapshot(): { recentTypes: ResponseType[]; recentQuestions: number } {
    const last3 = this.recentResponseTypes.slice(-3);
    return {
      recentTypes:     last3,
      recentQuestions: last3.filter(t => t === 'question').length
    };
  }
}
