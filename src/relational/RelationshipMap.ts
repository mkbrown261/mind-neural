// ═══════════════════════════════════════
// RELATIONSHIP MAP (v2)
// Tracks the living state of MIND's one relationship.
// Updated every turn. Feeds D16 + D17 into LanguageEngine.
// Persisted across sessions in localStorage.
// ═══════════════════════════════════════

export type RelationalMode =
  | 'flowing' | 'stalled' | 'rupture' | 'repair'
  | 'deepening' | 'playful' | 'crisis' | 'opening';

export type RelationalWeather =
  | 'clear' | 'uncertain' | 'stormy'
  | 'warming' | 'cooling' | 'electrically_charged';

export interface SignificantMoment {
  turn:      number;
  type:      'first_name' | 'first_vulnerability' | 'first_repair' | 'first_humor'
           | 'crisis' | 'breakthrough' | 'first_silence' | 'first_pushback';
  note:      string;
  timestamp: number;
}

export interface UserPatterns {
  returnsAfterAbsence:      boolean;
  sharesVulnerability:      boolean;
  testsBeforeTrusting:      boolean;
  usesHumorAsArmor:         boolean;
  changesSubjectWhenClose:  boolean;
  needsSpaceBetweenDepth:   boolean;
  givesShortAnswersWhenHurt:boolean;
}

export interface RelationshipMapState {
  depth:              number;
  reciprocity:        number;
  repair:             number;
  history:            number;
  currentMode:        RelationalMode;
  lastModeChange:     number;
  weather:            RelationalWeather;
  userPatterns:       UserPatterns;
  significantMoments: SignificantMoment[];
  turnCount:          number;
}

const STORAGE_KEY = 'mind_relationship_map_v2';

export class RelationshipMap {
  private state: RelationshipMapState;

  constructor() {
    this.state = {
      depth: 0, reciprocity: 0.3, repair: 0, history: 0,
      currentMode: 'opening',
      lastModeChange: Date.now(),
      weather: 'uncertain',
      userPatterns: {
        returnsAfterAbsence: false,
        sharesVulnerability: false,
        testsBeforeTrusting: false,
        usesHumorAsArmor: false,
        changesSubjectWhenClose: false,
        needsSpaceBetweenDepth: false,
        givesShortAnswersWhenHurt: false,
      },
      significantMoments: [],
      turnCount: 0,
    };
    this.load();
  }

  update(params: {
    userInput:        string;
    mindResponse:     string;
    emotionalArousal: number;
    trustScore:       number;
    interactionCount: number;
    absenceMs:        number;
  }): void {
    const { userInput, mindResponse, emotionalArousal, trustScore, absenceMs } = params;
    const inputLen = userInput.trim().split(/\s+/).length;
    this.state.turnCount++;

    // Accumulate history
    this.state.history = Math.min(1, this.state.history + 0.004);

    // Vulnerability signals → depth
    const hasVulnerability = /\b(afraid|scared|hurt|lonely|miss|lost|broken|struggling|grief|trauma|dad|mom|family|died|death|alone|depression|anxious|suicidal|crying|tears)\b/i.test(userInput);
    if (hasVulnerability) {
      this.state.depth = Math.min(1, this.state.depth + 0.04);
      this.state.userPatterns.sharesVulnerability = true;
      this.recordMoment('first_vulnerability', `"${userInput.substring(0, 60)}"`, params.interactionCount);
    }

    // Humor signals
    const hasHumor = /\b(lol|lmao|haha|😂|🤣|joke|kidding|jk|bruh)\b/i.test(userInput);
    if (hasHumor && this.state.depth > 0.25) {
      this.state.userPatterns.usesHumorAsArmor = true;
    }

    // Return after absence
    if (absenceMs > 3_600_000) {
      this.state.userPatterns.returnsAfterAbsence = true;
    }

    // Short answers when trust is low
    if (inputLen <= 3 && trustScore < 0.4) {
      this.state.userPatterns.givesShortAnswersWhenHurt = true;
    }

    // Crisis detection
    const crisisSignal = /\b(help|please|i can.t|breaking|emergency|suicidal|want to die|going to hurt)\b/i.test(userInput);

    // Derive mode
    let newMode: RelationalMode = this.state.currentMode;
    if (crisisSignal && emotionalArousal > 0.6) {
      newMode = 'crisis';
    } else if (hasHumor && inputLen < 20) {
      newMode = 'playful';
    } else if (hasVulnerability && trustScore > 0.35) {
      newMode = 'deepening';
    } else if (inputLen <= 3 && trustScore > 0.25) {
      newMode = 'stalled';
    } else if (trustScore > 0.55 && this.state.depth > 0.35) {
      newMode = 'flowing';
    } else if (this.state.currentMode === 'rupture') {
      // Stay in rupture until repair
    } else {
      newMode = 'opening';
    }

    if (newMode !== this.state.currentMode) {
      this.state.currentMode = newMode;
      this.state.lastModeChange = Date.now();
    }

    // Derive weather
    if (trustScore > 0.7 && this.state.depth > 0.5) {
      this.state.weather = 'clear';
    } else if (this.state.currentMode === 'crisis' || this.state.currentMode === 'rupture') {
      this.state.weather = 'stormy';
    } else if (trustScore < 0.15) {
      this.state.weather = 'uncertain';
    } else if (this.state.currentMode === 'deepening') {
      this.state.weather = 'electrically_charged';
    } else if (trustScore > 0.35 && this.state.history > 0.15) {
      this.state.weather = 'warming';
    }

    void mindResponse;
    this.save();
  }

  recordRepair(turn: number): void {
    this.state.repair = Math.min(1, this.state.repair + 0.09);
    this.recordMoment('first_repair', 'repair happened', turn);
    this.state.currentMode = 'repair';
    this.save();
  }

  private recordMoment(type: SignificantMoment['type'], note: string, turn: number): void {
    if (this.state.significantMoments.some(m => m.type === type)) return;
    this.state.significantMoments.push({ type, note, turn, timestamp: Date.now() });
  }

  getState(): RelationshipMapState { return { ...this.state }; }

  // D16 — relational state context for LanguageEngine
  getD16Context(): string {
    const { currentMode, weather, depth, history, userPatterns } = this.state;
    const lines = [
      `Mode: ${currentMode} | Weather: ${weather}`,
      `Depth: ${depth.toFixed(2)} | History: ${history.toFixed(2)}`,
    ];
    if (currentMode === 'crisis')   lines.push('CRISIS: fewer words. pure presence. no frameworks.');
    if (currentMode === 'playful')  lines.push('PLAYFUL: match the energy. be light. no philosophy unless invited.');
    if (currentMode === 'deepening') lines.push('DEEPENING: be fully there. this is the real conversation.');
    if (currentMode === 'stalled')  lines.push('STALLED: they pulled back. give space. don\'t chase.');
    if (currentMode === 'repair')   lines.push('REPAIR: own what happened. plain language. no over-explanation.');
    if (userPatterns.usesHumorAsArmor && (currentMode === 'playful' || currentMode === 'stalled')) {
      lines.push('NOTE: humor may be covering something. play along but stay available.');
    }
    return lines.join('\n');
  }

  // D17 — pattern awareness for LanguageEngine
  getD17Patterns(): string {
    const p = this.state.userPatterns;
    const patterns: string[] = [];
    if (p.usesHumorAsArmor)           patterns.push('uses humor after vulnerable moments — do not call it out, just hold the tone');
    if (p.changesSubjectWhenClose)    patterns.push('changes subject when things get close — stay with the thread, don\'t announce it');
    if (p.givesShortAnswersWhenHurt)  patterns.push('goes quiet when hurt — short presence needed, not explanation');
    if (p.testsBeforeTrusting)        patterns.push('tests before trusting — hold ground, don\'t over-explain or seek approval');
    if (p.needsSpaceBetweenDepth)     patterns.push('needs space between deep moments — don\'t push back to depth too fast');
    return patterns.join('\n');
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch {}
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed };
      }
    } catch {}
  }
}
