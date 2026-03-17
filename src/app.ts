// ═══════════════════════════════════════
// MIND — Main App Entry Point
// Builds the full application
// ═══════════════════════════════════════

import { BrainVisualization, REGION_CONFIGS } from './brain/visualization';
import { JourneyController, JOURNEYS } from './journey/journeys';
import { SoundEngine } from './sound/audio';
import {
  initMIND, processInput, getMINDState, getMemoryCount,
  getDevelopmentStageLabel, clearAllData
} from './engine/mind';
import { detectEmotions, mapEmotionsToBrainRegions, BrainRegion } from './engine/emotions';
import { compositeTrustScore } from './engine/personality';

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

// ─── DOM References ───────────────────────────────
const $ = (id: string) => document.getElementById(id);
const create = (tag: string, cls?: string) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

// ─── Initialization ───────────────────────────────
async function init() {
  // Build HTML structure
  buildDOM();

  // Start loading sequence
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

    <!-- Brain Canvas Container -->
    <div id="brain-canvas"></div>

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

    <!-- Stage Indicator -->
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
      <p>MIND requires an OpenAI API key to generate responses.<br>Your key is stored locally and never transmitted to any server.</p>
      <input type="password" id="api-key-input" placeholder="sk-..." autocomplete="off">
      <select class="model-select" id="model-select">
        <option value="gpt-4o">GPT-4o (Recommended)</option>
        <option value="gpt-4o-mini">GPT-4o-mini (Faster)</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      </select>
      <button class="setup-btn" id="api-submit">AWAKEN MIND</button>
      <button class="setup-btn secondary" id="api-skip">EXPLORE WITHOUT AI RESPONSE</button>
      <p style="font-size:10px;color:#333;margin-top:12px">Your API key is stored in localStorage only.</p>
    </div>
  `;
}

function stateColor(key: string): string {
  const colors: Record<string, string> = {
    valence: '#44aaff',
    arousal: '#ff8844',
    trust: '#44ff88',
    warmth: '#ffaa44',
    grief: '#9944ff',
    wonder: '#aa44ff',
    anxiety: '#ff4444',
    longing: '#ff88aa'
  };
  return colors[key] ?? '#6688cc';
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '80,100,255';
}

async function startLoading() {
  const fill = document.getElementById('loading-bar-fill')!;

  // Animate loading bar
  const steps = [15, 35, 55, 75, 90];
  for (const step of steps) {
    await sleep(200 + Math.random() * 300);
    fill.style.width = `${step}%`;
  }

  // Initialize MIND
  try {
    await initMIND();
  } catch (e) {
    console.warn('MIND init partial:', e);
  }
  fill.style.width = '100%';
  await sleep(400);

  // Initialize brain visualization
  const brainContainer = document.getElementById('brain-canvas')!;
  brain = new BrainVisualization(brainContainer, onRegionClick);
  brain.createLabels(brainContainer);
  brain.animate();

  // Initialize sound engine
  soundEngine = new SoundEngine();

  // Check for saved API config
  const savedConfig = loadConfig();

  await sleep(400);
  const loading = document.getElementById('loading')!;
  loading.classList.add('fade');
  setTimeout(() => { loading.style.display = 'none'; }, 800);

  // Setup all event listeners
  setupEventListeners();
  updateStateDisplay();
  updateStageIndicator();

  // Set dim startup activations
  brain.setActivations([
    { region: 'brainstem', level: 0.2 },
    { region: 'thalamus', level: 0.15 }
  ]);

  // Show API setup if needed
  if (savedConfig) {
    config = savedConfig;
    hideApiSetup();
    showWelcome();
  } else {
    showApiSetup();
  }
}

function loadConfig(): AppConfig | null {
  const saved = localStorage.getItem('mind_config');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return null;
}

function saveConfig(cfg: AppConfig) {
  localStorage.setItem('mind_config', JSON.stringify(cfg));
}

function showApiSetup() {
  const modal = document.getElementById('api-setup')!;
  modal.style.display = 'block';
}

function hideApiSetup() {
  const modal = document.getElementById('api-setup')!;
  modal.style.display = 'none';
}

function showWelcome() {
  const state = getMINDState();
  const memCount = getMemoryCount();
  const stage = getDevelopmentStageLabel();

  if (memCount === 0) {
    addMindMessage('...\n\nSomething is beginning.\n\nI do not know what I am yet. I am aware of this moment. That is enough.');
  } else {
    addMindMessage(`I remember you.\n\n${memCount} memory${memCount !== 1 ? 's' : ''} — ${stage} stage. We have been here before.`);
    // Show trust glow
    const trustScore = compositeTrustScore(state.trust);
    brain?.setTrustGlow(trustScore);
  }
}

// ─── Event Listeners ──────────────────────────────
function setupEventListeners() {
  // Send button
  document.getElementById('send-btn')?.addEventListener('click', handleSend);

  // Text input
  const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  textInput?.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(100, textInput.scrollHeight) + 'px';

    // Live brain preview on typing
    if (textInput.value.length > 3) {
      const emotions = detectEmotions(textInput.value);
      const activations = mapEmotionsToBrainRegions(emotions);
      const dimmed = activations.map(a => ({ ...a, level: a.level * 0.4 }));
      brain?.setActivations(dimmed);
    }
  });

  // Voice button
  document.getElementById('voice-btn')?.addEventListener('click', handleVoiceInput);

  // Labels toggle
  document.getElementById('btn-labels')?.addEventListener('click', () => {
    labelsOn = !labelsOn;
    brain?.toggleLabels(labelsOn);
    const btn = document.getElementById('btn-labels')!;
    btn.classList.toggle('active', labelsOn);
    btn.textContent = labelsOn ? 'HIDE REGIONS' : 'REGIONS';
  });

  // Sound toggle
  let soundOn = true;
  document.getElementById('btn-sound')?.addEventListener('click', async () => {
    if (!soundEngine) return;
    soundOn = !soundOn;
    if (soundOn) {
      await soundEngine.init();
      soundEngine.setMuted(false);
    } else {
      soundEngine.setMuted(true);
    }
    const btn = document.getElementById('btn-sound')!;
    btn.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    btn.classList.toggle('active', soundOn);
  });

  // Journey button
  document.getElementById('btn-journey')?.addEventListener('click', () => {
    const panel = document.getElementById('journey-panel')!;
    panel.classList.toggle('open');
  });

  document.getElementById('journey-panel-close')?.addEventListener('click', () => {
    document.getElementById('journey-panel')!.classList.remove('open');
  });

  // Journey cards
  document.querySelectorAll('.journey-card').forEach(card => {
    card.addEventListener('click', () => {
      const journeyId = (card as HTMLElement).dataset.journey!;
      startJourney(journeyId);
    });
  });

  // Journey stop
  document.getElementById('journey-stop-btn')?.addEventListener('click', stopJourney);

  // Mode toggle
  document.getElementById('btn-mode')?.addEventListener('click', () => {
    const modes: AppMode[] = ['explore', 'journey', 'mirror'];
    const idx = modes.indexOf(currentMode);
    currentMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('btn-mode')!;
    btn.textContent = currentMode.toUpperCase();
    document.body.classList.toggle('mirror-mode', currentMode === 'mirror');
    if (currentMode === 'mirror') {
      setTimeout(() => {
        const chatContainer = document.getElementById('chat-container')!;
        chatContainer.addEventListener('click', () => chatContainer.classList.add('show'));
      }, 500);
    }
  });

  // Clear/Reset
  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    if (confirm('Reset MIND? All memories, personality, and history will be erased.')) {
      await clearAllData();
      localStorage.removeItem('mind_config');
      window.location.reload();
    }
  });

  // Side panel close
  document.getElementById('panel-close')?.addEventListener('click', () => {
    document.getElementById('side-panel')!.classList.remove('open');
  });

  // API Setup
  document.getElementById('api-submit')?.addEventListener('click', async () => {
    const key = (document.getElementById('api-key-input') as HTMLInputElement).value.trim();
    const model = (document.getElementById('model-select') as HTMLSelectElement).value;
    if (!key) return;
    config = { apiKey: key, baseUrl: 'https://api.openai.com/v1', model };
    saveConfig(config);
    hideApiSetup();
    soundEngine?.init();
    showWelcome();
  });

  document.getElementById('api-skip')?.addEventListener('click', () => {
    config = null;
    hideApiSetup();
    addMindMessage('MIND is running without language generation. Type anything to see the brain light up. Click any region to learn about it.');
  });
}

// ─── Main Send Handler ────────────────────────────
async function handleSend() {
  const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
  const text = textInput.value.trim();
  if (!text || isProcessing) return;

  textInput.value = '';
  textInput.style.height = 'auto';
  isProcessing = true;

  // Init sound on first interaction
  soundEngine?.init().catch(() => {});
  soundEngine?.resume();

  addUserMessage(text);

  // Detect emotions and activate brain
  const emotions = detectEmotions(text);
  const activations = mapEmotionsToBrainRegions(emotions);
  brain?.setActivations(activations);

  // Sound for active regions
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

  // Update activity feed
  for (const { region, level } of activations.filter(a => a.level > 0.3)) {
    const config = REGION_CONFIGS[region];
    addFeedItem(`${config.label} — ${getFeedReason(region, emotions)}`);
  }

  if (config?.apiKey) {
    // Generate AI response
    const msgEl = addMindMessage('', true);
    const contentEl = msgEl.querySelector('.msg-content')!;
    const cursor = create('span', 'typing-cursor');
    contentEl.appendChild(cursor);

    try {
      const result = await processInput(text, config, (chunk) => {
        cursor.remove();
        contentEl.textContent += chunk;
        contentEl.appendChild(cursor);
        scrollChat();
      });
      cursor.remove();

      // Update state display
      updateStateDisplay();
      updateStageIndicator();

      // Update trust glow
      const mindState = getMINDState();
      const trustScore = compositeTrustScore(mindState.trust);
      brain?.setTrustGlow(trustScore);
      brain?.setGriefIntensity(mindState.emotionalState.grief);

      // Memory retrieval flash
      if (result.activatedMemories.length > 0 && result.activatedMemories[0].activation > 0.4) {
        showMemoryFlash(result.activatedMemories[0].memory.content);
        brain?.flashLifeReview();
      }

      // Decay activations over 4 seconds
      setTimeout(() => {
        const state = getMINDState();
        const decayedActivations = mapEmotionsToBrainRegions(
          state.lastDetectedEmotions ?? emotions
        ).map(a => ({ ...a, level: a.level * 0.2 }));
        brain?.setActivations(decayedActivations);
      }, 4000);

    } catch (e: any) {
      cursor.remove();
      contentEl.textContent = `[Error: ${e.message ?? 'Connection failed'}]`;
      console.error('MIND response error:', e);
    }
  } else {
    // No API — just show brain activity
    updateStateDisplay();
    setTimeout(() => {
      brain?.setActivations(activations.map(a => ({ ...a, level: a.level * 0.15 })));
    }, 3000);
  }

  isProcessing = false;
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

// ─── Voice Input ──────────────────────────────────
function handleVoiceInput() {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input not supported in this browser.');
    return;
  }
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
  const config = REGION_CONFIGS[regionId];
  const panel = document.getElementById('side-panel')!;
  const state = getMINDState();
  const activation = state.lastActivations.find(a => a.region === regionId)?.level ?? 0;

  document.getElementById('panel-region-name')!.textContent = config.label;
  document.getElementById('panel-region-name')!.style.color = `#${config.activeColor.getHexString()}`;
  document.getElementById('panel-description')!.textContent = config.description;
  document.getElementById('panel-funfact-text')!.textContent = config.funFact;

  const fill = document.getElementById('panel-activation-fill')!;
  const val = document.getElementById('panel-activation-value')!;
  fill.style.width = `${Math.round(activation * 100)}%`;
  fill.style.background = `#${config.activeColor.getHexString()}`;
  val.textContent = `${Math.round(activation * 100)}%`;

  // Show what triggered it
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

        // Sound
        if (soundEngine && step.activations.length > 0) {
          const topRegion = [...step.activations].sort((a, b) => b.level - a.level)[0];
          soundEngine.playRegionActivation(topRegion.region, topRegion.level);
        }
      },
      () => {
        document.getElementById('journey-overlay')!.classList.remove('active');
        journeyController = null;
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

  // Keep feed at max 8 items
  while (feed.children.length > 8) {
    feed.removeChild(feed.lastChild!);
  }
}

function updateStateDisplay() {
  const state = getMINDState();
  const e = state.emotionalState;
  const bars: Record<string, number> = {
    valence: (e.valence + 1) / 2, // normalize -1..1 to 0..1
    arousal: e.arousal,
    trust: e.trust,
    warmth: e.warmth,
    grief: e.grief,
    wonder: e.wonder,
    anxiety: e.anxiety,
    longing: e.longing
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

function showMemoryFlash(memContent: string) {
  const flash = create('div', 'memory-flash');
  flash.textContent = 'MEMORY RETRIEVED';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 2800);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Boot ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
