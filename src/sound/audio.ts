// ═══════════════════════════════════════
// SOUND DESIGN ENGINE
// Web Audio API — binaural, harmonic
// ═══════════════════════════════════════

import { BrainRegion } from '../engine/emotions';
import type { EmotionalState, SomaticState } from '../engine/state';

// Region tones (frequencies in Hz, pentatonic/harmonic intervals)
const REGION_FREQUENCIES: Record<BrainRegion, number[]> = {
  prefrontal: [396, 528, 639],      // Solfeggio healing frequencies
  amygdala: [80, 40, 174],          // Low, resonant, primal
  hippocampus: [432, 528],          // Warm, golden
  broca: [528, 741],                // Clear, communicative
  wernicke: [528, 639],             // Similar to broca but softer
  acc: [528, 963],                  // High violet
  insula: [285, 417],               // Warm, orange-feeling
  nucleus_accumbens: [528, 639, 852], // Joy chord
  dmn: [432, 432 * 1.5],           // Perfect fifth, self-referential
  cerebellum: [174, 285, 396],      // Earthy, rhythmic
  visual_cortex: [741, 852, 963],   // High, purple
  thalamus: [528, 852, 963],        // White, central
  brainstem: [40, 80, 174]          // Deep, survival
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientGain!: GainNode;
  private regionNodes: Map<BrainRegion, { oscillators: OscillatorNode[]; gain: GainNode }> = new Map();
  private isInitialized: boolean = false;
  private isMuted: boolean = false;
  private currentVolume: number = 0.15;

  public async init() {
    if (this.isInitialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Create ambient neural hum
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      await this.createAmbientHum();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  private async createAmbientHum() {
    if (!this.ctx) return;
    // Binaural-adjacent low hum: 40Hz carrier with slight beat
    const freqs = [40, 40.4, 174, 174.7];
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      // Slow oscillation in volume for breathing effect
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.3, this.ctx.currentTime); // 0.3Hz like resting brain

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.ambientGain);

      osc.start();
      lfo.start();
      this.ambientOscillators.push(osc, lfo);
    }
  }

  public playRegionActivation(region: BrainRegion, intensity: number) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;
    const frequencies = REGION_FREQUENCIES[region];
    if (!frequencies) return;

    // Stop any existing node for this region
    this.stopRegionNode(region);

    const oscillators: OscillatorNode[] = [];
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.06, this.ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.04, this.ctx.currentTime + 0.5);
    gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3 + intensity * 2);
    gainNode.connect(this.masterGain);

    for (const freq of frequencies) {
      const osc = this.ctx.createOscillator();
      osc.type = region === 'amygdala' || region === 'brainstem' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Slight detuning for warmth
      const detune = (Math.random() - 0.5) * 4;
      osc.detune.setValueAtTime(detune, this.ctx.currentTime);

      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + 4 + intensity * 2);
      oscillators.push(osc);
    }

    this.regionNodes.set(region, { oscillators, gain: gainNode });
  }

  private stopRegionNode(region: BrainRegion) {
    const existing = this.regionNodes.get(region);
    if (existing) {
      for (const osc of existing.oscillators) {
        try {
          existing.gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.05);
          osc.stop(this.ctx!.currentTime + 0.05);
        } catch {}
      }
      this.regionNodes.delete(region);
    }
  }

  public playChord(regions: BrainRegion[], intensity: number) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    const allFreqs: number[] = [];
    for (const r of regions) {
      const freqs = REGION_FREQUENCIES[r];
      if (freqs) allFreqs.push(...freqs.slice(0, 1));
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(intensity * 0.04, this.ctx.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
    gainNode.connect(this.masterGain);

    const duration = 3 + intensity * 2;
    for (const freq of allFreqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : this.currentVolume,
        this.ctx.currentTime + 0.2
      );
    }
  }

  public setVolume(v: number) {
    this.currentVolume = v;
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1);
    }
  }

  public resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ─── Sonification from resolved ESE + SSM state ──────────────────
  // Called after every processInput with the resolved emotional state.
  // Volume / frequency mappings derive from arousal, dominant emotion, interoception.
  public updateFromState(ese: EmotionalState, ssm: SomaticState) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    // Ambient hum volume: maps to arousal (ESE)
    const arousalLevel = Math.min(0.12, ese.arousal * 0.12);
    this.ambientGain.gain.linearRampToValueAtTime(
      arousalLevel, this.ctx.currentTime + 0.5
    );

    // Select sonification tone based on dominant emotion dimension
    let sonoRegion: BrainRegion | null = null;
    let sonoIntensity = 0;

    if (ese.grief > 0.4) {
      sonoRegion = 'acc'; sonoIntensity = ese.grief * 0.4;
    } else if (ese.wonder > 0.4) {
      sonoRegion = 'visual_cortex'; sonoIntensity = ese.wonder * 0.4;
    } else if (ese.warmth > 0.4) {
      sonoRegion = 'insula'; sonoIntensity = ese.warmth * 0.4;
    } else if (ese.anxiety > 0.5) {
      sonoRegion = 'amygdala'; sonoIntensity = ese.anxiety * 0.35;
    } else if (ese.longing > 0.4) {
      sonoRegion = 'hippocampus'; sonoIntensity = ese.longing * 0.35;
    }

    // Only trigger tone if significant — no decorative triggers
    if (sonoRegion && sonoIntensity > 0.15) {
      // Debounce: don't re-trigger if already playing this region
      const existing = this.regionNodes.get(sonoRegion);
      if (!existing) {
        this.playRegionActivation(sonoRegion, sonoIntensity);
      }
    }

    // Tension → master gain slight elevation (body response)
    const tensionBoost = ssm.tension * 0.02;
    const targetMaster = Math.min(0.25, this.currentVolume + tensionBoost);
    this.masterGain.gain.linearRampToValueAtTime(
      this.isMuted ? 0 : targetMaster, this.ctx.currentTime + 1
    );
  }

  // ─── Criticality: modulates ambient oscillation speed ────────────
  public setCriticalityLevel(index: number, pattern: 'ordered' | 'adaptive' | 'critical') {
    if (!this.ctx || !this.isInitialized || this.ambientOscillators.length < 2) return;
    // LFOs are every other entry in ambientOscillators (osc, lfo, osc, lfo ...)
    // Criticality pushes LFO freq higher (more neural chaos)
    const lfoFreq = pattern === 'critical' ? 0.6 :
                    pattern === 'adaptive' ? 0.4 : 0.3;
    // Update LFO oscillators (indices 1, 3, 5, 7)
    for (let i = 1; i < this.ambientOscillators.length; i += 2) {
      try {
        this.ambientOscillators[i].frequency.linearRampToValueAtTime(
          lfoFreq, this.ctx.currentTime + 2
        );
      } catch {}
    }
  }

  public dispose() {
    for (const osc of this.ambientOscillators) {
      try { osc.stop(); } catch {}
    }
    this.regionNodes.forEach(({ oscillators }) => {
      for (const osc of oscillators) { try { osc.stop(); } catch {} }
    });
    this.ctx?.close();
  }
}
