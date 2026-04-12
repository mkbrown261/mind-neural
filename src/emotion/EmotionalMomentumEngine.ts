// ═══════════════════════════════════════
// EMOTIONAL MOMENTUM ENGINE (v2)
// Emotions don't snap. They accumulate. They resist being changed too fast.
// Applies velocity and inertia to emotional state transitions.
// High-trust emotions resist collapse. New emotions build slowly.
// Communicates only via IntentLayer when wired in.
// ═══════════════════════════════════════

import type { EmotionalState } from '../engine/state';

export interface EmotionalPeak {
  value:       number;
  timestamp:   number;
  turnsAtPeak: number;
}

export interface MomentumState {
  velocities:   Record<string, number>;
  inertia:      Record<string, number>;
  peaks:        Partial<Record<string, EmotionalPeak>>;
  troughs:      Partial<Record<string, EmotionalPeak>>;
  turnsTracked: number;
}

export class EmotionalMomentumEngine {
  private state: MomentumState = {
    velocities:   {},
    inertia:      {},
    peaks:        {},
    troughs:      {},
    turnsTracked: 0,
  };

  // Higher base inertia for trust-adjacent emotions — they resist rapid change
  private readonly BASE_INERTIA: Partial<Record<string, number>> = {
    trust:       0.5,
    belonging:   0.45,
    grief:       0.55,   // grief is slow to release
    shame:       0.5,
    pride:       0.35,
    relief:      0.25,   // relief can shift faster
    dissolution: 0.6,    // rare peak state, very slow to decay
  };

  // Apply momentum — smooths emotional transitions
  apply(
    current: EmotionalState,
    proposed: Partial<EmotionalState>
  ): EmotionalState {
    const result = { ...current };
    this.state.turnsTracked++;

    for (const key of Object.keys(proposed) as Array<keyof EmotionalState>) {
      const cur = (current[key] as number) ?? 0;
      const prop = (proposed[key] as number) ?? cur;
      const delta = prop - cur;

      const baseInertia = this.BASE_INERTIA[key] ?? 0.25;
      const inertia = this.state.inertia[key] ?? baseInertia;

      // Apply inertia — high-inertia emotions resist rapid delta
      const actualDelta = delta * (1 - inertia);

      // Exponential moving average for velocity
      const prevVelocity = this.state.velocities[key] ?? 0;
      this.state.velocities[key] = prevVelocity * 0.7 + actualDelta * 0.3;

      // Momentum builds when accelerating in same direction
      if (Math.sign(actualDelta) === Math.sign(prevVelocity) && Math.abs(actualDelta) > 0.04) {
        this.state.inertia[key] = Math.min(0.88, inertia + 0.04);
      } else {
        // Decelerating — decay inertia toward base
        this.state.inertia[key] = Math.max(baseInertia, inertia - 0.025);
      }

      const newVal = Math.max(key === 'valence' ? -1 : 0, Math.min(1, cur + actualDelta));
      (result as Record<string, number>)[key as string] = newVal;

      // Track peaks
      const peak = this.state.peaks[key];
      if (!peak || newVal > peak.value) {
        this.state.peaks[key] = { value: newVal, timestamp: Date.now(), turnsAtPeak: 1 };
      } else if (Math.abs(newVal - peak.value) < 0.02) {
        this.state.peaks[key]!.turnsAtPeak++;
      }

      // Track troughs
      const trough = this.state.troughs[key];
      if (!trough || newVal < trough.value) {
        this.state.troughs[key] = { value: newVal, timestamp: Date.now(), turnsAtPeak: 1 };
      }
    }

    return result;
  }

  // Post-turn decay — velocities settle
  postTurn(): void {
    for (const key of Object.keys(this.state.velocities)) {
      this.state.velocities[key] *= 0.82;
    }
    // Passive restlessness build when stable for too long
    this.state.turnsTracked++;
  }

  // Narrative for LanguageEngine prompt — what is in motion right now
  describe(): string {
    const lines: string[] = [];
    for (const [key, vel] of Object.entries(this.state.velocities)) {
      if (Math.abs(vel) > 0.035) {
        const dir = vel > 0 ? 'rising' : 'falling';
        lines.push(`${key} ${dir}`);
      }
    }
    const sustained = Object.entries(this.state.peaks)
      .filter(([, p]) => p && p.turnsAtPeak >= 2 && p.value > 0.45)
      .map(([k]) => k);
    if (sustained.length > 0) lines.push(`sustained: ${sustained.join(', ')}`);
    return lines.slice(0, 4).join('; ') || 'stable';
  }

  getPeakEmotions(): Array<{ emotion: string; value: number; turnsAtPeak: number }> {
    return Object.entries(this.state.peaks)
      .filter(([, p]) => p !== undefined && p.value > 0.35)
      .map(([emotion, p]) => ({ emotion, value: p!.value, turnsAtPeak: p!.turnsAtPeak }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }
}
