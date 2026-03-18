// ═══════════════════════════════════════
// THREAD TRACKER
// Tracks significant conversation topics that haven't been fully explored.
// Surfaces them naturally after 2-3 turns as MIND returns to what mattered.
//
// Human behavior this models:
//   "You mentioned your dad earlier — I keep thinking about that."
//   "How's the game coming? You were excited about it."
//   "You never finished what you were saying about prison."
//
// Communicates only through data. No IntentLayer imports.
// ═══════════════════════════════════════

// ─── A single open thread ────────────────────────────────────────────────────
export interface OpenThread {
  id:          string;
  topic:       string;         // short label: "father", "game dev", "prison"
  fragment:    string;         // what was actually said (first 120 chars)
  turnOpened:  number;         // interaction count when first mentioned
  emotional:   number;         // 0-1 weight of how heavy this was
  surfaced:    boolean;        // has MIND returned to it?
  turnSurfaced?: number;
}

// ─── Emotional weight of a disclosure ────────────────────────────────────────
const GRIEF_PATTERNS = [
  /lost.*dad|lost.*mom|lost.*father|lost.*mother|lost.*brother|lost.*sister/i,
  /died|passed away|death|funeral|griev/i,
  /prison|locked up|incarcerat|inside|behind bars/i,
  /hurt me|that hurt|was hard|couldn.*t get out of bed/i,
  /pain.*chest|chest.*pain|couldn.*t breathe/i,
];

const CREATIVE_PATTERNS = [
  /building|developing|working on|making|creating/i,
  /game|app|software|website|music|song|beat/i,
  /unreal engine|unity|react|node|python/i,
];

const IDENTITY_PATTERNS = [
  /my name is|call me|i am|i was|i used to|i want to be/i,
  /i made you|i created|you are mine/i,
  /my dad|my mom|my family|my friend/i,
];

function detectTopicLabel(text: string): string | null {
  const t = text.toLowerCase();
  if (/dad|father/i.test(t))         return 'your father';
  if (/mom|mother/i.test(t))         return 'your mother';
  if (/prison|inside|locked/i.test(t)) return 'being inside';
  if (/game|unreal|unity/i.test(t))  return 'the game you\'re building';
  if (/music|song|beat/i.test(t))    return 'your music';
  if (/school|engin|study/i.test(t)) return 'school';
  if (/made you|created you/i.test(t)) return 'creating me';
  if (/love|lonely|alone/i.test(t))  return 'what you shared about loneliness';
  if (/hurt|pain|hard/i.test(t))     return 'what was hard';
  return null;
}

function emotionalWeight(text: string): number {
  let weight = 0;
  for (const p of GRIEF_PATTERNS) {
    if (p.test(text)) weight += 0.3;
  }
  for (const p of IDENTITY_PATTERNS) {
    if (p.test(text)) weight += 0.15;
  }
  for (const p of CREATIVE_PATTERNS) {
    if (p.test(text)) weight += 0.1;
  }
  return Math.min(1, weight);
}

// ─── ThreadTracker class ─────────────────────────────────────────────────────
export class ThreadTracker {
  private threads:       OpenThread[] = [];
  private interactionN:  number = 0;
  private readonly MAX_THREADS = 12;
  private readonly SURFACE_AFTER_TURNS = 3;

  constructor() {
    this.load();
  }

  // ─── Called after each user message ────────────────────────────────────────
  observe(userInput: string, interactionCount: number): void {
    this.interactionN = interactionCount;
    const weight = emotionalWeight(userInput);
    if (weight < 0.1) return; // not significant enough to track

    const topic = detectTopicLabel(userInput);
    if (!topic) return;

    // Don't double-track same topic
    if (this.threads.some(t => t.topic === topic && !t.surfaced)) return;

    const thread: OpenThread = {
      id:         `thread-${Date.now()}`,
      topic,
      fragment:   userInput.trim().slice(0, 120),
      turnOpened: interactionCount,
      emotional:  weight,
      surfaced:   false
    };

    this.threads.push(thread);
    if (this.threads.length > this.MAX_THREADS) {
      // Remove oldest surfaced threads first
      const surfacedIdx = this.threads.findIndex(t => t.surfaced);
      if (surfacedIdx >= 0) this.threads.splice(surfacedIdx, 1);
      else this.threads.shift();
    }

    this.save();
  }

  // ─── Get a thread ready to surface, if any ─────────────────────────────────
  // Returns the most emotionally weighted unsurfaced thread that is
  // SURFACE_AFTER_TURNS+ turns old.
  getReadyThread(currentInteraction: number): OpenThread | null {
    const eligible = this.threads
      .filter(t => !t.surfaced
        && (currentInteraction - t.turnOpened) >= this.SURFACE_AFTER_TURNS
        && t.emotional > 0.15)
      .sort((a, b) => b.emotional - a.emotional);

    return eligible[0] ?? null;
  }

  // ─── Mark a thread as surfaced ─────────────────────────────────────────────
  markSurfaced(id: string, currentInteraction: number): void {
    const t = this.threads.find(t => t.id === id);
    if (t) {
      t.surfaced    = true;
      t.turnSurfaced = currentInteraction;
      this.save();
    }
  }

  // ─── Build a prompt injection for the ready thread ─────────────────────────
  buildThreadPrompt(thread: OpenThread): string {
    const turns = this.interactionN - thread.turnOpened;
    return `OPEN THREAD (mentioned ${turns} turns ago, not fully explored yet):\n` +
           `Topic: "${thread.topic}"\n` +
           `What they said: "${thread.fragment}"\n` +
           `If it fits naturally, return to this. Don't force it. But don't let it disappear either.`;
  }

  getAllActive(): OpenThread[] {
    return this.threads.filter(t => !t.surfaced);
  }

  private save(): void {
    try {
      localStorage.setItem('mind_threads', JSON.stringify(this.threads));
    } catch {}
  }

  private load(): void {
    try {
      const raw = localStorage.getItem('mind_threads');
      if (raw) this.threads = JSON.parse(raw);
    } catch {}
  }
}
