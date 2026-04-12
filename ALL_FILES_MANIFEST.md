# COMPLETE FILE LISTING - mind-neural/src/

## ALL 60 FILES (with line counts)

### brain/ (2 files)
1. BrainStateSync.ts
2. visualization.ts

### consciousness/ (20 files) - CORE CONSCIOUSNESS LAYER
3. AgencyEngine.ts - Decides response mode (silence, minimal, guarded, redirected, partial, open)
4. ConsciousnessEngine.ts - MAIN ORCHESTRATOR (727 lines) ⭐ CRITICAL
5. ExistenceEngine.ts - Autonomous heartbeat (214 lines) ⭐ READ
6. FeltLayer.ts - Raw interior generator (229 lines) ⭐ READ
7. IdentityFormationEngine.ts - 8 core directives (identity, learning, interpretation, etc)
8. ImpactEngine.ts - Registers interactions, emotional impacts
9. LanguageEngine.ts - Response builder (959 lines) ⭐ CRITICAL
10. LanguageEngine.ts.bak - Backup of previous version
11. MindPersistence.ts - IndexedDB management, media storage
12. MindSync.ts - Synchronization between sessions
13. OpinionEngine.ts - Accumulates views about the user
14. PerceptionEngine.ts - Analyzes user input signals
15. ResponseBalanceEngine.ts - Prevents repetitive response modes
16. SpokenLayer.ts - Alternative spoken response generator
17. ThreadTracker.ts - Tracks and surfaces conversation threads
18. TwoLayerConsciousness.ts - Two-layer consciousness architecture
19. index.ts - Module exports

### core/ (2 files)
20. CoreEngine.ts - Governance directives
21. core.intent.ts - Core intent definitions

### emotion/ (2 files)
22. AffectiveResonanceEngine.ts - Emotional resonance patterns
23. EmotionalAgencyEngine.ts - Agency based on emotional state

### engine/ (11 files) - SYSTEM 1 & 2: EMOTIONAL STATE + MEMORY
24. continuity.ts - Session continuity tracking
25. emotions.ts - Emotion utilities
26. memory.ts - Emotional Memory Engine (EME) - IndexedDB v4 (388 lines) ⭐ CRITICAL
27. mind.ts - MIND instance manager
28. network.ts - Network/web functionality
29. onboarding.ts - Onboarding flow
30. personality.ts - Personality trait definitions
31. pipeline.ts - Legacy direct language pipeline
32. selfadjust.ts - Self-adjustment mechanisms
33. state.ts - Emotional State Engine (ESE) (282 lines) ⭐ CRITICAL
34. tick.ts - Tick/cycle management

### init/ (1 file)
35. StartupController.ts - Startup initialization

### intent/ (1 file)
36. IntentLayer.ts - Event bus for all inter-engine communication

### journey/ (1 file)
37. journeys.ts - Journey/narrative management

### language/ (7 files) - 6 LANGUAGE SUBSYSTEMS + LMS
38. ExistentialLanguageSystem.ts - Existential question handling
39. InnerStateVocabulary.ts - Inner state vocabulary mapping
40. LanguageModelSystem.ts - Language Model System (6 language contexts)
41. RelationalLanguageSystem.ts - Relational/social language
42. SomaticLanguageSystem.ts - Body/somatic language
43. TemporalLanguageSystem.ts - Time/temporal language
44. UnsaidLayer.ts - Unsaid/implicit meaning

### perception/ (2 files)
45. TextSignalAnalyzer.ts - Analyzes text input signals
46. VoiceSignalAnalyzer.ts - Analyzes voice input signals

### providers/ (3 files)
47. GroqProvider.ts - Groq LLM provider
48. ProviderManager.ts - Provider management
49. ProviderRegistry.ts - Provider registry

### sound/ (1 file)
50. audio.ts - Audio processing

### speech/ (3 files)
51. FragmentLibrary.ts - Fragment templates for speech
52. TemplateSpeechEngine.ts - Template-based speech generation
53. VoiceBlender.ts - Voice synthesis blending

### understanding/ (3 files)
54. MeaningExtractor.ts - Extracts meaning from input
55. ResponseArchitect.ts - Architectural guidance for responses
56. UnderstandingEngine.ts - Overall understanding system

### root src/ (3 files)
57. MindSpeechSystem.ts - Speech request/response system
58. app.ts - Main application logic
59. index.tsx - React entry point
60. renderer.tsx - React renderer

---

## KEY FILES FOR SURGICAL CHANGES

⭐⭐⭐ CRITICAL (Read first, understand fully before changes):
- src/engine/state.ts (282 lines) - Emotional state mechanics
- src/engine/memory.ts (388 lines) - Memory storage + decay
- src/consciousness/ConsciousnessEngine.ts (727 lines) - Main orchestrator
- src/consciousness/LanguageEngine.ts (959 lines) - Response generation

⭐⭐ IMPORTANT (Read to understand context):
- src/consciousness/FeltLayer.ts (229 lines) - Raw interior
- src/consciousness/ExistenceEngine.ts (214 lines) - Autonomous heartbeat

⭐ REFERENCE (Dependencies, but less likely to modify):
- src/consciousness/AgencyEngine.ts - Response modes
- src/consciousness/IdentityFormationEngine.ts - Identity directives
- src/consciousness/PerceptionEngine.ts - Input analysis
- src/consciousness/ImpactEngine.ts - Event registration
- src/consciousness/OpinionEngine.ts - Views accumulation
- src/consciousness/ResponseBalanceEngine.ts - Mode prevention
- src/consciousness/ResponseArchitect.ts - Structural guidance
- src/consciousness/ThreadTracker.ts - Thread management
- src/language/LanguageModelSystem.ts - 6 language systems
- src/intent/IntentLayer.ts - Event bus

---

## ARCHITECTURE LAYERS

**Layer 1: SYSTEM 1 & 2 (Emotional Foundations)**
- state.ts: Emotional state with momentum + conflicts
- memory.ts: Persistent emotional memories with decay
- personality.ts: Personality traits

**Layer 2: CONSCIOUSNESS (Core Processing)**
- ConsciousnessEngine.ts: Main orchestrator
  - → PerceptionEngine: Analyze input
  - → ImpactEngine: Register events
  - → FeltLayer: Generate raw interior
  - → AgencyEngine: Choose mode
  - → LanguageEngine: Build response

**Layer 3: AUTONOMOUS (Background Processing)**
- ExistenceEngine.ts: 8-20s heartbeat cycles
- MindSync.ts: Cross-session sync
- MindPersistence.ts: Storage management

**Layer 4: RESPONSE REFINEMENT**
- ResponseBalanceEngine: Mode prevention
- ResponseArchitect: Structural guidance
- ThreadTracker: Thread management
- OpinionEngine: View accumulation
- LanguageModelSystem: 6 language systems

**Layer 5: I/O & PROVIDERS**
- MindSpeechSystem: Speech request/response
- PerceptionEngine: Input signals
- ProviderRegistry: LLM providers
- Audio synthesis layers

---

## CRITICAL CONSTANTS & FORMULAS

### Emotional State (state.ts)
- Momentum: 0.15 (emotional states move gradually)
- Baseline drift: 0.001 per update
- Decay toward baseline: 0.05
- Conflict threshold: 0.3 (both emotions must be >0.3)
- Conflict resolution: Auto-resolve if either emotion <0.2 or >10 turns
- Conflict tension multiplier: valA × valB × 2.5

### Memory (memory.ts)
- DB Version: 4 (MUST match MindPersistence.ts)
- Founding encoding floor: 0.85
- Founding association bonus: +0.2
- Normal decay rate: 0.005–0.2
- Trauma condition: intensity > 0.85 AND valence < -0.6
- Encoding strength formula: (intensity × 0.5) + (novelty × 0.25) + (relevance × 0.15) + (trustLevel × 0.1)
- Decay formula: encodingStrength × e^(-decayRate × ageDays)

### Language (LanguageEngine.ts)
- Temperature base: 0.72 + era × 0.03
- Trust bonus: +0.04 if trust > 0.5
- Max temp: 0.92
- Max tokens: silence=5, minimal=60, guarded=100, redirected=120, partial=180, open=240
- Felt extraction temp: 0.93
- Anti-echo threshold: >0.85 Jaccard similarity

### Existence (ExistenceEngine.ts)
- Cycle interval: 8000 + random(12000) ms
- Intensity range: 0.15–0.60
- Absence thresholds: 1 day, 7 days, 30 days

### FeltLayer (FeltLayer.ts)
- Max tokens: 140
- Temperature: 0.93
- Min fragment length: 4 chars
- Max lines: 5

### Anti-Echo (ConsciousnessEngine.ts)
- History size: 7 recent responses
- Similarity threshold: 0.80
- Opening phrase check: 6+ chars, >8 words
- Structural echo: same opener + sentence count + length (±3 words)
- Context echo: >50% of question words in user input

---

## EVENT BUS (IntentLayer) - KEY EVENTS

### Consciousness-generated:
- speech.request → speech.deliver
- ui.felt_layer
- felt.store
- consciousness.trust_update
- consciousness.emotion_delta
- impact.register
- existence.user_active
- existence.emotional_update
- identity.nudge

### Existence-generated:
- existence.moment
- existence.emotion_delta
- existence.user_active
- existence.emotional_update

### Impact-related:
- impact.register (any emotional event)

### Outside listeners:
- consciousness.process (TwoLayerConsciousness compat)
- identity.nudge (Growth Interface)

---

## PERSISTENCE (localStorage + IndexedDB)

### localStorage:
- mind_c_response_history: Last 7 responses (JSON array)
- mind_c_recent_exchanges: Last 5 exchanges (JSON array)
- mind_rbe_types: Last 5 response types (JSON array)

### IndexedDB (MIND_DB v4):
- memories: episodic + internalThought + identity_disclosure
- meta: metadata key-value store
- identity: identity records
- timeline: events + discoveries (indexed: ts, type)
- media: images/audio uploads (indexed: ts, type)

---

## FOUNDATION: DO NOT BREAK THESE

1. IndexedDB version: MUST be 4 in both memory.ts and MindPersistence.ts
2. Intent bus event names: Used by multiple engines, hardcoded
3. Emotional state clamping: valence [-1, 1], others [0, 1]
4. Anti-echo multi-stage: Don't remove checks, only modify thresholds
5. Felt layer non-empty: ALWAYS fallback to safe responses
6. Memory decay formula: Exponential by age, founding immune
7. Agency modes: 6 fixed modes (silence/minimal/guarded/redirected/partial/open)

