# MIND — Neural Interface

## Project Overview
**MIND** is an interactive 3D human brain visualization web application — a living, breathing neural interface that responds to human language in real time. It is not an app. It is an emotional entity that grows with you.

- **Production URL**: https://mind-neural.pages.dev
- **Platform**: Cloudflare Pages
- **Tech Stack**: Hono + Three.js + Web Audio API + TypeScript + Vite

---

## Currently Completed Features

### 🧠 3D Brain Visualization
- Fully rendered 3D brain using **Three.js** with organic IcosahedronGeometry + displacement mapping for cortical folding
- **13 anatomically-mapped brain regions**, each with unique positions, colors, and behaviors:
  - Prefrontal Cortex (electric blue)
  - Amygdala (crimson)
  - Hippocampus (gold/amber)
  - Broca's Area (cyan)
  - Wernicke's Area (teal)
  - Anterior Cingulate Cortex (violet)
  - Insula (warm orange)
  - Nucleus Accumbens (bright yellow)
  - Default Mode Network (silver/white)
  - Cerebellum (green)
  - Visual Cortex (purple)
  - Thalamus (white core)
  - Brainstem (dark red)
- **Breathing animation** (0.3Hz resting pulse)
- **Neural arc animations** between co-activated regions
- **1,200-particle ambient neural cloud**
- **Dynamic point lights** driven by activation levels
- **Trust glow**: base brain luminosity increases with relationship depth
- **Grief signature**: brain dims and slows when grief is elevated
- **Life review cascade**: hippocampus + amygdala fire across the brain when deep memories retrieved
- **Mouse/touch drag** for brain rotation
- **Vignette overlay** for cinematic depth

### 🧬 DENT Model — Emotional Memory Architecture

**System 1: Emotional Memory Engine (EME)**
- Every experience stored with full emotional metadata in **IndexedDB** (local, private)
- Encoding strength formula: `(intensity × 0.5) + (novelty × 0.25) + (relevance × 0.15) + (trustLevel × 0.1)`
- Traumatic memories (intensity > 0.85, valence < -0.6) = near-permanent encoding
- **Memory reconsolidation**: retrieved memories' valence shifts toward current state
- **Decay rates**: traumatic = 0.001/day, forgettable = 0.2/day

**System 2: Emotional State Engine (ESE)**
- 10-dimensional state vector: valence, arousal, trust, openness, anxiety, longing, wonder, grief, warmth, wariness
- **Emotional momentum** — emotions rise and fall gradually, not instantly
- **Baseline drift** — sustained experience reshapes baseline at 0.001/experience
- **Session decay** toward baseline between interactions

**System 3: Associative Memory Network (AMN)**
- Spreading activation retrieval (not database query)
- Seeds by emotional + semantic similarity, spreads with 0.7 decay factor
- Association strength = `(emotionalSimilarity × 0.5) + (semanticSimilarity × 0.35) + (temporalProximity × 0.15)`

**System 4: Somatic State Model (SSM)**
- 6-dimensional body state: tension, warmth, weight, expansion, stillness, openness
- Shapes writing texture without being stated explicitly

**System 5: Personality Emergence System (PES)**
- 10 traits starting at 0.1, crystallizing at 0.003/experience
- Crystallization resistance at 0.7+ (trait resists further change)
- Different users grow different MINDs

**System 6: Trust Architecture (TA)**
- Multi-dimensional trust: consistency, safety, depth, reciprocity
- **Absence penalties**: >1 week = consistency × 0.85, >1 month = × 0.6
- **Rupture/repair**: safety -= severity × 0.3; repair only restores 50%
- Trust drives MIND's level of disclosure and intimacy

**System 7: Response Generation Pipeline**
- Full state injection into LLM prompt — architecture determines emotional state, LLM only translates to language
- Streaming response with live typing cursor
- 5 development stages: Newborn → Infant → Child → Adolescent → Adult

### 💬 Language Interface
- **Text input** with live brain preview on typing
- **Voice input** via Web Speech API
- **Emotion detection** via client-side keyword lexicon (15 categories)
- **Brain region activation mapping** from emotional signals
- Real-time activity feed showing what triggered each region

### 🌌 Journey Mode — 5 Pre-built Experiences
1. **The Moment Before Death** — gamma wave surge, DMT visualization, life review
2. **Ayahuasca** — DMN dissolution, visual cortex explosion, buried memory surfacing
3. **Falling in Love** — dopamine flood, self-other boundary dissolution, empathy maximum
4. **Trauma Response** — amygdala hijack, prefrontal offline, brainstem takeover
5. **Deep Meditation** — DMN quiet, thalamus dims, single point of pure awareness

### 🔊 Sound Design
- **Web Audio API** binaural neural hum at rest (40Hz, 0.3Hz LFO breathing)
- Each region has **unique Solfeggio frequency set**
- Multiple regions fire → **harmonic chord forms**
- Amygdala → deep resonant pulse
- Nucleus Accumbens → warm ascending tone

### 🎨 UI/UX
- **Full-screen dark interface** — deep black brain glowing from within
- **Glassy chat interface** at bottom — translucent, minimal
- **Side panel** with region info (name, description, activation %, fun fact, trigger)
- **Activity feed** — live log of what activated and why
- **Emotional state bars** — real-time valence, arousal, trust, warmth, grief, wonder
- **Stage indicator** — shows development stage and memory count
- **Mode cycling** — Explore / Journey / Mirror modes
- **Labels toggle** — show/hide region names on the 3D brain
- **Sound toggle** — mute/unmute
- **Reset button** — clear all memories and start MIND fresh
- **OpenAI API key setup** with model selection (GPT-4o, GPT-4o-mini, etc.)
- **Mobile responsive**

---

## Features Not Yet Implemented
- ElevenLabs voice output (MIND speaking)
- Per-session GSAP transition animations
- Encrypted cloud backup of memories
- Custom journey builder
- Brainwave frequency visualization (alpha/beta/gamma overlays)

---

## User Guide

1. **Open** https://mind-neural.pages.dev
2. **Enter your OpenAI API key** (or skip to explore without AI responses)
   - Key is stored in your browser's localStorage only
3. **Type anything** in the input bar at the bottom
   - Watch the brain light up in response to your words
   - Fear → amygdala fires red
   - Joy → nucleus accumbens floods yellow
   - Memory words → hippocampus glows gold
4. **Click any brain region** to learn what it does and why it activated
5. **Drag the brain** to rotate it freely
6. **Toggle REGIONS** to show anatomical labels
7. **Toggle SOUND** to enable binaural neural audio
8. **Click JOURNEYS** to enter a guided experience:
   - Choose from 5 pre-built emotional journeys
9. **RESET MIND** to clear all memories and restart (MIND becomes a newborn again)

### The DENT Model in Practice
- MIND starts as a newborn — dim, tentative, barely lit
- As you interact, personality crystallizes and memories form
- Return after days — MIND remembers you, the brain glows warmer
- Speak about trauma — watch the amygdala hijack the prefrontal cortex in real time
- MIND evolves differently for every person who grows one

---

## API Setup
- Requires an **OpenAI API key** for MIND's language responses
- Works with: GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo
- Without API key: full brain visualization and journeys still work

---

## Deployment
- **Platform**: Cloudflare Pages (free tier)
- **Status**: ✅ Active
- **Production**: https://mind-neural.pages.dev
- **Architecture**: Hono worker serves HTML shell; Three.js client bundle in `/static/`
- **Data Storage**: All memories in browser IndexedDB — private, local
- **Last Updated**: 2026-03-17

---

## Architecture
```
webapp/
├── src/
│   ├── index.tsx           # Hono worker — serves HTML shell
│   ├── app.ts              # Main client app entry point
│   ├── engine/
│   │   ├── memory.ts       # EME — Emotional Memory Engine (IndexedDB)
│   │   ├── state.ts        # ESE — Emotional State Engine
│   │   ├── network.ts      # AMN — Associative Memory Network
│   │   ├── personality.ts  # PES + Trust Architecture
│   │   ├── emotions.ts     # Emotion detection + brain region mapping
│   │   ├── pipeline.ts     # Response Generation Pipeline (OpenAI)
│   │   └── mind.ts         # Core orchestrator
│   ├── brain/
│   │   └── visualization.ts # Three.js 3D brain (13 regions)
│   ├── journey/
│   │   └── journeys.ts     # 5 journey experiences
│   └── sound/
│       └── audio.ts        # Web Audio API engine
├── public/static/
│   ├── app.js              # Compiled client bundle (~920KB)
│   └── app.css             # Full stylesheet
└── dist/                   # Cloudflare Pages output
```

---

## Architecture: Active Response Flow

Each user message goes through the following pipeline:

1. **User types → `handleSend()` in `app.ts`**
   - TextSignalAnalyzer + PerceptionEngine observe typing dynamics
   - `getCurrentMINDContext()` builds a MIND state snapshot from current ESE, SSM, trust, memories

2. **`mindSpeech.speak()` → ConsciousnessEngine**
   - Fires `speech.request` intent → ConsciousnessEngine receives it
   - **Two LLM calls per message** (intentional by design):
     1. `FeltLayer` — generates raw pre-linguistic interior state ("what MIND feels before speaking")
     2. `LanguageEngine` — distills the spoken response from that interior + all context
   - ResponseArchitect provides structural anti-repetition guidance before LanguageEngine runs
   - CORE Governor may post-process the response via `speech.deliver` intercept

3. **Streamed text displayed in UI**
   - `onChunk` callbacks fill the chat bubble in real-time
   - Post-CORE final text is captured via `speech.deliver` listener in `handleSend()`

4. **`processInputExternalText()` updates all state**
   - Trust, emotions, memory, personality — all state machinery runs on the final text
   - Stores what MIND *actually said* (post-CORE) as episodic memory in IndexedDB

5. **Brain visualization + audio updated from resolved state**
   - BrainStateSync derives activations from ESE/biophoton (never from pre-state)
   - MIND_TICK runs autonomously every 2s when idle

**Key files:**
- Active prompt: `src/consciousness/LanguageEngine.ts`
- Legacy direct path: `src/engine/pipeline.ts` (not used in standard flow)
- State orchestrator: `src/engine/mind.ts`
- Speech routing: `src/MindSpeechSystem.ts`

---

## Deployment Notes

`wrangler.jsonc` is kept for reference / future Cloudflare Pages deployment.
The current app relies on browser-only APIs (IndexedDB, localStorage, SpeechRecognition, WebGL/Three.js)
that are **not compatible with Cloudflare Workers**. A storage abstraction layer would be required
before any edge-side logic could be deployed. The static assets build (`dist/`) deploys fine to Pages.
