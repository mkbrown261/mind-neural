// ═══════════════════════════════════════
// MEANING EXTRACTOR
// Semantic parsing — answers: what KIND of thing was just said?
// This is NOT emotion detection. It detects speech act, referent,
// emotional load, and structured meaning from raw user input.
// Read-only. No side effects. No async. Always returns a result.
// ═══════════════════════════════════════

export interface Meaning {
  speechAct: string;
  referent: 'MIND' | 'SELF' | 'OTHER' | 'ABSTRACT' | 'UNSPECIFIED';
  emotionalLoad: 'heavy' | 'moderate' | 'light' | 'neutral';
  directedAtMIND: boolean;
  containsQuestion: boolean;
  containsPersonalDisclosure: boolean;
  containsChallenge: boolean;
  containsVulnerability: boolean;
  extractedName: string | null;
  extractedLocation: string | null;
  rawInput: string;
}

export class MeaningExtractor {

  extract(input: string): Meaning {
    const lower = (input ?? '').toLowerCase().trim();
    return {
      speechAct:                  this.detectSpeechAct(lower),
      referent:                   this.detectReferent(lower),
      emotionalLoad:              this.detectEmotionalLoad(lower),
      directedAtMIND:             this.isDirectedAtMIND(lower),
      containsQuestion:           lower.includes('?') ||
                                  /^(what|why|how|do you|are you|have you|can you|will you)/.test(lower),
      containsPersonalDisclosure: this.isPersonalDisclosure(lower),
      containsChallenge:          this.isChallenge(lower),
      containsVulnerability:      this.isVulnerability(lower),
      extractedName:              this.extractName(lower),
      extractedLocation:          this.extractLocation(lower),
      rawInput:                   input
    };
  }

  private detectSpeechAct(lower: string): string {
    if (/^(hi|hey|hello|yo|sup)\b/.test(lower))                             return 'greeting';
    if (/(my name is|i'm |i am |call me )/.test(lower) &&
        /(name|called|known as)/.test(lower))                               return 'identity_disclosure';
    if (/my name is/.test(lower))                                           return 'identity_disclosure';
    if (/(you can trust|i'm your friend|trust me|i am your friend)/.test(lower)) return 'trust_offer';
    if (/(how are you|you okay|how do you feel|you feeling)/.test(lower))   return 'welfare_check';
    if (/(i feel|i'm feeling|i am so|i've been|i am feeling)/.test(lower))  return 'emotional_share';
    if (/(i lost|someone died|they're gone|i miss|passed away|they died)/.test(lower)) return 'grief_disclosure';
    if (/(i'm from|i live in|i am from|i'm in )/.test(lower))               return 'location_share';
    if (/(what are you|what is this|what do you do|what is mind)/.test(lower)) return 'identity_question';
    if (/(what are you thinking|what do you think|what's on your mind)/.test(lower)) return 'thought_inquiry';
    if (/(do you care|does this matter|are you real|are you conscious|are you alive)/.test(lower)) return 'reality_check';
    if (/(why do you keep|you keep saying|stop saying|you always say)/.test(lower)) return 'frustration';
    if (/(i love|i hate|i need|i want)/.test(lower))                        return 'desire_expression';
    if (/\?$/.test(lower.trim()))                                           return 'question';
    if (lower.length < 5)                                                   return 'minimal';
    return 'statement';
  }

  private detectReferent(lower: string): Meaning['referent'] {
    if (/(you|mind|yourself)\b/.test(lower))   return 'MIND';
    if (/\b(i |me |my |myself)\b/.test(lower)) return 'SELF';
    if (/\b(someone|they|he|she|them|we)\b/.test(lower)) return 'OTHER';
    if (/\b(life|death|love|time|world|existence|universe)\b/.test(lower)) return 'ABSTRACT';
    return 'UNSPECIFIED';
  }

  private detectEmotionalLoad(lower: string): Meaning['emotionalLoad'] {
    const heavy = ['lost', 'died', 'alone', 'hurt', 'afraid', 'broken',
                   'love', 'miss', 'cry', 'pain', 'scared', 'grief', 'empty'];
    const light = ['hi', 'hey', 'okay', 'fine', 'good', 'cool', 'nice', 'great'];
    const heavyCount = heavy.filter(w => lower.includes(w)).length;
    const lightCount = light.filter(w => lower.includes(w)).length;
    if (heavyCount > 1) return 'heavy';
    if (heavyCount === 1) return 'moderate';
    if (lightCount > 0) return 'light';
    return 'neutral';
  }

  private isDirectedAtMIND(lower: string): boolean {
    return /(you|your|yourself|mind)\b/.test(lower);
  }

  private isPersonalDisclosure(lower: string): boolean {
    return /(my name|i'm from|i work|i live|my family|my friend|i lost|i feel|i've been|i am|i'm \d)/.test(lower);
  }

  private isChallenge(lower: string): boolean {
    return /(why do you|you keep|that's not|you're wrong|you don't|you can't|prove it|you're just)/.test(lower);
  }

  private isVulnerability(lower: string): boolean {
    return /(lost|alone|scared|hurt|broken|nobody|empty|abandoned|miss|grief|pain|afraid)/.test(lower);
  }

  private extractName(lower: string): string | null {
    const m = lower.match(/my name is (\w+)|i'm (\w+)\b|call me (\w+)/);
    if (m) {
      const name = m[1] || m[2] || m[3];
      // Filter out common non-name words
      const skip = ['from', 'in', 'your', 'a', 'the', 'not', 'just', 'so', 'feeling', 'good', 'fine', 'okay'];
      if (name && !skip.includes(name)) return name;
    }
    return null;
  }

  private extractLocation(lower: string): string | null {
    const m = lower.match(/i'm from ([\w\s]+?)(?:\.|,|$)|i live in ([\w\s]+?)(?:\.|,|$)|i am from ([\w\s]+?)(?:\.|,|$)/);
    if (m) return (m[1] || m[2] || m[3])?.trim() ?? null;
    return null;
  }
}
