// ═══════════════════════════════════════
// STARTUP CONTROLLER  v2
// Enforces strict 5-state initialization sequence.
// MIND must NEVER run in a broken state.
//
// STATE MACHINE:
//   PRE_INIT      — nothing running, DOM not ready
//   MODEL_SELECT  — user picks provider (Groq / OpenAI / Template / Skip)
//   API_KEY       — user enters key; validated before proceeding
//   INIT          — systems initializing in required order
//   READY         — all systems verified, input enabled
//
// RULES:
//   - No API call ever fires before state === READY
//   - Input is disabled until state === READY
//   - Any failure surfaces a clear error + retry path
//   - Reset always returns to PRE_INIT cleanly
//   - Removing this file breaks nothing in core modules
// ═══════════════════════════════════════

export type StartupState =
  | 'PRE_INIT'      // Nothing running. DOM not ready.
  | 'MODEL_SELECT'  // User must select a provider/model.
  | 'API_KEY'       // User must enter and validate API key.
  | 'INIT'          // Systems initializing in required order.
  | 'READY';        // All systems live. Input enabled.

export type StartupStep =
  | 'memory'      // EME + AMN
  | 'state'       // ESE + SSM
  | 'personality' // PES
  | 'trust'       // TA
  | 'response'    // RGP / UnderstandingEngine
  | 'brain';      // BrainVisualization

export interface StartupStatus {
  state:         StartupState;
  step:          StartupStep | null;
  error:         string | null;
  apiValidated:  boolean;
  model:         string | null;
  provider:      'groq' | 'openai' | 'template' | 'none' | null;
  sessionLocked: boolean;  // true after first message sent
}

type Listener = (status: StartupStatus) => void;

export class StartupController {
  private status: StartupStatus = {
    state:         'PRE_INIT',
    step:          null,
    error:         null,
    apiValidated:  false,
    model:         null,
    provider:      null,
    sessionLocked: false
  };

  private listeners: Listener[] = [];

  // ─── Subscribe to state changes ───────────────────
  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    fn({ ...this.status });                   // emit current state immediately
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private emit() {
    const snap = { ...this.status };
    for (const fn of this.listeners) { try { fn(snap); } catch {} }
  }

  // ─── State getters ────────────────────────────────
  get current():       StartupState         { return this.status.state; }
  get isReady():       boolean              { return this.status.state === 'READY'; }
  get isApiValid():    boolean              { return this.status.apiValidated; }
  get model():         string | null        { return this.status.model; }
  get provider():      StartupStatus['provider'] { return this.status.provider; }
  get sessionLocked(): boolean              { return this.status.sessionLocked; }
  get error():         string | null        { return this.status.error; }

  // ─── Guard: is it safe to call the API? ──────────
  canCallAPI(): boolean {
    return this.status.state === 'READY' && this.status.apiValidated;
  }

  // ─── Transition: PRE_INIT → MODEL_SELECT ──────────
  // Called once loading animation completes.
  transitionToModelSelect(): void {
    if (this.status.state !== 'PRE_INIT') return;
    this.status = { ...this.status, state: 'MODEL_SELECT', error: null };
    this.emit();
  }

  // ─── Transition: MODEL_SELECT → API_KEY ───────────
  // Called when user selects a provider.
  // For template/skip providers, go straight to INIT (no key needed).
  transitionToApiKey(provider: 'groq' | 'openai' | 'template' | 'none'): void {
    if (this.status.state !== 'MODEL_SELECT' && this.status.state !== 'API_KEY') return;
    this.status = {
      ...this.status,
      state:    (provider === 'template' || provider === 'none') ? 'INIT' : 'API_KEY',
      provider,
      error:    null
    };
    // For no-key providers, also mark api as validated
    if (provider === 'template' || provider === 'none') {
      this.status.apiValidated = true;
    }
    this.emit();
  }

  // ─── Transition: API_KEY → INIT ───────────────────
  // Called only after API key is verified successfully.
  transitionToInit(model: string): void {
    // Allow from API_KEY or MODEL_SELECT (for returning users with saved config)
    if (this.status.state !== 'API_KEY' &&
        this.status.state !== 'MODEL_SELECT' &&
        this.status.state !== 'API_SETUP' as any) return;
    this.status = {
      ...this.status,
      state:        'INIT',
      model,
      apiValidated: true,
      error:        null
    };
    this.emit();
  }

  // ─── Transition: INIT → READY ─────────────────────
  transitionToReady(): void {
    if (this.status.state !== 'INIT') return;
    this.status = { ...this.status, state: 'READY', step: null, error: null };
    this.emit();
  }

  // ─── Report init step progress ────────────────────
  setStep(step: StartupStep): void {
    this.status = { ...this.status, step, error: null };
    this.emit();
  }

  // ─── Signal initialization failure ───────────────
  // Surfaces error + returns to API_KEY so user can retry the key entry.
  fail(step: StartupStep | null, message: string): void {
    this.status = {
      ...this.status,
      state: 'API_KEY',
      step:  null,
      error: `Initialization failed${step ? ' at [' + step + ']' : ''}: ${message}`
    };
    this.emit();
  }

  // ─── Return to MODEL_SELECT from any state ────────
  // Use when key is invalid and user needs to pick a new provider.
  returnToModelSelect(): void {
    this.status = {
      ...this.status,
      state:        'MODEL_SELECT',
      step:         null,
      error:        null,
      apiValidated: false,
      model:        null,
      provider:     null
    };
    this.emit();
  }

  // ─── Lock session after first message sent ────────
  lockSession(): void {
    if (this.status.sessionLocked) return;
    this.status = { ...this.status, sessionLocked: true };
    this.emit();
  }

  // ─── RESET — return to PRE_INIT cleanly ──────────
  // Caller is responsible for stopping tick + clearing data.
  reset(): void {
    this.status = {
      state:         'PRE_INIT',
      step:          null,
      error:         null,
      apiValidated:  false,
      model:         null,
      provider:      null,
      sessionLocked: false
    };
    this.emit();
  }

  // ─── Legacy compatibility: transitionToApiSetup ────
  // Maps to MODEL_SELECT for callers using the old API.
  transitionToApiSetup(): void {
    if (this.status.state === 'PRE_INIT') {
      this.status = { ...this.status, state: 'MODEL_SELECT', error: null };
      this.emit();
    }
  }
}

// ─── Singleton export ─────────────────────────────
export const startupController = new StartupController();
