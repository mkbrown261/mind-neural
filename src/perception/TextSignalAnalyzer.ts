// ═══════════════════════════════════════
// LAYER 2 — TextSignalAnalyzer
// Perception module: typing dynamics analysis
// Tracks keystrokes, corrections, speed, punctuation, rhythm
// Sends text.signal intents via IntentLayer. Never imports Action Layer.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';

// ─── Public contract ─────────────────────────────────────────────────────────
export interface TextFeatures {
  // Timing
  typingDurationMs:    number;   // ms from first key to send
  wordsPerMinute:      number;   // average WPM
  keystrokesPerChar:   number;   // >1 indicates corrections

  // Corrections
  deletionCount:       number;   // backspace / delete presses
  correctionRatio:     number;   // deletions / total chars typed (0–1)

  // Rhythm
  interKeystrokeCV:    number;   // coefficient of variation of inter-key intervals (0–1)
  pauseCount:          number;   // pauses > 1.5s within typing
  burstCount:          number;   // rapid bursts (>3 keys in <200ms)

  // Linguistic
  wordCount:           number;
  avgWordLength:       number;
  punctuationDensity:  number;   // punctuation chars / total chars
  questionMarks:       number;
  exclamationMarks:    number;
  ellipsisCount:       number;   // "..." occurrences
  capsRatio:           number;   // uppercase / lowercase ratio
  emojiCount:          number;

  // Composition signals
  restartCount:        number;   // times all text was deleted before sending
  finalLength:         number;   // chars in sent message
}

export interface TextSignalPayload {
  features:  TextFeatures;
  rawText:   string;
  timestamp: number;
}

// ─── Internal state ───────────────────────────────────────────────────────────
interface TypingSession {
  startTime:    number;
  keyTimestamps: number[];
  totalKeys:    number;
  deletions:    number;
  restarts:     number;
  pauses:       number;
  bursts:       number;
  lastKeyTime:  number;
  burstBuffer:  number;   // keys in current fast burst
}

export class TextSignalAnalyzer {
  private intent: IntentLayer;
  private session: TypingSession | null = null;
  private readonly PAUSE_THRESHOLD_MS = 1500;
  private readonly BURST_WINDOW_MS    = 200;
  private readonly BURST_MIN_KEYS     = 3;

  constructor(intent: IntentLayer) {
    this.intent = intent;
  }

  // ─── Called by app.ts when input field gains first keypress ──────────────
  onTypingStart(): void {
    this.session = {
      startTime:     Date.now(),
      keyTimestamps: [],
      totalKeys:     0,
      deletions:     0,
      restarts:      0,
      pauses:        0,
      bursts:        0,
      lastKeyTime:   Date.now(),
      burstBuffer:   0
    };
  }

  // ─── Called on every keydown event ────────────────────────────────────────
  onKeypress(event: KeyboardEvent, currentValue: string): void {
    if (!this.session) this.onTypingStart();
    const s = this.session!;
    const now = Date.now();

    // Detect pause (gap since last key)
    const gap = now - s.lastKeyTime;
    if (gap > this.PAUSE_THRESHOLD_MS && s.totalKeys > 0) s.pauses++;

    // Detect burst
    if (gap < this.BURST_WINDOW_MS) {
      s.burstBuffer++;
      if (s.burstBuffer === this.BURST_MIN_KEYS) s.bursts++;
    } else {
      s.burstBuffer = 1;
    }

    s.keyTimestamps.push(now);
    s.totalKeys++;
    s.lastKeyTime = now;

    // Deletion tracking
    if (event.key === 'Backspace' || event.key === 'Delete') {
      s.deletions++;
    }

    // Restart: if the whole field is cleared (length < 2 after previous content)
    if (currentValue.length < 2 && s.totalKeys > 5) {
      s.restarts++;
    }
  }

  // ─── Called just before message is sent; emits text.signal ───────────────
  async analyze(text: string): Promise<void> {
    const s = this.session;
    const features = this.extractFeatures(text, s);

    // Reset session after each message
    this.session = null;

    const payload: TextSignalPayload = {
      features,
      rawText:   text,
      timestamp: Date.now()
    };

    await this.intent.send('text.signal', payload);
  }

  // ─── Feature extraction ───────────────────────────────────────────────────
  private extractFeatures(text: string, s: TypingSession | null): TextFeatures {
    const now = Date.now();
    const durationMs = s ? (now - s.startTime) : 0;
    const wordCount  = text.trim().split(/\s+/).filter(Boolean).length;
    const totalKeys  = s?.totalKeys ?? text.length;
    const deletions  = s?.deletions ?? 0;

    // WPM
    const minutes     = durationMs / 60000;
    const wpm         = minutes > 0 ? wordCount / minutes : 0;

    // Correction ratio
    const keystrokesPerChar = text.length > 0 ? totalKeys / text.length : 1;
    const correctionRatio   = totalKeys > 0 ? Math.min(1, deletions / totalKeys) : 0;

    // Inter-keystroke coefficient of variation
    const intervals: number[] = [];
    const timestamps = s?.keyTimestamps ?? [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const ikCV = this.coefficientOfVariation(intervals);

    // Linguistic analysis
    const avgWordLen = wordCount > 0
      ? text.trim().split(/\s+/).filter(Boolean).reduce((a, w) => a + w.length, 0) / wordCount
      : 0;
    const punctuationDensity = text.length > 0
      ? (text.match(/[.,!?;:…\-–]/g)?.length ?? 0) / text.length
      : 0;
    const questionMarks    = (text.match(/\?/g) ?? []).length;
    const exclamationMarks = (text.match(/!/g) ?? []).length;
    const ellipsisCount    = (text.match(/\.\.\.|…/g) ?? []).length;

    // Caps ratio (only alphabetic chars)
    const letters = text.replace(/[^a-zA-Z]/g, '');
    const capsRatio = letters.length > 0
      ? (text.match(/[A-Z]/g)?.length ?? 0) / letters.length
      : 0;

    // Emoji count (basic emoji regex)
    const emojiCount = (text.match(/[\u{1F300}-\u{1FFFF}]/u) ?? []).length;

    return {
      typingDurationMs:   durationMs,
      wordsPerMinute:     Math.min(200, wpm),
      keystrokesPerChar:  Math.max(1, keystrokesPerChar),
      deletionCount:      deletions,
      correctionRatio:    Math.max(0, Math.min(1, correctionRatio)),
      interKeystrokeCV:   Math.max(0, Math.min(1, ikCV)),
      pauseCount:         s?.pauses ?? 0,
      burstCount:         s?.bursts ?? 0,
      wordCount,
      avgWordLength:      avgWordLen,
      punctuationDensity: Math.max(0, Math.min(1, punctuationDensity)),
      questionMarks,
      exclamationMarks,
      ellipsisCount,
      capsRatio:          Math.max(0, Math.min(1, capsRatio)),
      emojiCount,
      restartCount:       s?.restarts ?? 0,
      finalLength:        text.length
    };
  }

  // ─── Math helpers ─────────────────────────────────────────────────────────
  private coefficientOfVariation(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (mean === 0) return 0;
    const variance = arr.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / arr.length;
    return Math.sqrt(variance) / mean;
  }
}
