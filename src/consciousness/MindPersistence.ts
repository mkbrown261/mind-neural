// ═══════════════════════════════════════════════════════════════════════════
// MIND PERSISTENCE ENGINE  v1.0
// ─────────────────────────────────────────────────────────────────────────
// Extends MIND_DB (IndexedDB) from v3 → v4 with three new object stores:
//
//   identity   — full identity snapshot (profile + observations + MINDIdentity + beliefs)
//   timeline   — growth milestone events  (session opens, belief formations, media events)
//   media      — media inputs analysed by MIND (image/file metadata + extracted traits)
//
// Design rules:
//   • Fully async — never blocks the main thread
//   • Mirrors critical data to localStorage so Growth Interface can read synchronously
//   • Provides a decay scheduler — runs once per session, ages low-weight observations
//   • Session fingerprinting — detects gap duration since last session
//   • Zero external dependencies — browser IDB only
//   • Communicates via IntentLayer only (no Action Layer imports)
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME    = 'MIND_DB';
const DB_VERSION = 4;   // bump from 3 → 4

// ─── Object store names ───────────────────────────────────────────────────
const STORE_MEMORIES = 'memories';
const STORE_META     = 'meta';
const STORE_IDENTITY = 'identity';   // NEW
const STORE_TIMELINE = 'timeline';   // NEW
const STORE_MEDIA    = 'media';      // NEW

// ─── localStorage mirror keys (Growth Interface reads these) ─────────────
export const LS = {
  profile:    'mind_identity_user_profile',
  obs:        'mind_identity_observations',
  identity:   'mind_identity_self',
  beliefs:    'mind_identity_beliefs',
  session:    'mind_identity_last_session',
  snapshot:   'mind_growth_snapshot',
  timeline:   'mind_growth_timeline',
  media:      'mind_growth_media',
} as const;

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface IdentitySnapshot {
  id:           'current';          // singleton record — always overwritten
  profile:      object;
  observations: object[];
  identity:     object;
  beliefs:      object[];
  savedAt:      number;
  sessionCount: number;
}

export interface TimelineEvent {
  id:          string;              // uuid
  ts:          number;              // timestamp
  type:        'session_open'
             | 'session_close'
             | 'belief_formed'
             | 'belief_strengthened'
             | 'milestone'
             | 'media_processed'
             | 'user_nudge'
             | 'era_change';
  label:       string;              // human-readable
  detail:      string;              // extra context
  weight:      number;              // 0–1 importance
}

export interface MediaRecord {
  id:          string;              // uuid
  ts:          number;
  type:        'image' | 'file' | 'text_block' | 'url';
  name:        string;              // filename or URL
  size?:       number;              // bytes
  mimeType?:   string;
  // What MIND extracted
  extractedTraits:   string[];      // e.g. ['creative', 'visual thinker']
  extractedEmotions: string[];      // e.g. ['wonder', 'curiosity']
  extractedThemes:   string[];      // e.g. ['architecture', 'nature']
  summary:           string;        // one-line MIND interpretation
  associatedBeliefs: string[];      // belief statements this reinforced
  weight:            number;        // 0–1 significance
}

// ─── Internal singleton ───────────────────────────────────────────────────
let _db: IDBDatabase | null = null;
let _decayRanThisSession = false;
let _sessionCount = 0;

// ─── DB init ──────────────────────────────────────────────────────────────
export async function initPersistence(): Promise<{ sessionCount: number; gapMs: number }> {
  await _openDB();

  // Load session count
  const stored = await getPersistenceMeta<number>('sessionCount');
  _sessionCount = (stored ?? 0) + 1;
  await setPersistenceMeta('sessionCount', _sessionCount);

  // Detect session gap
  const lastTs = await getPersistenceMeta<number>('lastSessionTs');
  const now    = Date.now();
  const gapMs  = lastTs ? now - lastTs : 0;
  await setPersistenceMeta('lastSessionTs', now);

  // Record timeline event
  await addTimelineEvent({
    id:     uid(),
    ts:     now,
    type:   'session_open',
    label:  'Session ' + _sessionCount,
    detail: gapMs > 0
      ? `Resumed after ${formatGap(gapMs)}`
      : 'First session',
    weight: gapMs > 86_400_000 ? 0.8   // >24 h gap — significant
          : gapMs > 3_600_000  ? 0.5   // >1 h
          : 0.2,
  });

  return { sessionCount: _sessionCount, gapMs };
}

// ─── Open / upgrade DB ────────────────────────────────────────────────────
function _openDB(): Promise<void> {
  if (_db) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d   = (e.target as IDBOpenDBRequest).result;
      const old = e.oldVersion;

      // ── Existing stores (v1–v3) — create only if absent ──
      if (!d.objectStoreNames.contains(STORE_MEMORIES)) {
        const s = d.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
        s.createIndex('timestamp',       'timestamp');
        s.createIndex('encodingStrength','encodingStrength');
        s.createIndex('type',            'type');
      } else if (old < 3) {
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        const s  = tx.objectStore(STORE_MEMORIES);
        if (!s.indexNames.contains('type')) s.createIndex('type','type');
      }
      if (!d.objectStoreNames.contains(STORE_META)) {
        d.createObjectStore(STORE_META, { keyPath: 'key' });
      }

      // ── New stores (v4) ──
      if (!d.objectStoreNames.contains(STORE_IDENTITY)) {
        d.createObjectStore(STORE_IDENTITY, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_TIMELINE)) {
        const s = d.createObjectStore(STORE_TIMELINE, { keyPath: 'id' });
        s.createIndex('ts',   'ts');
        s.createIndex('type', 'type');
      }
      if (!d.objectStoreNames.contains(STORE_MEDIA)) {
        const s = d.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        s.createIndex('ts',   'ts');
        s.createIndex('type', 'type');
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Identity snapshot ────────────────────────────────────────────────────

export async function saveIdentitySnapshot(snap: {
  profile:      object;
  observations: object[];
  identity:     object;
  beliefs:      object[];
}): Promise<void> {
  if (!_db) await _openDB();
  const record: IdentitySnapshot = {
    id:           'current',
    ...snap,
    savedAt:      Date.now(),
    sessionCount: _sessionCount,
  };

  await _put(STORE_IDENTITY, record);

  // Mirror to localStorage for Growth Interface synchronous reads
  _lsSet(LS.profile,    snap.profile);
  _lsSet(LS.obs,        snap.observations);
  _lsSet(LS.identity,   snap.identity);
  _lsSet(LS.beliefs,    snap.beliefs);
  _lsSet(LS.session,    Date.now());
}

export async function loadIdentitySnapshot(): Promise<IdentitySnapshot | null> {
  if (!_db) await _openDB();
  return _get<IdentitySnapshot>(STORE_IDENTITY, 'current');
}

// ─── Timeline ─────────────────────────────────────────────────────────────

export async function addTimelineEvent(evt: Omit<TimelineEvent,'id'> & { id?: string }): Promise<void> {
  if (!_db) await _openDB();
  const record: TimelineEvent = { id: evt.id ?? uid(), ...evt };
  await _put(STORE_TIMELINE, record);

  // Mirror last 30 events to localStorage for Growth Interface
  const all = await getAllTimelineEvents();
  _lsSet(LS.timeline, all.slice(-30));
}

export async function getAllTimelineEvents(): Promise<TimelineEvent[]> {
  if (!_db) await _openDB();
  return _getAll<TimelineEvent>(STORE_TIMELINE, 'ts');
}

// ─── Media ────────────────────────────────────────────────────────────────

export async function saveMediaRecord(rec: Omit<MediaRecord,'id'|'ts'> & { id?: string; ts?: number }): Promise<MediaRecord> {
  if (!_db) await _openDB();
  const record: MediaRecord = {
    id: rec.id ?? uid(),
    ts: rec.ts ?? Date.now(),
    ...rec,
  };
  await _put(STORE_MEDIA, record);

  // Mirror last 20 media records
  const all = await getAllMedia();
  _lsSet(LS.media, all.slice(-20));

  // Also add to timeline
  await addTimelineEvent({
    ts:     record.ts,
    type:   'media_processed',
    label:  `Media: ${record.name}`,
    detail: record.summary,
    weight: record.weight,
  });

  return record;
}

export async function getAllMedia(): Promise<MediaRecord[]> {
  if (!_db) await _openDB();
  return _getAll<MediaRecord>(STORE_MEDIA, 'ts');
}

// ─── Belief event helpers ─────────────────────────────────────────────────

export async function recordBeliefFormed(statement: string, confidence: number): Promise<void> {
  await addTimelineEvent({
    ts:     Date.now(),
    type:   'belief_formed',
    label:  'Belief formed',
    detail: statement.substring(0, 80),
    weight: Math.min(1, confidence + 0.1),
  });
}

export async function recordBeliefStrengthened(statement: string, confidence: number): Promise<void> {
  await addTimelineEvent({
    ts:     Date.now(),
    type:   'belief_strengthened',
    label:  'Belief strengthened',
    detail: statement.substring(0, 80),
    weight: confidence,
  });
}

export async function recordMilestone(label: string, detail: string, weight = 0.7): Promise<void> {
  await addTimelineEvent({
    ts:     Date.now(),
    type:   'milestone',
    label,
    detail,
    weight,
  });
}

export async function recordUserNudge(statement: string, direction: 'reinforce' | 'diminish'): Promise<void> {
  await addTimelineEvent({
    ts:     Date.now(),
    type:   'user_nudge',
    label:  direction === 'reinforce' ? 'User reinforced memory' : 'User diminished memory',
    detail: statement.substring(0, 80),
    weight: direction === 'reinforce' ? 0.8 : 0.4,
  });
}

// ─── Decay scheduler ─────────────────────────────────────────────────────
// Runs once per session. Decays timeline events older than 90 days (weight < 0.3 → prune).
// Low-weight media records older than 60 days are pruned.

export async function runDecayScheduler(): Promise<void> {
  if (_decayRanThisSession) return;
  _decayRanThisSession = true;

  const now       = Date.now();
  const day90     = 90 * 86_400_000;
  const day60     = 60 * 86_400_000;

  // Prune old low-weight timeline events
  const timeline  = await getAllTimelineEvents();
  const pruneTL   = timeline.filter(e =>
    (now - e.ts) > day90 && e.weight < 0.3 && e.type !== 'milestone'
  );
  for (const ev of pruneTL) await _delete(STORE_TIMELINE, ev.id);

  // Prune old low-weight media
  const media     = await getAllMedia();
  const pruneM    = media.filter(m => (now - m.ts) > day60 && m.weight < 0.35);
  for (const m of pruneM) await _delete(STORE_MEDIA, m.id);
}

// ─── Session management meta ──────────────────────────────────────────────

export async function getPersistenceMeta<T>(key: string): Promise<T | null> {
  if (!_db) await _openDB();
  return new Promise((resolve, reject) => {
    const tx  = _db!.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror   = () => reject(req.error);
  });
}

export async function setPersistenceMeta<T>(key: string, value: T): Promise<void> {
  if (!_db) await _openDB();
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ─── Media analysis helper ────────────────────────────────────────────────
// Called from app.ts when user uploads/pastes an image or file.
// Extracts traits/emotions/themes from file metadata (no server needed).

export function analyseMediaMetadata(file: File): Omit<MediaRecord, 'id' | 'ts'> {
  const name      = file.name || 'unknown';
  const mime      = file.type || '';
  const isImage   = mime.startsWith('image/');
  const isVideo   = mime.startsWith('video/');
  const isAudio   = mime.startsWith('audio/');
  const isDoc     = /pdf|word|text/.test(mime);

  const traits:   string[] = [];
  const emotions: string[] = [];
  const themes:   string[] = [];

  // Infer from filename
  const nameLow = name.toLowerCase();
  if (/music|beat|track|song|audio|wav|mp3/.test(nameLow)) {
    traits.push('music creator'); emotions.push('expressive'); themes.push('music');
  }
  if (/design|art|visual|photo|img|pic/.test(nameLow)) {
    traits.push('visual thinker'); emotions.push('creative'); themes.push('visual art');
  }
  if (/code|src|script|app|component/.test(nameLow)) {
    traits.push('engineer'); emotions.push('focused'); themes.push('technology');
  }
  if (/write|story|poem|essay|note|journal/.test(nameLow)) {
    traits.push('writer'); emotions.push('reflective'); themes.push('writing');
  }
  if (/game|level|world|map/.test(nameLow)) {
    traits.push('game creator'); themes.push('game design');
  }

  if (isImage)  { themes.push('visual');  traits.push('visual thinker'); }
  if (isAudio)  { themes.push('sound');   traits.push('audio oriented'); }
  if (isVideo)  { themes.push('video');   traits.push('multimedia'); }
  if (isDoc)    { themes.push('writing'); traits.push('writer'); }

  const unique = <T>(a: T[]) => [...new Set(a)];
  return {
    type:              isImage ? 'image' : 'file',
    name,
    size:              file.size,
    mimeType:          mime,
    extractedTraits:   unique(traits),
    extractedEmotions: unique(emotions),
    extractedThemes:   unique(themes),
    summary:           `Shared ${isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'file'}: ${name}`,
    associatedBeliefs: [],
    weight:            traits.length > 0 ? 0.6 : 0.35,
  };
}

// ─── IDB helpers ──────────────────────────────────────────────────────────

function _put<T>(store: string, record: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

function _get<T>(store: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx  = _db!.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result ?? null) as T | null);
    req.onerror   = () => reject(req.error);
  });
}

function _getAll<T>(store: string, indexName?: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx  = _db!.transaction(store, 'readonly');
    const src = indexName && tx.objectStore(store).indexNames.contains(indexName)
      ? tx.objectStore(store).index(indexName)
      : tx.objectStore(store);
    const req = (src as IDBObjectStore | IDBIndex).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror   = () => reject(req.error);
  });
}

function _delete(store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function _lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

export function formatGap(ms: number): string {
  if (ms < 60_000)          return 'a moment';
  if (ms < 3_600_000)       return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000)      return `${Math.round(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000)  return `${Math.round(ms / 86_400_000)}d`;
  return `${Math.round(ms / (7 * 86_400_000))}w`;
}
