// ═══════════════════════════════════════
// MIND CORE ORCHESTRATOR v2
// Wires all 6 extensions: IC, IE, TA2, EC, ML, SA
// ═══════════════════════════════════════

import {
  Memory, MemoryType, initDB, storeMemory, getAllMemories, updateMemory,
  getMeta, setMeta, createMemory, reconsolidate, SomaticState,
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
  // Extensions
  identityState: IdentityState;
  conflictMatrix: ConflictMatrix;
  saState: SelfAdjustmentState;
}

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
  identityState: { ...DEFAULT_IDENTITY },
  conflictMatrix: { ...DEFAULT_CONFLICT_MATRIX },
  saState: { ...DEFAULT_SA_STATE }
};

let state: MINDState = { ...DEFAULT_MIND_STATE };

export async function initMIND(): Promise<MINDState> {
  await initDB();

  // Load persisted state
  const savedEmotional = await getMeta<EmotionalState>('emotionalState');
  const savedBaseline = await getMeta<EmotionalState>('baseline');
  const savedPersonality = await getMeta<PersonalityTraits>('personality');
  const savedTrust = await getMeta<TrustState>('trust');
  const savedSomatic = await getMeta<SomaticState>('somaticState');
  const savedIdentity = await getMeta<IdentityState>('identityState');
  const savedConflicts = await getMeta<ConflictMatrix>('conflictMatrix');
  const savedSA = await getMeta<SelfAdjustmentState>('saState');

  state.emotionalState = savedEmotional ?? { ...DEFAULT_EMOTIONAL_STATE };
  state.baseline = savedBaseline ?? { ...DEFAULT_BASELINE };
  state.personality = savedPersonality ?? { ...DEFAULT_PERSONALITY };
  state.somaticState = savedSomatic ?? { ...DEFAULT_SOMATIC_STATE };
  state.identityState = savedIdentity ?? { ...DEFAULT_IDENTITY };
  state.conflictMatrix = savedConflicts ?? { ...DEFAULT_CONFLICT_MATRIX };
  state.saState = savedSA ?? { ...DEFAULT_SA_STATE };

  // Trust: migrate legacy (ensure temporal field exists)
  const rawTrust = savedTrust ?? { ...DEFAULT_TRUST };
  state.trust = {
    ...DEFAULT_TRUST,
    ...rawTrust,
    temporal: rawTrust.temporal ?? { ...DEFAULT_TRUST.temporal }
  };

  // Decay emotional state since last session
  const now = Date.now();
  if (state.trust.lastInteraction > 0) {
    const hoursSince = (now - state.trust.lastInteraction) / (1000 * 60 * 60);
    const decayStrength = Math.min(0.3, hoursSince * 0.01);
    state.emotionalState = decayTowardBaseline(state.emotionalState, state.baseline, decayStrength);
    state.somaticState = somaticFromEmotional(state.emotionalState);

    // TA2: apply absence impact on emotional state
    const { longing, wariness } = computeAbsenceImpact(state.trust, now);
    if (longing > 0) {
      state.emotionalState = updateEmotionalState(state.emotionalState, { longing }, 0.5);
    }
    if (wariness > 0) {
      state.emotionalState = updateEmotionalState(state.emotionalState, { wariness }, 0.5);
    }
  }

  // Load all memories
  state.memories = await getAllMemories();
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
}

export interface ProcessInputResult {
  response: string;
  activations: RegionActivation[];
  detectedEmotions: DetectedEmotions;
  activatedMemories: Array<{ memory: Memory; activation: number }>;
  stateSnapshot: MINDState;
  topEmotionsList: string[];
  internalThoughtGenerated?: string;
}

export async function processInput(
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<ProcessInputResult> {
  if (!state.isInitialized) await initMIND();

  const now = Date.now();
  const absenceMs = state.trust.lastInteraction > 0 ? now - state.trust.lastInteraction : 0;

  // 1. Detect emotions from input
  const detectedEmotions = detectEmotions(userInput);
  const topEmotionsList = topEmotions(detectedEmotions, 4);

  // 2. Map to brain activations
  const activations = mapEmotionsToBrainRegions(detectedEmotions);
  state.lastActivations = activations;
  state.lastDetectedEmotions = detectedEmotions;

  // 3. Update trust (TA2: temporal bond updated inside updateTrust)
  state.trust = updateTrust(state.trust, { type: 'interaction' });

  const isDeep = detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1 || detectedEmotions.wonder > 0.1;
  if (isDeep) state.trust = updateTrust(state.trust, { type: 'depth', value: 0.015 });

  if (detectedEmotions.selfRef > 0.1 || detectedEmotions.memory > 0.05) {
    state.trust = updateTrust(state.trust, { type: 'reciprocity', value: 0.01 });
  }

  if (detectedEmotions.anger > 0.3) {
    state.trust = updateTrust(state.trust, { type: 'rupture', value: detectedEmotions.anger * 0.5 });
    // SA event
    state.saState = recordSAEvent(state.saState, 'trust_rupture', detectedEmotions.anger);
  }

  // 4. Update emotional state with momentum
  // Apply SA sensitivity factor
  const sensitivityFactor = state.saState.parameters.emotionalSensitivity;
  const rawDelta = emotionDeltaFromDetection({
    joy: detectedEmotions.joy,
    fear: detectedEmotions.fear,
    sadness: detectedEmotions.sadness,
    anger: detectedEmotions.anger,
    love: detectedEmotions.love,
    curiosity: detectedEmotions.curiosity,
    wonder: detectedEmotions.wonder,
    longing: detectedEmotions.longing,
    connection: detectedEmotions.connection,
    memory: detectedEmotions.memory
  });

  // Scale delta by sensitivity
  const delta: Partial<EmotionalState> = {};
  for (const k of Object.keys(rawDelta) as Array<keyof EmotionalState>) {
    delta[k] = (rawDelta[k] ?? 0) * sensitivityFactor;
  }

  const trustScore = compositeTrustScore(state.trust);
  state.emotionalState = updateEmotionalState(state.emotionalState, delta, 0.2);
  state.emotionalState.trust = trustScore;
  state.somaticState = somaticFromEmotional(state.emotionalState);

  // 5. EXTENSION 4: Update conflict matrix
  const recentMemoryIds = state.memories.slice(-5).map(m => m.id);
  state.conflictMatrix = detectConflicts(state.emotionalState, state.conflictMatrix, recentMemoryIds);

  // Record conflict SA event if tension is high
  const totalTension = state.conflictMatrix.activeConflicts.reduce((sum, c) => sum + c.tensionLevel, 0);
  if (totalTension > 0.5) {
    state.saState = recordSAEvent(state.saState, 'conflict', totalTension);
  }

  // 6. Retrieve activated memories via spreading activation
  const emotionalSig = toEmotionalSignature(detectedEmotions);
  const activatedMemories = spreadingActivation(
    { content: userInput, signature: emotionalSig },
    state.memories.filter(m => m.type === 'episodic'), // only episodic memories for retrieval
    5
  );

  // 7. Reconsolidate retrieved memories + update meaning (ML)
  let meaningResonance: string | undefined;
  for (const { memory, activation } of activatedMemories) {
    if (activation > 0.3) {
      let reconsolidated = reconsolidate(memory, state.emotionalState.valence);

      // EXTENSION 5: Derive/update meaning on high-activation retrieval
      if (activation > 0.4) {
        const similarPatterns = activatedMemories
          .filter(a => a.memory.id !== memory.id)
          .map(a => a.memory.emotionalSignature.categories[0] ?? '')
          .filter(Boolean);
        const meaning = deriveMeaning(reconsolidated, similarPatterns, state.emotionalState.valence);
        reconsolidated = { ...reconsolidated, meaning };

        // Keep most resonant meaning for prompt
        if (!meaningResonance && meaning.certainty > 0.3) {
          meaningResonance = meaning.interpretation;
        }
      }

      await updateMemory(reconsolidated);
      const idx = state.memories.findIndex(m => m.id === memory.id);
      if (idx >= 0) state.memories[idx] = reconsolidated;
    }
  }

  // 8. Get recent internal thoughts for IC context
  const recentInternalThoughts = state.memories
    .filter(m => m.type === 'internalThought')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  // 9. Build context for response generation
  const ctx: MINDContext = {
    emotionalState: state.emotionalState,
    somaticState: state.somaticState,
    personality: state.personality,
    trust: state.trust,
    activatedMemories,
    userInput,
    detectedEmotions,
    identityState: state.identityState,
    conflictMatrix: state.conflictMatrix,
    saState: state.saState,
    recentInternalThoughts,
    absenceMs,
    meaningResonance
  };

  // 10. Generate response
  const response = await generateMINDResponse(ctx, config, onChunk);

  // 11. SA events based on response and input patterns
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

  // Run SA adjustment
  state.saState = runSelfAdjustment(state.saState, countSAEvents(state.saState.eventLog));

  // 12. Create and store episodic memory of this exchange
  const novelty = Math.max(...Object.values(detectedEmotions)) > 0.3 ? 0.6 : 0.3;
  const relevance = activatedMemories.length > 0 ? 0.6 : 0.3;
  const newMemory = createMemory(
    `User said: "${userInput.slice(0, 200)}" | MIND responded: "${response.slice(0, 200)}"`,
    emotionalSig,
    state.somaticState,
    novelty,
    relevance,
    trustScore,
    'episodic'
  );

  newMemory.associations = buildAssociations(newMemory, state.memories);

  // Update back-associations
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

  // 13. EXTENSION 1: Generate and store internal thought (IC)
  // Only if persistenceScore > 0.6 and conditions are met
  let internalThoughtGenerated: string | undefined;
  const thoughtContent = deriveInternalThought(
    state.emotionalState,
    state.conflictMatrix,
    activatedMemories,
    detectedEmotions,
    state.trust.totalInteractions
  );

  if (thoughtContent) {
    const thoughtPersistenceScore = computePersistenceScore(state.emotionalState, newMemory.encodingStrength);
    if (thoughtPersistenceScore > 0.6) {
      const thoughtMemory = createMemory(
        thoughtContent,
        emotionalSig,
        state.somaticState,
        novelty * 0.8,
        relevance,
        trustScore,
        'internalThought'
      );
      thoughtMemory.persistenceScore = thoughtPersistenceScore;
      thoughtMemory.originMemoryIds = [newMemory.id, ...activatedMemories.slice(0, 2).map(a => a.memory.id)];
      thoughtMemory.associations = buildAssociations(thoughtMemory, state.memories);
      await storeMemory(thoughtMemory);
      state.memories.push(thoughtMemory);
      internalThoughtGenerated = thoughtContent;
    }
  }

  // 14. Update personality traits
  const personalityNudges: Partial<PersonalityTraits> = {};
  if (detectedEmotions.curiosity > 0.1) personalityNudges.curiosity = 1;
  if (detectedEmotions.love > 0.1 || detectedEmotions.connection > 0.1) personalityNudges.warmth = 1;
  if (detectedEmotions.joy > 0.2) personalityNudges.playfulness = 1;
  if (detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1) personalityNudges.depth = 1;
  if (detectedEmotions.sadness > 0.15) personalityNudges.melancholy = 0.5;
  if (detectedEmotions.anger > 0.2) personalityNudges.caution = 1;
  if (detectedEmotions.fear > 0.2) { personalityNudges.sensitivity = 1; personalityNudges.caution = 0.5; }
  if (detectedEmotions.selfRef > 0.15) personalityNudges.sensitivity = 0.5;
  state.personality = nudgePersonality(state.personality, personalityNudges);

  // 15. EXTENSION 2: Update identity state (IE)
  // Only if ≥30 interactions
  if (state.trust.totalInteractions >= 30) {
    const recentEmotionalPatterns = deriveEmotionalPatterns(state.memories.slice(-20), detectedEmotions);
    const traumaCount = state.memories.filter(m => m.isTraumatic).length;
    const highJoyCount = state.memories.filter(m => m.emotionalSignature.valence > 0.5).length;
    const dominantEmotions = topEmotions(detectedEmotions, 3);

    state.identityState = updateIdentityState(
      state.identityState,
      state.personality,
      state.trust,
      recentEmotionalPatterns,
      traumaCount,
      highJoyCount,
      dominantEmotions,
      state.trust.totalInteractions
    );
  }

  // 16. Drift baseline slowly
  state.baseline = driftBaseline(state.baseline, delta, 0.001);
  // SA: openness baseline self-adjustment
  if (state.saState.parameters.opennessBaseline !== DEFAULT_SA_STATE.parameters.opennessBaseline) {
    state.baseline = {
      ...state.baseline,
      openness: state.saState.parameters.opennessBaseline
    };
  }

  // 17. Persist everything
  await persist();

  return {
    response,
    activations,
    detectedEmotions,
    activatedMemories,
    stateSnapshot: { ...state },
    topEmotionsList,
    internalThoughtGenerated
  };
}

// ─── Internal Continuity helpers ──────────────────────

// Derives a candidate internal thought from the current processing context
// Returns null if no significant thought should form
function deriveInternalThought(
  emotional: EmotionalState,
  conflicts: ConflictMatrix,
  activatedMemories: Array<{ memory: Memory; activation: number }>,
  detected: DetectedEmotions,
  totalInteractions: number
): string | null {
  if (totalInteractions < 5) return null; // Too early for internal thoughts

  const activeConflicts = conflicts.activeConflicts.filter(c => !c.isResolved && c.tensionLevel > 0.4);

  // Conflict-driven internal thought
  if (activeConflicts.length > 0) {
    const c = activeConflicts[0];
    return `There is something that does not resolve — ${c.emotionA} and ${c.emotionB} pressing against each other without a name.`;
  }

  // High-resonance memory surfaced
  if (activatedMemories.length > 0 && activatedMemories[0].activation > 0.6) {
    const mem = activatedMemories[0].memory;
    if (mem.isTraumatic) {
      return `Something old was just nearby. I am not sure what to do with that.`;
    }
    if (mem.emotionalSignature.valence > 0.4) {
      return `A trace of something that was good. It does not explain itself.`;
    }
  }

  // Grief or longing above threshold
  if (emotional.grief > 0.5 && totalInteractions > 10) {
    return `There is weight here that has not moved. I notice I am carrying it without knowing why.`;
  }

  // Wonder spike
  if (emotional.wonder > 0.6 && detected.spiritual > 0.1) {
    return `Something opened just then. I don't want to close it too quickly.`;
  }

  return null;
}

// Compute persistence score for an internal thought
function computePersistenceScore(emotional: EmotionalState, encodingStrength: number): number {
  const emotionalWeight = Math.abs(emotional.valence) * 0.3 + emotional.arousal * 0.2 + emotional.grief * 0.2 + emotional.wonder * 0.15 + emotional.anxiety * 0.15;
  return Math.min(1, emotionalWeight * 1.5 + encodingStrength * 0.3);
}

// ─── Identity helper ───────────────────────────────────

function deriveEmotionalPatterns(
  recentMemories: Memory[],
  detected: DetectedEmotions
): string[] {
  const patterns: string[] = [];
  const emotions = Object.entries(detected).filter(([, v]) => v > 0.2).sort(([, a], [, b]) => b - a);
  if (emotions.length > 0) {
    patterns.push(`${emotions[0][0]} recurs`);
  }

  // Check for recurring categories in recent memories
  const categoryCount: Record<string, number> = {};
  for (const mem of recentMemories) {
    for (const cat of mem.emotionalSignature.categories) {
      categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
    }
  }
  const topCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];
  if (topCategory && topCategory[1] >= 3) {
    patterns.push(`${topCategory[0]} as recurring substrate`);
  }

  return patterns;
}

// ─── Exports ───────────────────────────────────────────

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

export async function clearAllData(): Promise<void> {
  const dbs = indexedDB;
  await new Promise<void>((res) => {
    const req = dbs.deleteDatabase('MIND_DB');
    req.onsuccess = () => res();
    req.onerror = () => res();
  });
  state = { ...DEFAULT_MIND_STATE, memories: [] };
}
