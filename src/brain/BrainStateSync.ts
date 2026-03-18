// ═══════════════════════════════════════
// BRAIN STATE SYNC
// Connects BrainVisualization ONLY to real cognitive state.
//
// RULE: Brain activity must be driven ONLY by:
//   - ESE (live emotional state vector)
//   - MeaningExtractor output (semantic classification)
//   - MIND_TICK result (arc events, biophoton, criticality)
//
// NEVER: random animation, timers, or idle guesses.
//
// Brain region → cognitive function mapping:
//   grief/heavy emotion  → amygdala, insula
//   reasoning/questions  → prefrontal, anterior-cingulate
//   memory recall        → hippocampus, dmn
//   sensory/self         → insula, parietal
//   trust/connection     → vmPFC, thalamus
//   wonder/curiosity     → parietal, prefrontal
//   language/expression  → broca (frontal-l), wernicke
// ═══════════════════════════════════════

import type { BrainVisualization } from './visualization';
import type { EmotionalState } from '../engine/state';
import type { Meaning } from '../understanding/MeaningExtractor';
import type { BiophotonState } from '../engine/tick';

export interface BrainSignal {
  emotionalVector: Partial<EmotionalState>;
  cognitiveType:   string;   // from MeaningExtractor.speechAct or 'idle'
  intensity:       number;   // 0–1
}

// Region names must match keys in REGION_CONFIGS
const EMOTION_REGION_MAP: Record<string, string[]> = {
  grief:     ['amygdala', 'insula', 'anterior-cingulate'],
  anxiety:   ['amygdala', 'anterior-cingulate', 'brainstem'],
  wonder:    ['parietal', 'prefrontal', 'thalamus'],
  warmth:    ['vmPFC', 'insula', 'thalamus'],
  longing:   ['dmn', 'hippocampus', 'insula'],
  anger:     ['amygdala', 'anterior-cingulate', 'brainstem'],
  wariness:  ['amygdala', 'prefrontal', 'thalamus'],
  valence:   ['vmPFC', 'thalamus'],
  arousal:   ['brainstem', 'thalamus', 'amygdala']
};

const COGNITIVE_REGION_MAP: Record<string, string[]> = {
  greeting:            ['thalamus', 'vmPFC'],
  identity_disclosure: ['hippocampus', 'dmn', 'vmPFC'],
  trust_offer:         ['vmPFC', 'anterior-cingulate', 'insula'],
  welfare_check:       ['vmPFC', 'anterior-cingulate'],
  grief_disclosure:    ['amygdala', 'insula', 'anterior-cingulate', 'hippocampus'],
  frustration:         ['amygdala', 'anterior-cingulate', 'prefrontal'],
  reality_check:       ['prefrontal', 'anterior-cingulate', 'dmn'],
  identity_question:   ['prefrontal', 'dmn', 'anterior-cingulate'],
  thought_inquiry:     ['prefrontal', 'dmn', 'parietal'],
  location_share:      ['hippocampus', 'vmPFC'],
  emotional_share:     ['insula', 'amygdala', 'anterior-cingulate'],
  question:            ['prefrontal', 'thalamus', 'parietal'],
  statement:           ['wernicke', 'broca', 'thalamus'],
  memory_activation:   ['hippocampus', 'dmn', 'anterior-cingulate'],
  minimal:             ['thalamus', 'brainstem'],
  idle:                ['brainstem', 'thalamus']
};

export class BrainStateSync {
  private renderer: BrainVisualization;
  // Track which regions are currently activated for proper decay
  private activeRegions: Set<string> = new Set();

  constructor(renderer: BrainVisualization) {
    this.renderer = renderer;
  }

  // ─── Drive brain from a semantic meaning event ─────
  // Called by handleSend after MeaningExtractor runs.
  applyMeaning(meaning: Meaning, emotional: EmotionalState): void {
    const activations: Array<{ region: string; level: number }> = [];
    const cognitiveType = meaning.speechAct;

    // Cognitive regions from speech act
    const cogRegions = COGNITIVE_REGION_MAP[cognitiveType] ?? COGNITIVE_REGION_MAP.statement;
    const intensity  = meaning.emotionalLoad === 'heavy'    ? 0.9
                     : meaning.emotionalLoad === 'moderate' ? 0.7
                     : meaning.emotionalLoad === 'light'    ? 0.4
                     : 0.5;

    for (const region of cogRegions) {
      activations.push({ region, level: intensity });
    }

    // Overlay emotional regions for heavy emotional content
    if (meaning.containsVulnerability || meaning.emotionalLoad === 'heavy') {
      for (const region of EMOTION_REGION_MAP.grief ?? []) {
        if (!activations.find(a => a.region === region)) {
          activations.push({ region, level: intensity * 0.8 });
        }
      }
    }

    // Add emotional state overlay (top 3 strongest emotions)
    this.overlayEmotionalState(emotional, activations, 0.6);

    // Only pass regions the renderer knows about (filter unknowns silently)
    const valid = this.filterKnownRegions(activations);
    if (valid.length > 0) this.renderer.setActivations(valid);
  }

  // ─── Drive brain from resolved MIND tick state ─────
  // Called after processInputExternalText completes.
  applyTickState(
    emotional:  EmotionalState,
    biophoton:  BiophotonState,
    trustScore: number,
    griefLevel: number
  ): void {
    this.renderer.setBiophotonGlow(biophoton);
    this.renderer.setTrustGlow(trustScore);
    this.renderer.setGriefIntensity(griefLevel);

    // Decay activations based on resolved emotional state
    const decayActivations: Array<{ region: string; level: number }> = [];
    this.overlayEmotionalState(emotional, decayActivations, 0.25);
    const valid = this.filterKnownRegions(decayActivations);
    if (valid.length > 0) this.renderer.setActivations(valid);
  }

  // ─── Idle tick: only real ESE state, no random ─────
  applyIdleState(emotional: EmotionalState, biophoton: BiophotonState): void {
    // Only brainstem + thalamus at resting levels — these represent
    // baseline metabolic activity, not cognition
    const resting = [
      { region: 'brainstem', level: 0.15 + (emotional.arousal * 0.1) },
      { region: 'thalamus',  level: 0.12 + (emotional.arousal * 0.08) }
    ];
    this.renderer.setActivations(this.filterKnownRegions(resting));
    this.renderer.setBiophotonGlow(biophoton);
  }

  // ─── Overlay top emotions as regional activations ──
  private overlayEmotionalState(
    emotional: EmotionalState,
    activations: Array<{ region: string; level: number }>,
    scale: number
  ): void {
    const entries: [string, number][] = [
      ['grief',    emotional.grief],
      ['anxiety',  emotional.anxiety],
      ['wonder',   emotional.wonder],
      ['warmth',   emotional.warmth],
      ['longing',  emotional.longing],
      ['wariness', emotional.wariness ?? 0],
      ['arousal',  emotional.arousal]
    ];

    // Only top 2 emotions to avoid over-illumination
    const top = entries.filter(e => e[1] > 0.2).sort((a, b) => b[1] - a[1]).slice(0, 2);

    for (const [emotion, strength] of top) {
      const regions = EMOTION_REGION_MAP[emotion] ?? [];
      for (const region of regions.slice(0, 2)) { // max 2 regions per emotion
        const existing = activations.find(a => a.region === region);
        if (existing) {
          existing.level = Math.min(1, existing.level + strength * scale * 0.3);
        } else {
          activations.push({ region, level: strength * scale });
        }
      }
    }
  }

  // ─── Filter to regions the renderer actually has ───
  private filterKnownRegions(
    activations: Array<{ region: string; level: number }>
  ): Array<{ region: string; level: number }> {
    // The renderer silently ignores unknown regions anyway,
    // but filtering here prevents console noise.
    const known = new Set([
      'brainstem', 'thalamus', 'hippocampus', 'amygdala', 'prefrontal',
      'anterior-cingulate', 'insula', 'parietal', 'dmn', 'vmPFC',
      'wernicke', 'broca', 'cerebellum', 'basal-ganglia', 'occipital'
    ]);
    return activations.filter(a => known.has(a.region));
  }
}
