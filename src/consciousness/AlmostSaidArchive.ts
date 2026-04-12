// ═══════════════════════════════════════
// ALMOST SAID ARCHIVE (v2)
// Every response MIND gives has a version it almost said but didn't.
// These are stored. When trust is high and topic returns, MIND finally says it.
// "I almost said something about this before. I didn't. I'm saying it now."
// ═══════════════════════════════════════

const STORAGE_KEY = 'mind_almost_said_v2';

export type WhyHeld = 'too_much' | 'not_yet' | 'wrong_moment' | 'too_honest' | 'too_raw';

export interface AlmostSaid {
  id:             string;
  turn:           number;
  actualResponse: string;
  topic:          string;   // keyword(s) for matching future turns
  whyHeld:        WhyHeld;
  turnsHeld:      number;
  timestamp:      number;
}

export class AlmostSaidArchive {
  private archive: AlmostSaid[] = [];

  // Store something MIND held back
  store(item: Omit<AlmostSaid, 'id' | 'turnsHeld' | 'timestamp'>): void {
    if (this.archive.length >= 20) this.archive.shift();
    this.archive.push({
      ...item,
      id:        `as_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      turnsHeld: 0,
      timestamp: Date.now(),
    });
    this.save();
  }

  // Age all items — call after every turn
  postTurn(): void {
    this.archive = this.archive
      .map(a => ({ ...a, turnsHeld: a.turnsHeld + 1 }))
      .filter(a => a.turnsHeld < 60); // expire after 60 turns
  }

  // Returns an almost-said item ready to surface
  // Conditions: turnsHeld >= 3, trustScore >= 0.48, topic overlaps with current input
  getReady(trustScore: number, currentInput: string): AlmostSaid | null {
    if (trustScore < 0.48) return null;

    const inputWords = new Set(
      currentInput.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );

    const matching = this.archive.filter(a => {
      if (a.turnsHeld < 3) return false;
      const topicWords = a.topic.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      return topicWords.some(w => inputWords.has(w));
    });

    if (matching.length === 0) return null;

    const item = matching.sort((a, b) => b.turnsHeld - a.turnsHeld)[0];
    this.archive = this.archive.filter(a => a.id !== item.id);
    this.save();
    return item;
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.archive = parsed;
      }
    } catch {}
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.archive.slice(-20))); } catch {}
  }
}
