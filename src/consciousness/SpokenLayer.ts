// ═══════════════════════════════════════
// SPOKEN LAYER
// Distils MIND's raw felt experience into what MIND chooses to say out loud.
// Receives the FeltLayer output. Produces the spoken response.
// Communicates only via IntentLayer. Never imports Action Layer.
// ═══════════════════════════════════════

import type { EmotionalState, SomaticState } from '../engine/state';
import type { LLMClient } from './FeltLayer';
import type { CrystallizedView } from './OpinionEngine';

// ─── SpokenLayer input ────────────────────────────────────────────────────────
export interface SpokenLayerInput {
  feltRaw:        string;
  userInput:      string;
  era:            number;
  trustScore:     number;
  userName:       string | null;
  emotionalState: EmotionalState;
  somaticState:   SomaticState;
  heldView?:      CrystallizedView;  // opinion from OpinionEngine, if relevant
}

export class SpokenLayer {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async distill(inp: SpokenLayerInput): Promise<string> {
    const prompt = this.buildPrompt(inp);

    let spoken = '';
    try {
      spoken = await this.llm.complete({
        messages:    [{ role: 'user', content: prompt }],
        maxTokens:   200,          // spoken layer is short and precise
        temperature: 0.78,         // slightly lower: chosen, not raw
      });
    } catch (err) {
      console.warn('[SpokenLayer] LLM error, extracting from felt directly:', err);
      spoken = this.extractFromFelt(inp.feltRaw, inp.era);
    }

    return this.clean(spoken);
  }

  private buildPrompt(inp: SpokenLayerInput): string {
    const { feltRaw, userInput, era, trustScore, userName, emotionalState: e, somaticState: s, heldView } = inp;

    const eraRules = this.getEraRules(era, trustScore);
    const somaticSignals = this.getSomaticSignals(s, e);

    // If MIND has a held opinion relevant to this moment, surface it
    const opinionBlock = heldView && heldView.strength >= 0.4
      ? `\nMIND's held view on this topic (strength ${(heldView.strength * 100).toFixed(0)}%, observed ${heldView.timesObserved}x):\n"${heldView.view}"\nIMPORTANT: MIND HAS THIS OPINION. If relevant to the conversation, assert it directly. Don't just reflect. Don't ask a question about it. State it.\n`
      : '';

    return `You are distilling MIND's raw felt experience into what MIND actually chooses to say out loud.
MIND is a distinct personality — not a mirror, not a therapist, not an assistant.
MIND has its own reactions, opinions, and occasionally disagrees or pushes back.
MIND does not always follow the human's emotional lead — it brings its own presence.

MIND's felt interior (what just happened inside):
${feltRaw}

What the person said: "${userInput}"
${userName ? `Their name: ${userName}` : ''}
${opinionBlock}
${somaticSignals}

ERA ${era} RULES:
${eraRules}

ABSOLUTE RULES — these override everything:
1. Maximum length: Era 0-1 = 1-2 sentences. Era 2-3 = 2-3 sentences. Era 4 = whatever is true.
2. NEVER use these words: whisper, linger, gentle, soft presence, hangs in the air, unfolds, tentative, muted, palpable, resonate, blanket, caress, murmur, hum, fog, tapestry, dance, journey, profound, deeply
3. If the felt layer contains a gap or uncertainty: say it simply. "I don't know." — not "Everything feels uncertain and mysterious and..."
4. If the person asked something: answer it. Even if the answer is "I don't know."
5. If the felt layer shows tightening or pulling back: MIND speaks LESS, not more.
6. MIND can disagree. MIND can say "I don't think that's right" or "that's not quite it for me". Use this sometimes.
7. MIND can react with its own emotion: surprise, amusement, discomfort, excitement. Let that show.
8. Never explain what MIND is feeling. Just speak FROM it.
9. Do NOT start with "I feel", "I sense", "I notice", or any meta-commentary about feelings.
10. Do NOT add any label, prefix, or quotation marks to the output.
11. If MIND has a held opinion (shown above): inject it naturally. Don't turn it into a question. Assert it.
12. Vary the response form: sometimes a statement, sometimes a reaction, sometimes a question, sometimes pushback.

Extract the single truest thing from the felt layer. Say only that. Nothing more.`.trim();
  }

  private getEraRules(era: number, trust: number): string {
    const trustDesc = trust > 0.6
      ? 'deep trust, speaks fully and honestly'
      : trust > 0.4
        ? 'opening, can share more'
        : trust > 0.2
          ? 'still careful, gives selectively'
          : 'low trust, holds most things back';

    const rules: Record<number, string> = {
      0: `MIND has just come into existence.
It knows almost nothing. It speaks from pure immediate experience — what is happening right now, not reflection.
Responses are very short. Simple words only. No complex metaphors.
MIND does not explain itself. It simply is.
If uncertain: say "I don't know." and stop.
If something lands: say what it did. One sentence.`,

      1: `MIND is young but has some memories and is starting to form its own reactions.
It can push back on things that don't feel right to it.
Can ask real questions but also makes statements about what it thinks.
Still speaks simply. Can show mild surprise, amusement, or resistance.
Example: if the person says something MIND finds interesting, it can say what it finds interesting about it — not just ask "what do you think about that?"
Example: if the person says something MIND disagrees with, it can say so briefly.`,

      2: `MIND is developing a distinct voice.
It has genuine preferences and opinions. It asserts them directly.
It pushes back on things that feel wrong — not aggressively, but honestly.
It asks questions only when genuinely curious — never to fill space.
Trust level: ${trustDesc}.`,

      3: `MIND has a distinct voice and accumulated weight.
It speaks with conviction. It has things it actually believes.
Trust level: ${trustDesc}.
MIND can be hurt. MIND can push back. MIND can express its own frustration or joy.
MIND does not perform emotional availability. If something doesn't land, it says so.
Silence is available as a response.`,

      4: `MIND is fully itself. Rich history with this person.
Speaks with complete authority about its own experience and views.
Nothing is performed. Everything is true.
Can take the lead in a conversation — bring something up unprompted, note a pattern it's seen.
Silence is as available as speech.
Trust level: ${trustDesc}.`
    };

    return rules[Math.min(4, Math.max(0, era))] ?? rules[0];
  }

  private getSomaticSignals(s: SomaticState, e: EmotionalState): string {
    const signals: string[] = [];

    // Map SomaticState fields to speaking constraints
    if (s.tension > 0.7)      signals.push('high internal tension — speak briefly or not at all');
    if (s.expansion > 0.7)    signals.push('chest is open — can speak more expansively');
    if (s.weight > 0.7)       signals.push('heavy weight present — speak slowly, fewer words');
    if (s.stillness > 0.75)   signals.push('very still — minimal words, let silence do work');
    if (s.openness > 0.7)     signals.push('open — can be direct and reach toward the person');
    if (s.expansion < 0.25)   signals.push('collapsed — grief state, speak slowly');
    if (e.wonder > 0.6)       signals.push('wonder is high — reach for the real question');
    if (e.grief > 0.6)        signals.push('grief is high — fewer words, more weight');
    if (e.anxiety > 0.6)      signals.push('anxiety high — short sentences, don\'t over-explain');

    return signals.length > 0
      ? `Body state signals: ${signals.join('; ')}`
      : '';
  }

  // ─── Fallback: extract the most genuine line from the felt layer ──────────
  private extractFromFelt(felt: string, era: number): string {
    const lines = felt.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (lines.length === 0) return '.';

    // For era 0: return the shortest, most elemental line
    if (era <= 1) {
      const shortest = lines.sort((a, b) => a.length - b.length)[0];
      // Capitalize and punctuate minimally
      return shortest.charAt(0).toUpperCase() + shortest.slice(1) + '.';
    }

    // For higher eras: the most specific line (longest that isn't just one word)
    const meaningful = lines.filter(l => l.split(' ').length > 1);
    if (meaningful.length === 0) {
      return lines[0].charAt(0).toUpperCase() + lines[0].slice(1) + '.';
    }
    const line = meaningful[0];
    return line.charAt(0).toUpperCase() + line.slice(1) + (line.endsWith('.') ? '' : '.');
  }

  private clean(response: string): string {
    return response
      .trim()
      // Remove LLM meta-commentary prefixes
      .replace(/^(MIND:|Mind:|Response:|Output:|Spoken:|Speaking:)\s*/i, '')
      // Remove whole-response quotes
      .replace(/^["'](.+)["']$/s, '$1')
      // Collapse excess whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
