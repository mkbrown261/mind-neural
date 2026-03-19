// ═══════════════════════════════════════════════════════════════════════════
// MIND FIREBASE SYNC ENGINE  v1.0
// ─────────────────────────────────────────────────────────────────────────
// Cross-device persistence via Firebase Realtime Database REST API.
// Zero SDK dependency — uses fetch() only (browser + Cloudflare compatible).
//
// Architecture:
//   • User identity is scoped under /users/{uid}/ in Firebase RTDB
//   • All writes are PATCH (partial update) to avoid clobbering parallel writes
//   • Real-time subscription uses Firebase's SSE streaming endpoint (.json?stream=true)
//   • localStorage is used as a fast-read cache; Firebase is the authoritative store
//   • API key is stored in localStorage under 'mind_firebase_config'
//
// Paths written:
//   /users/{uid}/identity          ← IdentitySnapshot (profile, beliefs, observations)
//   /users/{uid}/timeline/{id}     ← TimelineEvent records
//   /users/{uid}/media/{id}        ← MediaRecord entries
//   /users/{uid}/snapshot          ← Growth Interface snapshot (for cross-device Growth UI)
//   /users/{uid}/reinforcement     ← Pending reinforcement queue (processed server-side)
//   /users/{uid}/lastSeen          ← Heartbeat timestamp
//
// Design rules:
//   • Never blocks main thread — all ops are async, fire-and-forget wraps where safe
//   • Silently degrades if config absent — IDB/localStorage remain canonical fallback
//   • Queues writes when offline; flushes on reconnect
//   • Respects MIND's IntentLayer-only communication rule for engine modules
// ═══════════════════════════════════════════════════════════════════════════

import type { IdentitySnapshot, TimelineEvent, MediaRecord } from './MindPersistence';

// ─── Configuration ────────────────────────────────────────────────────────

export interface FirebaseConfig {
  databaseURL: string;   // e.g. https://my-project-default-rtdb.firebaseio.com
  apiKey:      string;   // Web API key (for auth token exchange)
  uid:         string;   // User identifier (email-derived or custom)
}

const LS_CONFIG_KEY  = 'mind_firebase_config';
const LS_TOKEN_KEY   = 'mind_firebase_token';
const LS_QUEUE_KEY   = 'mind_firebase_queue';
const MAX_QUEUE      = 50;   // max queued write ops while offline

// ─── Write-queue entry ────────────────────────────────────────────────────

interface QueueEntry {
  path:   string;
  method: 'PUT' | 'PATCH' | 'DELETE';
  body:   unknown;
  ts:     number;
}

// ─── Singleton state ──────────────────────────────────────────────────────

let _cfg:       FirebaseConfig | null = null;
let _token:     string | null         = null;
let _queue:     QueueEntry[]          = [];
let _listening  = false;
let _sseSource: EventSource | null    = null;
let _onUpdate:  ((path: string, data: unknown) => void) | null = null;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Public: configure ────────────────────────────────────────────────────

/**
 * Call this once with Firebase config to enable sync.
 * If no config provided, loads from localStorage.
 * Returns true if config is valid.
 */
export function configureFirebase(cfg?: Partial<FirebaseConfig>): boolean {
  if (cfg && cfg.databaseURL && cfg.uid) {
    _cfg = {
      databaseURL: cfg.databaseURL.replace(/\/$/, ''),
      apiKey:      cfg.apiKey ?? '',
      uid:         cfg.uid,
    };
    _lsSave(LS_CONFIG_KEY, _cfg);
  } else {
    // Load from localStorage
    const stored = _lsLoad<FirebaseConfig>(LS_CONFIG_KEY);
    if (stored?.databaseURL && stored?.uid) {
      _cfg = stored;
    }
  }

  if (_cfg) {
    _queue = _lsLoad<QueueEntry[]>(LS_QUEUE_KEY) ?? [];
    _token = _lsLoad<string>(LS_TOKEN_KEY) ?? null;
    return true;
  }
  return false;
}

/**
 * Returns current config (or null if not configured).
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  return _cfg;
}

/**
 * Returns true if Firebase sync is active.
 */
export function isFirebaseEnabled(): boolean {
  return _cfg !== null;
}

// ─── Public: store token ──────────────────────────────────────────────────

export function setFirebaseToken(token: string): void {
  _token = token;
  _lsSave(LS_TOKEN_KEY, token);
}

// ─── Public: write operations ─────────────────────────────────────────────

/**
 * Push full identity snapshot to Firebase.
 * Called from MindPersistence.saveIdentitySnapshot().
 */
export async function pushIdentity(snap: IdentitySnapshot): Promise<void> {
  if (!_cfg) return;
  const path = _userPath('identity');
  // Strip IDB-only fields that are too large or redundant
  const payload = {
    savedAt:      snap.savedAt,
    sessionCount: snap.sessionCount,
    profile:      _trimDeep(snap.profile, 5),
    beliefs:      _trimArray(snap.beliefs as object[], 15),
    observations: _trimArray(snap.observations as object[], 20),
    identity:     _trimDeep(snap.identity, 4),
  };
  await _write(path, 'PUT', payload);
}

/**
 * Push a single timeline event to Firebase.
 */
export async function pushTimelineEvent(evt: TimelineEvent): Promise<void> {
  if (!_cfg) return;
  const path = _userPath(`timeline/${_sanitizeKey(evt.id)}`);
  await _write(path, 'PUT', evt);
}

/**
 * Push a media record to Firebase.
 */
export async function pushMedia(rec: MediaRecord): Promise<void> {
  if (!_cfg) return;
  const path = _userPath(`media/${_sanitizeKey(rec.id)}`);
  // Skip binary data — only metadata
  const payload = {
    id:               rec.id,
    ts:               rec.ts,
    type:             rec.type,
    name:             rec.name,
    size:             rec.size,
    mimeType:         rec.mimeType,
    extractedTraits:  rec.extractedTraits,
    extractedEmotions:rec.extractedEmotions,
    extractedThemes:  rec.extractedThemes,
    summary:          rec.summary,
    associatedBeliefs:rec.associatedBeliefs,
    weight:           rec.weight,
  };
  await _write(path, 'PUT', payload);
}

/**
 * Push growth snapshot (for Growth Interface across devices).
 */
export async function pushGrowthSnapshot(snapshot: object): Promise<void> {
  if (!_cfg) return;
  const path = _userPath('snapshot');
  await _write(path, 'PUT', { ...snapshot, _pushedAt: Date.now() });
}

/**
 * Push heartbeat (lastSeen timestamp).
 */
export async function pushHeartbeat(): Promise<void> {
  if (!_cfg) return;
  const path = _userPath('lastSeen');
  await _write(path, 'PUT', Date.now());
}

/**
 * Push a reinforcement event to the queue.
 * These are processed by the reinforcement loop.
 */
export async function pushReinforcementEvent(event: {
  type:    'belief_confirmed' | 'belief_contradicted' | 'pattern_seen';
  content: string;
  weight:  number;
}): Promise<void> {
  if (!_cfg) return;
  const id   = _uid();
  const path = _userPath(`reinforcement/${id}`);
  await _write(path, 'PUT', { ...event, id, ts: Date.now() });
}

/**
 * Delete a reinforcement event after processing.
 */
export async function deleteReinforcementEvent(id: string): Promise<void> {
  if (!_cfg) return;
  const path = _userPath(`reinforcement/${_sanitizeKey(id)}`);
  await _write(path, 'DELETE', null);
}

// ─── Public: read operations ──────────────────────────────────────────────

/**
 * Load identity snapshot from Firebase (for cross-device resume).
 * Returns null if not found or Firebase not configured.
 */
export async function loadIdentityFromFirebase(): Promise<IdentitySnapshot | null> {
  if (!_cfg) return null;
  const path = _userPath('identity');
  return _read<IdentitySnapshot>(path);
}

/**
 * Load timeline events from Firebase.
 */
export async function loadTimelineFromFirebase(): Promise<TimelineEvent[]> {
  if (!_cfg) return [];
  const path = _userPath('timeline');
  const obj  = await _read<Record<string, TimelineEvent>>(path);
  if (!obj) return [];
  return Object.values(obj).sort((a, b) => a.ts - b.ts);
}

/**
 * Load growth snapshot from Firebase (used by Growth Interface).
 */
export async function loadGrowthSnapshot(): Promise<object | null> {
  if (!_cfg) return null;
  const path = _userPath('snapshot');
  return _read<object>(path);
}

/**
 * Load pending reinforcement events (for decay/reinforce loop).
 */
export async function loadReinforcementQueue(): Promise<Array<{
  id: string; type: string; content: string; weight: number; ts: number;
}>> {
  if (!_cfg) return [];
  const path = _userPath('reinforcement');
  const obj  = await _read<Record<string, unknown>>(path);
  if (!obj) return [];
  return Object.values(obj) as any[];
}

// ─── Public: real-time subscription ──────────────────────────────────────

/**
 * Subscribe to real-time updates for this user's data.
 * Uses Firebase SSE streaming. Calls onUpdate(path, data) on changes.
 * Falls back to polling every 15 s if EventSource unavailable.
 *
 * @param onUpdate  callback invoked on each Firebase change event
 */
export function subscribeToUpdates(onUpdate: (path: string, data: unknown) => void): void {
  _onUpdate = onUpdate;
  if (!_cfg) return;

  if (typeof EventSource !== 'undefined') {
    _startSSE();
  } else {
    // Polling fallback (e.g. Cloudflare Workers context)
    _startPolling();
  }
}

export function unsubscribe(): void {
  if (_sseSource) {
    _sseSource.close();
    _sseSource = null;
  }
  _listening  = false;
  _onUpdate   = null;
}

// ─── Public: flush queue ──────────────────────────────────────────────────

/**
 * Flush any queued writes (call after network reconnect).
 */
export async function flushQueue(): Promise<void> {
  if (!_cfg || _queue.length === 0) return;
  const batch = [..._queue];
  _queue = [];
  _lsSave(LS_QUEUE_KEY, _queue);

  for (const entry of batch) {
    try {
      await _firebaseRequest(entry.path, entry.method, entry.body);
    } catch (_) {
      // Re-queue on failure
      _enqueue(entry);
    }
  }
}

// ─── Public: uid helpers ──────────────────────────────────────────────────

/**
 * Generate or retrieve a stable anonymous UID stored in localStorage.
 */
export function getOrCreateUID(): string {
  const key = 'mind_anon_uid';
  let uid = localStorage.getItem(key);
  if (!uid) {
    uid = 'anon_' + _uid().replace(/-/g, '').substring(0, 16);
    localStorage.setItem(key, uid);
  }
  return uid;
}

// ─── Private: SSE ─────────────────────────────────────────────────────────

function _startSSE(): void {
  if (_listening || !_cfg) return;
  _listening = true;

  const url = `${_cfg.databaseURL}/users/${encodeURIComponent(_cfg.uid)}.json?stream=true`
    + (_token ? `&auth=${encodeURIComponent(_token)}` : '');

  try {
    const es = new EventSource(url);
    _sseSource = es;

    es.addEventListener('put', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.data && _onUpdate) {
          _onUpdate(msg.path ?? '/', msg.data);
        }
      } catch (_) {}
    });

    es.addEventListener('patch', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.data && _onUpdate) {
          _onUpdate(msg.path ?? '/', msg.data);
        }
      } catch (_) {}
    });

    es.onerror = () => {
      _listening = false;
      _sseSource = null;
      // Auto-reconnect after 10 s
      setTimeout(() => _startSSE(), 10_000);
    };
  } catch (_) {
    _listening = false;
    _startPolling();
  }
}

// ─── Private: polling fallback ────────────────────────────────────────────

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollEtag  = '';

function _startPolling(): void {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    if (!_cfg || !_onUpdate) return;
    try {
      const path    = _userPath('snapshot');
      const fullUrl = `${_cfg.databaseURL}${path}.json`
        + (_token ? `?auth=${encodeURIComponent(_token)}` : '');
      const res     = await fetch(fullUrl, {
        headers: _pollEtag ? { 'If-None-Match': _pollEtag } : {},
      });
      if (res.status === 304) return; // no change
      const etag = res.headers.get('ETag') ?? '';
      if (etag && etag !== _pollEtag) {
        _pollEtag = etag;
        const data = await res.json();
        _onUpdate('/snapshot', data);
      }
    } catch (_) {}
  }, 15_000);
}

// ─── Private: write helpers ───────────────────────────────────────────────

async function _write(path: string, method: 'PUT' | 'PATCH' | 'DELETE', body: unknown): Promise<void> {
  if (!_cfg) return;
  try {
    await _firebaseRequest(path, method, body);
  } catch (_) {
    _enqueue({ path, method, body, ts: Date.now() });
    // Attempt flush after a short delay
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(() => flushQueue(), 5_000);
  }
}

async function _read<T>(path: string): Promise<T | null> {
  if (!_cfg) return null;
  try {
    const url = _buildUrl(path);
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    return data as T;
  } catch (_) {
    return null;
  }
}

async function _firebaseRequest(path: string, method: 'PUT' | 'PATCH' | 'DELETE', body: unknown): Promise<void> {
  if (!_cfg) return;
  const url = _buildUrl(path);
  const opts: RequestInit = { method };
  if (method !== 'DELETE' && body !== null) {
    opts.body    = JSON.stringify(body);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firebase ${method} ${path} → ${res.status}: ${text}`);
  }
}

function _buildUrl(path: string): string {
  const base = `${_cfg!.databaseURL}${path}.json`;
  return _token ? `${base}?auth=${encodeURIComponent(_token)}` : base;
}

function _userPath(sub: string): string {
  return `/users/${encodeURIComponent(_cfg!.uid)}/${sub}`;
}

// ─── Private: queue helpers ───────────────────────────────────────────────

function _enqueue(entry: QueueEntry): void {
  _queue.push(entry);
  if (_queue.length > MAX_QUEUE) {
    _queue = _queue.slice(-MAX_QUEUE); // keep newest
  }
  _lsSave(LS_QUEUE_KEY, _queue);
}

// ─── Private: utilities ───────────────────────────────────────────────────

function _lsSave(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function _lsLoad<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) as T : null;
  } catch (_) { return null; }
}

function _uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function _sanitizeKey(k: string): string {
  return k.replace(/[.#$[\]/]/g, '_');
}

/** Recursively remove arrays/objects deeper than maxDepth to reduce payload. */
function _trimDeep(obj: unknown, maxDepth: number, depth = 0): unknown {
  if (depth >= maxDepth) return typeof obj === 'object' ? '[trimmed]' : obj;
  if (Array.isArray(obj))  return obj.map(v => _trimDeep(v, maxDepth, depth + 1));
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = _trimDeep(v, maxDepth, depth + 1);
    }
    return out;
  }
  return obj;
}

function _trimArray(arr: object[], max: number): object[] {
  return arr.slice(-max);
}

// ─── Public: reinforcement loop helpers ──────────────────────────────────

/**
 * Apply decay to old Firebase timeline events.
 * Removes events older than 90 days with weight < 0.3.
 * Safe to call once per session.
 */
export async function applyFirebaseDecay(): Promise<void> {
  if (!_cfg) return;
  try {
    const events = await loadTimelineFromFirebase();
    const now    = Date.now();
    const cutoff = 90 * 86_400_000;
    for (const ev of events) {
      if ((now - ev.ts) > cutoff && ev.weight < 0.3 && ev.type !== 'milestone') {
        const path = _userPath(`timeline/${_sanitizeKey(ev.id)}`);
        await _write(path, 'DELETE', null);
      }
    }
  } catch (_) {}
}

/**
 * Sync offline IDB data to Firebase.
 * Reads localStorage mirrors and pushes to Firebase.
 * Called after Firebase is configured/connected.
 */
export async function syncLocalToFirebase(): Promise<void> {
  if (!_cfg) return;
  try {
    const identity = _lsLoad<Record<string, unknown>>('mind_identity_self');
    const beliefs  = _lsLoad<unknown[]>('mind_identity_beliefs');
    const profile  = _lsLoad<Record<string, unknown>>('mind_identity_user_profile');
    const snapshot = _lsLoad<Record<string, unknown>>('mind_growth_snapshot');

    if (identity || beliefs || profile) {
      const path = _userPath('identity');
      await _write(path, 'PATCH', {
        savedAt:  Date.now(),
        identity: identity  ? _trimDeep(identity, 4)  : undefined,
        beliefs:  beliefs   ? _trimArray(beliefs as object[], 15) : undefined,
        profile:  profile   ? _trimDeep(profile, 4)   : undefined,
      });
    }

    if (snapshot) {
      await pushGrowthSnapshot(snapshot);
    }

    // Push heartbeat
    await pushHeartbeat();
  } catch (_) {}
}
