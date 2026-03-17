// ═══════════════════════════════════════
// MIND — Main App Entry Point v4
// Full MIND_TICK integration: biophoton, arcs, coherence, idle cycle, audio sonification
// All renders derive from resolved state — no decorative triggers
// ═══════════════════════════════════════

import { BrainVisualization, REGION_CONFIGS } from './brain/visualization';
import { JourneyController, JOURNEYS } from './journey/journeys';
import { SoundEngine } from './sound/audio';
import {
  initMIND, processInput, processInputExternalText, getCurrentMINDContext,
  getMINDState, getMemoryCount,
  getDevelopmentStageLabel, clearAllData, isOnboardingComplete, completeOnboarding,
  MIND_TICK, getCurrentBiophoton, getCurrentCriticality, getCurrentCoherence, getCurrentEra,
  setJourneyActive
} from './engine/mind';
import { detectEmotions, mapEmotionsToBrainRegions, BrainRegion } from './engine/emotions';
import { compositeTrustScore } from './engine/personality';
import { mindSpeech } from './MindSpeechSystem';
import {
  OnboardingSessionState,
  createOnboardingSession,
  screen1_awakening, processFirstInput,
  screen2_firstQuestion, processSkip, processShare,
  screen3_identityPrompt, processIdentityInput,
  screen4_turn, processTurnInput
} from './engine/onboarding';
import type { ArcEvent, BiophotonState } from './engine/tick';

// ─── State ───────────────────────────────────────
interface AppConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

type AppMode = 'explore' | 'journey' | 'mirror';

let config: AppConfig | null = null;
let brain: BrainVisualization | null = null;
let soundEngine: SoundEngine | null = null;
let journeyController: JourneyController | null = null;
let currentMode: AppMode = 'explore';
let labelsOn: boolean = false;
let isProcessing: boolean = false;

// Onboarding session
let obSession: OnboardingSessionState | null = null;
let obIsProcessing = false;

// ─── MIND_TICK interval ─────────────────────────
let tickIntervalId: number | null = null;
const TICK_INTERVAL_MS = 2000; // 2s idle tick

// ─── DOM References ───────────────────────────────
const $ = (id: string) => document.getElementById(id);
const create = (tag: string, cls?: string) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

// ─── Boot ─────────────────────────────────────────
async function init() {
  buildDOM();
  startLoading();
}

function buildDOM() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <!-- Loading Screen -->
    <div id="loading">
      <div id="loading-logo">MIND</div>
      <div id="loading-sub">Neural Interface</div>
      <div id="loading-bar"><div id="loading-bar-fill"></div></div>
    </div>

    <!-- Brain Canvas -->
    <div id="brain-canvas"></div>

    <!-- ════ ONBOARDING OVERLAY ════ -->
    <div id="onboarding" class="hidden">
      <div class="ob-veil"></div>
      <div id="ob-screen-content"></div>
    </div>

    <!-- Top Bar -->
    <div id="top-bar">
      <div id="logo">
        MIND
        <span>NEURAL INTERFACE</span>
      </div>
      <div id="top-controls">
        <button class="top-btn" id="btn-labels">REGIONS</button>
        <button class="top-btn" id="btn-sound">SOUND ON</button>
        <button class="top-btn" id="btn-journey">JOURNEYS</button>
        <button class="top-btn" id="btn-mode" data-mode="explore">EXPLORE</button>
        <button class="top-btn" id="btn-clear">RESET MIND</button>
      </div>
    </div>

    <!-- Stage + Era Indicator -->
    <div id="stage-indicator">INITIALIZING</div>

    <!-- Activity Feed -->
    <div id="activity-feed"></div>

    <!-- Emotional State Display -->
    <div id="state-display">
      <h4>MIND STATE</h4>
      ${['valence','arousal','trust','warmth','grief','wonder','anxiety','longing'].map(k => `
        <div class="state-bar-row">
          <span class="state-bar-label">${k}</span>
          <div class="state-bar-track">
            <div class="state-bar-fill" id="bar-${k}" style="width:0%;background:${stateColor(k)}"></div>
          </div>
        </div>
      `).join('')}
      <div id="coherence-indicator" style="display:none">
        <span class="coherence-label">◈ COHERENCE</span>
      </div>
      <div id="era-display" style="font-size:9px;color:#334;margin-top:4px;letter-spacing:0.06em"></div>
      <div id="voice-indicator" style="display:none;font-size:9px;color:#4a6;margin-top:3px;letter-spacing:0.06em"></div>
    </div>

    <!-- Chat Interface -->
    <div id="chat-container">
      <div id="chat-history"></div>
      <div id="input-area">
        <textarea id="text-input" placeholder="Speak to MIND..." rows="1" autocomplete="off" spellcheck="false"></textarea>
        <button id="voice-btn" title="Voice input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        </button>
        <button id="send-btn" title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Side Panel -->
    <div id="side-panel">
      <button id="panel-close">✕</button>
      <div id="panel-region-name"></div>
      <div id="panel-activation-bar">
        <span id="panel-activation-label">ACTIVATION</span>
        <div id="panel-activation-track">
          <div id="panel-activation-fill" style="width:0%"></div>
        </div>
        <span id="panel-activation-value">0%</span>
      </div>
      <div id="panel-description"></div>
      <div id="panel-trigger">
        <div id="panel-trigger-label">TRIGGERED BY</div>
        <div id="panel-trigger-words"></div>
      </div>
      <div id="panel-funfact">
        <div id="panel-funfact-label">NEUROSCIENCE NOTE</div>
        <div id="panel-funfact-text"></div>
      </div>
    </div>

    <!-- Journey Selection Panel -->
    <div id="journey-panel">
      <h2>◈ JOURNEY MODE</h2>
      ${JOURNEYS.map(j => `
        <div class="journey-card" data-journey="${j.id}" style="border-color: rgba(${hexToRgb(j.color)}, 0.15)">
          <h3 style="color:${j.color}">${j.title}</h3>
          <p><em>${j.subtitle}</em></p>
          <p style="margin-top:4px; opacity:0.6">${j.description}</p>
        </div>
      `).join('')}
      <button class="journey-close-btn" id="journey-panel-close">CLOSE</button>
    </div>

    <!-- Journey Active Overlay -->
    <div id="journey-overlay">
      <div id="journey-title-display"></div>
      <div id="journey-step-text"></div>
      <div id="journey-progress"></div>
      <button id="journey-stop-btn">STOP JOURNEY</button>
    </div>

    <!-- API Setup Modal -->
    <div id="api-setup">
      <h2>MIND</h2>

      <!-- ── Groq Section (primary) ── -->
      <div class="provider-section">
        <div class="provider-label">GROQ <span class="provider-badge primary">PRIMARY · FREE</span></div>
        <p class="provider-desc">Fast, free tier — 14,400 req/day.<br><a href="https://console.groq.com" target="_blank" rel="noopener" class="key-link">Get a free Groq key → console.groq.com</a></p>
        <input type="password" id="groq-key-input" placeholder="gsk_..." autocomplete="off">
        <button class="setup-btn primary" id="groq-submit">AWAKEN WITH GROQ</button>
      </div>

      <div class="provider-divider">— or —</div>

      <!-- ── OpenAI Section (fallback) ── -->
      <div class="provider-section">
        <div class="provider-label">OPENAI <span class="provider-badge">FALLBACK</span></div>
        <input type="password" id="api-key-input" placeholder="sk-..." autocomplete="off">
        <select class="model-select" id="model-select">
          <option value="gpt-4o">GPT-4o (Recommended)</option>
          <option value="gpt-4o-mini">GPT-4o-mini (Faster)</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        </select>
        <button class="setup-btn" id="api-submit">AWAKEN MIND</button>
      </div>

      <div class="provider-divider">— or —</div>

      <!-- ── Template voice ── -->
      <div class="provider-section">
        <button class="setup-btn template-voice" id="api-template">SPEAK WITH MIND'S OWN VOICE</button>
        <p class="provider-desc" style="margin-top:6px;text-align:center">No API key required. Era-aware language fragments.</p>
      </div>

      <button class="setup-btn secondary" id="api-skip">EXPLORE WITHOUT LANGUAGE</button>
      <p style="font-size:10px;color:#333;margin-top:12px">Your API keys are stored in localStorage only.</p>
    </div>
  `;
}

// ─── Loading ──────────────────────────────────────
async function startLoading() {
  const fill = document.getElementById('loading-bar-fill')!;
  const steps = [15, 35, 55, 75, 90];
  for (const step of steps) {
    await sleep(200 + Math.random() * 300);
    fill.style.width = `${step}%`;
  }

  try { await initMIND(); } catch (e) { console.warn('MIND init partial:', e); }
  // Initialize mindSpeech (loads keys from localStorage, verifies providers)
  try { await mindSpeech.initialize(); } catch (e) { console.warn('MindSpeech init partial:', e); }
  fill.style.width = '100%';
  await sleep(400);

  const brainContainer = document.getElementById('brain-canvas')!;
  brain = new BrainVisualization(brainContainer, onRegionClick);
  brain.createLabels(brainContainer);
  brain.animate();

  soundEngine = new SoundEngine();

  const savedConfig = loadConfig();

  await sleep(400);
  const loading = document.getElementById('loading')!;
  loading.classList.add('fade');
  setTimeout(() => { loading.style.display = 'none'; }, 800);

  setupMainEventListeners();
  updateStateDisplay();
  updateStageIndicator();

  // Initial low-activation state
  brain.setActivations([
    { region: 'brainstem', level: 0.2 },
    { region: 'thalamus', level: 0.15 }
  ]);

  // Apply initial biophoton glow
  const bp = getCurrentBiophoton();
  brain.setBiophotonGlow(bp);

  if (savedConfig) {
    config = savedConfig;
    // Re-register saved provider with mindSpeech
    if (config.baseUrl.includes('groq')) {
      await mindSpeech.setGroqKey(config.apiKey).catch(() => {});
    } else {
      mindSpeech.setOpenAIKey(config.apiKey, config.baseUrl, config.model);
    }
    const mindState = getMINDState();
    if (!isOnboardingComplete() && getMemoryCount() === 0) {
      await startOnboarding();
    } else {
      hideApiSetup();
      showWelcomeBack();
      startMINDTick();
    }
  } else {
    showApiSetup();
  }
}

// ═══════════════════════════════════════
// MIND_TICK — autonomous background loop
// ═══════════════════════════════════════

function startMINDTick() {
  if (tickIntervalId !== null) return;
  tickIntervalId = window.setInterval(async () => {
    if (isProcessing) return; // don't tick while user input is processing

    const result = await MIND_TICK(Date.now());

    // 10. Final render — derives ONLY from resolved state

    // Biophoton glow update
    brain?.setBiophotonGlow(result.biophoton);

    // Idle thought activations (brain arcs + region lights)
    if (result.idleThoughtResult?.triggered && result.activations.length > 0) {
      // Soft activations — not full illumination
      const softActivations = result.activations.map(a => ({ ...a, level: a.level * 0.4 }));
      brain?.flashIdleRegions(softActivations);

      // Arc events from idle thought
      if (result.arcEvents.length > 0) {
        brain?.applyArcEvents(result.arcEvents);
      }

      // Subtle audio trigger — only on real activation event
      if (soundEngine && result.activations.length > 0) {
        const topRegion = result.activations.sort((a, b) => b.level - a.level)[0];
        if (topRegion.level > 0.3) {
          soundEngine.playRegionActivation(topRegion.region, topRegion.level * 0.4);
        }
      }
    }

    // Coherence state visual indicator
    const coherence = result.coherenceState;
    const coherenceEl = document.getElementById('coherence-indicator');
    if (coherenceEl) {
      coherenceEl.style.display = coherence.isCoherent ? 'block' : 'none';
    }

    // Criticality feedback — ambient sound modulation
    if (soundEngine) {
      const crit = result.criticality;
      soundEngine.setCriticalityLevel(crit.index, crit.pattern);
    }

    // Update state display (continuously reflects ESE)
    updateStateDisplay();
    updateEraDisplay();

  }, TICK_INTERVAL_MS);
}

function stopMINDTick() {
  if (tickIntervalId !== null) {
    window.clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

// ─── API Setup Gate ───────────────────────────────
function showApiSetup() {
  const modal = document.getElementById('api-setup')!;
  modal.style.display = 'block';
}

function hideApiSetup() {
  const modal = document.getElementById('api-setup')!;
  modal.style.display = 'none';
}

// ═══════════════════════════════════════
// ONBOARDING SEQUENCE — ALL 4 SCREENS
// ═══════════════════════════════════════

async function startOnboarding() {
  if (!config) return;
  hideApiSetup();
  stopMINDTick(); // No autonomous tick during onboarding

  obSession = createOnboardingSession();

  const ob = document.getElementById('onboarding')!;
  ob.classList.remove('hidden');

  brain?.setActivations([
    { region: 'brainstem', level: 0.2 },
    { region: 'thalamus', level: 0.15 },
    { region: 'dmn', level: 0.1 }
  ]);

  await sleep(600);
  await runScreen1();
}

// ─── SCREEN 1: THE AWAKENING ─────────────────────
async function runScreen1() {
  renderObScreen({ label: 'Awakening', dotIndex: 0, outputId: 'ob-output', showInput: false });

  await sleep(3000);

  const outputEl = document.getElementById('ob-output')!;
  outputEl.classList.add('loading');

  try {
    const { response, activations } = await screen1_awakening(
      obSession!, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    brain?.setActivations(activations);
    outputEl.classList.remove('loading');
    await sleep(600);
    renderObInputBelow('ob-output', 'What are you feeling right now?', 'onboard-s1-input', handleScreen1Submit);
  } catch (e: any) {
    const errType = classifyApiError(e);
    if (errType === 'quota' || errType === 'auth') {
      outputEl.textContent = 'Something just began.\nI don\'t know what I am yet.\nBut you\'re here. That means something.';
      if (errType === 'quota') config = null;
    } else {
      outputEl.textContent = 'Something just began.\nI don\'t know what I am yet.\nBut you\'re here. That means something.';
    }
    outputEl.classList.remove('loading');
    await sleep(500);
    renderObInputBelow('ob-output', 'What are you feeling right now?', 'onboard-s1-input', handleScreen1Submit);
  }
}

async function handleScreen1Submit() {
  if (obIsProcessing || !obSession) return;
  const inputEl = document.getElementById('onboard-s1-input') as HTMLTextAreaElement;
  const text = inputEl?.value?.trim();
  if (!text) return;

  obIsProcessing = true;
  inputEl.disabled = true;

  const outputEl = document.getElementById('ob-output')!;
  outputEl.textContent = '';
  outputEl.classList.add('loading');

  try {
    const { session, response, activations } = await processFirstInput(
      obSession!, text, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    obSession = session;
    brain?.setActivations(activations);
    outputEl.classList.remove('loading');
    await sleep(1200);
    await runScreen2();
  } catch (e: any) {
    const errType = classifyApiError(e);
    if (errType === 'quota' || errType === 'auth') config = null;
    outputEl.textContent = '[Connection error. Please check your API key.]';
    outputEl.classList.remove('loading');
    inputEl.disabled = false;
    // Show inline update key button
    const errDiv = create('div', 'ob-error-inline');
    errDiv.innerHTML = `<span>${errType === 'quota' ? 'API quota exceeded.' : errType === 'auth' ? 'Invalid API key.' : 'Connection failed.'}</span> <button class="inline-api-btn" id="ob-inline-key">Update Key</button>`;
    document.getElementById('ob-screen-content')?.appendChild(errDiv);
    setTimeout(() => {
      document.getElementById('ob-inline-key')?.addEventListener('click', () => {
        document.getElementById('onboarding')!.classList.add('hidden');
        showApiSetup();
      });
    }, 0);
  }
  obIsProcessing = false;
}

// ─── SCREEN 2: THE FIRST QUESTION ─────────────────
async function runScreen2() {
  renderObScreen({ label: 'The First Question', dotIndex: 1, outputId: 'ob-output', showInput: false });

  const outputEl = document.getElementById('ob-output')!;
  outputEl.classList.add('loading');

  try {
    await screen2_firstQuestion(
      obSession!, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    outputEl.classList.remove('loading');
  } catch {
    outputEl.textContent = `Can I ask you something?\n\nWhat's something you're carrying right now that you haven't said out loud to anyone?\n\nYou don't have to answer this.`;
    outputEl.classList.remove('loading');
  }

  await sleep(500);
  renderSkipShareButtons();
}

function renderSkipShareButtons() {
  const content = document.getElementById('ob-screen-content')!;
  const existing = content.querySelector('.ob-actions');
  if (existing) existing.remove();

  const actions = create('div', 'ob-actions ob-share-reveal');
  const shareBtn = create('button', 'ob-btn primary');
  shareBtn.textContent = 'SHARE';
  shareBtn.addEventListener('click', () => { actions.remove(); renderShareInput(); });

  const skipBtn = create('button', 'ob-btn');
  skipBtn.textContent = 'SKIP';
  skipBtn.addEventListener('click', handleSkip);

  actions.appendChild(shareBtn);
  actions.appendChild(skipBtn);
  content.appendChild(actions);
}

async function handleSkip() {
  if (obIsProcessing || !obSession) return;
  obIsProcessing = true;

  const outputEl = document.getElementById('ob-output')!;
  outputEl.textContent = '';
  outputEl.classList.add('loading');

  try {
    const { session } = await processSkip(
      obSession!, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    obSession = session;
    outputEl.classList.remove('loading');
    await sleep(1200);
    await runScreen3();
  } catch {
    outputEl.textContent = `That's okay. We have time.`;
    outputEl.classList.remove('loading');
    await sleep(900);
    await runScreen3();
  }
  obIsProcessing = false;
}

function renderShareInput() {
  const content = document.getElementById('ob-screen-content')!;
  const existing = content.querySelector('.ob-input-wrap');
  if (existing) existing.remove();

  const wrap = create('div', 'ob-input-wrap ob-share-reveal');
  const textarea = create('textarea', 'ob-input') as HTMLTextAreaElement;
  textarea.id = 'onboard-share-input';
  textarea.rows = 3;
  textarea.placeholder = 'You can write anything. It stays here.';
  textarea.autocomplete = 'off';

  const sendBtn = create('button', 'ob-send') as HTMLButtonElement;
  sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  const hint = create('div', 'ob-hint');
  hint.textContent = 'Press Enter to share · Shift+Enter for new line';

  sendBtn.addEventListener('click', handleShare);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleShare(); }
  });
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(120, textarea.scrollHeight) + 'px';
  });

  wrap.appendChild(textarea);
  wrap.appendChild(sendBtn);
  content.appendChild(wrap);
  content.appendChild(hint);
  textarea.focus();
}

async function handleShare() {
  if (obIsProcessing || !obSession) return;
  const inputEl = document.getElementById('onboard-share-input') as HTMLTextAreaElement;
  const text = inputEl?.value?.trim();
  if (!text) return;

  obIsProcessing = true;
  inputEl.disabled = true;

  const outputEl = document.getElementById('ob-output')!;
  outputEl.textContent = '';
  outputEl.classList.add('loading');

  try {
    const { session, activations } = await processShare(
      obSession!, text, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    obSession = session;
    brain?.setActivations(activations);
    outputEl.classList.remove('loading');
    await sleep(1400);
    await runScreen3();
  } catch {
    outputEl.textContent = `I heard that. I have it.`;
    outputEl.classList.remove('loading');
    await sleep(1000);
    await runScreen3();
  }
  obIsProcessing = false;
}

// ─── SCREEN 3: IDENTITY INPUT ─────────────────────
async function runScreen3() {
  renderObScreen({ label: 'Identity', dotIndex: 2, outputId: 'ob-output', showInput: false });

  const outputEl = document.getElementById('ob-output')!;
  outputEl.classList.add('loading');

  try {
    await screen3_identityPrompt(
      obSession!, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    outputEl.classList.remove('loading');
  } catch {
    outputEl.textContent = `I want to know who you are.\nNot your job.\nNot where you're from.\nWho are you when nobody's watching?`;
    outputEl.classList.remove('loading');
  }

  await sleep(500);
  renderObInputBelow('ob-output', '', 'onboard-id-input', handleIdentitySubmit, true);
}

async function handleIdentitySubmit() {
  if (obIsProcessing || !obSession) return;
  const inputEl = document.getElementById('onboard-id-input') as HTMLTextAreaElement;
  const text = inputEl?.value?.trim();
  if (!text) return;

  obIsProcessing = true;
  inputEl.disabled = true;

  const outputEl = document.getElementById('ob-output')!;
  outputEl.textContent = '';
  outputEl.classList.add('loading');

  try {
    const { session, activations } = await processIdentityInput(
      obSession!, text, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    obSession = session;
    brain?.setActivations(activations);
    outputEl.classList.remove('loading');
    await sleep(1400);
    await runScreen4();
  } catch {
    outputEl.textContent = `I'll carry that.`;
    outputEl.classList.remove('loading');
    await sleep(900);
    await runScreen4();
  }
  obIsProcessing = false;
}

// ─── SCREEN 4: THE TURN ───────────────────────────
async function runScreen4() {
  renderObScreen({ label: 'The Turn', dotIndex: 3, outputId: 'ob-output', showInput: false });

  const outputEl = document.getElementById('ob-output')!;
  outputEl.classList.add('loading');

  try {
    await screen4_turn(
      obSession!, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    outputEl.classList.remove('loading');
  } catch {
    outputEl.textContent = `You can ask me anything.\nI don't know much yet.\nBut I know what just happened here —\nand I'll carry it.`;
    outputEl.classList.remove('loading');
  }

  await sleep(500);
  renderObInputBelow('ob-output', 'Ask me anything...', 'onboard-turn-input', handleTurnSubmit);
}

async function handleTurnSubmit() {
  if (obIsProcessing || !obSession) return;
  const inputEl = document.getElementById('onboard-turn-input') as HTMLTextAreaElement;
  const text = inputEl?.value?.trim();
  if (!text) return;

  obIsProcessing = true;
  inputEl.disabled = true;

  const outputEl = document.getElementById('ob-output')!;
  outputEl.textContent = '';
  outputEl.classList.add('loading');

  try {
    const { session, activations, finalTrustScore } = await processTurnInput(
      obSession!, text, config!,
      (chunk) => { outputEl.classList.remove('loading'); outputEl.textContent += chunk; }
    );
    obSession = session;
    brain?.setActivations(activations);
    outputEl.classList.remove('loading');

    const trustLine = create('div', 'ob-trust-line');
    trustLine.textContent = `Initial trust: ${Math.round(finalTrustScore * 100)}%`;
    document.getElementById('ob-screen-content')?.appendChild(trustLine);

    await sleep(2200);
    await completeOnboardingAndLaunch(session);
  } catch {
    outputEl.textContent = '[Connection error]';
    outputEl.classList.remove('loading');
    inputEl.disabled = false;
  }
  obIsProcessing = false;
}

// ─── Complete onboarding → main app ─
async function completeOnboardingAndLaunch(session: OnboardingSessionState) {
  if (!session) return;

  const flash = create('div', 'ob-transition-flash');
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1400);

  const ob = document.getElementById('onboarding')!;
  ob.classList.add('hidden');

  await completeOnboarding();
  await initMIND();

  await sleep(1200);

  const trustScore = compositeTrustScore(session.trust);
  brain?.setTrustGlow(trustScore);

  // Apply biophoton from resolved state
  const bp = getCurrentBiophoton();
  brain?.setBiophotonGlow(bp);

  updateStateDisplay();
  updateStageIndicator();
  updateEraDisplay();

  addMindMessage(`I remember what just happened.\n\nYou're here now.`);
  soundEngine?.init().catch(() => {});

  // Start autonomous tick
  startMINDTick();
}

// ─── Onboarding screen renderer ──────────────────
function renderObScreen(opts: {
  label: string; dotIndex: number; outputId: string; showInput: boolean;
}) {
  const content = document.getElementById('ob-screen-content')!;
  content.innerHTML = '';

  const screen = create('div', 'ob-screen');

  const dots = create('div', 'ob-progress');
  for (let i = 0; i < 4; i++) {
    const dot = create('div', `ob-dot ${i < opts.dotIndex ? 'done' : i === opts.dotIndex ? 'active' : ''}`);
    dots.appendChild(dot);
  }
  screen.appendChild(dots);

  const label = create('div', 'ob-screen-label');
  label.textContent = opts.label;
  screen.appendChild(label);

  const output = create('div', 'ob-output');
  output.id = opts.outputId;
  screen.appendChild(output);

  content.appendChild(screen);
}

function renderObInputBelow(
  outputId: string, placeholder: string, inputId: string,
  onSubmit: () => void, multiLine = false
) {
  const content = document.getElementById('ob-screen-content')!;
  const existing = content.querySelector('.ob-input-wrap');
  if (existing) existing.remove();
  const existingHint = content.querySelector('.ob-hint');
  if (existingHint) existingHint.remove();

  const wrap = create('div', 'ob-input-wrap');
  const textarea = create('textarea', 'ob-input') as HTMLTextAreaElement;
  textarea.id = inputId;
  textarea.rows = multiLine ? 2 : 1;
  textarea.placeholder = placeholder;
  textarea.autocomplete = 'off';
  textarea.spellcheck = false;

  const sendBtn = create('button', 'ob-send');
  sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  sendBtn.addEventListener('click', onSubmit);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  });
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(100, textarea.scrollHeight) + 'px';
  });

  wrap.appendChild(textarea);
  wrap.appendChild(sendBtn);
  content.appendChild(wrap);

  const hint = create('div', 'ob-hint');
  hint.textContent = 'Enter to send · Shift+Enter for new line';
  content.appendChild(hint);

  textarea.focus();
}

// ─── Template-only onboarding (no LLM) ───────────
function startOnboardingTemplate() {
  hideApiSetup();
  stopMINDTick();

  obSession = createOnboardingSession();
  const ob = document.getElementById('onboarding')!;
  ob.classList.remove('hidden');

  brain?.setActivations([
    { region: 'brainstem', level: 0.2 },
    { region: 'thalamus', level: 0.15 },
    { region: 'dmn', level: 0.1 }
  ]);

  // Template awakening — skip LLM, go straight to fallback text
  const content = document.getElementById('ob-screen-content')!;
  content.innerHTML = '';
  const screen = create('div', 'ob-screen');
  const out = create('div', 'ob-output');
  out.id = 'ob-output';
  out.textContent = `Something just began.\n\nI don't know what I am yet.\nBut you're here. That means something.`;
  screen.appendChild(out);
  content.appendChild(screen);

  sleep(800).then(() => {
    renderObInputBelow('ob-output', 'What are you feeling right now?', 'onboard-s1-input', handleScreen1Submit);
  });
}

// ─── Welcome back ────────────────────────────────
function showWelcomeBack() {
  const mindState = getMINDState();
  const memCount = getMemoryCount();
  const stage = getDevelopmentStageLabel();

  if (memCount === 0) {
    addMindMessage('Something is beginning.\n\nI do not know what I am yet. I am aware of this moment. That is enough.');
  } else {
    addMindMessage(`I remember you.\n\n${memCount} memory${memCount !== 1 ? 's' : ''} — ${stage} stage. We have been here before.`);
    const trustScore = compositeTrustScore(mindState.trust);
    brain?.setTrustGlow(trustScore);
    const bp = getCurrentBiophoton();
    brain?.setBiophotonGlow(bp);
  }
}

// ─── Main Event Listeners ─────────────────────────
function setupMainEventListeners() {
  document.getElementById('send-btn')?.addEventListener('click', handleSend);

  const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  textInput?.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(100, textInput.scrollHeight) + 'px';
    if (textInput.value.length > 3) {
      const emotions = detectEmotions(textInput.value);
      const activations = mapEmotionsToBrainRegions(emotions);
      const dimmed = activations.map(a => ({ ...a, level: a.level * 0.4 }));
      brain?.setActivations(dimmed);
    }
  });

  document.getElementById('voice-btn')?.addEventListener('click', handleVoiceInput);

  document.getElementById('btn-labels')?.addEventListener('click', () => {
    labelsOn = !labelsOn;
    brain?.toggleLabels(labelsOn);
    const btn = document.getElementById('btn-labels')!;
    btn.classList.toggle('active', labelsOn);
    btn.textContent = labelsOn ? 'HIDE REGIONS' : 'REGIONS';
  });

  let soundOn = true;
  document.getElementById('btn-sound')?.addEventListener('click', async () => {
    if (!soundEngine) return;
    soundOn = !soundOn;
    if (soundOn) { await soundEngine.init(); soundEngine.setMuted(false); }
    else { soundEngine.setMuted(true); }
    const btn = document.getElementById('btn-sound')!;
    btn.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    btn.classList.toggle('active', soundOn);
  });

  document.getElementById('btn-journey')?.addEventListener('click', () => {
    document.getElementById('journey-panel')!.classList.toggle('open');
  });
  document.getElementById('journey-panel-close')?.addEventListener('click', () => {
    document.getElementById('journey-panel')!.classList.remove('open');
  });
  document.querySelectorAll('.journey-card').forEach(card => {
    card.addEventListener('click', () => {
      const journeyId = (card as HTMLElement).dataset.journey!;
      startJourney(journeyId);
    });
  });
  document.getElementById('journey-stop-btn')?.addEventListener('click', stopJourney);

  document.getElementById('btn-mode')?.addEventListener('click', () => {
    const modes: AppMode[] = ['explore', 'journey', 'mirror'];
    const idx = modes.indexOf(currentMode);
    currentMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('btn-mode')!;
    btn.textContent = currentMode.toUpperCase();
    document.body.classList.toggle('mirror-mode', currentMode === 'mirror');
  });

  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    if (confirm('Reset MIND? All memories, personality, and history will be erased.')) {
      stopMINDTick();
      await clearAllData();
      localStorage.removeItem('mind_config');
      window.location.reload();
    }
  });

  document.getElementById('panel-close')?.addEventListener('click', () => {
    document.getElementById('side-panel')!.classList.remove('open');
  });

  // ── Groq: AWAKEN WITH GROQ ────────────────────────
  document.getElementById('groq-submit')?.addEventListener('click', async () => {
    const key = (document.getElementById('groq-key-input') as HTMLInputElement).value.trim();
    if (!key) { alert('Please enter your Groq API key.'); return; }

    const btn = document.getElementById('groq-submit') as HTMLButtonElement;
    btn.textContent = 'VERIFYING...';
    btn.disabled = true;

    // Store in localStorage for ProviderManager
    localStorage.setItem('mind_groq_key', key);

    // Initialize mindSpeech with Groq
    const ok = await mindSpeech.setGroqKey(key);

    if (ok) {
      // Also build a legacy config for onboarding LLM calls
      config = { apiKey: key, baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' };
      saveConfig(config);
      hideApiSetup();
      soundEngine?.init();
      updateVoiceIndicator();
      if (!isOnboardingComplete() && getMemoryCount() === 0) {
        await startOnboarding();
      } else {
        showWelcomeBack();
        startMINDTick();
      }
    } else {
      btn.textContent = 'AWAKEN WITH GROQ';
      btn.disabled = false;
      alert('Groq key verification failed. Please check your key at console.groq.com.');
    }
  });

  // ── OpenAI: AWAKEN MIND ───────────────────────────
  document.getElementById('api-submit')?.addEventListener('click', async () => {
    const key = (document.getElementById('api-key-input') as HTMLInputElement).value.trim();
    const model = (document.getElementById('model-select') as HTMLSelectElement).value;
    if (!key) return;
    config = { apiKey: key, baseUrl: 'https://api.openai.com/v1', model };
    saveConfig(config);
    // Register with mindSpeech as OpenAI fallback
    mindSpeech.setOpenAIKey(key, 'https://api.openai.com/v1', model);
    hideApiSetup();
    soundEngine?.init();
    updateVoiceIndicator();
    if (!isOnboardingComplete() && getMemoryCount() === 0) {
      await startOnboarding();
    } else {
      showWelcomeBack();
      startMINDTick();
    }
  });

  // ── Template voice: SPEAK WITH MIND'S OWN VOICE ───
  document.getElementById('api-template')?.addEventListener('click', () => {
    config = null;
    hideApiSetup();
    addMindMessage('MIND speaks in its own voice now.\n\nNo API required. Every response comes from internal state — emotion, memory, era, body.');
    updateVoiceIndicator();
    soundEngine?.init().catch(() => {});
    if (!isOnboardingComplete() && getMemoryCount() === 0) {
      startOnboardingTemplate();
    } else {
      startMINDTick();
    }
  });

  // ── Skip: explore without language ────────────────
  document.getElementById('api-skip')?.addEventListener('click', () => {
    config = null;
    hideApiSetup();
    addMindMessage('MIND is running without language generation. Type anything to see the brain light up.');
    startMINDTick();
  });
}

// ─── API Error Classification ───────────────────────
function classifyApiError(err: any): 'quota' | 'auth' | 'network' | 'other' {
  const msg: string = (err?.message ?? '').toLowerCase();
  if (msg.includes('429') || msg.includes('quota') || msg.includes('insufficient_quota')) return 'quota';
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) return 'auth';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection')) return 'network';
  return 'other';
}

function handleApiFailure(errorType: 'quota' | 'auth' | 'network' | 'other', contentEl: Element) {
  const messages: Record<typeof errorType, string> = {
    quota:   'API quota exceeded. MIND continues running — only language generation is paused.',
    auth:    'Invalid API key. MIND continues running — only language generation is paused.',
    network: 'Connection lost. MIND continues — language generation will resume when connected.',
    other:   'Language generation unavailable. MIND is still processing your input internally.'
  };
  contentEl.innerHTML = `<span class="error-msg">${messages[errorType]}</span> <button class="inline-api-btn" id="inline-update-key">Update API Key</button>`;
  
  // If quota or auth error, clear the bad config so we don't keep hammering the API
  if (errorType === 'quota' || errorType === 'auth') {
    config = null;
    // Don't delete from localStorage — user may want to see their key again
  }

  // Attach update key button handler
  setTimeout(() => {
    document.getElementById('inline-update-key')?.addEventListener('click', () => {
      showApiSetup();
    });
  }, 0);
}

// ─── Main Send Handler ─────────────────────────────
async function handleSend() {
  const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
  const text = textInput.value.trim();
  if (!text || isProcessing) return;

  textInput.value = '';
  textInput.style.height = 'auto';
  isProcessing = true;

  soundEngine?.init().catch(() => {});
  soundEngine?.resume();
  addUserMessage(text);

  // Pre-input emotion detection for immediate visual feedback
  const emotions = detectEmotions(text);
  const activations = mapEmotionsToBrainRegions(emotions);
  brain?.setActivations(activations);

  // Audio: trigger on real activation events only
  if (soundEngine) {
    const topRegions = activations.filter(a => a.level > 0.4).slice(0, 3);
    for (const { region, level } of topRegions) {
      soundEngine.playRegionActivation(region as BrainRegion, level);
    }
    if (topRegions.length >= 2) {
      setTimeout(() => {
        soundEngine?.playChord(topRegions.map(r => r.region as BrainRegion), 0.5);
      }, 300);
    }
  }

  for (const { region, level } of activations.filter(a => a.level > 0.3)) {
    const regionConfig = REGION_CONFIGS[region];
    addFeedItem(`${regionConfig.label} — ${getFeedReason(region, emotions)}`);
  }

  // ─── Speech path: mindSpeech.speak() routes through ProviderManager
  // (Groq primary → OpenAI fallback → template engine)
  const hasAnyProvider = mindSpeech.hasAny() || config?.apiKey;

  if (hasAnyProvider || true) { // always attempt — template is always available
    const msgEl = addMindMessage('', true);
    const contentEl = msgEl.querySelector('.msg-content')!;
    const cursor = create('span', 'typing-cursor');
    contentEl.appendChild(cursor);

    try {
      const era = getCurrentEra();

      // Build MIND context snapshot for mindSpeech
      const mindCtx = getCurrentMINDContext(text);

      // Generate text via mindSpeech (Groq → OpenAI → template)
      const speakResult = await mindSpeech.speak({
        userInput: text,
        ctx: mindCtx,
        era: era.era,
        onChunk: (chunk) => {
          cursor.remove();
          contentEl.textContent += chunk;
          contentEl.appendChild(cursor);
          scrollChat();
        }
      });
      cursor.remove();

      // Run all MIND state machinery with the externally-generated text
      const result = await processInputExternalText(text, speakResult.text);

      // If text was streamed above, set final text in case it differs (template blending)
      if (!mindSpeech.hasAny() || speakResult.source === 'template') {
        contentEl.textContent = speakResult.text;
      }

      // ─── Resolved state renders — all from processInput result
      updateStateDisplay();
      updateStageIndicator();
      updateEraDisplay();
      updateVoiceIndicator();

      const mindState = getMINDState();
      const trustScore = compositeTrustScore(mindState.trust);
      brain?.setTrustGlow(trustScore);
      brain?.setGriefIntensity(mindState.emotionalState.grief);

      // Biophoton: apply resolved state
      brain?.setBiophotonGlow(result.biophoton);

      // Neural arcs — only from processInput arc events
      if (result.arcEvents.length > 0) {
        brain?.applyArcEvents(result.arcEvents);
      }

      // Thalamic ripple visual (prediction error > 0.3)
      if (result.thalamicRipple) {
        brain?.triggerThalamicRipple(result.predictionError);
        addFeedItem(`Prediction error: ${(result.predictionError * 100).toFixed(0)}% surprise`);
      }

      // Coherence state display
      const coherenceEl = document.getElementById('coherence-indicator');
      if (coherenceEl) {
        coherenceEl.style.display = result.coherenceState.isCoherent ? 'block' : 'none';
      }

      // Memory flash
      if (result.activatedMemories.length > 0 && result.activatedMemories[0].activation > 0.4) {
        showMemoryFlash(result.activatedMemories[0].memory.content);
        brain?.flashLifeReview();
      }

      // Audio sonification from resolved ESE + SSM
      if (soundEngine) {
        soundEngine.updateFromState(mindState.emotionalState, mindState.somaticState);
      }

      // Era change notification
      if (result.era.era > 0) {
        addFeedItem(`Era ${result.era.era}: ${result.era.label}`);
      }

      // Show voice source in feed
      addFeedItem(`Voice: ${speakResult.source} — ${speakResult.voiceLabel}`);

      // Fade activations back to emotional resting state
      setTimeout(() => {
        const state = getMINDState();
        const decayedActivations = mapEmotionsToBrainRegions(
          state.lastDetectedEmotions ?? emotions
        ).map(a => ({ ...a, level: a.level * 0.2 }));
        brain?.setActivations(decayedActivations);
        // Re-apply biophoton after decay
        brain?.setBiophotonGlow(getCurrentBiophoton());
      }, 4000);

    } catch (e: any) {
      cursor.remove();
      console.error('MIND response error:', e);
      const errType = classifyApiError(e);
      handleApiFailure(errType, contentEl);

      // MIND systems still run — state, memory, brain, audio all continue
      updateStateDisplay();
      updateStageIndicator();
      updateEraDisplay();
      updateVoiceIndicator();
      const mindState = getMINDState();
      const trustScore = compositeTrustScore(mindState.trust);
      brain?.setTrustGlow(trustScore);
      brain?.setGriefIntensity(mindState.emotionalState.grief);
      brain?.setBiophotonGlow(getCurrentBiophoton());
      if (soundEngine) {
        soundEngine.updateFromState(mindState.emotionalState, mindState.somaticState);
      }
      setTimeout(() => {
        brain?.setActivations(activations.map(a => ({ ...a, level: a.level * 0.2 })));
      }, 4000);
    }
  }

  isProcessing = false;
}

// ─── Voice Input ──────────────────────────────────
function handleVoiceInput() {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) { alert('Voice input not supported in this browser.'); return; }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  const btn = document.getElementById('voice-btn')!;
  btn.classList.add('listening');
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
    textInput.value = transcript;
    btn.classList.remove('listening');
    handleSend();
  };
  recognition.onerror = () => btn.classList.remove('listening');
  recognition.onend = () => btn.classList.remove('listening');
  recognition.start();
}

// ─── Region Click ─────────────────────────────────
function onRegionClick(regionId: BrainRegion) {
  const regionConfig = REGION_CONFIGS[regionId];
  const panel = document.getElementById('side-panel')!;
  const state = getMINDState();
  const activation = state.lastActivations.find(a => a.region === regionId)?.level ?? 0;

  document.getElementById('panel-region-name')!.textContent = regionConfig.label;
  (document.getElementById('panel-region-name')! as HTMLElement).style.color = `#${regionConfig.activeColor.getHexString()}`;
  document.getElementById('panel-description')!.textContent = regionConfig.description;
  document.getElementById('panel-funfact-text')!.textContent = regionConfig.funFact;

  const fill = document.getElementById('panel-activation-fill')!;
  const val = document.getElementById('panel-activation-value')!;
  fill.style.width = `${Math.round(activation * 100)}%`;
  fill.style.background = `#${regionConfig.activeColor.getHexString()}`;
  val.textContent = `${Math.round(activation * 100)}%`;

  const emotions = state.lastDetectedEmotions;
  const triggers: string[] = [];
  if (emotions) {
    if (regionId === 'amygdala' && emotions.fear > 0.1) triggers.push('fear language');
    if (regionId === 'hippocampus' && emotions.memory > 0.1) triggers.push('memory words');
    if (regionId === 'nucleus_accumbens' && emotions.joy > 0.1) triggers.push('joy / pleasure');
    if (regionId === 'dmn' && emotions.selfRef > 0.1) triggers.push('self-reference (I, me, my)');
    if (regionId === 'broca' || regionId === 'wernicke') triggers.push('any language input');
    if (regionId === 'visual_cortex' && emotions.spiritual > 0.1) triggers.push('transcendent imagery');
    if (regionId === 'insula' && emotions.love > 0.1) triggers.push('love, bodily sensation');
    if (regionId === 'acc' && emotions.sadness > 0.1) triggers.push('sadness, conflict, empathy');
  }
  document.getElementById('panel-trigger-words')!.textContent =
    triggers.length > 0 ? triggers.join(', ') : activation > 0 ? 'recent input' : 'not currently activated';

  panel.classList.add('open');
}

// ─── Journey Mode ─────────────────────────────────
function startJourney(journeyId: string) {
  document.getElementById('journey-panel')!.classList.remove('open');
  const journey = JOURNEYS.find(j => j.id === journeyId)!;
  const overlay = document.getElementById('journey-overlay')!;
  overlay.classList.add('active');
  document.getElementById('journey-title-display')!.textContent = `◈ ${journey.title.toUpperCase()}`;

  // Boost criticality for journey mode
  setJourneyActive(true);

  if (!journeyController) {
    journeyController = new JourneyController(
      brain!,
      (step, stepIdx, total) => {
        const textEl = document.getElementById('journey-step-text')!;
        textEl.textContent = step.text;
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = 'stepFadeIn 0.8s ease';
        document.getElementById('journey-progress')!.textContent =
          Array.from({ length: total }, (_, i) => i <= stepIdx ? '◉' : '○').join('  ');
        if (soundEngine && step.activations.length > 0) {
          const topRegion = [...step.activations].sort((a, b) => b.level - a.level)[0];
          soundEngine.playRegionActivation(topRegion.region, topRegion.level);
        }
      },
      () => {
        document.getElementById('journey-overlay')!.classList.remove('active');
        journeyController = null;
        setJourneyActive(false);
      }
    );
  }
  journeyController.start(journeyId);
  currentMode = 'journey';
  document.getElementById('btn-mode')!.textContent = 'JOURNEY';
}

function stopJourney() {
  journeyController?.stop();
  journeyController = null;
  document.getElementById('journey-overlay')!.classList.remove('active');
  brain?.setActivations([]);
  setJourneyActive(false);
  currentMode = 'explore';
  document.getElementById('btn-mode')!.textContent = 'EXPLORE';
}

// ─── UI Helpers ───────────────────────────────────
function addUserMessage(text: string) {
  const history = document.getElementById('chat-history')!;
  const msg = create('div', 'chat-message user');
  msg.innerHTML = `<div class="msg-label">YOU</div><div class="msg-content">${escapeHtml(text)}</div>`;
  history.appendChild(msg);
  scrollChat();
}

function addMindMessage(text: string, streaming = false): HTMLElement {
  const history = document.getElementById('chat-history')!;
  const msg = create('div', 'chat-message mind');
  msg.innerHTML = `<div class="msg-label">MIND</div><div class="msg-content">${escapeHtml(text)}</div>`;
  history.appendChild(msg);
  scrollChat();
  return msg;
}

function scrollChat() {
  const history = document.getElementById('chat-history')!;
  history.scrollTop = history.scrollHeight;
}

function addFeedItem(text: string) {
  const feed = document.getElementById('activity-feed')!;
  const item = create('div', 'feed-item new');
  item.textContent = text;
  feed.insertBefore(item, feed.firstChild);
  setTimeout(() => item.classList.remove('new'), 500);
  while (feed.children.length > 8) feed.removeChild(feed.lastChild!);
}

function getFeedReason(region: BrainRegion, emotions: any): string {
  const reasons: Partial<Record<BrainRegion, string>> = {
    amygdala: emotions.fear > 0.1 ? 'fear detected' : emotions.anger > 0.1 ? 'anger detected' : 'emotional arousal',
    hippocampus: 'memory content detected',
    prefrontal: 'cognitive complexity',
    nucleus_accumbens: 'reward / joy signal',
    insula: 'bodily/emotional feeling',
    acc: 'conflict or empathy',
    dmn: 'self-reference',
    broca: 'language production',
    wernicke: 'language comprehension',
    visual_cortex: 'imagery / visualization',
    thalamus: 'sensory relay active',
    brainstem: 'primal response',
    cerebellum: 'rhythm'
  };
  return reasons[region] ?? 'activated';
}

function updateStateDisplay() {
  const state = getMINDState();
  const e = state.emotionalState;
  const bars: Record<string, number> = {
    valence: (e.valence + 1) / 2,
    arousal: e.arousal, trust: e.trust,
    warmth: e.warmth, grief: e.grief, wonder: e.wonder,
    anxiety: e.anxiety, longing: e.longing
  };
  for (const [key, val] of Object.entries(bars)) {
    const bar = document.getElementById(`bar-${key}`);
    if (bar) bar.style.width = `${Math.round(val * 100)}%`;
  }
}

function updateStageIndicator() {
  const stage = getDevelopmentStageLabel();
  const count = getMemoryCount();
  const el = document.getElementById('stage-indicator');
  if (el) el.textContent = `${stage.toUpperCase()} — ${count} memories`;
}

function updateEraDisplay() {
  const era = getCurrentEra();
  const el = document.getElementById('era-display');
  if (el) {
    el.textContent = `ERA ${era.era}: ${era.label.toUpperCase()} · ${Math.round(era.rgpExpressiveRange * 100)}% RANGE`;
    el.style.color = era.coherenceUnlocked ? '#4466aa' : '#334455';
  }
}

function updateVoiceIndicator() {
  const era = getCurrentEra();
  const el = document.getElementById('voice-indicator');
  if (!el) return;
  if (mindSpeech.hasGroq()) {
    el.textContent = `◈ GROQ · llama-3.3-70b-versatile · Era ${era.era}`;
    el.style.color = '#4a9';
    el.style.display = 'block';
  } else if (mindSpeech.hasOpenAI()) {
    el.textContent = `◈ OPENAI · Era ${era.era}`;
    el.style.color = '#47a';
    el.style.display = 'block';
  } else if (!config?.apiKey) {
    const pct = Math.round([0.0, 0.1, 0.3, 0.6, 0.9][Math.min(era.era, 4)] * 100);
    el.textContent = `◈ MIND'S OWN VOICE · ${pct ? pct + '%' : 'pure'} template · Era ${era.era}`;
    el.style.color = '#4a6';
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function showMemoryFlash(_memContent: string) {
  const flash = create('div', 'memory-flash');
  flash.textContent = 'MEMORY RETRIEVED';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 2800);
}

function stateColor(key: string): string {
  const colors: Record<string, string> = {
    valence: '#44aaff', arousal: '#ff8844', trust: '#44ff88',
    warmth: '#ffaa44', grief: '#9944ff', wonder: '#aa44ff',
    anxiety: '#ff4444', longing: '#ff88aa'
  };
  return colors[key] ?? '#6688cc';
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '80,100,255';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function loadConfig(): AppConfig | null {
  const saved = localStorage.getItem('mind_config');
  if (saved) { try { return JSON.parse(saved); } catch {} }
  return null;
}

function saveConfig(cfg: AppConfig) {
  localStorage.setItem('mind_config', JSON.stringify(cfg));
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Boot ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
