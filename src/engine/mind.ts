// ═══════════════════════════════════════
// MIND CORE ORCHESTRATOR
// Ties all systems together
// ═══════════════════════════════════════

import {
  Memory, initDB, storeMemory, getAllMemories, updateMemory,
  getMeta, setMeta, createMemory, reconsolidate, SomaticState
} from './memory';
import {
  EmotionalState, DEFAULT_EMOTIONAL_STATE, DEFAULT_SOMATIC_STATE, DEFAULT_BASELINE,
  updateEmotionalState, driftBaseline, decayTowardBaseline, somaticFromEmotional,
  emotionDeltaFromDetection
} from './state';
import {
  PersonalityTraits, TrustState, DEFAULT_PERSONALITY, DEFAULT_TRUST,
  nudgePersonality, updateTrust, compositeTrustScore, getDevelopmentStage
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
  isInitialized: false
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

  state.emotionalState = savedEmotional ?? { ...DEFAULT_EMOTIONAL_STATE };
  state.baseline = savedBaseline ?? { ...DEFAULT_BASELINE };
  state.personality = savedPersonality ?? { ...DEFAULT_PERSONALITY };
  state.trust = savedTrust ?? { ...DEFAULT_TRUST };
  state.somaticState = savedSomatic ?? { ...DEFAULT_SOMATIC_STATE };

  // Decay emotional state since last session
  const now = Date.now();
  if (state.trust.lastInteraction > 0) {
    const hoursSince = (now - state.trust.lastInteraction) / (1000 * 60 * 60);
    const decayStrength = Math.min(0.3, hoursSince * 0.01);
    state.emotionalState = decayTowardBaseline(state.emotionalState, state.baseline, decayStrength);
    state.somaticState = somaticFromEmotional(state.emotionalState);
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
}

export interface ProcessInputResult {
  response: string;
  activations: RegionActivation[];
  detectedEmotions: DetectedEmotions;
  activatedMemories: Array<{ memory: Memory; activation: number }>;
  stateSnapshot: MINDState;
  topEmotionsList: string[];
}

export async function processInput(
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<ProcessInputResult> {
  if (!state.isInitialized) await initMIND();

  // 1. Detect emotions from input
  const detectedEmotions = detectEmotions(userInput);
  const topEmotionsList = topEmotions(detectedEmotions, 4);

  // 2. Map to brain activations
  const activations = mapEmotionsToBrainRegions(detectedEmotions);
  state.lastActivations = activations;
  state.lastDetectedEmotions = detectedEmotions;

  // 3. Update trust
  state.trust = updateTrust(state.trust, { type: 'interaction' });

  // Check for depth signals (philosophical/abstract content)
  const isDeep = detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1 || detectedEmotions.wonder > 0.1;
  if (isDeep) {
    state.trust = updateTrust(state.trust, { type: 'depth', value: 0.015 });
  }

  // Check for reciprocity (self-reference = sharing something personal)
  if (detectedEmotions.selfRef > 0.1 || detectedEmotions.memory > 0.05) {
    state.trust = updateTrust(state.trust, { type: 'reciprocity', value: 0.01 });
  }

  // Check for rupture signals
  if (detectedEmotions.anger > 0.3) {
    state.trust = updateTrust(state.trust, { type: 'rupture', value: detectedEmotions.anger * 0.5 });
  }

  // 4. Update emotional state with momentum
  const delta = emotionDeltaFromDetection({
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

  const trustScore = compositeTrustScore(state.trust);
  state.emotionalState = updateEmotionalState(state.emotionalState, delta, 0.2);
  state.emotionalState.trust = trustScore;
  state.somaticState = somaticFromEmotional(state.emotionalState);

  // 5. Retrieve activated memories via spreading activation
  const emotionalSig = toEmotionalSignature(detectedEmotions);
  const activatedMemories = spreadingActivation(
    { content: userInput, signature: emotionalSig },
    state.memories,
    5
  );

  // Reconsolidate retrieved memories
  for (const { memory, activation } of activatedMemories) {
    if (activation > 0.3) {
      const reconsolidated = reconsolidate(memory, state.emotionalState.valence);
      await updateMemory(reconsolidated);
      // Update in local array
      const idx = state.memories.findIndex(m => m.id === memory.id);
      if (idx >= 0) state.memories[idx] = reconsolidated;
    }
  }

  // 6. Build context for response generation
  const ctx: MINDContext = {
    emotionalState: state.emotionalState,
    somaticState: state.somaticState,
    personality: state.personality,
    trust: state.trust,
    activatedMemories,
    userInput,
    detectedEmotions
  };

  // 7. Generate response
  const response = await generateMINDResponse(ctx, config, onChunk);

  // 8. Create and store memory of this exchange
  const novelty = Math.max(...Object.values(detectedEmotions)) > 0.3 ? 0.6 : 0.3;
  const relevance = activatedMemories.length > 0 ? 0.6 : 0.3;
  const newMemory = createMemory(
    `User said: "${userInput.slice(0, 200)}" | MIND responded: "${response.slice(0, 200)}"`,
    emotionalSig,
    state.somaticState,
    novelty,
    relevance,
    trustScore
  );

  // Build associations with existing memories
  newMemory.associations = buildAssociations(newMemory, state.memories);

  // Update existing memories to include new association
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

  // 9. Update personality
  const personalityNudges: Partial<PersonalityTraits> = {};
  if (detectedEmotions.curiosity > 0.1) personalityNudges.curiosity = 1;
  if (detectedEmotions.love > 0.1 || detectedEmotions.connection > 0.1) personalityNudges.warmth = 1;
  if (detectedEmotions.joy > 0.2) personalityNudges.playfulness = 1;
  if (detectedEmotions.abstract > 0.1 || detectedEmotions.spiritual > 0.1) { personalityNudges.depth = 1; }
  if (detectedEmotions.sadness > 0.15) personalityNudges.melancholy = 0.5;
  if (detectedEmotions.anger > 0.2) personalityNudges.caution = 1;
  if (detectedEmotions.fear > 0.2) { personalityNudges.sensitivity = 1; personalityNudges.caution = 0.5; }
  if (detectedEmotions.selfRef > 0.15) personalityNudges.sensitivity = 0.5;

  state.personality = nudgePersonality(state.personality, personalityNudges);

  // 10. Drift baseline slowly
  state.baseline = driftBaseline(state.baseline, delta, 0.001);

  // 11. Persist everything
  await persist();

  return {
    response,
    activations,
    detectedEmotions,
    activatedMemories,
    stateSnapshot: { ...state },
    topEmotionsList
  };
}

export function getMemoryCount(): number {
  return state.memories.length;
}

export function getDevelopmentStageLabel(): string {
  const stage = getDevelopmentStage(state.trust.totalInteractions);
  return ['Newborn', 'Infant', 'Child', 'Adolescent', 'Adult'][stage];
}

export function getCurrentActivations(): RegionActivation[] {
  return state.lastActivations;
}

export async function clearAllData(): Promise<void> {
  // Clear IndexedDB
  const dbs = indexedDB;
  await new Promise<void>((res) => {
    const req = dbs.deleteDatabase('MIND_DB');
    req.onsuccess = () => res();
    req.onerror = () => res();
  });
  state = { ...DEFAULT_MIND_STATE, memories: [] };
}
