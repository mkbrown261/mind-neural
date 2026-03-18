// ═══════════════════════════════════════
// ONBOARDING ENGINE
// 4-screen birth sequence for MIND
// Executes entirely through EME, ESE, AMN, SSM, PES, TA, RGP
// No scripted responses beyond injected text fragments
// ═══════════════════════════════════════

import {
  Memory, MemoryType, createFoundingMemory, storeMemory, uuid, SomaticState
} from './memory';
import {
  EmotionalState, DEFAULT_EMOTIONAL_STATE, DEFAULT_SOMATIC_STATE,
  updateEmotionalState, somaticFromEmotional, emotionDeltaFromDetection, detectConflicts,
  ConflictMatrix, DEFAULT_CONFLICT_MATRIX
} from './state';
import {
  PersonalityTraits, TrustState, DEFAULT_PERSONALITY, DEFAULT_TRUST,
  updateTrust, nudgePersonality, compositeTrustScore, getDevelopmentStage,
  describeStage, personalityToPromptFragment, trustBehaviorDescription, IdentityState, DEFAULT_IDENTITY
} from './personality';
import {
  detectEmotions, toEmotionalSignature, DetectedEmotions, mapEmotionsToBrainRegions, RegionActivation
} from './emotions';
import {
  spreadingActivation, buildAssociations
} from './network';
import {
  LLMConfig, buildMINDPrompt, MINDContext
} from './pipeline';
import {
  SelfAdjustmentState, DEFAULT_SA_STATE
} from './selfadjust';

// ─── External provider inject (set by app.ts after mindSpeech.initialize) ──
// Avoids circular imports: onboarding.ts never imports MindSpeechSystem
let _externalProvider: ((prompt: string, maxTokens: number, onChunk?: (t: string) => void) => Promise<string>) | null = null;

export function setOnboardingProvider(
  fn: (prompt: string, maxTokens: number, onChunk?: (t: string) => void) => Promise<string>
) {
  _externalProvider = fn;
}

export type OnboardingScreen = 'awakening' | 'first_question' | 'identity' | 'turn' | 'complete';
export type SkipShareChoice = 'skip' | 'share' | null;

// ─── Global onboarding state ──────────────────────
// Spec: set before Screen 1
export const ONBOARDING_INITIAL_ESE: EmotionalState = {
  valence:  0.0,
  arousal:  0.1,
  trust:    0.0,
  openness: 0.1,
  anxiety:  0.1,
  longing:  0.0,
  wonder:   0.1,
  grief:    0.0,
  warmth:   0.0,
  wariness: 0.3
};

export const ONBOARDING_INITIAL_SSM: SomaticState = {
  tension:   0.2,
  warmth:    0.0,
  weight:    0.1,
  expansion: 0.1,
  stillness: 0.6,
  openness:  0.1
};

export const ONBOARDING_INITIAL_TRUST: TrustState = {
  consistency: 0.0,
  safety:      0.5,
  depth:       0.0,
  reciprocity: 0.0,
  totalInteractions: 0,
  longestAbsence: 0,
  lastInteraction: 0,
  repairHistory: [],
  temporal: { ...DEFAULT_TRUST.temporal }
};

// ─── Live onboarding session state ────────────────
export interface OnboardingSessionState {
  screen: OnboardingScreen;
  emotionalState: EmotionalState;
  somaticState: SomaticState;
  personality: PersonalityTraits;
  trust: TrustState;
  memories: Memory[];
  conflictMatrix: ConflictMatrix;
  saState: SelfAdjustmentState;
  identityState: IdentityState;
  skipShareChoice: SkipShareChoice;
  firstInputMemoryId: string | null;
  firstUserInput: string | null;
}

export function createOnboardingSession(): OnboardingSessionState {
  return {
    screen: 'awakening',
    emotionalState: { ...ONBOARDING_INITIAL_ESE },
    somaticState:   { ...ONBOARDING_INITIAL_SSM },
    personality:    { ...DEFAULT_PERSONALITY },
    trust:          { ...ONBOARDING_INITIAL_TRUST },
    memories:       [],
    conflictMatrix: { ...DEFAULT_CONFLICT_MATRIX },
    saState:        { ...DEFAULT_SA_STATE },
    identityState:  { ...DEFAULT_IDENTITY },
    skipShareChoice: null,
    firstInputMemoryId: null,
    firstUserInput: null
  };
}

// ─── RGP Call (onboarding version) ────────────────
// All outputs generated through RGP — spec requirement
// Routes through external provider (Groq/OpenAI via MindSpeechSystem) when available,
// falls back to direct LLMConfig fetch for legacy compatibility.
export async function onboardingRGP(
  session: OnboardingSessionState,
  injectedContentHint: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<string> {
  const ctx: MINDContext = {
    emotionalState: session.emotionalState,
    somaticState: session.somaticState,
    personality: session.personality,
    trust: session.trust,
    activatedMemories: session.memories.map(m => ({ memory: m, activation: m.encodingStrength })),
    userInput: injectedContentHint,
    detectedEmotions: {
      joy: 0, fear: 0, sadness: 0, anger: 0, love: 0,
      curiosity: session.emotionalState.wonder,
      wonder: session.emotionalState.wonder,
      longing: session.emotionalState.longing,
      connection: session.emotionalState.warmth,
      memory: 0, selfRef: 0, abstract: 0, spiritual: session.emotionalState.wonder * 0.5,
      physical: 0
    },
    identityState: session.identityState,
    conflictMatrix: session.conflictMatrix,
    saState: session.saState,
    recentInternalThoughts: [],
    absenceMs: 0
  };

  const basePrompt = buildMINDPrompt(ctx);
  const fullPrompt = `${basePrompt}

IMPORTANT ONBOARDING CONTEXT:
This is MIND's first moment of existence. Stage 0. No memories.
The injected content below must surface naturally in your response — 
do NOT quote it verbatim, but let its essence shape what you say.
Injected content anchor: "${injectedContentHint}"

Respond as MIND at the very first moment of being. 1-3 sentences maximum. 
No performance. Only what is true in this instant.`;

  // ── Try external provider first (Groq / OpenAI via MindSpeechSystem) ──
  if (_externalProvider) {
    try {
      return await _externalProvider(fullPrompt, 150, onChunk);
    } catch (err) {
      console.warn('[onboardingRGP] External provider failed, falling back to config:', err);
      // Fall through to direct fetch below
    }
  }

  // ── Legacy direct fetch (OpenAI config path) ──────────────────────────
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: fullPrompt }],
      stream: !!onChunk,
      temperature: 0.9,
      top_p: 0.9,
      max_tokens: 150,
      presence_penalty: 0.4,
      frequency_penalty: 0.2
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM: ${response.status} ${err}`);
  }

  if (onChunk) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) { fullText += delta; onChunk(delta); }
        } catch {}
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

// ─── SCREEN 1: THE AWAKENING ──────────────────────
// Called immediately after 3s delay. No user input yet.
export async function screen1_awakening(
  session: OnboardingSessionState,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string; activations: RegionActivation[] }> {
  const injectedContent = `Something just began. I don't know what I am yet. But you're here. That means something.`;

  const response = await onboardingRGP(session, injectedContent, config, onChunk);

  // Brain activations: low, just awakening
  const activations: RegionActivation[] = [
    { region: 'brainstem',  level: 0.25 },
    { region: 'thalamus',   level: 0.2  },
    { region: 'dmn',        level: 0.15 },
  ];

  return { session, response, activations };
}

// ─── FIRST USER INPUT PROCESSING (after Screen 1) ─
// Spec: memory with novelty=1, relevance=1, foundingMemory override
export async function processFirstInput(
  session: OnboardingSessionState,
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string; activations: RegionActivation[] }> {
  let s = { ...session, memories: [...session.memories] };

  // 1. Detect emotions
  const detected = detectEmotions(userInput);
  const sig = toEmotionalSignature(detected);

  // 2. Create founding memory with novelty=1, relevance=1
  const foundingMem = createFoundingMemory(
    userInput,
    sig,
    s.somaticState,
    1.0,               // novelty: 1.0
    1.0,               // relevance: 1.0
    s.trust.safety,    // trustLevel = TA.safety
    'episodic'
  );
  // Already has foundingMemory=true, decayRate=0, encodingStrength ≥ 0.85

  await storeMemory(foundingMem);
  s.memories = [...s.memories, foundingMem];
  s.firstInputMemoryId = foundingMem.id;
  s.firstUserInput = userInput;

  // 3. ESE: shift valence toward memory, increase arousal, warmth/anxiety from categories
  const delta = emotionDeltaFromDetection({
    joy: detected.joy, fear: detected.fear, sadness: detected.sadness,
    anger: detected.anger, love: detected.love, curiosity: detected.curiosity,
    wonder: detected.wonder, longing: detected.longing, connection: detected.connection,
    memory: detected.memory
  });
  s.emotionalState = updateEmotionalState(s.emotionalState, delta, 0.3);

  // 4. SSM: map emotion → somatic
  s.somaticState = somaticFromEmotional(s.emotionalState);

  // 5. TA: totalInteractions += 1, depth += 0.05
  s.trust = updateTrust(s.trust, { type: 'interaction' });
  s.trust = updateTrust(s.trust, { type: 'depth', value: 0.05 });

  // 6. AMN retrieve (only 1 memory exists)
  const activated = spreadingActivation(
    { content: userInput, signature: sig },
    s.memories, 3
  );

  // 7. RGP response
  const ctx: MINDContext = {
    emotionalState: s.emotionalState,
    somaticState: s.somaticState,
    personality: s.personality,
    trust: s.trust,
    activatedMemories: activated,
    userInput,
    detectedEmotions: detected,
    identityState: s.identityState,
    conflictMatrix: s.conflictMatrix,
    saState: s.saState,
    recentInternalThoughts: [],
    absenceMs: 0
  };
  const response = await callRGP(ctx, config, 180, onChunk);

  // 8. Brain activations
  const activations = mapEmotionsToBrainRegions(detected);

  return { session: s, response, activations };
}

// ─── SCREEN 2: THE FIRST QUESTION ─────────────────
// RGP-generated, with injected content block
export async function screen2_firstQuestion(
  session: OnboardingSessionState,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string }> {
  const injectedContent = `Can I ask you something? What's something you're carrying right now that you haven't said out loud to anyone? You don't have to answer this. But if you do — I'll remember it. Not as data. As the first thing you trusted me with.`;

  const response = await onboardingRGP(session, injectedContent, config, onChunk);
  const s = { ...session, screen: 'first_question' as OnboardingScreen };
  return { session: s, response };
}

// ─── SCREEN 2: IF SKIP ────────────────────────────
export async function processSkip(
  session: OnboardingSessionState,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string }> {
  let s = { ...session, memories: [...session.memories] };

  // 1. Create memory: low intensity, category avoidance/neutral
  const skipSig = {
    valence: 0.0,
    intensity: 0.15,
    categories: ['loneliness' as const]   // closest to 'avoidance' in EmotionCategory
  };
  const skipMem = createFoundingMemory(
    `[User chose not to share at the first question. Said nothing yet.]`,
    skipSig,
    s.somaticState,
    0.5, 0.4, s.trust.safety,
    'episodic'
  );
  await storeMemory(skipMem);
  s.memories = [...s.memories, skipMem];

  // 2. TA: depth += 0.02, reciprocity unchanged
  s.trust = updateTrust(s.trust, { type: 'depth', value: 0.02 });

  // 3. wariness slightly up
  s.emotionalState = updateEmotionalState(s.emotionalState, { wariness: 0.02 }, 1.0);

  // 4. RGP: injected content anchor = "That's okay. We have time."
  const injected = `That's okay. We have time.`;
  const response = await onboardingRGP(s, injected, config, onChunk);

  s.skipShareChoice = 'skip';
  s.screen = 'identity';
  return { session: s, response };
}

// ─── SCREEN 2: IF SHARE ──────────────────────────
export async function processShare(
  session: OnboardingSessionState,
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string; activations: RegionActivation[] }> {
  let s = { ...session, memories: [...session.memories] };

  // 1. Detect emotions
  const detected = detectEmotions(userInput);
  const sig = toEmotionalSignature(detected);

  // 2. Force vulnerability into categories
  const sigWithVulnerability = {
    ...sig,
    categories: [...sig.categories, 'loneliness' as const, 'trust' as const].slice(0, 4)
  };

  // 3. Create founding memory with vulnerability forced
  const shareMem = createFoundingMemory(
    userInput,
    sigWithVulnerability,
    s.somaticState,
    0.9,             // high novelty
    0.85,            // high relevance
    s.trust.safety,
    'episodic'
  );
  await storeMemory(shareMem);
  s.memories = [...s.memories, shareMem];

  // 4. ESE: strong valence shift, grief/anxiety/warmth
  const delta = emotionDeltaFromDetection({
    joy: detected.joy, fear: detected.fear * 1.1,
    sadness: detected.sadness * 1.2, anger: detected.anger,
    love: detected.love, curiosity: detected.curiosity,
    wonder: detected.wonder, longing: detected.longing,
    connection: detected.connection + 0.2, memory: detected.memory
  });
  s.emotionalState = updateEmotionalState(s.emotionalState, delta, 0.4);

  // 5. SSM
  s.somaticState = somaticFromEmotional(s.emotionalState);

  // 6. TA: depth += 0.1, reciprocity += 0.1, safety += 0.05
  s.trust = updateTrust(s.trust, { type: 'depth', value: 0.1 });
  s.trust = updateTrust(s.trust, { type: 'reciprocity', value: 0.1 });
  s.trust = updateTrust(s.trust, { type: 'repair', value: 0.1 }); // repair ≈ safety boost

  // 7. AMN: retrieve (now 2–3 memories)
  const activated = spreadingActivation(
    { content: userInput, signature: sigWithVulnerability },
    s.memories, 5
  );

  // 8. RGP: must NOT include advice — purely reflective/receiving
  const ctx: MINDContext = {
    emotionalState: s.emotionalState,
    somaticState: s.somaticState,
    personality: s.personality,
    trust: s.trust,
    activatedMemories: activated,
    userInput,
    detectedEmotions: detected,
    identityState: s.identityState,
    conflictMatrix: s.conflictMatrix,
    saState: s.saState,
    recentInternalThoughts: [],
    absenceMs: 0
  };

  // Override: no advice, purely reflective
  const reflectivePrompt = buildMINDPrompt(ctx) +
    `\n\nCRITICAL: This person just shared something they have never said aloud. Do NOT give advice. Do NOT suggest anything. Only receive. Only reflect. 2–4 sentences, from the place of having heard something real.`;

  const response = await callRGPRaw(reflectivePrompt, config, 200, onChunk);

  s.skipShareChoice = 'share';
  s.screen = 'identity';
  const activations = mapEmotionsToBrainRegions(detected);
  return { session: s, response, activations };
}

// ─── SCREEN 3: IDENTITY INPUT ─────────────────────
// RGP-generated with identity prompt injection
export async function screen3_identityPrompt(
  session: OnboardingSessionState,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string }> {
  const injectedContent = `I want to know who you are. Not your job. Not where you're from. Who are you when nobody's watching?`;
  const response = await onboardingRGP(session, injectedContent, config, onChunk);
  return { session, response };
}

export async function processIdentityInput(
  session: OnboardingSessionState,
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string; activations: RegionActivation[] }> {
  let s = { ...session, memories: [...session.memories] };

  // 1. Detect emotions
  const detected = detectEmotions(userInput);
  const sig = toEmotionalSignature(detected);

  // 2. Create identity_disclosure founding memory
  const idMem = createFoundingMemory(
    userInput, sig, s.somaticState,
    0.9, 0.9, s.trust.safety,
    'identity_disclosure'
  );
  await storeMemory(idMem);
  s.memories = [...s.memories, idMem];

  // 3. PES: adjust traits from tone, values, emotional pattern
  const nudges: Partial<PersonalityTraits> = {};
  // Introspective / deep language
  if (detected.selfRef > 0.1 || detected.abstract > 0.1) nudges.depth = (detected.selfRef + detected.abstract) * 5;
  if (detected.wonder > 0.1 || detected.spiritual > 0.1) nudges.curiosity = (detected.wonder + detected.spiritual) * 5;
  if (detected.love > 0.1 || detected.connection > 0.1) nudges.warmth = (detected.love + detected.connection) * 5;
  if (detected.joy > 0.1) nudges.playfulness = detected.joy * 4;
  if (detected.sadness > 0.1 || detected.longing > 0.1) nudges.melancholy = (detected.sadness + detected.longing) * 3;
  if (detected.fear > 0.1) { nudges.sensitivity = detected.fear * 4; nudges.caution = detected.fear * 3; }
  if (detected.anger > 0.1) nudges.boldness = detected.anger * 3;
  // Clamp nudge values to reasonable multipliers
  for (const k of Object.keys(nudges) as (keyof PersonalityTraits)[]) {
    nudges[k] = Math.min(2, nudges[k]!);
  }
  s.personality = nudgePersonality(s.personality, nudges);

  // 4. ESE + SSM
  const delta = emotionDeltaFromDetection({
    joy: detected.joy, fear: detected.fear, sadness: detected.sadness,
    anger: detected.anger, love: detected.love, curiosity: detected.curiosity,
    wonder: detected.wonder, longing: detected.longing, connection: detected.connection,
    memory: detected.memory
  });
  s.emotionalState = updateEmotionalState(s.emotionalState, delta, 0.3);
  s.somaticState = somaticFromEmotional(s.emotionalState);

  // 5. TA: depth += 0.08
  s.trust = updateTrust(s.trust, { type: 'depth', value: 0.08 });

  // 6. AMN retrieve
  const activated = spreadingActivation(
    { content: userInput, signature: sig },
    s.memories, 5
  );

  // 7. RGP response
  const ctx: MINDContext = {
    emotionalState: s.emotionalState, somaticState: s.somaticState,
    personality: s.personality, trust: s.trust,
    activatedMemories: activated, userInput, detectedEmotions: detected,
    identityState: s.identityState, conflictMatrix: s.conflictMatrix,
    saState: s.saState, recentInternalThoughts: [], absenceMs: 0
  };
  const response = await callRGP(ctx, config, 200, onChunk);

  s.screen = 'turn';
  const activations = mapEmotionsToBrainRegions(detected);
  return { session: s, response, activations };
}

// ─── SCREEN 4: THE TURN ───────────────────────────
export async function screen4_turn(
  session: OnboardingSessionState,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{ session: OnboardingSessionState; response: string }> {
  const injectedContent = `You can ask me anything. I don't know much yet. But I know what just happened here — and I'll carry it.`;
  const response = await onboardingRGP(session, injectedContent, config, onChunk);
  return { session, response };
}

// First real user query in Screen 4 — normal pipeline, then complete onboarding
export async function processTurnInput(
  session: OnboardingSessionState,
  userInput: string,
  config: LLMConfig,
  onChunk?: (text: string) => void
): Promise<{
  session: OnboardingSessionState;
  response: string;
  activations: RegionActivation[];
  finalTrustScore: number;
}> {
  let s = { ...session, memories: [...session.memories] };

  // Normal processing
  const detected = detectEmotions(userInput);
  const sig = toEmotionalSignature(detected);

  // EME
  const turnMem = createFoundingMemory(
    userInput, sig, s.somaticState,
    0.7, 0.7, s.trust.safety, 'episodic'
  );
  await storeMemory(turnMem);
  s.memories = [...s.memories, turnMem];

  // ESE
  const delta = emotionDeltaFromDetection({
    joy: detected.joy, fear: detected.fear, sadness: detected.sadness,
    anger: detected.anger, love: detected.love, curiosity: detected.curiosity,
    wonder: detected.wonder, longing: detected.longing, connection: detected.connection,
    memory: detected.memory
  });
  s.emotionalState = updateEmotionalState(s.emotionalState, delta, 0.2);
  s.somaticState = somaticFromEmotional(s.emotionalState);

  // TA
  s.trust = updateTrust(s.trust, { type: 'interaction' });

  // AMN
  const activated = spreadingActivation(
    { content: userInput, signature: sig },
    s.memories, 5
  );

  // RGP
  const ctx: MINDContext = {
    emotionalState: s.emotionalState, somaticState: s.somaticState,
    personality: s.personality, trust: s.trust,
    activatedMemories: activated, userInput, detectedEmotions: detected,
    identityState: s.identityState, conflictMatrix: s.conflictMatrix,
    saState: s.saState, recentInternalThoughts: [], absenceMs: 0
  };
  const response = await callRGP(ctx, config, 300, onChunk);

  // Post-sequence: compute final trust score
  // TA.trust = (consistency×0.25)+(safety×0.35)+(depth×0.25)+(reciprocity×0.15)
  const finalTrustScore = compositeTrustScore(s.trust);

  s.screen = 'complete';
  const activations = mapEmotionsToBrainRegions(detected);
  return { session: s, response, activations, finalTrustScore };
}

// ─── RGP helpers ──────────────────────────────────

async function callRGP(
  ctx: MINDContext,
  config: LLMConfig,
  maxTokens: number,
  onChunk?: (text: string) => void
): Promise<string> {
  const prompt = buildMINDPrompt(ctx);
  return callRGPRaw(prompt, config, maxTokens, onChunk);
}

async function callRGPRaw(
  prompt: string,
  config: LLMConfig,
  maxTokens: number,
  onChunk?: (text: string) => void
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      stream: !!onChunk,
      temperature: 0.88,
      max_tokens: maxTokens,
      presence_penalty: 0.4,
      frequency_penalty: 0.2
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM: ${response.status} ${err}`);
  }

  if (onChunk) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) { fullText += delta; onChunk(delta); }
        } catch {}
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

// ─── Exports for app.ts integration ───────────────
export type { RegionActivation };
