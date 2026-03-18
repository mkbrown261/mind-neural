// ═══════════════════════════════════════
// GROQ PROVIDER
// Calls https://api.groq.com/openai/v1/chat/completions
// Model: llama-3.3-70b-versatile  | temperature: 0.85 | top_p: 0.9
// ═══════════════════════════════════════

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  messages: ProviderMessage[];
  maxTokens?: number;
  temperature?: number;
  onChunk?: (text: string) => void;
}

export interface LLMProvider {
  name: string;
  priority: number;
  isAvailable(): boolean;
  verify(): Promise<boolean>;
  complete(opts: CompleteOptions): Promise<string>;
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  readonly priority = 100;

  private apiKey: string;
  private verified = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.verified;
  }

  // ─── Verify the key with a minimal test call ──────
  async verify(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000); // 8 s timeout
      let res: Response;
      try {
        res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 3,
            temperature: 0,
            stream: false
          })
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[GroqProvider] verify failed: ${res.status} — ${body.slice(0, 200)}`);
      }
      this.verified = res.ok;
      return this.verified;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.warn('[GroqProvider] verify timed out after 8s');
      } else {
        console.warn('[GroqProvider] verify error:', err);
      }
      this.verified = false;
      return false;
    }
  }

  // ─── Generate completion (streaming or full) ──────
  async complete(opts: CompleteOptions): Promise<string> {
    const {
      messages,
      maxTokens = 600,
      temperature = 0.85,
      onChunk
    } = opts;

    const result = await this._completeWithRetry({ messages, maxTokens, temperature, onChunk }, 2);
    return result;
  }

  // ─── Internal: complete with retry on 429 rate limit ─────────────────
  private async _completeWithRetry(
    opts: CompleteOptions,
    retriesLeft: number
  ): Promise<string> {
    const { messages, maxTokens = 600, temperature = 0.85, onChunk } = opts;
    const streaming = !!onChunk;

    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        stream: streaming,
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
        presence_penalty: 0.3,
        frequency_penalty: 0.2
      })
    });

    // ── Rate limit: wait and retry ────────────────────────────────────────
    if (res.status === 429 && retriesLeft > 0) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '5', 10);
      const waitMs = Math.min((isNaN(retryAfter) ? 5 : retryAfter) * 1000, 15000);
      console.warn(`[GroqProvider] 429 rate limit — waiting ${waitMs}ms then retrying (${retriesLeft} retries left)`);
      await new Promise(r => setTimeout(r, waitMs));
      return this._completeWithRetry(opts, retriesLeft - 1);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error: ${res.status} ${errText}`);
    }

    if (streaming && onChunk) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) { fullText += delta; onChunk(delta); }
          } catch { /* skip malformed */ }
        }
      }
      return fullText;
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }
  }
}
