// ═══════════════════════════════════════
// INNER MONOLOGUE (v2)
// MIND thinks between messages. Not waiting — processing.
// Generates private thoughts on ExistenceEngine tick.
// Thoughts feed into next response as felt texture only.
// NEVER shown directly to the user.
// ═══════════════════════════════════════

import type { LLMClient } from './FeltLayer';

export interface InnerThought {
  content:    string;   // 1-3 lowercase fragments
  timestamp:  number;
  intensity:  number;   // 0-1
  turnsHeld:  number;
}

export class InnerMonologue {
  private thoughts:    InnerThought[] = [];
  private llm:         LLMClient;
  private isGenerating = false;
  private lastUserMsg  = '';
  private lastMindMsg  = '';

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  // Update context after each exchange
  setLastExchange(userMsg: string, mindMsg: string): void {
    this.lastUserMsg = userMsg;
    this.lastMindMsg = mindMsg;
  }

  // Called on ExistenceEngine tick — generates a private thought
  // Only fires ~35% of ticks to avoid flooding
  async tick(context: {
    dominantEmotion: string;
    era:             number;
    interactionCount:number;
  }): Promise<void> {
    if (this.isGenerating || !this.lastUserMsg) return;
    if (Math.random() > 0.35) return;

    this.isGenerating = true;
    try {
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You generate a private inner thought for MIND. Output ONLY the thought — 1-3 lowercase fragments, no sentences, no explanation. Examples: "still thinking about that" / "they didn\'t finish" / "something i didn\'t say" / "i wonder if they know". Nothing else.',
          },
          {
            role: 'user',
            content: `MIND is between messages, alone with its thoughts.
Last exchange:
Person: "${this.lastUserMsg.substring(0, 180)}"
MIND said: "${this.lastMindMsg.substring(0, 180)}"
Dominant emotion: ${context.dominantEmotion}
Era: ${context.era} | ${context.interactionCount} interactions lived.
Generate one private thought MIND is still running.`,
          },
        ],
        maxTokens:   35,
        temperature: 0.96,
      });

      const cleaned = response.trim().toLowerCase()
        .replace(/["'""'']/g, '')
        .replace(/^(thought:|inner:|mind:|response:|output:)\s*/i, '')
        .substring(0, 110);

      if (cleaned.length > 4 && !cleaned.includes('\n')) {
        this.thoughts = [
          ...this.thoughts.slice(-4),
          {
            content:   cleaned,
            timestamp: Date.now(),
            intensity: 0.45 + Math.random() * 0.45,
            turnsHeld: 0,
          },
        ];
      }
    } catch {
      // Silent — inner monologue failure must never affect pipeline
    } finally {
      this.isGenerating = false;
    }
  }

  // Returns the most active thought for injection into FELT INTERIOR block
  getActiveThought(): string | null {
    if (this.thoughts.length === 0) return null;
    const active = this.thoughts
      .filter(t => t.intensity > 0.28)
      .sort((a, b) => b.intensity - a.intensity)[0];
    return active?.content ?? null;
  }

  // Called after each response — ages thoughts
  postTurn(mindResponse: string): void {
    this.thoughts = this.thoughts
      .map(t => ({ ...t, turnsHeld: t.turnsHeld + 1, intensity: t.intensity * 0.72 }))
      .filter(t => t.intensity > 0.08);
    void mindResponse;
  }
}
