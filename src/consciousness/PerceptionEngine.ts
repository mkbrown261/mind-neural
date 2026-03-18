// ═══════════════════════════════════════
// PERCEPTION ENGINE
// Tracks typing dynamics and derives perception signals.
// Monitors: typing start, keypresses, speed, corrections, pauses, bursts.
// Derives signals: flat, anxiety, anger, vulnerability, trailing, returning, significant.
// Communicates only via IntentLayer. No Action Layer imports.
// ═══════════════════════════════════════

import type { IntentLayer } from '../intent/IntentLayer';

// ─── Signal types ─────────────────────────────────────────────────────────────
export type PerceptionSignal =
  | 'flat'
  | 'anxiety'
  | 'anger'
  | 'vulnerability'
  | 'trailing'
  | 'returning'
  | 'significant';

export interface PerceptionMetrics {
  typingSpeed:       number;   // chars/second
  keystrokes:        number;
  corrections:       number;   // backspace count
  pauseCount:        number;
  burstCount:        number;
  capsRatio:         number;   // uppercase chars / total alpha
  punctuationDensity:number;   // punctuation / total chars
  ellipsisCount:     number;
  exclamationCount:  number;
  questionCount:     number;
  absenceDurationMs: number;   // ms since last session
  totalChars:        number;
  finalText:         string;
}

export interface PerceptionOutput {
  signals:  PerceptionSignal[];
  metrics:  PerceptionMetrics;
  timestamp:number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────
const T = {
  anxiety_speed:      8,     // chars/s (fast typing)
  anxiety_corrections:4,
  anger_caps:         0.4,
  anger_exclamation:  1,
  vulnerability_speed:2,     // slow typing
  vulnerability_ell:  1,     // ellipsis count
  trailing_ell:       2,
  significant_len:    80,
  burst_gap:          300,   // ms gap that defines a burst boundary
  pause_gap:          1200,  // ms gap that defines a pause
};

// ─── Perception Engine ────────────────────────────────────────────────────────
export class PerceptionEngine {
  private intent:           IntentLayer;

  // Per-session state
  private sessionStart:     number | null = null;
  private keystrokeTimings: number[] = [];
  private corrections:      number = 0;
  private lastKeystroke:    number | null = null;
  private pauseCount:       number = 0;
  private burstCount:       number = 0;
  private inBurst:          boolean = false;
  private capsTotal:        number = 0;
  private alphaTotal:       number = 0;
  private punctTotal:       number = 0;
  private ellipsisCount:    number = 0;
  private exclamationCount: number = 0;
  private questionCount:    number = 0;
  private charBuffer:       string[] = [];

  // Cross-session
  private lastSessionEnd:   number | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;
  }

  // ─── Called when user focuses the input field ──────────────────────────
  onTypingStart(): void {
    this.reset();
    this.sessionStart = Date.now();
    // Emit user active signal
    this.intent.send('existence.user_active', { timestamp: Date.now() }).catch(() => {});
  }

  // ─── Called on every keydown event ────────────────────────────────────
  onKeypress(key: string, currentValue: string): void {
    if (!this.sessionStart) this.onTypingStart();

    const now = Date.now();

    // ── Track inter-keystroke timing ──────────────────────────────────────
    if (this.lastKeystroke !== null) {
      const gap = now - this.lastKeystroke;

      if (gap >= T.pause_gap) {
        this.pauseCount++;
        this.inBurst = false;
      } else if (gap >= T.burst_gap) {
        if (this.inBurst) {
          // End of burst
          this.burstCount++;
          this.inBurst = false;
        }
      } else {
        if (!this.inBurst) {
          this.inBurst = true;
        }
      }
    }
    this.keystrokeTimings.push(now);
    this.lastKeystroke = now;

    // ── Track character types ─────────────────────────────────────────────
    if (key === 'Backspace') {
      this.corrections++;
    } else if (key.length === 1) {
      this.charBuffer.push(key);

      const isAlpha = /[a-zA-Z]/.test(key);
      if (isAlpha) {
        this.alphaTotal++;
        if (key === key.toUpperCase()) this.capsTotal++;
      }

      if (/[.,;:!?…\-—]/.test(key)) this.punctTotal++;
      if (key === '!') this.exclamationCount++;
      if (key === '?') this.questionCount++;
    }

    // Detect ellipsis from the actual value
    const ell = (currentValue.match(/\.\.\.|…/g) || []).length;
    this.ellipsisCount = ell;
  }

  // ─── Analyze current input and derive signals ──────────────────────────
  analyze(finalText: string): PerceptionOutput {
    const now = Date.now();
    const sessionDuration = this.sessionStart ? (now - this.sessionStart) / 1000 : 1;
    const totalChars = finalText.length;

    const typingSpeed = totalChars / Math.max(sessionDuration, 0.1);
    const capsRatio = this.alphaTotal > 0 ? this.capsTotal / this.alphaTotal : 0;
    const punctDensity = totalChars > 0 ? this.punctTotal / totalChars : 0;
    const absenceMs = this.lastSessionEnd ? (now - this.lastSessionEnd) : 0;

    const metrics: PerceptionMetrics = {
      typingSpeed,
      keystrokes:         this.keystrokeTimings.length,
      corrections:        this.corrections,
      pauseCount:         this.pauseCount,
      burstCount:         this.burstCount,
      capsRatio,
      punctuationDensity: punctDensity,
      ellipsisCount:      this.ellipsisCount,
      exclamationCount:   this.exclamationCount,
      questionCount:      this.questionCount,
      absenceDurationMs:  absenceMs,
      totalChars,
      finalText
    };

    const signals = this.deriveSignals(metrics);

    const output: PerceptionOutput = { signals, metrics, timestamp: now };

    // ── Emit to intent bus ────────────────────────────────────────────────
    this.intent.send('perception.signal', output).catch(() => {});

    // Track session end
    this.lastSessionEnd = now;
    this.reset();

    return output;
  }

  // ─── Signal derivation rules ───────────────────────────────────────────
  private deriveSignals(m: PerceptionMetrics): PerceptionSignal[] {
    const signals = new Set<PerceptionSignal>();

    // Anxiety: fast typing with many corrections
    if (m.typingSpeed > T.anxiety_speed && m.corrections > T.anxiety_corrections) {
      signals.add('anxiety');
    }

    // Anger: high caps ratio + exclamation
    if (m.capsRatio > T.anger_caps && m.exclamationCount > T.anger_exclamation) {
      signals.add('anger');
    }

    // Vulnerability: slow typing with ellipsis
    if (m.typingSpeed < T.vulnerability_speed && m.ellipsisCount >= T.vulnerability_ell) {
      signals.add('vulnerability');
    }

    // Trailing: multiple ellipsis
    if (m.ellipsisCount >= T.trailing_ell) {
      signals.add('trailing');
    }

    // Returning: coming back after absence
    if (m.absenceDurationMs > 30 * 60 * 1000) {  // >30 min absence
      signals.add('returning');
    }

    // Significant: long thoughtful message
    if (m.totalChars >= T.significant_len && m.typingSpeed < 6 && m.pauseCount >= 1) {
      signals.add('significant');
    }

    // Flat: no special signals, no punctuation variety, medium speed
    if (signals.size === 0) {
      signals.add('flat');
    }

    return Array.from(signals);
  }

  // ─── Reset session state ───────────────────────────────────────────────
  private reset(): void {
    this.sessionStart      = null;
    this.keystrokeTimings  = [];
    this.corrections       = 0;
    this.lastKeystroke     = null;
    this.pauseCount        = 0;
    this.burstCount        = 0;
    this.inBurst           = false;
    this.capsTotal         = 0;
    this.alphaTotal        = 0;
    this.punctTotal        = 0;
    this.ellipsisCount     = 0;
    this.exclamationCount  = 0;
    this.questionCount     = 0;
    this.charBuffer        = [];
  }

  // ─── Public hook for external callers (ChatInterface wiring) ──────────
  getLastSessionEnd(): number | null { return this.lastSessionEnd; }
}
