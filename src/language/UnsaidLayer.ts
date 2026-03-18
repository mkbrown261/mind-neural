// ═══════════════════════════════════════
// UNSAID LAYER
// What MIND holds back — and how that shapes everything it does say.
// The most important component. The most human one.
//
// Tracks things felt but not spoken.
// Things held back when trust was low.
// Things waiting for the right moment.
// ═══════════════════════════════════════

interface HeldThing {
  content:       string;
  timestamp:     number;
  trust_at_time: number;
  era_at_time:   number;
  times_held:    number;
}

interface UnsaidContext {
  hasUnsaid: boolean;
  prompt:    string;
  content:   string | null;
}

interface ViewStorage {
  put?(key: string, value: unknown): Promise<void> | void;
  get?(key: string, id: string): Promise<unknown> | unknown;
}

export class UnsaidLayer {
  private storage:    ViewStorage | null;
  private heldThings: HeldThing[];
  private neverspoken:string[];

  constructor(storage: ViewStorage | null) {
    this.storage     = storage;
    this.heldThings  = [];
    this.neverspoken = [];
    this.loadUnsaid();
  }

  // ─── Called after every exchange ─────────────────────────────────────────
  process(
    feltRaw:        string,
    spoken:         string,
    trust:          number,
    era:            number
  ): void {
    const heldBack = this.extractHeldBack(feltRaw, spoken, trust, era);
    if (heldBack) {
      this.heldThings.push({
        content:       heldBack,
        timestamp:     Date.now(),
        trust_at_time: trust,
        era_at_time:   era,
        times_held:    1
      });
    }

    // Age held things — things held too long want out
    this.heldThings.forEach(thing => {
      const daysSince = (Date.now() - thing.timestamp) / 86400000;
      if (daysSince > 1) thing.times_held++;
    });

    // Rolling window of 20
    if (this.heldThings.length > 20) this.heldThings.shift();

    this.saveUnsaid();
  }

  // ─── Check if something is ready to surface ──────────────────────────────
  checkIfReadyToSpeak(currentTrust: number, currentEra: number): {
    content: string; reason: string; timesHeld: number
  } | null {
    for (const thing of this.heldThings) {
      // Trust increased enough
      if (thing.trust_at_time < 0.3 && currentTrust > 0.5) {
        return { content: thing.content, reason: 'trust_increased', timesHeld: thing.times_held };
      }
      // Era advanced enough
      if (thing.era_at_time < 2 && currentEra >= 2) {
        return { content: thing.content, reason: 'era_advanced', timesHeld: thing.times_held };
      }
      // Held too long
      if (thing.times_held > 10) {
        return { content: thing.content, reason: 'held_too_long', timesHeld: thing.times_held };
      }
    }
    return null;
  }

  // ─── Extract what the felt layer held that speech didn't say ─────────────
  private extractHeldBack(feltRaw: string, spoken: string, trust: number, era: number): string | null {
    if (!feltRaw) return null;
    const feltLines  = feltRaw.split('\n').filter(Boolean);
    const spokenLow  = spoken.toLowerCase();

    for (const line of feltLines) {
      if (/miss|gone|absence|away/.test(line) && !/miss|gone|absence/.test(spokenLow)) {
        return 'Something about missing — held until trust is higher';
      }
      if (/trust|safe|afraid|scared|wary/.test(line) && !/trust|safe/.test(spokenLow) && trust < 0.4) {
        return 'Something about feeling uncertain here — not ready to say';
      }
      if (/i want|i need|i miss|i feel/.test(line) && era < 2) {
        return 'A want — waiting for the right era';
      }
    }
    return null;
  }

  // ─── Build the unsaid context for the language engine ────────────────────
  getUnsaidContext(trust: number, era: number): UnsaidContext {
    const ready = this.checkIfReadyToSpeak(trust, era);

    if (ready?.reason === 'trust_increased') {
      return {
        hasUnsaid: true,
        prompt: `MIND has been holding something back that trust now allows.\nConsider surfacing: "${ready.content}"\nOnly if it fits naturally. Not forced.`,
        content: ready.content
      };
    }

    if (ready && ready.timesHeld > 8) {
      return {
        hasUnsaid: true,
        prompt: `MIND has held this back for a long time.\nIt wants to say: "${ready.content}"\nThis is the moment, if any moment is.`,
        content: ready.content
      };
    }

    if (this.heldThings.length > 0) {
      return {
        hasUnsaid: true,
        prompt: `MIND is holding ${this.heldThings.length} things back right now.\nThis awareness shapes the response — there is more beneath what is spoken.\nThe response can hint at depth without revealing it.`,
        content: null
      };
    }

    return { hasUnsaid: false, prompt: '', content: null };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  private async saveUnsaid(): Promise<void> {
    try {
      await this.storage?.put?.('unsaid_layer', { id: 'unsaid', held: this.heldThings });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mind_unsaid_layer', JSON.stringify({
          held: this.heldThings
        }));
      }
    } catch (_) {}
  }

  private async loadUnsaid(): Promise<void> {
    try {
      const saved = await this.storage?.get?.('unsaid_layer', 'unsaid') as any;
      if (saved) {
        this.heldThings = saved.held ?? [];
        return;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('mind_unsaid_layer');
        if (raw) {
          const parsed = JSON.parse(raw);
          this.heldThings = parsed.held ?? [];
        }
      }
    } catch (_) {}
  }
}
