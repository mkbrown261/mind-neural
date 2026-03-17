// ═══════════════════════════════════════
// SYSTEM 1: EMOTIONAL MEMORY ENGINE (EME)
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
}

export interface Memory {
  id: string;
  timestamp: number;
  content: string;
  emotionalSignature: EmotionalSignature;
  encodingStrength: number;
  isTraumatic: boolean;
  associations: string[];
  somaticEcho: SomaticState;
  retrievalCount: number;
  lastRetrieved: number | null;
  decayRate: number;
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const DB_NAME = 'MIND_DB';
const STORE_NAME = 'memories';
const META_STORE = 'meta';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('encodingStrength', 'encodingStrength');
      }
      if (!d.objectStoreNames.contains(META_STORE)) {
        d.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve();
    };
    req.onerror = () => reject(req.error);
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
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getMemory(id: string): Promise<Memory | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
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

export function createMemory(
  content: string,
  emotionalSignature: EmotionalSignature,
  somatic: SomaticState,
  novelty: number = 0.5,
  relevance: number = 0.5,
  trustLevel: number = 0.5
): Memory {
  const { intensity } = emotionalSignature;
  const encodingStrength = (intensity * 0.5) + (novelty * 0.25) + (relevance * 0.15) + (trustLevel * 0.1);
  const isTraumatic = intensity > 0.85 && emotionalSignature.valence < -0.6;
  const decayRate = isTraumatic ? 0.001 : Math.max(0.005, 0.2 - encodingStrength * 0.15);

  return {
    id: uuid(),
    timestamp: Date.now(),
    content,
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

// Memory Reconsolidation: retrieved memory's valence shifts toward current state
export function reconsolidate(memory: Memory, currentValence: number): Memory {
  const shift = (currentValence - memory.emotionalSignature.valence) * 0.05;
  return {
    ...memory,
    emotionalSignature: {
      ...memory.emotionalSignature,
      valence: Math.max(-1, Math.min(1, memory.emotionalSignature.valence + shift))
    },
    retrievalCount: memory.retrievalCount + 1,
    lastRetrieved: Date.now()
  };
}

// Apply decay based on time elapsed
export function applyDecay(memory: Memory): Memory {
  const ageMs = Date.now() - memory.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decayed = memory.encodingStrength * Math.exp(-memory.decayRate * ageDays);
  return {
    ...memory,
    encodingStrength: Math.max(0, decayed)
  };
}
