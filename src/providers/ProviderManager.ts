// ═══════════════════════════════════════
// PROVIDER MANAGER
// Initializes providers from localStorage keys:
//   mind_groq_key   → GroqProvider  (priority 100)
//   mind_openai_key → OpenAI-compat (priority 50)
// Registers 'speech.request' intent handler on the Intent Layer.
// ═══════════════════════════════════════

import { ProviderRegistry } from './ProviderRegistry';
import { GroqProvider } from './GroqProvider';
import type { LLMProvider, CompleteOptions } from './GroqProvider';
import type { IntentLayer } from '../intent/IntentLayer';

// ─── Minimal OpenAI-compatible provider ───────────
class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly priority = 50;

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private _available = false;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1', model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    // Mark available immediately — verification is optional for OpenAI path
    this._available = !!apiKey;
  }

  isAvailable(): boolean { return this._available && !!this.apiKey; }

  async verify(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          signal: controller.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 3, stream: false })
        });
      } finally {
        clearTimeout(timer);
      }
      this._available = res.ok;
      return this._available;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') console.warn('[OpenAIProvider] verify timed out');
      this._available = false;
      return false;
    }
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const { messages, maxTokens = 600, temperature = 0.85, onChunk } = opts;
    const streaming = !!onChunk;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: streaming,
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
        presence_penalty: 0.3,
        frequency_penalty: 0.2
      })
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`LLM API error: ${res.status} ${t}`); }
    if (streaming && onChunk) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try { const d = JSON.parse(data); const delta = d.choices?.[0]?.delta?.content ?? ''; if (delta) { full += delta; onChunk(delta); } } catch {}
        }
      }
      return full;
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }
  }
}

// ─── ProviderManager ──────────────────────────────
export interface SpeechRequestPayload {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  onChunk?: (text: string) => void;
  resolve: (text: string) => void;
  reject: (err: unknown) => void;
}

export class ProviderManager {
  private registry = new ProviderRegistry();
  private intent: IntentLayer;
  private groqProvider: GroqProvider | null = null;
  private openaiProvider: OpenAIProvider | null = null;

  constructor(intent: IntentLayer) {
    this.intent = intent;

    // Register speech.request intent handler immediately in constructor
    // so it is available even before any key is set
    this.intent.register('speech.request', async (payload: unknown) => {
      const p = payload as SpeechRequestPayload;
      const provider = this.registry.selectBest();
      if (!provider) {
        p.reject(new Error('No LLM provider available'));
        return;
      }
      try {
        const text = await provider.complete({
          messages: [{ role: 'user', content: p.prompt }],
          maxTokens: p.maxTokens,
          temperature: p.temperature,
          onChunk: p.onChunk
        });
        p.resolve(text);
      } catch (err) {
        p.reject(err);
      }
    });
  }

  // ─── Initialize providers from localStorage ───────
  // NOTE: Only called when app.ts has confirmed a valid savedConfig exists.
  // Never call this on a fresh session — it will read stale keys.
  async initialize(): Promise<void> {
    // Hard 10 s ceiling — never block the UI indefinitely
    const initWork = async () => {
      const groqKey    = localStorage.getItem('mind_groq_key')   ?? '';
      const openaiKey  = localStorage.getItem('mind_openai_key') ?? '';
      const openaiBase = localStorage.getItem('mind_openai_base') ?? 'https://api.openai.com/v1';
      const openaiMod  = localStorage.getItem('mind_openai_model') ?? 'gpt-4o';

      if (groqKey) {
        this.groqProvider = new GroqProvider(groqKey);
        const ok = await this.groqProvider.verify();
        if (ok) this.registry.register(this.groqProvider);
        else console.warn('[ProviderManager] Groq key present but verify failed — skipping');
      }

      if (openaiKey) {
        this.openaiProvider = new OpenAIProvider(openaiKey, openaiBase, openaiMod);
        this.registry.register(this.openaiProvider);
      }
    };

    const timeout = new Promise<void>(resolve => setTimeout(resolve, 10_000));
    await Promise.race([initWork(), timeout])
      .catch(err => console.warn('[ProviderManager] initialize error:', err));
  }

  // ─── Register or update Groq key at runtime ───────
  async setGroqKey(apiKey: string): Promise<boolean> {
    localStorage.setItem('mind_groq_key', apiKey);
    this.groqProvider = new GroqProvider(apiKey);
    const ok = await this.groqProvider.verify();
    if (ok) {
      this.registry.register(this.groqProvider);
    } else {
      this.registry.unregister('groq');
      this.groqProvider = null;
    }
    return ok;
  }

  // ─── Register or update OpenAI key at runtime ────
  setOpenAIKey(apiKey: string, baseUrl: string, model: string): void {
    localStorage.setItem('mind_openai_key', apiKey);
    localStorage.setItem('mind_openai_base', baseUrl);
    localStorage.setItem('mind_openai_model', model);
    this.openaiProvider = new OpenAIProvider(apiKey, baseUrl, model);
    this.registry.register(this.openaiProvider);
  }

  // ─── Query state ──────────────────────────────────
  hasGroq(): boolean { return !!this.groqProvider?.isAvailable(); }
  hasOpenAI(): boolean { return !!this.openaiProvider?.isAvailable(); }
  hasAny(): boolean { return this.registry.hasAvailable(); }
  activeProviderName(): string { return this.registry.selectBest()?.name ?? 'none'; }

  // ─── Direct completion (bypasses intent, for pipeline) ──
  async complete(opts: CompleteOptions): Promise<string> {
    const provider = this.registry.selectBest();
    if (!provider) throw new Error('No LLM provider available');
    return provider.complete(opts);
  }
}
