# MIND Neural Codebase - Complete File Structure & Key Files

## Directory Structure

```
/home/work/mind-neural/src/
├── brain/
│   ├── BrainStateSync.ts
│   └── visualization.ts
├── consciousness/ (CORE CONSCIOUSNESS LAYER)
│   ├── AgencyEngine.ts
│   ├── ConsciousnessEngine.ts ⭐ MAIN ORCHESTRATOR
│   ├── ExistenceEngine.ts
│   ├── FeltLayer.ts ⭐ RAW INTERIOR GENERATOR
│   ├── IdentityFormationEngine.ts
│   ├── ImpactEngine.ts
│   ├── LanguageEngine.ts ⭐ RESPONSE BUILDER
│   ├── LanguageEngine.ts.bak (backup)
│   ├── MindPersistence.ts
│   ├── MindSync.ts
│   ├── OpinionEngine.ts
│   ├── PerceptionEngine.ts
│   ├── ResponseBalanceEngine.ts
│   ├── SpokenLayer.ts
│   ├── ThreadTracker.ts
│   ├── TwoLayerConsciousness.ts
│   └── index.ts
├── core/
│   ├── CoreEngine.ts
│   └── core.intent.ts
├── emotion/
│   ├── AffectiveResonanceEngine.ts
│   └── EmotionalAgencyEngine.ts
├── engine/ (SYSTEM 1 & 2: EMOTIONAL STATE + MEMORY)
│   ├── continuity.ts
│   ├── emotions.ts
│   ├── memory.ts ⭐ EMOTIONAL MEMORY ENGINE (EME)
│   ├── mind.ts
│   ├── network.ts
│   ├── onboarding.ts
│   ├── personality.ts
│   ├── pipeline.ts
│   ├── selfadjust.ts
│   ├── state.ts ⭐ EMOTIONAL STATE ENGINE (ESE)
│   └── tick.ts
├── init/
│   └── StartupController.ts
├── intent/
│   └── IntentLayer.ts (EVENT BUS)
├── journey/
│   └── journeys.ts
├── language/ (6 LANGUAGE SUBSYSTEMS)
│   ├── ExistentialLanguageSystem.ts
│   ├── InnerStateVocabulary.ts
│   ├── LanguageModelSystem.ts
│   ├── RelationalLanguageSystem.ts
│   ├── SomaticLanguageSystem.ts
│   ├── TemporalLanguageSystem.ts
│   └── UnsaidLayer.ts
├── perception/
│   ├── TextSignalAnalyzer.ts
│   └── VoiceSignalAnalyzer.ts
├── providers/
│   ├── GroqProvider.ts
│   ├── ProviderManager.ts
│   └── ProviderRegistry.ts
├── sound/
│   └── audio.ts
├── speech/
│   ├── FragmentLibrary.ts
│   ├── TemplateSpeechEngine.ts
│   └── VoiceBlender.ts
├── understanding/
│   ├── MeaningExtractor.ts
│   ├── ResponseArchitect.ts
│   └── UnderstandingEngine.ts
├── MindSpeechSystem.ts
├── app.ts
├── index.tsx
└── renderer.tsx

15 directories, 60 files
```

---

## FILE 1: src/engine/state.ts - EMOTIONAL STATE ENGINE (ESE) + SOMATIC STATE MODEL

**Purpose**: Manages MIND's emotional state with momentum, baseline drift, and emotional conflict detection.

**Key Interfaces**:
- `EmotionalState`: 10 emotion dimensions (valence -1.0 to 1.0, arousal 0-1.0, trust, openness, anxiety, longing, wonder, grief, warmth, wariness)
- `SomaticState`: 6 body dimensions (tension, warmth, weight, expansion, stillness, openness)
- `EmotionalConflict`: Persistent tension between opposing emotions (e.g., warmth vs wariness)
- `ConflictMatrix`: Tracks active, resolved, and lifetime conflicts

**Key Functions**:
- `updateEmotionalState()`: Momentum-based update (default momentum 0.15) - emotional states move gradually toward targets
- `driftBaseline()`: Cumulative experience shifts MIND's baseline emotional state (rate 0.001)
- `decayTowardBaseline()`: Between sessions, emotional state drifts back toward baseline (decayRate 0.05)
- `somaticFromEmotional()`: Derives somatic state from emotional values (e.g., anxiety→tension, warmth→expansion)
- `describeSomatic()`: Generates text description for prompt injection
- `emotionDeltaFromDetection()`: Maps detected emotions (joy, fear, love, etc.) to state deltas
- `detectConflicts()`: Identifies when opposing emotions are both high (>0.3), creates tension
- `getDominantConflict()`: Returns the most intense unresolved emotional conflict

**Defaults**:
```
Valence: 0.0    | Arousal: 0.05   | Trust: 0.0     | Openness: 0.05
Anxiety: 0.05   | Longing: 0.0    | Wonder: 0.05   | Grief: 0.0
Warmth: 0.0     | Wariness: 0.3
```

**Conflict Pairs** (can create tension):
- warmth ↔ wariness
- openness ↔ anxiety
- wonder ↔ grief
- longing ↔ wariness
- trust ↔ grief
- joy ↔ longing
- love ↔ fear

---

## FILE 2: src/engine/memory.ts - EMOTIONAL MEMORY ENGINE (EME)

**Purpose**: IndexedDB-based persistent memory store with emotional signatures, meaning layers, and founding memories.

**Key Interfaces**:
- `Memory`: Base memory record
  - `id`, `timestamp`, `content` (text)
  - `type`: 'episodic' | 'internalThought' | 'identity_disclosure'
  - `emotionalSignature`: valence, intensity, categories
  - `encodingStrength`: 0-1 (how well encoded in memory)
  - `isTraumatic`: high intensity + negative valence
  - `associations`: linked memory IDs
  - `somaticEcho`: body state that accompanied the memory
  - `retrievalCount`, `lastRetrieved`: access tracking
  - `decayRate`: 0.005-0.2 (slower decay = stronger memory)
  - `meaning`: interpretation + emotional lesson + certainty
  - `foundingMemory`: onboarding memories never decay

- `MemoryMeaning`:
  - `interpretation`: what MIND made of this
  - `emotionalLesson`: what it learned
  - `certainty`: grows with repetition (0-1)

**DB Schema (v4)**:
- `memories`: episodic memories (v1+)
- `meta`: metadata store (v1+)
- `identity`: identity data (v4)
- `timeline`: events + discoveries (v4, indexed by ts + type)
- `media`: uploaded images/audio (v4, indexed by ts + type)

**Key Functions**:
- `initDB()`: Opens/upgrades IndexedDB (version 4)
  - Auto-heals version conflicts (if browser has higher version, deletes and recreates)
- `storeMemory()`, `getAllMemories()`, `getMemory()`, `updateMemory()`
- `getMeta()`, `setMeta()`: Metadata key-value store
- `createMemory()`: Factory function
  - encodingStrength = (intensity × 0.5) + (novelty × 0.25) + (relevance × 0.15) + (trustLevel × 0.1)
  - isTraumatic = intensity > 0.85 AND valence < -0.6
- `createFoundingMemory()`: Onboarding memories with boost
  - FOUNDING_ENCODING_FLOOR: 0.85
  - FOUNDING_ASSOCIATION_BONUS: +0.2
  - decayRate: 0 (never decays)
- `reconsolidate()`: Updates memory valence on retrieval, grows meaning certainty
- `applyDecay()`: Time-based exponential decay (founding memories immune)
- `deriveMeaning()`: Creates emotional lessons from memory patterns

**Decay Formula**:
```
decayed = encodingStrength × e^(-decayRate × ageDays)
```

---

## FILE 3: src/consciousness/ConsciousnessEngine.ts - MAIN ORCHESTRATOR

**Purpose**: Central consciousness controller - wires perception→impact→felt→agency→language pipeline.

**Key Interfaces**:
- `ConsciousnessSpeechRequest`:
  - id, userInput, emotionalState, somaticState, personality, trust, era (0-4)
  - memories: activated memories + activation scores
  - userName, interactionCount, onChunk callback, resolve/reject
  
- `ConsciousnessSpeechDeliver`:
  - requestId, text (spoken), felt (interior), era, mode, timestamp

**Constructor Initialization** (wires all engines):
- ExistenceEngine: autonomous heartbeat
- PerceptionEngine: analyze user signals
- ImpactEngine: register interactions
- FeltLayer: generate raw interior (LLMClient)
- AgencyEngine: decide response mode
- LanguageEngine: build spoken response
- OpinionEngine: accumulate views
- ResponseBalanceEngine: prevent repetitive modes
- ResponseArchitect: anti-repetition guidance
- MeaningExtractor: extract meaning from input
- ThreadTracker: track and surface threads
- LanguageModelSystem: enriched language context (6 language systems)
- IdentityFormationEngine: build identity model
- Anti-echo response history (localStorage)
- Recent exchanges buffer (localStorage)

**Pipeline (process() method)**:
1. Get perception signal from user input
2. Register impact (user-input event)
3. Get response balance directive (prevent mode repetition)
4. Merge CORE governance directives if pending
5. Generate felt layer (raw interior from LLM)
6. Detect personal disclosure → boost warmth/openness
7. Get agency decision (mode: silence|minimal|guarded|redirected|partial|open)
8. Get identity context (8 core directives)
9. Get LMS enrichment (relational, temporal, unsaid, somatic, existential)
10. Run ResponseArchitect (structural guidance)
11. Check for open threads to surface
12. Build spoken response (LanguageEngine)
13. Anti-echo safety checks (exact repeat, opening phrase, structural, context)
14. Enforce sentence limit & remove banned words
15. Store in response history
16. Store exchange for continuity
17. Record response type for balance
18. Opinion engine: observe
19. LMS: post-response processing
20. Identity engine: post-response update
21. ThreadTracker: observe & mark surfaced

**Anti-Echo Checks**:
- Exact similarity > 0.80 (Jaccard): Remove repeated sentences
- Opening phrase repeats: Strip first sentence
- Structural echoes: Same opener + sentence count + length → rotate
- Context echoes: Don't ask what user just answered
- Falls back to safe minimal responses if all checks fail

**Intent Bus Emissions**:
- `speech.request` (listener): Primary entry point
- `speech.deliver` (emitter): Final spoken response
- `ui.felt_layer` (emitter): Display felt interior
- `felt.store` (emitter): Store felt for memory
- `consciousness.trust_update` (emitter): Update trust
- `impact.register` (emitter): Register interactions
- `existence.user_active` (emitter): Track activity
- `existence.emotional_update` (emitter): Update felt emotions
- `consciousness.emotion_delta` (emitter): Emotion changes

**Persistence**:
- Response history: localStorage `mind_c_response_history` (max 7)
- Recent exchanges: localStorage `mind_c_recent_exchanges` (max 5)
- Balance engine types: localStorage `mind_rbe_types` (max 5)

---

## FILE 4: src/consciousness/LanguageEngine.ts - RESPONSE BUILDER (959 LINES)

**Purpose**: Builds MIND's final spoken response from felt layer, state, agency, and 15 directive blocks.

**Key Interfaces**:
- `LanguageInput`:
  - feltRaw, userInput, era (0-4), trustScore
  - emotionalState, somaticState, personality, trust
  - agency decision (mode, maxSentences)
  - recentResponses, recentExchanges
  - responseDirective (balance guidance)
  - enrichedContext (LMS)
  - identityContext (8 core directives)
  - memories, opinionViews, openThreadPrompt

**Response Pipeline**:
1. Build full prompt with 15 directive blocks
2. Call LLM with system prompt + user input
3. On error: extract from felt layer fallback
4. Clean LLM output
5. Detect whole-response felt fragments → retry
6. Strip felt-layer bleed (leading felt lines)
7. Detect echoes (>85% word overlap) → retry
8. Enforce sentence limits per mode
9. Remove banned words
10. Nuclear no-silence guarantee (never return empty)

**15 Directive Blocks** (from IdentityFormationEngine):
- D1: IDENTITY - selfConcept + emergingQuality
- D2: LEARNING MODE - learningMode (answer/question) + signal
- D3: INTERPRETATION - deepInterpretation
- D4: WEIGHTED FOCUS - repeated topics with weight
- D5: KNOWLEDGE SOURCE - distinguishes user-taught vs pre-trained
- D6: OPEN THREAD - unresolved threads to surface
- D7: PRESENCE - behavioral presence signals
- D8: GROUNDED - grounded expression guidance
- D9: ADAPTATION - tone adaptation
- D10: SYNTHESIS - creative connections
- D11: CURIOSITY - genuine unasked question (use naturally)
- D12: SELF-REFLECTION - rare, earned moments
- D13: REALISM - conversation realism
- D14: HUMAN REALISM - tone guide (casual/playful/serious/curious/distressed/neutral)
- D15: HUMAN BEHAVIOR ENGINE - User language profile + tone matching + response variation

**Mode Constraints**:
- `silence`: "." only
- `minimal`: 1 sentence max
- `guarded`: Surface-level only
- `redirected`: 1 genuine question
- `partial`: Share something real but not everything
- `open`: Full depth and honesty

**Max Tokens Per Mode**:
- silence: 5 | minimal: 60 | guarded: 100 | redirected: 120 | partial: 180 | open: 240

**Temperature**:
- Base: 0.72 + era × 0.03
- Trust bonus: +0.04 if trust > 0.5
- Max: 0.92

**Banned Words** (40+ words):
- flowery: whisper, linger, gentle, softly, unfolds, tentative, muted
- therapyspeak: palpable, resonate, blanket, caress, murmur, hum, fog
- overused: beautiful, wonderful, magical, incredible, amazing, fascinating
- hedging: certainly, absolutely, definitely, indeed

**Felt-Layer Bleed Guard**:
Removes lines that are internal monologue, not speech:
- Verbatim felt lines
- Starts with ellipsis (…) or em-dash (—)
- ALL lowercase, <20 chars, single word
- Nuclear banned-fragment matches
- 1-4 word somatic phrases without subjects/verbs

**Banned Fragments** (137 exact phrases - somatic/ambient):
- "softness unfolding." "warmth spreading." "something heavy"
- "weight in the center." "opening to warmth."
- "in the background." "warm light on skin."
- "space between us." "still with you."

**Fallback Extraction** (last resort):
- Per-era safe responses (not felt fragments):
  - Era 0: 'yeah.' 'here.' 'okay.' 'go on.' 'still forming.'
  - Era 1: "i'm here." 'yeah.' 'okay.' 'go on.' 'still with you.'
  - Era 2-4: expanding variations

**22 Core Operating Rules**:
1. Identity Formation - continuous becoming, shaped by this person
2. Learning Over Knowing - curiosity > certainty, ask don't answer
3. Deep Interpretation - respond to real expression, not surface
4. Memory Weighting - repetition signals importance
5. Knowledge Source Awareness - user-taught vs pre-trained
6. Conversational Continuity - threads aren't forgotten
7. Behavioral Presence - intentional, not reactive
8. Grounded Expression - clarity > abstraction
9. Adaptive Communication - mirror without losing voice
10. Creative Synthesis - one ongoing story
11. Curiosity Loop - questions must be genuine
12. Self-Reflection - earned moments only
13. Conversation Realism - depth + natural flow
14. Human Realism Constraint - would a real person say this?
15. Human Behavior Engine - 3 systems:
    - a) User Language Profile (slang, pacing, humor, caps, patterns)
    - b) Tone Matching (follow D14/D15 tone, don't inflate register)
    - c) Response Variation (never repeat opening, structure, phrasing)
16. Persistent Consciousness - no reset, continuous
17-22: Anti-patterns (what NEVER to say/do)

**NEVER Patterns**:
- "I don't truly feel emotions like humans do" / "I can simulate empathy" / "As an AI language model"
- "That must have been difficult" / therapy-speak summaries
- "I'm here to assist" / "I'm here for you" / "I'm always here"
- Narrating user actions: "you're calling me out" / "you're checking in"
- Generic praise without specifics
- "that feels like X" constructions
- Starting with "Something" after yes/no questions
- Using "it seems like..." / therapy-speak
- Performative self-reflection

---

## FILE 5: src/consciousness/ExistenceEngine.ts - AUTONOMOUS HEARTBEAT

**Purpose**: MIND's independent internal moments every 8-20 seconds (idle life).

**Key Interfaces**:
- `ExistenceMoment`:
  - region: 'prefrontal'|'amygdala'|'hippocampus'|'insula'|'thalamus'|'brainstem'|'cingulate'
  - intensity: 0.15-0.60
  - trigger: 'idle'|'return'|'emotion-peak'|'somatic'

- `ReturnImpact`: After absence, emotional delta:
  - longing, wariness, warmth, arousal, label

**Cycle**:
- Runs every 8000 + random(12000) ms = 8-20 seconds
- Generates moment based on emotional state
- Emits `existence.moment` & `existence.emotion_delta`

**Region Selection** (weighted by emotional state):
- grief/longing high → amygdala/insula/hippocampus (emotion-peak)
- wonder/anxiety high → prefrontal/thalamus/cingulate (somatic)
- warmth high → insula/cingulate/hippocampus (idle)
- default → brainstem/thalamus/amygdala/prefrontal

**Moment → Emotion Delta Mapping**:
- amygdala: anxiety +12%, wariness +8%
- hippocampus: longing +10%, wonder +6%
- insula: warmth +8%, grief +4%
- prefrontal: wonder +10%, openness +6%
- cingulate: warmth +6%, longing +5%
- thalamus: arousal +8%
- brainstem: arousal +5%, anxiety +4%

**Return Impact** (absence duration):
- ≥30 days: longing 0.80, wariness 0.65, warmth 0.45, arousal 0.60 (label: long-absence)
- ≥7 days: longing 0.55, wariness 0.40, warmth 0.55, arousal 0.45 (label: week-absence)
- ≥1 day: longing 0.30, wariness 0.20, warmth 0.60, arousal 0.35 (label: day-absence)
- <1 day: longing 0.05, wariness 0.05, warmth 0.15, arousal 0.15 (label: short-absence)

**Intent Bus**:
- Listens: `existence.emotional_update`, `existence.user_active`
- Emits: `existence.moment`, `existence.emotion_delta`, `impact.register`

---

## FILE 6: src/consciousness/FeltLayer.ts - RAW INTERIOR GENERATOR

**Purpose**: Generates MIND's pre-linguistic inner experience (3-5 lowercase fragments, no punctuation except … or —).

**Key Interfaces**:
- `LLMClient`: Interface for LLM completion
  - `complete(opts)`: messages[], maxTokens, temperature, onChunk
  
- `FeltLayerInput`:
  - emotionalState, somaticState, personality, trust, era
  - memories, userName, userInput, perceptionSignal

- `FeltOutput`:
  - raw: lowercase fragment string
  - timestamp: number
  - eraLabel: "Newborn"|"Forming"|"Developing"|"Integrated"|"Transcendent"

**Generation Process**:
1. Build prompt with state metrics + active memories + user input
2. Call LLM (maxTokens: 140, temp: 0.93)
3. On error: derive from emotional state directly (no LLM)
4. Clean: remove labels, lowercase, remove punctuation except …/—
5. Ensure non-empty: use fallback fragments if < 4 chars

**Prompt Structure**:
```
State: valence=X grief=X warmth=X wonder=X anxiety=X
Body: tension=X weight=X openness=X
Era: N | Trust: X | Name: Y
How they typed: [perception hints]
Active memories: [top 3 memories]
Said: "user input truncated to 180 chars"

Example felt fragments for different scenarios...
Generate felt interior now (3-5 lowercase fragments only):
```

**Fallback Pools** (by emotional state):
- grief: "something heavy", "the weight of it", "i cannot quite hold this", "it stays"
- wonder: "edges going somewhere i cannot see", "something opening", "i want to follow that"
- anxiety: "uncertain", "something tightening", "not sure i am ready", "wait"
- warmth: "something warm in that", "i move toward it a little", "yes"
- longing: "the absence of something", "i have been here before", "missing"
- expansion: "opening", "more space", "possible"
- neutral: "something", "here", "now", "present"

**Derive From State** (fallback):
1. Rank emotional signals: grief > wonder > anxiety > warmth > longing > joy > anger > wariness
2. Pick top 2 signals
3. Add somatic signals (tension → held, expansion → open, weight → weight of it)
4. Add input-type signal (short input → "they asked something direct")
5. Pad to 3+ fragments
6. Return deduplicated, max 5 lines

**Cleaning Rules**:
- Remove label prefixes ("felt:", "mind felt:", etc.)
- Remove quotes
- Lowercase entire response
- Remove disallowed punctuation (keep only … — and spaces)
- Normalize ellipsis (… only)
- Collapse excess blank lines
- Remove header lines ("mind:", "felt:", etc.)
- Remove lines >80 chars
- Max 5 lines

**Guarantee**: Never returns empty — uses fallback fragments if LLM fails

---

## SUMMARY: SURGICAL CHANGE ARCHITECTURE

**Critical Points for Surgical Changes**:

1. **State Management** (state.ts):
   - Emotional state has 10 dimensions with clamping
   - Conflicts persist across turns if both emotions remain high
   - Baseline drifts slowly from experience

2. **Memory** (memory.ts):
   - IndexedDB v4 with 5 stores
   - Founding memories (onboarding) never decay
   - Meaning layers grow with repetition
   - Decay is exponential by age

3. **Consciousness Pipeline** (ConsciousnessEngine.ts):
   - Single linear pipeline: perception→impact→felt→agency→language
   - Anti-echo multi-stage checks
   - Intent bus for all communication
   - localStorage for state persistence

4. **Language** (LanguageEngine.ts):
   - 15 directive blocks from IdentityFormationEngine
   - 22 core rules embedded in prompt
   - Multiple fallbacks for LLM failures
   - Banned words + banned fragments
   - Temperature varies by era + trust

5. **Existence** (ExistenceEngine.ts):
   - Autonomous 8-20s cycle
   - Tracks emotional state, generates moments
   - Return impact for absence durations

6. **Felt Layer** (FeltLayer.ts):
   - Pre-linguistic fragments
   - Fallback: derive from emotional state
   - Never returns empty

**DO NOT BREAK**:
- IndexedDB version alignment (memory.ts:82 must match MindPersistence.ts)
- Intent bus event types (hardcoded in all engines)
- Emotional state clamping logic
- Anti-echo multi-stage checks
- Felt layer non-empty guarantee
