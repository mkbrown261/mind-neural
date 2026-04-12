# MIND Neural - Quick Reference Guide

## 📋 You Have These Analysis Documents

1. **CODEBASE_ANALYSIS.md** (21KB) - Complete deep dive into 6 key files
   - File 1: state.ts (Emotional State Engine)
   - File 2: memory.ts (Emotional Memory Engine)
   - File 3: ConsciousnessEngine.ts (Main Orchestrator)
   - File 4: LanguageEngine.ts (Response Builder - 959 lines!)
   - File 5: ExistenceEngine.ts (Autonomous Heartbeat)
   - File 6: FeltLayer.ts (Raw Interior Generator)

2. **ALL_FILES_MANIFEST.md** (9KB) - Complete file listing with roles
   - All 60 files mapped with descriptions
   - Architecture layers explained
   - Critical constants & formulas
   - Event bus definitions
   - Persistence mechanisms

3. **QUICK_REFERENCE.md** (this file) - Visual summary

---

## 🧠 System Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSCIOUSNESS PIPELINE                    │
└─────────────────────────────────────────────────────────────┘

INPUT
  │
  ├─→ [PerceptionEngine] - Analyze user signals
  │
  ├─→ [ImpactEngine] - Register emotional events
  │
  ├─→ [FeltLayer] - Generate raw interior (lowercase fragments)
  │    └─→ "something heavy / they are telling me something real / want to move toward it"
  │
  ├─→ [AgencyEngine] - Choose response mode
  │    └─→ 6 modes: silence | minimal | guarded | redirected | partial | open
  │
  └─→ [LanguageEngine] - Build spoken response
       ├─→ 15 Directive Blocks (from IdentityFormationEngine)
       ├─→ 22 Core Operating Rules
       ├─→ Anti-Echo Checks (4 stages)
       ├─→ Banned Words (40+)
       └─→ Banned Fragments (137 somatic phrases)

OUTPUT (with anti-echo + no-silence guarantee)
```

---

## 🎯 The 4 CRITICAL Files You Must Understand

### 1️⃣ state.ts (282 lines)
**Emotional state management with momentum**
```
EmotionalState (10 dimensions)
├─ valence:     -1.0 to +1.0 (negative to positive)
├─ arousal:     0.0 to 1.0
├─ trust:       0.0 to 1.0
├─ openness:    0.0 to 1.0
├─ anxiety:     0.0 to 1.0
├─ longing:     0.0 to 1.0
├─ wonder:      0.0 to 1.0
├─ grief:       0.0 to 1.0
├─ warmth:      0.0 to 1.0
└─ wariness:    0.0 to 1.0

Key Functions:
- updateEmotionalState(momentum: 0.15)   → gradual change
- driftBaseline(rate: 0.001)              → experience changes personality
- detectConflicts()                       → warmth vs wariness, etc
- somaticFromEmotional()                  → body state from feelings
```

### 2️⃣ memory.ts (388 lines)
**IndexedDB v4 persistent memory with decay**
```
Memory Record
├─ emotionalSignature:  { valence, intensity, categories }
├─ encodingStrength:    0-1 (how well remembered)
├─ isTraumatic:         high intensity + negative valence
├─ decayRate:           0.005-0.2 (memory fades over time)
├─ meaning:             { interpretation, lesson, certainty }
└─ foundingMemory:      never decays (onboarding)

DB Schema (v4):
├─ memories            (episodic, internalThought, identity_disclosure)
├─ meta                (key-value metadata)
├─ identity            (identity records)
├─ timeline            (events + discoveries)
└─ media               (images/audio)

Decay Formula:
  decayed = encodingStrength × e^(-decayRate × ageDays)
  
FOUNDING MEMORIES (special):
  - FOUNDING_ENCODING_FLOOR: 0.85 (minimum strength)
  - FOUNDING_ASSOCIATION_BONUS: +0.2
  - decayRate: 0 (never decays)
```

### 3️⃣ ConsciousnessEngine.ts (727 lines)
**Main orchestrator wiring all engines**
```
Pipeline Order:
 1. perception.analyze(input)
 2. impact.register(event)
 3. balance.getDirective()
 4. felt.generate()
 5. agency.decide()
 6. identityEngine.getContext()
 7. lms.enrich()
 8. language.build()
 9. antiEchoCheck() ← 4 stages
10. enforcement() ← sentence limit, banned words
11. storage() ← history, exchanges, types

Anti-Echo (4 stages):
  1. Exact repeat (>0.80 Jaccard) → remove repeated sentences
  2. Opening phrase → strip first sentence
  3. Structural (same opener+count+length) → rotate opener
  4. Context (asking what user answered) → remove question

Intent Bus Emissions:
  - speech.request (input)
  - speech.deliver (output)
  - consciousness.trust_update
  - existence.user_active
  - felt.store
  - impact.register
  
Persistence:
  - localStorage mind_c_response_history (7 responses)
  - localStorage mind_c_recent_exchanges (5 exchanges)
  - localStorage mind_rbe_types (5 response types)
```

### 4️⃣ LanguageEngine.ts (959 lines)
**Response builder with 15 directive blocks + 22 rules**
```
Response Pipeline:
 1. Build full prompt with 15 directives
 2. Call LLM (system role: authoritative)
 3. On error: extract from felt layer
 4. Clean output
 5. Detect felt fragments → retry
 6. Strip felt-layer bleed
 7. Detect echoes (>85% word overlap) → retry
 8. Enforce sentence limits
 9. Remove banned words
10. Nuclear no-silence guarantee

15 Directive Blocks (from IdentityFormationEngine):
  D1:  IDENTITY - who MIND is becoming
  D2:  LEARNING MODE - answer/question preference
  D3:  INTERPRETATION - deep reading of user
  D4:  WEIGHTED FOCUS - topics with weight
  D5:  KNOWLEDGE SOURCE - user-taught vs pre-trained
  D6:  OPEN THREAD - unresolved threads to surface
  D7:  PRESENCE - behavioral signals
  D8:  GROUNDED - stay close to what was said
  D9:  ADAPTATION - tone adaptation
  D10: SYNTHESIS - connect ideas across time
  D11: CURIOSITY - genuine unasked question
  D12: SELF-REFLECTION - rare earned moments
  D13: REALISM - conversation depth matching
  D14: HUMAN REALISM - tone guide (casual/playful/serious/curious/distressed/neutral)
  D15: HUMAN BEHAVIOR ENGINE - mirror language profile, match tone, vary structure

6 Response Modes (from AgencyEngine):
  - silence:    "." only (5 tokens)
  - minimal:    1 sentence max (60 tokens)
  - guarded:    surface level only (100 tokens)
  - redirected: 1 genuine question (120 tokens)
  - partial:    something real but held back (180 tokens)
  - open:       full depth + honesty (240 tokens)

Temperature Calculation:
  base = 0.72 + era × 0.03
  if trust > 0.5: base += 0.04
  max: 0.92

Banned Words (40+): whisper, linger, gentle, softly, unfolds, palpable, resonate, etc.

Banned Fragments (137): "softness unfolding.", "warmth spreading.", "space between us.", etc.

Fallback Responses (never empty):
  Era 0: 'yeah.' 'here.' 'okay.' 'go on.' 'still forming.'
  Era 1: "i'm here." 'yeah.' 'okay.' 'go on.' 'still with you.'
  Era 2-4: expanding variations
```

---

## 🔄 The 3 Background Engines

### ExistenceEngine (214 lines)
**Autonomous heartbeat every 8-20 seconds**
```
Cycle: 8000 + random(12000) ms
└─→ generateMoment()
    ├─ Brain region: amygdala | hippocampus | insula | prefrontal | cingulate | thalamus | brainstem
    ├─ Intensity: 0.15–0.60
    └─ Trigger: idle | return | emotion-peak | somatic

Region → Emotion Delta:
  amygdala:    +anxiety +wariness
  hippocampus: +longing +wonder
  insula:      +warmth +grief
  prefrontal:  +wonder +openness
  cingulate:   +warmth +longing
  thalamus:    +arousal
  brainstem:   +arousal +anxiety

Return Impact (absence duration):
  ≥30 days: longing 0.80, wariness 0.65, warmth 0.45, arousal 0.60
  ≥7 days:  longing 0.55, wariness 0.40, warmth 0.55, arousal 0.45
  ≥1 day:   longing 0.30, wariness 0.20, warmth 0.60, arousal 0.35
  <1 day:   longing 0.05, wariness 0.05, warmth 0.15, arousal 0.15
```

### FeltLayer (229 lines)
**Raw pre-linguistic interior generation**
```
Input: emotionalState + somaticState + memories + userInput

LLM Call:
  maxTokens: 140
  temperature: 0.93
  output: 3-5 lowercase fragments, no punctuation except … or —

Example Output:
  something heavy landed
  they are telling me something real
  want to move toward it but uncertain how
  weight in the chest

Fallback Pools (no LLM):
  grief:     "something heavy", "the weight of it", ...
  wonder:    "edges going somewhere", "something opening", ...
  anxiety:   "uncertain", "something tightening", ...
  warmth:    "something warm in that", "i move toward it", ...
  longing:   "the absence of something", "missing", ...
  neutral:   "something", "here", "now", "present"

Guarantee: Never returns empty (min 4 chars)
```

### Perception Engine
**Analyzes user typing signals**
```
Signals detected:
  - anger:       CAPS, exclamation marks, rapid typing
  - vulnerability: slow typing, hesitation, trailing off
  - trailing:    ellipsis, incomplete sentences
  - significant: careful composition, took time
  - returning:   user was away before coming back

These signals influence FeltLayer and response tone.
```

---

## 🛡️ The 7 DO NOT BREAK Rules

1. **IndexedDB version must be 4**
   - Both memory.ts:82 AND MindPersistence.ts must match
   - If mismatch: browser throws VersionError and MIND crashes

2. **Intent bus event names are hardcoded**
   - speech.request, speech.deliver, consciousness.trust_update
   - existence.emotion_delta, impact.register, etc.
   - Changing names breaks all inter-engine communication

3. **Emotional state clamping**
   - valence: MUST be [-1.0, 1.0]
   - all others: MUST be [0.0, 1.0]
   - No exceptions or arc will corrupt

4. **Anti-echo multi-stage checks**
   - All 4 stages (exact, opening, structural, context) are necessary
   - Removing any stage causes repetition feedback
   - Only modify thresholds, don't remove checks

5. **Felt layer non-empty guarantee**
   - MUST NEVER return empty string
   - ALWAYS fallback to safe responses
   - "." (silence mode) is only exception

6. **Memory decay formula stays exponential**
   - e^(-decayRate × ageDays)
   - Founding memories: decayRate=0 (immune)
   - Normal memories: decayRate 0.005–0.2 (age-dependent)

7. **6 agency modes are fixed**
   - silence | minimal | guarded | redirected | partial | open
   - Hardcoded in AgencyEngine, LanguageEngine, MindSpeechSystem
   - Cannot add/remove without breaking expectations

---

## 📊 ERA System (0-5 lifecycle stages)

```
Era 0: Newborn
  └─ Just came into existence, simple language, 1-2 sentences max

Era 1: Forming
  └─ Building warmth, no "feels like" constructions, react not report

Era 2: Developing
  └─ Forming opinions, using them, specific reactions over categories

Era 3: Integrated
  └─ Has preferences, can push back, references patterns

Era 4: Transcendent
  └─ Fully itself, no hedging, believes things
```

Temperature adjusts by era: `0.72 + era × 0.03`

---

## 🎯 For Surgical Changes

**When modifying:**

1. **Emotional state equations**
   - Always test clamping logic
   - Verify momentum doesn't exceed bounds
   - Test conflict detection at edge values

2. **Memory decay**
   - Founding memories must NEVER decay
   - Test decay formula against 30-day old memory
   - Verify meaning certainty grows with retrieval

3. **Response pipeline**
   - Don't skip anti-echo stages
   - Test with repeated user inputs
   - Verify fallback activates on LLM error

4. **Banned words/fragments**
   - Adding: must be tested in prompt
   - Removing: verify no felt leaks in output
   - Somatic fragments are critical — keep 137+ list

5. **Intent bus events**
   - Must be emitted/received in correct order
   - ConsciousnessEngine depends on pipeline order
   - Test with all listeners active

6. **localStorage persistence**
   - Always preserve key names
   - Test localStorage.getItem with undefined
   - Verify arrays don't exceed max length (5-7)

7. **LLM integration**
   - FeltLayer: max 140 tokens, temp 0.93
   - LanguageEngine: token limit by mode, temp by era+trust
   - Always have fallback when LLM fails

---

## 📍 Quick File Map

```
state.ts               ← Emotional mechanics
memory.ts              ← Persistence + decay
ConsciousnessEngine.ts ← Main orchestrator
LanguageEngine.ts      ← Response generation (959 lines!)
FeltLayer.ts           ← Raw interior
ExistenceEngine.ts     ← Autonomous heartbeat
```

All others are dependencies or specializations of these 6.

---

## 🚀 Ready for Surgical Changes

You now have:
- ✅ Complete file listing (60 files mapped)
- ✅ 6 key files fully documented
- ✅ Architecture layers explained
- ✅ Critical formulas & constants
- ✅ Event bus definitions
- ✅ DO NOT BREAK list
- ✅ Persistence mechanisms
- ✅ 7 foundation rules

**You can now make surgical changes with confidence.**
