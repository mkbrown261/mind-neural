// ═══════════════════════════════════════
// SYSTEM 3: ASSOCIATIVE MEMORY NETWORK (AMN)
// ═══════════════════════════════════════

import { Memory, EmotionalSignature } from './memory';

interface ActivationNode {
  memoryId: string;
  activation: number;
}

const SPREAD_DECAY = 0.7;
const MIN_ACTIVATION = 0.1;
const MAX_HOPS = 3;

function emotionalSimilarity(a: EmotionalSignature, b: EmotionalSignature): number {
  const valenceDiff = Math.abs(a.valence - b.valence) / 2;
  const intensityDiff = Math.abs(a.intensity - b.intensity);
  const catA = new Set(a.categories);
  const catB = new Set(b.categories);
  const intersection = [...catA].filter(c => catB.has(c)).length;
  const union = new Set([...catA, ...catB]).size;
  const catSim = union > 0 ? intersection / union : 0;
  return (1 - valenceDiff) * 0.4 + (1 - intensityDiff) * 0.2 + catSim * 0.4;
}

function semanticSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

function temporalProximity(tsA: number, tsB: number): number {
  const diffMs = Math.abs(tsA - tsB);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.exp(-diffDays / 7); // decays over a week
}

export function associationStrength(a: Memory, b: Memory): number {
  const eSim = emotionalSimilarity(a.emotionalSignature, b.emotionalSignature);
  const sSim = semanticSimilarity(a.content, b.content);
  const tProx = temporalProximity(a.timestamp, b.timestamp);
  return (eSim * 0.5) + (sSim * 0.35) + (tProx * 0.15);
}

// Find seed memories by emotional + semantic similarity to input
function findSeeds(
  query: { content: string; signature: EmotionalSignature },
  memories: Memory[],
  topK: number = 5
): Array<{ memory: Memory; activation: number }> {
  const scored = memories.map(m => {
    const eSim = emotionalSimilarity(query.signature, m.emotionalSignature);
    const sSim = semanticSimilarity(query.content, m.content);
    const activation = eSim * 0.6 + sSim * 0.4;
    return { memory: m, activation };
  });
  scored.sort((a, b) => b.activation - a.activation);
  return scored.slice(0, topK).filter(s => s.activation > 0.05);
}

// Spreading activation from seeds
export function spreadingActivation(
  query: { content: string; signature: EmotionalSignature },
  memories: Memory[],
  topK: number = 8
): Array<{ memory: Memory; activation: number }> {
  if (memories.length === 0) return [];

  const memMap = new Map<string, Memory>(memories.map(m => [m.id, m]));
  const activations = new Map<string, number>();

  // Initialize from seeds
  const seeds = findSeeds(query, memories, 5);
  for (const { memory, activation } of seeds) {
    activations.set(memory.id, activation);
  }

  // Spread activation
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const current = new Map(activations);
    for (const [id, act] of current.entries()) {
      if (act < MIN_ACTIVATION) continue;
      const mem = memMap.get(id);
      if (!mem) continue;
      // Spread to explicit associations
      for (const assocId of mem.associations) {
        const existing = activations.get(assocId) ?? 0;
        const newAct = act * SPREAD_DECAY;
        if (newAct > existing) {
          activations.set(assocId, newAct);
        }
      }
      // Spread to implicit associations by computing strength
      for (const other of memories) {
        if (other.id === id) continue;
        const existing = activations.get(other.id) ?? 0;
        const strength = associationStrength(mem, other);
        const newAct = act * SPREAD_DECAY * strength;
        if (newAct > MIN_ACTIVATION && newAct > existing) {
          activations.set(other.id, newAct);
        }
      }
    }
  }

  // Collect and sort
  const result: Array<{ memory: Memory; activation: number }> = [];
  for (const [id, activation] of activations.entries()) {
    const m = memMap.get(id);
    if (m && activation >= MIN_ACTIVATION) {
      result.push({ memory: m, activation });
    }
  }
  result.sort((a, b) => b.activation - a.activation);
  return result.slice(0, topK);
}

// Build association links between new memory and existing memories
export function buildAssociations(newMemory: Memory, existingMemories: Memory[]): string[] {
  const threshold = 0.3;
  const scored = existingMemories
    .map(m => ({ id: m.id, strength: associationStrength(newMemory, m) }))
    .filter(s => s.strength >= threshold)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
  return scored.map(s => s.id);
}
