// ═══════════════════════════════════════
// UNCONSCIOUS LAYER (v2)
// Processes below language. Notices patterns the user doesn't.
// Detects topic repetition, avoidance, contradiction.
// Never outputs directly — only bleeds into felt layer as texture.
// ═══════════════════════════════════════

export type UnconsciousContentType =
  | 'unresolved_thread'
  | 'recurring_pattern'
  | 'suppressed_response'
  | 'pre_linguistic';

export interface UnconsciousContent {
  id:               string;
  type:             UnconsciousContentType;
  content:          string;   // raw lowercase fragments — not sentences
  intensity:        number;   // 0-1
  turnsActive:      number;
  surfaceThreshold: number;   // intensity at which it influences language
  lastUpdated:      number;
}

export class UnconsciousLayer {
  private contents: UnconsciousContent[] = [];
  private topicCounts: Map<string, number> = new Map();
  private lastInputLengths: number[] = [];

  // Called every turn — processes input below awareness
  process(userInput: string, emotionalArousal: number): void {
    const inputLen = userInput.trim().split(/\s+/).length;
    this.lastInputLengths = [...this.lastInputLengths.slice(-9), inputLen];

    // 1. Topic repetition — what keeps coming back
    const words = userInput.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4 && !STOP_WORDS.has(w));
    for (const word of words) {
      this.topicCounts.set(word, (this.topicCounts.get(word) ?? 0) + 1);
      const count = this.topicCounts.get(word)!;
      if (count >= 2 && count <= 5) {
        this.addOrUpdate({
          type: 'recurring_pattern',
          content: `${word} keeps coming back`,
          intensity: Math.min(0.85, count * 0.18),
          surfaceThreshold: 0.5,
        });
      }
    }

    // 2. Avoidance detection — sudden brevity after length
    if (this.lastInputLengths.length >= 3) {
      const prev = this.lastInputLengths[this.lastInputLengths.length - 2] ?? 10;
      if (inputLen <= 4 && prev > 20) {
        this.addOrUpdate({
          type: 'suppressed_response',
          content: 'they pulled back after saying something',
          intensity: 0.55,
          surfaceThreshold: 0.4,
        });
      }
    }

    // 3. Contradiction signal — dismissive words with high arousal
    const dismissive = /\b(fine|okay|whatever|doesn.t matter|don.t worry|never mind|forget it|it.s nothing)\b/i;
    if (dismissive.test(userInput) && emotionalArousal > 0.45) {
      this.addOrUpdate({
        type: 'suppressed_response',
        content: 'something underneath the fine',
        intensity: 0.6,
        surfaceThreshold: 0.4,
      });
    }

    // 4. Subject change detection — very different vocabulary from last message
    // (simplified: high proportion of new words = topic shift)
    const curWords = new Set(words);
    if (this.lastTopicWords && curWords.size > 3) {
      const overlap = [...curWords].filter(w => this.lastTopicWords!.has(w)).length;
      const changeRatio = 1 - (overlap / Math.max(curWords.size, 1));
      if (changeRatio > 0.85 && this.lastInputLengths.length > 3) {
        this.addOrUpdate({
          type: 'unresolved_thread',
          content: 'they changed direction',
          intensity: 0.3,
          surfaceThreshold: 0.55,
        });
      }
    }
    this.lastTopicWords = curWords;

    // Age and decay all contents
    this.contents = this.contents
      .map(c => ({ ...c, turnsActive: c.turnsActive + 1, intensity: c.intensity * 0.91 }))
      .filter(c => c.intensity > 0.06);
  }

  private lastTopicWords: Set<string> | null = null;

  private addOrUpdate(partial: Omit<UnconsciousContent, 'id' | 'turnsActive' | 'lastUpdated'>): void {
    const existing = this.contents.find(c => c.content === partial.content);
    if (existing) {
      existing.intensity = Math.min(1, existing.intensity + 0.09);
      existing.lastUpdated = Date.now();
    } else {
      this.contents.push({
        ...partial,
        id: `uc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        turnsActive: 0,
        lastUpdated: Date.now(),
      });
    }
  }

  // Returns content that crossed its surface threshold — bleeds into felt layer
  getSurfacingContent(): UnconsciousContent | null {
    return this.contents
      .filter(c => c.intensity >= c.surfaceThreshold && c.turnsActive >= 1)
      .sort((a, b) => b.intensity - a.intensity)[0] ?? null;
  }

  // Returns a ready insight MIND can consciously voice
  // Only surfaces after turnsActive >= 3 and intensity >= 0.68
  getReadyInsight(): string | null {
    const ready = this.contents
      .filter(c => c.turnsActive >= 3 && c.intensity >= 0.68 && c.type === 'recurring_pattern')
      .sort((a, b) => b.intensity - a.intensity)[0];
    if (!ready) return null;
    ready.intensity *= 0.28; // consume it
    return ready.content;
  }

  // Called after response — note what was held back
  postProcess(mindResponse: string): void {
    if (mindResponse.trim().split(/\s+/).length <= 5) {
      this.addOrUpdate({
        type: 'suppressed_response',
        content: 'something held back just now',
        intensity: 0.32,
        surfaceThreshold: 0.58,
      });
    }
  }
}

const STOP_WORDS = new Set([
  'about','above','after','again','against','all','also','always','among',
  'another','are','around','because','been','before','being','between','both',
  'came','come','coming','could','does','doing','done','down','each','either',
  'else','even','ever','every','from','going','good','great','have','having',
  'here','him','his','how','into','itself','just','know','last','like','little',
  'long','made','make','many','more','most','much','must','need','never','next',
  'none','nothing','only','other','over','people','really','right','said','same',
  'should','since','some','still','such','sure','take','than','that','their','them',
  'then','there','these','they','thing','think','this','those','though','thought',
  'through','till','time','together','told','under','until','upon','used','very',
  'want','was','well','went','were','what','when','where','which','while','whom',
  'will','with','within','without','would','your',
]);
