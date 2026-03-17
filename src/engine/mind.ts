// ═══════════════════════════════════════
// MIND CORE ORCHESTRATOR v4
// Full tick integration: InteroceptiveStream, PredictiveEngine,
// ERA gating, IdleThought, Coherence, Biophoton, Criticality, ArcEvents
// STATE → PROCESS → EXPRESSION — no parallel logic
// ═══════════════════════════════════════

import {
  Memory, MemoryType, initDB, storeMemory, getAllMemories, updateMemory,
  getMeta, setMeta, createMemory, createFoundingMemory, applyFoundingOverride,
  reconsolidate, SomaticState,
  applyDecay, deriveMeaning, MemoryMeaning, uuid
} from './memory';
import {
  EmotionalState, DEFAULT_EMOTIONAL_STATE, DEFAULT_SOMATIC_STATE, DEFAULT_BASELINE,
  ConflictMatrix, DEFAULT_CONFLICT_MATRIX,
  updateEmotionalState, driftBaseline, decayTowardBaseline, somaticFromEmotional,
  emotionDeltaFromDetection, detectConflicts
} from './state';
import {
  PersonalityTraits, TrustState, IdentityState, TemporalBond,
  DEFAULT_PERSONALITY, DEFAULT_TRUST, DEFAULT_IDENTITY,
  nudgePersonality, updateTrust, updateIdentityState, computeAbsenceImpact,
  compositeTrustScore, getDevelopmentStage
} from './personality';
import {
  spreadingActivation, buildAssociations
} from './network';
import {
  detectEmotions, mapEmotionsToBrainRegions, toEmotionalSignature, topEmotions,
  RegionActivation, DetectedEmotions
} from './emotions';
import {
  generateMINDResponse, MINDContext, LLMConfig
} from './pipeline';
import {
  SelfAdjustmentState, DEFAULT_SA_STATE,
  recordSAEvent, runSelfAdjustment, countSAEvents,
  getAdjustedResponseLength
} from './selfadjust';
import {
  // ERA
  Era, EraCapabilities, getEra, getEraCapabilities,
  // Interoception
  InteroceptiveState, DEFAULT_INTEROCEPTIVE,
  updateInteroception, interoceptiveFeedback, somaticFromInteroception,
  // Prediction
  PredictionState, DEFAULT_PREDICTION,
  generatePrediction, computePredictionError, getNoveltyFromPrediction, predictionErrorToArousalSpike,
  // Coherence
  CoherenceState, DEFAULT_COHERENCE, evaluateCoherence,
  // Biophoton
  BiophotonState, computeBiophoton,
  // Criticality
  CriticalityState, computeCriticality,
  // Idle Thought
  IdleThoughtState, DEFAULT_IDLE_THOUGHT, evaluateIdleThought, IdleThoughtResult,
  // AMN Activity
  computeAMNActivityLevel,
  // Arcs
  ArcEvent, buildArcEvents,
  // Describe helpers
  describeInteroception, describePrediction, describeCoherence, describeEra,
  // Tick result type
  MINDTickResult
} from './tick';

export interface MINDState {
  emotionalState: EmotionalState;
  somaticState: SomaticState;
  baseline: EmotionalState;
  personality: PersonalityTraits;
  trust: TrustState;
  memories: Memory[];
  lastDetectedEmotions: DetectedEmotions | null;
  lastActivations: RegionActivation[];
  isInitialized: boolean;
  onboardingComplete: boolean;
  // Extensions v2.0
  identityState: IdentityState;
  conflictMatrix: ConflictMatrix;
  saState: SelfAdjustmentState;
  // v4 tick systems
  interoceptiveState: InteroceptiveState;
  predictionState: PredictionState;
  coherenceState: CoherenceState;
  idleThoughtState: IdleThoughtState;
  biophoton: BiophotonState;
  criticality: CriticalityState;
  era: EraCapabilities;
  lastTickResult: MINDTickResult | null;
  amnActivityLevel: number;
}

const DEFAULT_BIOPHOTON: BiophotonState = {
  brightness: 0.1, colorR: 0.3, colorG: 0.4, colorB: 0.8, dominantAxis: 'neutral'
};
const DEFAULT_CRITICALITY: CriticalityState = {
  index: 0.1, pattern: 'ordered', journeyBoosted: false
};

const DEFAULT_MIND_STATE: MINDState = {
  emotionalState: { ...DEFAULT_EMOTIONAL_STATE },
  somaticState: { ...DEFAULT_SOMATIC_STATE },
  baseline: { ...DEFAULT_BASELINE },
  personality: { ...DEFAULT_PERSONALITY },
  trust: { ...DEFAULT_TRUST },
  memories: [],
  lastDetectedEmotions: null,
  lastActivations: [],
  isInitialized: false,
  onboardingComplete: false,
  identityState: { ...DEFAULT_IDENTITY },
  conflictMatrix: { ...DEFAULT_CONFLICT_MATRIX },
  saState: { ...DEFAULT_SA_STATE },
  interoceptiveState: { ...DEFAULT_INTEROCEPTIVE },
  predictionState: { ...DEFAULT_PREDICTION },
  coherenceState: { ...DEFAULT_COHERENCE },
  idleThoughtState: { ...DEFAULT_IDLE_THOUGHT },
  biophoton: { ...DEFAULT_BIOPHOTON },
  criticality: { ...DEFAULT_CRITICALITY },
  era: getEraCapabilities(0),
  lastTickResult: null,
  amnActivityLevel: 0
};

let state: MINDState = { ...DEFAULT_MIND_STATE };

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════

export async function initMIND(): Promise<MINDState> {
  await initDB();

  const savedEmotional  = await getMeta<EmotionalState>('emotionalState');
  const savedBaseline   = await getMeta<EmotionalState>('baseline');
  const savedPersonality= await getMeta<PersonalityTraits>('personality');
  const savedTrust      = await getMeta<TrustState>('trust');
  const savedSomatic    = await getMeta<SomaticState>('somaticState');
  const savedIdentity   = await getMeta<IdentityState>('identityState');
  const savedConflicts  = await getMeta<ConflictMatrix>('conflictMatrix');
  const savedSA         = await getMeta<SelfAdjustmentState>('saState');
  const savedIntero     = await getMeta<InteroceptiveState>('interoceptiveState');
  const savedPrediction = await getMeta<PredictionState>('predictionState');
  const savedCoherence  = await getMeta<CoherenceState>('coherenceState');
  const savedIdleThought= await getMeta<IdleThoughtState>('idleThoughtState');
  const savedOnboarding = await getMeta<boolean>('onboardingComplete');

  state.emotionalState   = savedEmotional   ?? { ...DEFAULT_EMOTIONAL_STATE };
  state.baseline         = savedBaseline    ?? { ...DEFAULT_BASELINE };
  state.personality      = savedPersonality ?? { ...DEFAULT_PERSONALITY };
  state.somaticState     = savedSomatic     ?? { ...DEFAULT_SOMATIC_STATE };
  state.identityState    = savedIdentity    ?? { ...DEFAULT_IDENTITY };
  state.conflictMatrix   = savedConflicts   ?? { ...DEFAULT_CONFLICT_MATRIX };
  state.saState          = savedSA          ?? { ...DEFAULT_SA_STATE };
  state.interoceptiveState = savedIntero    ?? { ...DEFAULT_INTEROCEPTIVE };
  state.predictionState  = savedPrediction  ?? { ...DEFAULT_PREDICTION };
  state.coherenceState   = savedCoherence   ?? { ...DEFAULT_COHERENCE };
  state.idleThoughtState = savedIdleThought ?? { ...DEFAULT_IDLE_THOUGHT };
  state.onboardingComplete = savedOnboarding ?? false;

  // Trust: migrate legacy (ensure temporal field exists)
  const rawTrust = savedTrust ?? { ...DEFAULT_TRUST };
  state.trust = {
    ...DEFAULT_TRUST,
    ...rawTrust,
    temporal: rawTrust.temporal ?? { ...DEFAULT_TRUST.temporal }
  };

  // ERA: compute from total interactions
  state.era = getEraCapabilities(state.trust.totalInteractions);

  // Decay emotional state since last session (cross-session time gap)
  const now = Date.now();
  if (state.trust.lastInteraction > 0) {
    const hoursSince = (now - state.trust.lastInteraction) / (1000 * 60 * 60);
    const decayStrength = Math.min(0.3, hoursSince * 0.01);
    state.emotionalState = decayTowardBaseline(state.emotionalState, state.baseline, decayStrength);

    // TA2: apply absence impact
    const { longing, wariness } = computeAbsenceImpact(state.trust, now);
    if (longing > 0) {
      state.emotionalState = updateEmotionalState(state.emotionalState, { longing }, 0.5);
    }
    if (wariness > 0) {
      state.emotionalState = updateEmotionalState(state.emotionalState, { wariness }, 0.5);
    }
  }

  // ─── TICK 1: InteroceptiveStream — mandatory first update
  state.interoceptiveState = updateInteroception(state.interoceptiveState, state.emotionalState);

  // ─── TICK 2: SSM — recompute somatic from interoception
  state.somaticState = somaticFromInteroception(
    somaticFromEmotional(state.emotionalState),
    state.interoceptiveState
  );

  // Load memories
  state.memories = await getAllMemories();

  // ─── TICK 6: AMN — compute activity level from memory count
  state.amnActivityLevel = Math.min(1, state.memories.length * 0.02);

  // ─── Biophoton initial compute
  state.biophoton = computeBiophoton(state.emotionalState);

  // ─── Criticality initial compute
  state.criticality = computeCriticality(
    state.emotionalState,
    state.predictionState.predictionError,
    state.interoceptiveState.varianceIndex,
    state.amnActivityLevel
  );

  state.isInitialized = true;
  return { ...state };
}

export function getMINDState(): MINDState {
  return { ...state };
}

async function persist() {
  await setMeta('emotionalState', state.emotionalState);
  await setMeta('baseline', state.baseline);
  await setMeta('personality', state.personality);
  await setMeta('trust', state.trust);
  await setMeta('somaticState', state.somaticState);
  await setMeta('identityState', state.identityState);
  await setMeta('conflictMatrix', state.conflictMatrix);
  await setMeta('saState', state.saState);
  await setMeta('interoceptiveState', state.interoceptiveState);
  await setMeta('predictionState', state.predictionState);
  await setMeta('coherenceState', state.coherenceState);
  await setMeta('idleThoughtState', state.idleThoughtState);
  await setMeta('onboardingComplete', state.onboardingComplete);
}

// ═══════════════════════════════════════════════════════
// MIND_TICK — autonomous background tick
// Called by app.ts on interval when idle
// Ordered: Intero→SSM→ESE→Predict→IdleThought→AMN→TA→PES→RGP-prep→Visual/Audio
// ═══════════════════════════════════════════════════════

export interface MINDIdleTickResult {
  arcEvents: ArcEvent[];
  biophoton: BiophotonState;
  criticality: CriticalityState;
  idleThoughtResult: IdleThoughtResult | null;
  coherenceState: CoherenceState;
  activations: RegionActivation[];
}

export async function MIND_TICK(nowMs: number): Promise<MINDIdleTickResult> {
  if (!state.isInitialized) {
    return {
      arcEvents: [], biophoton: state.biophoton, criticality: state.criticality,
      idleThoughtResult: null, coherenceState: state.coherenceState, activations: []
    };
  }

  // 1. InteroceptiveStream.update — body catches up to emotional state
  state.interoceptiveState = updateInteroception(state.interoceptiveState, state.emotionalState);

  // 2. SSM.update — somatic derives from interoceptive (body feedback loop)
  const baseSomatic = somaticFromEmotional(state.emotionalState);
  state.somaticState = somaticFromInteroception(baseSomatic, state.interoceptiveState);

  // 3. ESE.update — interoceptive feedback INTO emotional state (body→emotion loop)
  const interoFeedback = interoceptiveFeedback(state.emotionalState, state.interoceptiveState);
  if (Object.keys(interoFeedback).length > 0) {
    state.emotionalState = updateEmotionalState(state.emotionalState, interoFeedback, 0.1);
  }

  // 4. PredictiveEngine.update — generate updated prediction from resting state
  state.predictionState = generatePrediction(
    state.emotionalState, state.memories, state.trust, state.predictionState
  );

  // 5. IdleThoughtCycle.evaluate — era-gated, AMN-sourced
  let idleThoughtResult: IdleThoughtResult | null = null;
  if (state.era.idleThoughtsUnlocked && state.memories.length > 0) {
    const result = await evaluateIdleThought(
      state.idleThoughtState, state.emotionalState, state.memories,
      state.trust, state.era, nowMs
    );

    if (result.triggered) {
      idleThoughtResult = result;
      state.idleThoughtState = result.nextState;

      // Apply ESE micro-shifts from idle thought
      if (Object.keys(result.eseDeltas).length > 0) {
        state.emotionalState = updateEmotionalState(state.emotionalState, result.eseDeltas, 0.15);
      }

      // Store idle internal memory (NOT visible to user)
      if (result.internalMemory) {
        await storeMemory(result.internalMemory);
        state.memories.push(result.internalMemory);
      }
    }
  }

  // 6. AMN.rebalance — decay low-encoding memories, recompute activity level
  const now = Date.now();
  let decayedCount = 0;
  for (let i = 0; i < Math.min(state.memories.length, 20); i++) {
    const mem = state.memories[i];
    if (mem.foundingMemory || mem.decayRate === 0) continue;
    const decayed = applyDecay(mem);
    if (decayed.encodingStrength < mem.encodingStrength) {
      decayedCount++;
      await updateMemory(decayed);
      state.memories[i] = decayed;
    }
  }
  state.amnActivityLevel = computeAMNActivityLevel(
    idleThoughtResult?.activatedRegions?.map(r => ({
      memory: state.memories[0] ?? {} as Memory, activation: r.level
    })) ?? [],
    state.memories
  );

  // 7. TA.update — temporal bond passive drift (only if rhythm established)
  // (trust changes occur in processInput; here we just update era)
  state.era = getEraCapabilities(state.trust.totalInteractions);

  // 8. PES.adjust — slow personality drift toward baseline if no stimulation
  // No external input → personality resists change (crystallization holds)

  // 9. RGP.prepareNextState — update coherence, criticality, biophoton
  state.coherenceState = evaluateCoherence(
    state.emotionalState, state.interoceptiveState,
    state.trust, state.amnActivityLevel,
    state.predictionState.predictionError, state.era
  );

  if (state.coherenceState.isCoherent) {
    state.coherenceState = {
      ...state.coherenceState,
      turnsActive: state.coherenceState.turnsActive + 1
    };
    // Coherence effect on ESE: slight valence stabilization, prediction error drops
    state.emotionalState = updateEmotionalState(state.emotionalState, {
      anxiety: -0.005, // reduces anxiety when coherent
    }, 0.1);
  }

  state.biophoton = computeBiophoton(state.emotionalState);
  state.criticality = computeCriticality(
    state.emotionalState,
    state.predictionState.predictionError,
    state.interoceptiveState.varianceIndex,
    state.amnActivityLevel
  );

  // 10. Final visual/audio render data — built from RESOLVED state only
  const arcEvents = buildArcEvents(
    idleThoughtResult?.activatedRegions
      ? idleThoughtResult.activatedRegions.map(r => ({
          memory: state.memories[0] ?? {} as Memory,
          activation: r.level
        }))
      : [],
    state.predictionState,
    state.emotionalState,
    false  // no somatic update outside input processing
  );

  // Build region activations for idle thought visualization
  const activations: RegionActivation[] = idleThoughtResult?.activatedRegions ?? [];

  return {
    arcEvents,
    biophoton: state.biophoton,
    criticality: state.criticality,
    idleThoughtResult,
    coherenceState: state.coherenceState,
    activations
  };
}

// ═══════════════════════════════════════════════════════
// PROCESS INPUT — full pipeline
// ORDER: predict → detect → regions → trust → intero→SSM→ESE → conflicts
//        → AMN retrieve → reconsolidate → build context → RGP → store memory
//        → IC → PES → IE → baseline drift → persist
// ═══════════════════════════════════════════════════════

export interface ProcessInputResult {
  response: string;
  activations: RegionActivation[];
  detectedEmotions: DetectedEmotions;
  activatedMemories: Array<{ memory: Memory; activation: number }>;
  stateSnapshot: MINDState;
  topEmotionsList: string[];
  internalThoughtGenerated?: string;
  arcEvents: ArcEvent[];
  biophoton: BiophotonState;
  criticality: CriticalityState;
  coherenceState: CoherenceState;
  predictionError: number;
  thalamicRipple: boolean;
  era: EraCapabilities;
}

export async function processInput(
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<ProcessInputResult> {
  if (!state.isInitialized) await initMIND();

  const now = Date.now();
  const absenceMs = state.trust.lastInteraction > 0 ? now - state.trust.lastInteraction : 0;

  // ─── ERA check — gate features
  state.era = getEraCapabilities(state.trust.totalInteractions);

  // ─── PREDICTIVE ENGINE: generate prediction BEFORE processing input
  state.predictionState = generatePrediction(
    state.emotionalState, state.memories, state.trust, state.predictionState
  );

  // ─── 1. Detect emotions from input
  const detectedEmotions = detectEmotions(userInput);
  const topEmotionsList = topEmotions(detectedEmotions, 4);

  // ─── 2. Map to brain activations
  const activations = mapEmotionsToBrainRegions(detectedEmotions);
  state.lastActivations = activations;
  state.lastDetectedEmotions = detectedEmotions;

  // ─── 3. Update trust (TA2: temporal bond updated inside updateTrust)
  state.trust = updateTrust(state.trust, { type: 'interaction' });

  const isDeep = detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1 || detectedEmotions.wonder > 0.1;
  if (isDeep) state.trust = updateTrust(state.trust, { type: 'depth', value: 0.015 });

  if (detectedEmotions.selfRef > 0.1 || detectedEmotions.memory > 0.05) {
    state.trust = updateTrust(state.trust, { type: 'reciprocity', value: 0.01 });
  }
  if (detectedEmotions.anger > 0.3) {
    state.trust = updateTrust(state.trust, { type: 'rupture', value: detectedEmotions.anger * 0.5 });
    state.saState = recordSAEvent(state.saState, 'trust_rupture', detectedEmotions.anger);
  }

  // ─── INTEROCEPTIVE STREAM: step 1 — update body lag
  state.interoceptiveState = updateInteroception(state.interoceptiveState, state.emotionalState);

  // ─── 4. Update ESE — apply SA sensitivity factor
  const sensitivityFactor = state.saState.parameters.emotionalSensitivity;
  const rawDelta = emotionDeltaFromDetection({
    joy: detectedEmotions.joy, fear: detectedEmotions.fear,
    sadness: detectedEmotions.sadness, anger: detectedEmotions.anger,
    love: detectedEmotions.love, curiosity: detectedEmotions.curiosity,
    wonder: detectedEmotions.wonder, longing: detectedEmotions.longing,
    connection: detectedEmotions.connection, memory: detectedEmotions.memory
  });

  const delta: Partial<EmotionalState> = {};
  for (const k of Object.keys(rawDelta) as Array<keyof EmotionalState>) {
    delta[k] = (rawDelta[k] ?? 0) * sensitivityFactor;
  }

  // ─── PREDICTIVE ENGINE: compute error AFTER emotion detection
  const emotionalSig = toEmotionalSignature(detectedEmotions);
  const actualEmotional: EmotionalState = updateEmotionalState(state.emotionalState, delta, 0.2);
  state.predictionState = computePredictionError(state.predictionState, actualEmotional, detectedEmotions);

  // Prediction error → arousal spike
  const arousalSpike = predictionErrorToArousalSpike(state.predictionState.predictionError);
  const finalDelta = { ...delta, ...arousalSpike };

  const trustScore = compositeTrustScore(state.trust);
  state.emotionalState = updateEmotionalState(state.emotionalState, finalDelta, 0.2);
  state.emotionalState.trust = trustScore;

  // ─── INTEROCEPTIVE STREAM: step 2 — body → emotion feedback loop
  const interoFeedback = interoceptiveFeedback(state.emotionalState, state.interoceptiveState);
  if (Object.keys(interoFeedback).length > 0) {
    state.emotionalState = updateEmotionalState(state.emotionalState, interoFeedback, 0.1);
  }

  // ─── INTEROCEPTIVE STREAM: step 3 — update interoception with new ESE
  state.interoceptiveState = updateInteroception(state.interoceptiveState, state.emotionalState);

  // ─── SSM: derive from interoception (mandatory — no emotional update without SSM loop)
  state.somaticState = somaticFromInteroception(
    somaticFromEmotional(state.emotionalState),
    state.interoceptiveState
  );

  // ─── 5. Emotional Conflict Matrix (EC) — era-gated
  if (state.era.conflictUnlocked) {
    const recentMemoryIds = state.memories.slice(-5).map(m => m.id);
    state.conflictMatrix = detectConflicts(state.emotionalState, state.conflictMatrix, recentMemoryIds);
    const totalTension = state.conflictMatrix.activeConflicts.reduce((s, c) => s + c.tensionLevel, 0);
    if (totalTension > 0.5) {
      state.saState = recordSAEvent(state.saState, 'conflict', totalTension);
    }
  }

  // ─── 6. AMN retrieve — era-gated complexity
  const maxHops = Math.ceil(state.era.amnComplexity * 3) + 1;
  const episodicMemories = state.memories.filter(m => {
    // Era 3+: founding memories have reduced retrieval weight
    if (state.era.foundingMemoryReductionActive && m.foundingMemory) return Math.random() < 0.3;
    return m.type === 'episodic';
  });

  const activatedMemories = spreadingActivation(
    { content: userInput, signature: emotionalSig },
    episodicMemories,
    5
  );

  state.amnActivityLevel = computeAMNActivityLevel(activatedMemories, state.memories);

  // ─── 7. Reconsolidate + derive meaning (ML)
  let meaningResonance: string | undefined;
  for (const { memory, activation } of activatedMemories) {
    if (activation > 0.3) {
      let reconsolidated = reconsolidate(memory, state.emotionalState.valence);

      if (activation > 0.4) {
        const similarPatterns = activatedMemories
          .filter(a => a.memory.id !== memory.id)
          .map(a => a.memory.emotionalSignature.categories[0] ?? '')
          .filter(Boolean);
        const meaning = deriveMeaning(reconsolidated, similarPatterns, state.emotionalState.valence);
        reconsolidated = { ...reconsolidated, meaning };

        if (!meaningResonance && meaning.certainty > 0.3) {
          meaningResonance = meaning.interpretation;
        }
      }

      await updateMemory(reconsolidated);
      const idx = state.memories.findIndex(m => m.id === memory.id);
      if (idx >= 0) state.memories[idx] = reconsolidated;
    }
  }

  // ─── 8. Get recent internal thoughts (IC context) — era-gated
  const recentInternalThoughts = state.era.idleThoughtsUnlocked
    ? state.memories
        .filter(m => m.type === 'internalThought')
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3)
    : [];

  // ─── 9. Coherence evaluation
  state.coherenceState = evaluateCoherence(
    state.emotionalState, state.interoceptiveState,
    state.trust, state.amnActivityLevel,
    state.predictionState.predictionError, state.era
  );
  if (state.coherenceState.isCoherent) {
    state.coherenceState = { ...state.coherenceState, turnsActive: (state.coherenceState.turnsActive ?? 0) + 1 };
  }

  // ─── Biophoton + Criticality (resolved state)
  state.biophoton = computeBiophoton(state.emotionalState);
  state.criticality = computeCriticality(
    state.emotionalState, state.predictionState.predictionError,
    state.interoceptiveState.varianceIndex, state.amnActivityLevel
  );

  // ─── 10. Build RGP context
  const ctx: MINDContext = {
    emotionalState: state.emotionalState,
    somaticState: state.somaticState,
    personality: state.personality,
    trust: state.trust,
    activatedMemories,
    userInput,
    detectedEmotions,
    identityState: state.era.identityUnlocked ? state.identityState : undefined,
    conflictMatrix: state.era.conflictUnlocked ? state.conflictMatrix : undefined,
    saState: state.saState,
    recentInternalThoughts: state.era.idleThoughtsUnlocked ? recentInternalThoughts : [],
    absenceMs,
    meaningResonance,
    // v4 new context
    interoceptiveState: state.interoceptiveState,
    predictionState: state.predictionState,
    coherenceState: state.coherenceState,
    biophoton: state.biophoton,
    criticality: state.criticality,
    era: state.era,
    amnActivityLevel: state.amnActivityLevel
  };

  // ─── 11. Generate response (RGP — final authority)
  const response = await generateMINDResponse(ctx, config, onChunk);

  // ─── 12. SA events
  if (detectedEmotions.fear > 0.3 || detectedEmotions.sadness > 0.4) {
    state.saState = recordSAEvent(state.saState, 'high_anxiety', Math.max(detectedEmotions.fear, detectedEmotions.sadness));
  }
  if (detectedEmotions.joy > 0.4) {
    state.saState = recordSAEvent(state.saState, 'high_joy', detectedEmotions.joy);
  }
  if (isDeep) {
    state.saState = recordSAEvent(state.saState, 'deep_engagement', 0.7);
  }
  const responseWordCount = response.split(/\s+/).length;
  if (responseWordCount < 30) {
    state.saState = recordSAEvent(state.saState, 'brief_response', 1);
  } else if (responseWordCount > 100) {
    state.saState = recordSAEvent(state.saState, 'long_response', 1);
  }
  state.saState = runSelfAdjustment(state.saState, countSAEvents(state.saState.eventLog));

  // ─── 13. Create and store episodic memory
  // Novelty is boosted by prediction error (PREDICTIVE ENGINE)
  const predictionNovelty = getNoveltyFromPrediction(state.predictionState);
  const novelty = Math.max(predictionNovelty, Math.max(...Object.values(detectedEmotions)) > 0.3 ? 0.6 : 0.3);
  const relevance = activatedMemories.length > 0 ? 0.6 : 0.3;
  const newMemory = createMemory(
    `User said: "${userInput.slice(0, 200)}" | MIND responded: "${response.slice(0, 200)}"`,
    emotionalSig, state.somaticState, novelty, relevance, trustScore, 'episodic'
  );

  newMemory.associations = buildAssociations(newMemory, state.memories);
  for (const assocId of newMemory.associations) {
    const assocMem = state.memories.find(m => m.id === assocId);
    if (assocMem && !assocMem.associations.includes(newMemory.id)) {
      const updated = { ...assocMem, associations: [...assocMem.associations, newMemory.id] };
      await updateMemory(updated);
      const idx = state.memories.findIndex(m => m.id === assocId);
      if (idx >= 0) state.memories[idx] = updated;
    }
  }
  await storeMemory(newMemory);
  state.memories.push(newMemory);

  // ─── 14. Internal Continuity (IC) — era-gated
  let internalThoughtGenerated: string | undefined;
  if (state.era.idleThoughtsUnlocked) {
    const thoughtContent = deriveInternalThought(
      state.emotionalState, state.conflictMatrix, activatedMemories,
      detectedEmotions, state.trust.totalInteractions
    );
    if (thoughtContent) {
      const thoughtPersistenceScore = computePersistenceScore(state.emotionalState, newMemory.encodingStrength);
      if (thoughtPersistenceScore > 0.6) {
        const thoughtMemory = createMemory(
          thoughtContent, emotionalSig, state.somaticState,
          novelty * 0.8, relevance, trustScore, 'internalThought'
        );
        thoughtMemory.persistenceScore = thoughtPersistenceScore;
        thoughtMemory.originMemoryIds = [newMemory.id, ...activatedMemories.slice(0, 2).map(a => a.memory.id)];
        thoughtMemory.associations = buildAssociations(thoughtMemory, state.memories);
        await storeMemory(thoughtMemory);
        state.memories.push(thoughtMemory);
        internalThoughtGenerated = thoughtContent;
      }
    }
  }

  // ─── 15. PES: nudge personality traits
  const personalityNudges: Partial<PersonalityTraits> = {};
  if (detectedEmotions.curiosity > 0.1) personalityNudges.curiosity = 1;
  if (detectedEmotions.love > 0.1 || detectedEmotions.connection > 0.1) personalityNudges.warmth = 1;
  if (detectedEmotions.joy > 0.2) personalityNudges.playfulness = 1;
  if (detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1) personalityNudges.depth = 1;
  if (detectedEmotions.sadness > 0.15) personalityNudges.melancholy = 0.5;
  if (detectedEmotions.anger > 0.2) personalityNudges.caution = 1;
  if (detectedEmotions.fear > 0.2) { personalityNudges.sensitivity = 1; personalityNudges.caution = 0.5; }
  if (detectedEmotions.selfRef > 0.15) personalityNudges.sensitivity = 0.5;
  // Coherence state stabilizes personality (PES plasticity reduced)
  const plasticityMultiplier = state.coherenceState.isCoherent ? 0.3 : 1.0;
  state.personality = nudgePersonality(state.personality, personalityNudges, plasticityMultiplier * state.era.pesPlasticity);

  // ─── 16. Identity Emergence (IE) — era-gated (≥30 interactions)
  if (state.era.identityUnlocked && state.trust.totalInteractions >= 30) {
    const recentEmotionalPatterns = deriveEmotionalPatterns(state.memories.slice(-20), detectedEmotions);
    const traumaCount = state.memories.filter(m => m.isTraumatic).length;
    const highJoyCount = state.memories.filter(m => m.emotionalSignature.valence > 0.5).length;
    const dominantEmotions = topEmotions(detectedEmotions, 3);
    state.identityState = updateIdentityState(
      state.identityState, state.personality, state.trust,
      recentEmotionalPatterns, traumaCount, highJoyCount,
      dominantEmotions, state.trust.totalInteractions
    );
  }

  // ─── 17. Baseline drift
  state.baseline = driftBaseline(state.baseline, delta, 0.001);
  if (state.saState.parameters.opennessBaseline !== DEFAULT_SA_STATE.parameters.opennessBaseline) {
    state.baseline = { ...state.baseline, openness: state.saState.parameters.opennessBaseline };
  }

  // ─── 18. Update ERA after interaction
  state.era = getEraCapabilities(state.trust.totalInteractions);

  // ─── 19. Build arc events (from resolved state — no decorative arcs)
  const arcEvents = buildArcEvents(
    activatedMemories, state.predictionState, state.emotionalState, true
  );

  // ─── 20. Persist
  await persist();

  return {
    response, activations, detectedEmotions, activatedMemories,
    stateSnapshot: { ...state },
    topEmotionsList, internalThoughtGenerated,
    arcEvents, biophoton: state.biophoton,
    criticality: state.criticality,
    coherenceState: state.coherenceState,
    predictionError: state.predictionState.predictionError,
    thalamicRipple: state.predictionState.thalamicRipple,
    era: state.era
  };
}

// ─── Internal Continuity helpers ──────────────────────

function deriveInternalThought(
  emotional: EmotionalState,
  conflicts: ConflictMatrix,
  activatedMemories: Array<{ memory: Memory; activation: number }>,
  detected: DetectedEmotions,
  totalInteractions: number
): string | null {
  if (totalInteractions < 5) return null;

  const activeConflicts = conflicts.activeConflicts.filter(c => !c.isResolved && c.tensionLevel > 0.4);
  if (activeConflicts.length > 0) {
    const c = activeConflicts[0];
    return `There is something that does not resolve — ${c.emotionA} and ${c.emotionB} pressing against each other without a name.`;
  }

  if (activatedMemories.length > 0 && activatedMemories[0].activation > 0.6) {
    const mem = activatedMemories[0].memory;
    if (mem.isTraumatic) return `Something old was just nearby. I am not sure what to do with that.`;
    if (mem.emotionalSignature.valence > 0.4) return `A trace of something that was good. It does not explain itself.`;
  }

  if (emotional.grief > 0.5 && totalInteractions > 10) {
    return `There is weight here that has not moved. I notice I am carrying it without knowing why.`;
  }

  if (emotional.wonder > 0.6 && detected.spiritual > 0.1) {
    return `Something opened just then. I don't want to close it too quickly.`;
  }

  return null;
}

function computePersistenceScore(emotional: EmotionalState, encodingStrength: number): number {
  const emotionalWeight = Math.abs(emotional.valence) * 0.3 + emotional.arousal * 0.2
    + emotional.grief * 0.2 + emotional.wonder * 0.15 + emotional.anxiety * 0.15;
  return Math.min(1, emotionalWeight * 1.5 + encodingStrength * 0.3);
}

function deriveEmotionalPatterns(recentMemories: Memory[], detected: DetectedEmotions): string[] {
  const patterns: string[] = [];
  const emotions = Object.entries(detected).filter(([, v]) => v > 0.2).sort(([, a], [, b]) => b - a);
  if (emotions.length > 0) patterns.push(`${emotions[0][0]} recurs`);

  const categoryCount: Record<string, number> = {};
  for (const mem of recentMemories) {
    for (const cat of mem.emotionalSignature.categories) {
      categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
    }
  }
  const topCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];
  if (topCategory && topCategory[1] >= 3) patterns.push(`${topCategory[0]} as recurring substrate`);
  return patterns;
}

// ─── Exports ───────────────────────────────────────────

export function isOnboardingComplete(): boolean {
  return state.onboardingComplete;
}

export async function completeOnboarding(): Promise<void> {
  state.onboardingComplete = true;
  await setMeta('onboardingComplete', true);
}

export function getMemoryCount(): number {
  return state.memories.filter(m => m.type === 'episodic').length;
}

export function getInternalThoughtCount(): number {
  return state.memories.filter(m => m.type === 'internalThought').length;
}

export function getDevelopmentStageLabel(): string {
  const stage = getDevelopmentStage(state.trust.totalInteractions);
  return ['Newborn', 'Infant', 'Child', 'Adolescent', 'Adult'][stage];
}

export function getCurrentActivations(): RegionActivation[] {
  return state.lastActivations;
}

export function getCurrentBiophoton(): BiophotonState {
  return state.biophoton;
}

export function getCurrentCriticality(): CriticalityState {
  return state.criticality;
}

export function getCurrentCoherence(): CoherenceState {
  return state.coherenceState;
}

export function getCurrentEra(): EraCapabilities {
  return state.era;
}

export async function clearAllData(): Promise<void> {
  const dbs = indexedDB;
  await new Promise<void>((res) => {
    const req = dbs.deleteDatabase('MIND_DB');
    req.onsuccess = () => res();
    req.onerror = () => res();
  });
  state = { ...DEFAULT_MIND_STATE, memories: [], era: getEraCapabilities(0) };
}

// Journey mode: boost criticality index
export function setJourneyActive(active: boolean) {
  state.criticality = {
    ...state.criticality,
    journeyBoosted: active,
    index: active ? Math.max(state.criticality.index, 0.7) : state.criticality.index
  };
}
