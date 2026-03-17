// ═══════════════════════════════════════
// PROVIDER REGISTRY
// Manages registered LLM providers; selects the first available by priority.
// ═══════════════════════════════════════

import type { LLMProvider } from './GroqProvider';

export class ProviderRegistry {
  private providers: LLMProvider[] = [];

  // ─── Register a provider ──────────────────────────
  register(provider: LLMProvider): void {
    // Remove existing entry for same name before re-registering
    this.providers = this.providers.filter(p => p.name !== provider.name);
    this.providers.push(provider);
    // Always keep sorted by priority descending (highest priority first)
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  // ─── Unregister a provider by name ───────────────
  unregister(name: string): void {
    this.providers = this.providers.filter(p => p.name !== name);
  }

  // ─── Select the first available provider ─────────
  selectBest(): LLMProvider | null {
    return this.providers.find(p => p.isAvailable()) ?? null;
  }

  // ─── List all providers (sorted by priority) ─────
  list(): LLMProvider[] {
    return [...this.providers];
  }

  // ─── Check if any provider is available ──────────
  hasAvailable(): boolean {
    return this.providers.some(p => p.isAvailable());
  }
}
