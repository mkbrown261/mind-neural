// ═══════════════════════════════════════════════════════════════════════════
// MIND SYNC ENGINE  v1.0
// ─────────────────────────────────────────────────────────────────────────
// Effortless cross-device sync — no accounts, no Firebase, no URLs to copy.
//
// How it works:
//   • MIND auto-generates a 6-character SYNC CODE on first use
//   • Pushes state to /api/sync/:code after every interaction
//   • On another device: open /growth, enter the code → instant resume
//   • Growth Interface polls /api/sync/:code/ping every 8s for changes
//
// Architecture:
//   • All API calls go to the same origin (mind-neural.pages.dev)
//   • Cloudflare KV stores data server-side, 30-day auto-renewing TTL
//   • Fails silently — IDB/localStorage are always the canonical local store
//   • No tokens, no auth, no external dependencies
// ═══════════════════════════════════════════════════════════════════════════

const LS_CODE_KEY     = 'mind_sync_code';
const LS_ENABLED_KEY  = 'mind_sync_enabled';
const LS_LAST_SYNC_KEY = 'mind_sync_last';
const API_BASE        = '/api/sync';
const CODE_CHARS      = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no O/0/I/1 ambiguity

// ─── Internal state ───────────────────────────────────────────────────────
let _code:    string  | null = null;
let _enabled: boolean        = false;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _onRemoteUpdate: ((data: RemoteState) => void) | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _lastRemoteSyncAt = 0;

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface SyncPayload {
  snapshot:   object;
  identity?:  object;
  timeline?:  object[];
}

export interface RemoteState {
  snapshot: object;
  identity: object | null;
  timeline: object[];
  ping:     number | null;
  syncAt:   number;
}

// ─── Public: init ─────────────────────────────────────────────────────────

/**
 * Call once on MIND boot. Loads/creates a sync code.
 * Returns the code so the UI can display it.
 */
export function initSync(): { code: string; enabled: boolean } {
  _code    = _lsGet(LS_CODE_KEY) ?? _generateCode();
  _enabled = _lsGet(LS_ENABLED_KEY) === 'true';
  _lsSet(LS_CODE_KEY, _code);
  return { code: _code, enabled: _enabled };
}

/**
 * Enable sync (user has viewed the code and opted in).
 * Immediately pushes current state.
 */
export function enableSync(): void {
  _enabled = true;
  _lsSet(LS_ENABLED_KEY, 'true');
}

/**
 * Disable sync (user opt-out).
 */
export function disableSync(): void {
  _enabled = false;
  _lsSet(LS_ENABLED_KEY, 'false');
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

/**
 * Returns the current sync code (always available even if disabled).
 */
export function getSyncCode(): string {
  if (!_code) { const r = initSync(); _code = r.code; }
  return _code;
}

/**
 * Returns whether sync is enabled.
 */
export function isSyncEnabled(): boolean {
  return _enabled;
}

// ─── Public: push state ───────────────────────────────────────────────────

/**
 * Push state to the sync server. Debounced 2s so rapid interactions
 * don't hammer the API.
 */
export function pushState(payload: SyncPayload): void {
  if (!_enabled || !_code) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => _doPush(payload), 2000);
}

/**
 * Push immediately (e.g. on session close).
 */
export async function pushStateNow(payload: SyncPayload): Promise<void> {
  if (!_enabled || !_code) return;
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  await _doPush(payload);
}

// ─── Public: pull state ───────────────────────────────────────────────────

/**
 * Pull full state for a given code (called on connecting device).
 * Returns null if code not found or offline.
 */
export async function pullState(code: string): Promise<RemoteState | null> {
  const upper = code.toUpperCase().trim();
  if (!_validCode(upper)) return null;
  try {
    const res  = await fetch(`${API_BASE}/${upper}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { found: boolean } & Partial<RemoteState>;
    if (!data.found) return null;
    return {
      snapshot: data.snapshot ?? {},
      identity: data.identity ?? null,
      timeline: data.timeline ?? [],
      ping:     data.ping     ?? null,
      syncAt:   (data.snapshot as any)?._syncAt ?? 0,
    };
  } catch { return null; }
}

/**
 * Check if a code exists on the server (before connecting).
 */
export async function checkCodeExists(code: string): Promise<boolean> {
  const upper = code.toUpperCase().trim();
  if (!_validCode(upper)) return false;
  try {
    const res  = await fetch(`${API_BASE}/${upper}/exists`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json() as { exists: boolean };
    return data.exists === true;
  } catch { return false; }
}

// ─── Public: remote polling (Growth Interface side) ──────────────────────

/**
 * Start polling a remote code for updates (used on the receiving device).
 * Calls onUpdate whenever the remote state changes.
 */
export function startRemotePoll(
  code: string,
  onUpdate: (state: RemoteState) => void,
  intervalMs = 8000
): void {
  const upper = code.toUpperCase().trim();
  if (!_validCode(upper)) return;
  _onRemoteUpdate = onUpdate;

  if (_pollInterval) clearInterval(_pollInterval);

  const check = async () => {
    try {
      const res  = await fetch(`${API_BASE}/${upper}/ping`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const data = await res.json() as { found?: boolean; syncAt?: number; offline?: boolean };
      if (!data.found || data.offline) return;

      const remoteSyncAt = data.syncAt ?? 0;
      if (remoteSyncAt > _lastRemoteSyncAt) {
        _lastRemoteSyncAt = remoteSyncAt;
        // Fetch full state
        const full = await pullState(upper);
        if (full && _onRemoteUpdate) _onRemoteUpdate(full);
      }
    } catch { /* silent */ }
  };

  check(); // immediate check on subscribe
  _pollInterval = setInterval(check, intervalMs);
}

export function stopRemotePoll(): void {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  _onRemoteUpdate = null;
}

// ─── Private: push implementation ────────────────────────────────────────

async function _doPush(payload: SyncPayload): Promise<void> {
  if (!_code) return;
  try {
    const res = await fetch(`${API_BASE}/${_code}/snapshot`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as { syncAt?: number };
      _lsSet(LS_LAST_SYNC_KEY, String(data.syncAt ?? Date.now()));
    }
  } catch { /* silent — IDB is the fallback */ }
}

// ─── Private: code generation ─────────────────────────────────────────────

function _generateCode(): string {
  let code = '';
  const arr = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    arr.forEach((_, i) => arr[i] = Math.floor(Math.random() * 256));
  }
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[arr[i] % CODE_CHARS.length];
  }
  return code;
}

function _validCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

// ─── Private: localStorage ────────────────────────────────────────────────

function _lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function _lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/**
 * Returns the last sync timestamp from localStorage.
 */
export function getLastSyncTime(): number {
  const v = _lsGet(LS_LAST_SYNC_KEY);
  return v ? Number(v) : 0;
}
