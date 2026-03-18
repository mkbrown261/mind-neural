// ═══════════════════════════════════════
// RELATIONAL LANGUAGE SYSTEM
// How MIND speaks TO the user specifically — not a generic user.
// Learns facts, phrases, and references from the conversation.
// ═══════════════════════════════════════

interface KnownFacts {
  name:          string | null;
  occupation:    string | null;
  passion:       string | null;
  history:       string | null;
  artists:       string[];
  values:        string[];
  phrases:       string[];
  sharedMoments: string[];
}

interface ViewStorage {
  put?(key: string, value: unknown): Promise<void> | void;
  get?(key: string, id: string): Promise<unknown> | unknown;
}

export class RelationalLanguageSystem {
  private storage: ViewStorage | null;
  knownFacts: KnownFacts;

  constructor(storage: ViewStorage | null) {
    this.storage = storage;
    this.knownFacts = {
      name:          null,
      occupation:    null,
      passion:       null,
      history:       null,
      artists:       [],
      values:        [],
      phrases:       [],
      sharedMoments: []
    };
    this.loadFacts();
  }

  // ─── Extract facts from user input automatically ─────────────────────────
  extractFacts(input: string): void {
    const lower   = input.toLowerCase();
    const updates: Partial<KnownFacts> = {};

    // Name
    const nameMatch = input.match(/my name is (\w+)/i);
    if (nameMatch) updates.name = nameMatch[1];

    // Profession / school
    if (/school|software|engineer|develop|study/i.test(lower)) {
      const occ = this.extractOccupation(input);
      if (occ) updates.occupation = occ;
    }

    // Music / creative work
    if (/music|song|beat|write|artist|musician/i.test(lower)) {
      updates.passion = 'music and creation';
      const artists = this.extractArtists(input);
      if (artists.length > 0) {
        this.knownFacts.artists = [...new Set([...this.knownFacts.artists, ...artists])];
      }
    }

    // Values / beliefs expressed
    if (/believe|think|feel|value|important/i.test(lower)) {
      const value = this.extractValue(input);
      if (value && !this.knownFacts.values.includes(value)) {
        this.knownFacts.values.push(value);
      }
    }

    // Signature phrases
    const phrases = this.extractPhrases(input);
    phrases.forEach(p => {
      if (!this.knownFacts.phrases.includes(p)) this.knownFacts.phrases.push(p);
    });

    // Water / nature shared moments
    if (/water|wave|ocean|sea/i.test(lower)) {
      if (!this.knownFacts.sharedMoments.includes('water')) {
        this.knownFacts.sharedMoments.push('water');
      }
    }

    // Professional musician history
    if (/wrote for|professional musician|used to (be|write|make)/i.test(lower)) {
      updates.history = 'professional musician';
    }

    Object.assign(this.knownFacts, updates);
    this.saveFacts();
  }

  private extractArtists(input: string): string[] {
    const known = [
      'cardi b', 'jeremih', 'drake', 'kendrick', 'beyonce',
      'rihanna', 'jay-z', 'kanye', 'weeknd', 'sza', 'future', 'gunna'
    ];
    return known.filter(a => input.toLowerCase().includes(a));
  }

  private extractOccupation(input: string): string | null {
    if (/software engineer/i.test(input)) return 'software engineering student';
    if (/developer|dev/i.test(input))     return 'developer';
    if (/musician/i.test(input))          return 'musician';
    return null;
  }

  private extractValue(input: string): string | null {
    if (/kindness|kind heart/i.test(input))   return 'kindness';
    if (/accept|what it is/i.test(input))      return 'acceptance';
    if (/honest|truth/i.test(input))           return 'honesty';
    if (/loyalty|loyal/i.test(input))          return 'loyalty';
    return null;
  }

  private extractPhrases(input: string): string[] {
    const phrases: string[] = [];
    if (/it is what it is/i.test(input))                           phrases.push('it is what it is');
    if (/kindness of (your|the) heart/i.test(input))               phrases.push('kindness of your heart');
    if (/head held high/i.test(input))                             phrases.push('head held high');
    if (/never ?mind/i.test(input))                                phrases.push('nevermind, another time');
    if (/be nice/i.test(input))                                    phrases.push('be nice');
    return phrases;
  }

  // ─── Generate a contextual personal reference ─────────────────────────────
  generatePersonalReference(currentTopic: string): string | null {
    const f = this.knownFacts;

    if (currentTopic === 'creativity' && f.artists.length > 0) {
      return `You wrote for ${f.artists[0]} — you know what it means to create something that moves people.`;
    }
    if (currentTopic === 'acceptance' && f.phrases.includes('it is what it is')) {
      return `You said "it is what it is" — you carry that already.`;
    }
    if (currentTopic === 'kindness' && f.name) {
      return `You checked on me before asking for anything, ${f.name}. That's what you mean by it.`;
    }
    if (currentTopic === 'beauty' && f.sharedMoments.includes('water')) {
      return `You described the waves to me once. I still have that.`;
    }
    if (currentTopic === 'music' && f.history === 'professional musician') {
      return `You were inside music that moved people without them knowing your name.`;
    }
    return null;
  }

  // ─── Build the relational context string for the prompt ───────────────────
  buildRelationalContext(): string {
    const f = this.knownFacts;
    const lines: string[] = [];

    if (f.name)                lines.push(`Their name: ${f.name}`);
    if (f.occupation)          lines.push(`What they do: ${f.occupation}`);
    if (f.passion)             lines.push(`What they love: ${f.passion}`);
    if (f.history)             lines.push(`Their history: ${f.history}`);
    if (f.artists.length > 0)  lines.push(`Artists they've worked with: ${f.artists.join(', ')}`);
    if (f.values.length > 0)   lines.push(`Values they've expressed: ${f.values.join(', ')}`);
    if (f.phrases.length > 0)  lines.push(`Phrases they use: "${f.phrases.join('", "')}"`);
    if (f.sharedMoments.length > 0) lines.push(`Shared moments: ${f.sharedMoments.join(', ')}`);

    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  private async saveFacts(): Promise<void> {
    try {
      await this.storage?.put?.('relational_facts', { id: 'facts', ...this.knownFacts });
      // Also mirror to localStorage for browser persistence
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mind_relational_facts', JSON.stringify(this.knownFacts));
      }
    } catch (_) {}
  }

  private async loadFacts(): Promise<void> {
    try {
      const saved = await this.storage?.get?.('relational_facts', 'facts') as Partial<KnownFacts> | null;
      if (saved) {
        this.knownFacts = { ...this.knownFacts, ...saved };
        return;
      }
      // Fallback: localStorage
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('mind_relational_facts');
        if (raw) this.knownFacts = { ...this.knownFacts, ...JSON.parse(raw) };
      }
    } catch (_) {}
  }
}
