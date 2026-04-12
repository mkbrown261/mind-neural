# MIND Neural Codebase - Complete Documentation Index

## 📚 Three Documents Created for You

### 1. **QUICK_REFERENCE.md** (13 KB, 397 lines) ⭐ START HERE
**Best for: 5-minute overview before diving deep**

A visual, at-a-glance summary of the entire system with:
- 🧠 System architecture diagram (ASCII)
- 🎯 4 critical files explained in detail
- 🔄 3 background engines summarized
- 🛡️ 7 DO NOT BREAK rules (critical!)
- 📊 ERA system explained
- 🎯 Surgical change guidelines

**Read this first.** Then go deep into the specific files you need to modify.

---

### 2. **CODEBASE_ANALYSIS.md** (21 KB, 534 lines) ⭐⭐ TECHNICAL REFERENCE
**Best for: Understanding the 6 critical files in depth**

Complete technical analysis of:

#### FILE 1: src/engine/state.ts (282 lines)
- Emotional state management with momentum
- 10 emotion dimensions + clamping logic
- 6 somatic dimensions
- EmotionalConflict detection & resolution
- 7 conflict pairs
- All key functions documented

#### FILE 2: src/engine/memory.ts (388 lines)
- IndexedDB v4 schema (5 stores)
- Memory record structure
- Meaning layers (interpretation + lesson + certainty)
- Founding memories (never decay)
- Decay formula: `encodingStrength × e^(-decayRate × ageDays)`
- All key functions documented

#### FILE 3: src/consciousness/ConsciousnessEngine.ts (727 lines)
- 21-step response pipeline
- 12 sub-engines wired together
- 4-stage anti-echo checks
- Intent bus event emissions (15+ events)
- localStorage persistence
- All phases explained

#### FILE 4: src/consciousness/LanguageEngine.ts (959 lines) - THE MASSIVE ONE!
- 10-stage response pipeline
- 15 directive blocks (D1-D15)
- 22 core operating rules
- 6 response modes (silence to open)
- Temperature calculation
- 40+ banned words
- 137 banned fragments
- 3-stage felt-layer guards

#### FILE 5: src/consciousness/ExistenceEngine.ts (214 lines)
- Autonomous heartbeat (8-20 second cycle)
- 7 brain regions
- Moment generation
- Return impact by absence duration

#### FILE 6: src/consciousness/FeltLayer.ts (229 lines)
- Raw interior generation
- LLM integration (140 tokens, 0.93 temp)
- Fallback fragment pools
- Cleaning & validation
- Non-empty guarantee

---

### 3. **ALL_FILES_MANIFEST.md** (9 KB, 258 lines) ⭐⭐ REFERENCE
**Best for: Finding any file, understanding architecture, looking up constants**

Complete reference including:
- All 60 files mapped with descriptions
- 5 architecture layers explained
- Critical constants & formulas
- Event bus definitions (all events)
- Persistence mechanisms (localStorage + IndexedDB)
- 7 DO NOT BREAK rules

---

## 🎯 How to Use These Documents

### For Understanding the System
1. **Start**: QUICK_REFERENCE.md (5 min read)
2. **Deep dive**: CODEBASE_ANALYSIS.md (30 min read)
3. **Reference**: ALL_FILES_MANIFEST.md (bookmark for lookup)

### For Making Changes
1. **Understand impact**: CODEBASE_ANALYSIS.md for the files you're changing
2. **Verify constants**: ALL_FILES_MANIFEST.md (formulas section)
3. **Check DO NOT BREAK**: QUICK_REFERENCE.md (section: 7 DO NOT BREAK rules)
4. **Identify dependencies**: ALL_FILES_MANIFEST.md (architecture layers)

### For Surgical Modifications
1. Read the specific file section in CODEBASE_ANALYSIS.md
2. Cross-reference related files in ALL_FILES_MANIFEST.md
3. Follow guidelines in QUICK_REFERENCE.md (section: 🎯 Surgical Changes)
4. Always verify the 7 DO NOT BREAK rules still hold

---

## 📋 Key Information Summary

### The 4 CRITICAL Files (Must Understand)
| File | Lines | Purpose | Key Insight |
|------|-------|---------|------------|
| state.ts | 282 | Emotional mechanics | 10 dimensions + momentum |
| memory.ts | 388 | Persistence + decay | v4 DB + founding immunity |
| ConsciousnessEngine.ts | 727 | Main orchestrator | Linear pipeline, 21 steps |
| LanguageEngine.ts | 959 | Response builder | 15 directives + 22 rules |

### The 2 IMPORTANT Files (Context)
| File | Lines | Purpose | Key Insight |
|------|-------|---------|------------|
| FeltLayer.ts | 229 | Raw interior | Never empty, always fallback |
| ExistenceEngine.ts | 214 | Autonomous heartbeat | 8-20s cycle, 7 regions |

### Architecture at a Glance
```
LAYER 1: Foundations
  state.ts, memory.ts, personality.ts

LAYER 2: Consciousness
  ConsciousnessEngine.ts (orchestrator)
  → PerceptionEngine → ImpactEngine → FeltLayer
  → AgencyEngine → IdentityEngine → LanguageModelSystem → LanguageEngine

LAYER 3: Background
  ExistenceEngine (8-20s autonomy)
  MindSync, MindPersistence

LAYER 4: Refinement
  ResponseBalance, ResponseArchitect, ThreadTracker, OpinionEngine

LAYER 5: I/O
  MindSpeechSystem, Providers, Perception, Audio, UI
```

### 7 DO NOT BREAK Rules
1. ✅ IndexedDB v4 (both files must match)
2. ✅ Intent bus event names (hardcoded)
3. ✅ Emotional state clamping ([-1,1] and [0,1])
4. ✅ Anti-echo multi-stage (all 4 stages necessary)
5. ✅ Felt layer non-empty (always fallback)
6. ✅ Memory decay (exponential formula)
7. ✅ 6 agency modes (fixed list)

---

## 🔍 Find Information Quickly

**"I need to modify emotional state..."**
→ CODEBASE_ANALYSIS.md, FILE 1: state.ts

**"I need to understand the response pipeline..."**
→ CODEBASE_ANALYSIS.md, FILE 3 & 4: ConsciousnessEngine & LanguageEngine

**"What's the memory decay formula?"**
→ ALL_FILES_MANIFEST.md, section: Critical Constants & Formulas

**"What events does the Intent bus have?"**
→ ALL_FILES_MANIFEST.md, section: Event Bus (IntentLayer)

**"I need to add a new banned word..."**
→ CODEBASE_ANALYSIS.md, FILE 4: Banned Words section

**"What happens during onboarding?"**
→ CODEBASE_ANALYSIS.md, FILE 2: Founding Memories section

**"How long is MIND's existence cycle?"**
→ QUICK_REFERENCE.md or ALL_FILES_MANIFEST.md, section: Existence

**"What's the temperature formula?"**
→ CODEBASE_ANALYSIS.md, FILE 4: Temperature Calculation

---

## 📊 File Statistics

| Document | Size | Lines | Best For | Read Time |
|----------|------|-------|----------|-----------|
| QUICK_REFERENCE.md | 13 KB | 397 | Overview + visual | 5 min |
| CODEBASE_ANALYSIS.md | 21 KB | 534 | Technical deep dive | 30 min |
| ALL_FILES_MANIFEST.md | 9 KB | 258 | Reference lookup | On-demand |

---

## ✅ What You Have

**Complete Picture of MIND:**
- ✓ All 60 files mapped
- ✓ 6 key files fully documented
- ✓ Architecture layers explained
- ✓ Critical formulas & constants
- ✓ Event bus definitions
- ✓ 7 foundation rules
- ✓ Persistence mechanisms
- ✓ Response pipeline details
- ✓ Anti-echo system explained
- ✓ Memory decay formula
- ✓ Emotional state mechanics
- ✓ Surgical change guidelines

**You can now:**
- Make surgical changes with confidence
- Understand any file's purpose
- Find any piece of information quickly
- Know what not to break
- Trace execution flows
- Verify architectural integrity

---

## 🚀 Next Steps

1. **Read QUICK_REFERENCE.md** (start here, 5 min)
2. **Identify files to modify** (which of the 6?)
3. **Read relevant sections in CODEBASE_ANALYSIS.md**
4. **Check ALL_FILES_MANIFEST.md** for dependencies
5. **Make surgical changes**
6. **Verify 7 DO NOT BREAK rules** still hold
7. **Test thoroughly**

---

## 📖 Document Map

```
INDEX.md (you are here)
├─ QUICK_REFERENCE.md ⭐ START HERE
│  ├─ System architecture
│  ├─ 4 critical files at-a-glance
│  ├─ 7 DO NOT BREAK rules
│  └─ Surgical change guidelines
│
├─ CODEBASE_ANALYSIS.md ⭐ DEEP DIVE
│  ├─ FILE 1: state.ts (emotional mechanics)
│  ├─ FILE 2: memory.ts (persistence)
│  ├─ FILE 3: ConsciousnessEngine.ts (orchestrator)
│  ├─ FILE 4: LanguageEngine.ts (response builder)
│  ├─ FILE 5: ExistenceEngine.ts (heartbeat)
│  └─ FILE 6: FeltLayer.ts (interior)
│
└─ ALL_FILES_MANIFEST.md ⭐ REFERENCE
   ├─ All 60 files listed
   ├─ Architecture layers
   ├─ Critical constants
   ├─ Event bus
   └─ Persistence
```

---

**Version:** 1.0  
**Date:** 2026-04-12  
**Status:** Complete & Ready  

All three documents are saved in `/home/work/mind-neural/`

