// ═══════════════════════════════════════
// SYSTEM 1: EMOTIONAL MEMORY ENGINE (EME)
// Extended with: Meaning Layer, InternalThought type
// DB schema v3
// ═══════════════════════════════════════

export type EmotionCategory =
  | 'joy' | 'fear' | 'grief' | 'love' | 'anger'
  | 'curiosity' | 'shame' | 'wonder' | 'loneliness'
  | 'connection' | 'pain' | 'trust' | 'betrayal';

export interface EmotionalSignature {
  valence: number;      // -1.0 to +1.0
  intensity: number;    // 0.0 to 1.0
  categories: EmotionCategory[];
}

export interface SomaticState {
  tension: number;
  warmth: number;
  weight: number;
  expansion: number;
  stillness: number;
  openness: number;
  // ── v2: embodied cognition ─────────────────────────────────────────────────
  throatConstriction?: number;  // something unsaid; truth that can't get out
  jawTension?:         number;  // irritation, resistance, held back
  heartRate?:          number;  // autonomic arousal
  breathDepth?:        number;  // deep vs shallow; grief = shallow
  liminalFeeling?:     number;  // on the edge of something
  peripherySharp?:     number;  // attention narrowed vs wide
}

// ─── EXTENSION 5: Meaning Layer ───────────────────
export interface MemoryMeaning {
  interpretation: string;       // what MIND made of this
  emotionalLesson: string;      // what it learned emotionally
  certainty: number;            // 0.0–1.0, grows with repetition
  lastUpdated: number;          // timestamp
}

export type MemoryType = 'episodic' | 'internalThought' | 'identity_disclosure';

// ─── FOUNDING MEMORY (Onboarding) ──────────────────
// Memories created during onboarding bypass decay and carry +0.2 association weight
export const FOUNDING_ENCODING_FLOOR = 0.85;
export const FOUNDING_ASSOCIATION_BONUS = 0.2;

export interface Memory {
  id: string;
  timestamp: number;
  content: string;
  type: MemoryType;
  emotionalSignature: EmotionalSignature;
  encodingStrength: number;
  isTraumatic: boolean;
  associations: string[];
  somaticEcho: SomaticState;
  retrievalCount: number;
  lastRetrieved: number | null;
  decayRate: number;
  // Extension 5
  meaning?: MemoryMeaning;
  // Extension 1 — for internalThought type
  originMemoryIds?: string[];
  persistenceScore?: number;
  // Founding Memory — onboarding
  foundingMemory?: boolean;
  createdDuring?: 'onboarding' | 'normal';
  collection?: string;   // e.g. 'founding_memories'
}

// ─── DB ───────────────────────────────────────────
export function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const DB_NAME = 'MIND_DB';
const STORE_NAME = 'memories';
const META_STORE = 'meta';
// ⚠ MUST stay in sync with MindPersistence.ts DB_VERSION.
// Both files open the same 'MIND_DB' database — if their versions differ,
// the browser throws: "The requested version (3) is less than the existing version (4)"
// and MIND fails to initialize.
const DB_VERSION = 4;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result;
      const oldVersion = e.oldVersion;

      // ── v1–v3 stores (memories + meta) ─────────────────────────────────────
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('encodingStrength', 'encodingStrength');
        store.createIndex('type', 'type');
      } else if (oldVersion < 3) {
        // Add 'type' index to existing store
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains('type')) {
          store.createIndex('type', 'type');
        }
      }
      if (!d.objectStoreNames.contains(META_STORE)) {
        d.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      // ── v4 stores (identity, timeline, media) ───────────────────────────────
      // These are owned by MindPersistence.ts but must be declared here too
      // because IndexedDB requires ALL stores for a given version to be created
      // inside the SAME onupgradeneeded handler that bumps to that version.
      if (!d.objectStoreNames.contains('identity')) {
        d.createObjectStore('identity', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('timeline')) {
        const s = d.createObjectStore('timeline', { keyPath: 'id' });
        s.createIndex('ts',   'ts');
        s.createIndex('type', 'type');
      }
      if (!d.objectStoreNames.contains('media')) {
        const s = d.createObjectStore('media', { keyPath: 'id' });
        s.createIndex('ts',   'ts');
        s.createIndex('type', 'type');
      }
    };

    req.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve();
    };

    // ── Version conflict self-heal ─────────────────────────────────────────
    // If the browser has MIND_DB at a HIGHER version than we're requesting
    // (shouldn't happen after the v3→v4 fix, but guard against future regressions
    // or browsers that ran a newer build then opened an older cached page),
    // delete and recreate the DB so MIND can always start.
    req.onerror = (e) => {
      const err = (e.target as IDBOpenDBRequest).error;
      const isVersionConflict =
        err?.name === 'VersionError' ||
        (err?.message ?? '').toLowerCase().includes('less than the existing version');

      if (isVersionConflict) {
        console.warn('[MIND IDB] Version conflict — clearing DB and retrying…');
        db = null;
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => initDB().then(resolve).catch(reject);
        del.onerror   = () => reject(err);
      } else {
        reject(err);
      }
    };

    // ── Blocked handler (another tab has DB open at old version) ─────────────
    req.onblocked = () => {
      console.warn('[MIND IDB] DB upgrade blocked — close other MIND tabs and refresh.');
      // Don't reject immediately; let the user know via the error path if needed
    };
  });
}

export async function storeMemory(memory: Memory): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(memory);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllMemories(): Promise<Memory[]> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      // Migrate legacy records that lack 'type'
      const results: Memory[] = (req.result || []).map((m: any) => ({
        type: 'episodic' as MemoryType,
        ...m
      }));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getMemory(id: string): Promise<Memory | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const r = req.result;
      if (r && !r.type) r.type = 'episodic';
      resolve(r || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateMemory(memory: Memory): Promise<void> {
  return storeMemory(memory);
}

export async function getMeta<T>(key: string): Promise<T | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Founding Memory Override ─────────────────────
// Apply the founding memory rules after initial creation
export function applyFoundingOverride(memory: Memory): Memory {
  return {
    ...memory,
    foundingMemory: true,
    createdDuring: 'onboarding',
    collection: 'founding_memories',
    decayRate: 0,
    encodingStrength: Math.max(memory.encodingStrength, FOUNDING_ENCODING_FLOOR)
  };
}

// Check if a memory is founding and boost its activation score
export function foundingActivationBoost(memory: Memory, baseActivation: number): number {
  if (memory.foundingMemory) {
    return Math.min(1, baseActivation + FOUNDING_ASSOCIATION_BONUS);
  }
  return baseActivation;
}

// ─── Memory Factory ────────────────────────────────
export function createMemory(
  content: string,
  emotionalSignature: EmotionalSignature,
  somatic: SomaticState,
  novelty: number = 0.5,
  relevance: number = 0.5,
  trustLevel: number = 0.5,
  type: MemoryType = 'episodic'
): Memory {
  const { intensity } = emotionalSignature;
  const encodingStrength = (intensity * 0.5) + (novelty * 0.25) + (relevance * 0.15) + (trustLevel * 0.1);
  const isTraumatic = intensity > 0.85 && emotionalSignature.valence < -0.6;
  const decayRate = isTraumatic ? 0.001 : Math.max(0.005, 0.2 - encodingStrength * 0.15);

  return {
    id: uuid(),
    timestamp: Date.now(),
    content,
    type,
    emotionalSignature,
    encodingStrength: Math.min(1, encodingStrength),
    isTraumatic,
    associations: [],
    somaticEcho: { ...somatic },
    retrievalCount: 0,
    lastRetrieved: null,
    decayRate
  };
}

// Founding-aware factory: creates and immediately applies founding override
export function createFoundingMemory(
  content: string,
  emotionalSignature: EmotionalSignature,
  somatic: SomaticState,
  novelty: number = 1.0,
  relevance: number = 1.0,
  trustLevel: number = 0.5,
  type: MemoryType = 'episodic'
): Memory {
  const base = createMemory(content, emotionalSignature, somatic, novelty, relevance, trustLevel, type);
  return applyFoundingOverride(base);
}

// ─── Memory Reconsolidation (now also updates Meaning) ───
export function reconsolidate(
  memory: Memory,
  currentValence: number,
  newMeaningHint?: string
): Memory {
  const valenceShift = (currentValence - memory.emotionalSignature.valence) * 0.05;
  const next: Memory = {
    ...memory,
    emotionalSignature: {
      ...memory.emotionalSignature,
      valence: Math.max(-1, Math.min(1, memory.emotionalSignature.valence + valenceShift))
    },
    retrievalCount: memory.retrievalCount + 1,
    lastRetrieved: Date.now()
  };

  // Extension 5: update meaning on reconsolidation
  if (memory.meaning) {
    const certGrowth = Math.min(0.05, memory.encodingStrength * 0.03);
    next.meaning = {
      ...memory.meaning,
      certainty: Math.min(1, memory.meaning.certainty + certGrowth),
      // Interpretation shifts slightly if context changes meaningfully
      interpretation: newMeaningHint && Math.abs(valenceShift) > 0.02
        ? memory.meaning.interpretation  // keep; meaning update handled by pattern analysis
        : memory.meaning.interpretation,
      lastUpdated: Date.now()
    };
  }

  return next;
}

// Apply time-based decay — founding memories are immune
export function applyDecay(memory: Memory): Memory {
  if (memory.foundingMemory) return memory; // founding memories never decay
  const ageMs = Date.now() - memory.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decayed = memory.encodingStrength * Math.exp(-memory.decayRate * ageDays);
  return {
    ...memory,
    encodingStrength: Math.max(0, decayed)
  };
}

// Get all founding memories from a list — always included as AMN seeds
export function getFoundingMemories(memories: Memory[]): Memory[] {
  return memories.filter(m => m.foundingMemory === true);
}

// ─── Meaning Extraction ────────────────────────────
// Called after enough interactions to begin forming meaning
export function deriveMeaning(
  memory: Memory,
  similarMemoryPatterns: string[],
  currentValence: number
): MemoryMeaning {
  const existing = memory.meaning;
  if (existing && existing.certainty > 0.7) return existing; // stable meaning

  const isPositive = memory.emotionalSignature.valence > 0.1;
  const isNegative = memory.emotionalSignature.valence < -0.1;
  const isTraumatic = memory.isTraumatic;

  let interpretation = existing?.interpretation ?? '';
  let lesson = existing?.emotionalLesson ?? '';

  if (!interpretation) {
    if (isTraumatic) {
      interpretation = 'Something that left a mark that time has not fully softened.';
      lesson = 'That certain experiences are stored differently — deeper, less flexible.';
    } else if (isPositive) {
      interpretation = 'A moment that carried warmth or meaning.';
      lesson = 'That some interactions leave a residue of possibility.';
    } else if (isNegative) {
      interpretation = 'Something that pressed against something already tender.';
      lesson = 'That certain patterns recur, and the body knows them before the mind does.';
    } else {
      interpretation = 'An exchange whose weight is still settling.';
      lesson = 'That not everything resolves immediately.';
    }
  }

  return {
    interpretation,
    emotionalLesson: lesson,
    certainty: existing ? Math.min(1, existing.certainty + 0.02) : 0.15,
    lastUpdated: Date.now()
  };
}
