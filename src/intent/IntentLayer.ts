// ═══════════════════════════════════════
// INTENT LAYER — Message Bus
// Independent module; communicates via events, never imports Action Layer directly.
// All new MIND features communicate through this bus.
// ═══════════════════════════════════════

export type IntentMiddleware = (event: string, payload: unknown, next: () => void) => void;
export type IntentHandler = (payload: unknown) => void | Promise<void>;

interface RegisteredHandler {
  event: string;
  handler: IntentHandler;
}

export class IntentLayer {
  private handlers: RegisteredHandler[] = [];
  private middlewares: IntentMiddleware[] = [];

  // ─── Register a handler for an intent event ──────
  register(event: string, handler: IntentHandler): void {
    this.handlers.push({ event, handler });
  }

  // ─── Unregister all handlers for an event ────────
  unregister(event: string): void {
    this.handlers = this.handlers.filter(h => h.event !== event);
  }

  // ─── Add middleware (runs before handlers) ────────
  use(middleware: IntentMiddleware): void {
    this.middlewares.push(middleware);
  }

  // ─── Send an intent event ─────────────────────────
  async send(event: string, payload: unknown = {}): Promise<void> {
    // Run middleware chain first
    let idx = 0;
    const next = (): void => {
      if (idx < this.middlewares.length) {
        const mw = this.middlewares[idx++];
        mw(event, payload, next);
      }
    };
    next();

    // Dispatch to all registered handlers for this event
    const matched = this.handlers.filter(h => h.event === event);
    for (const { handler } of matched) {
      try {
        await handler(payload);
      } catch (err) {
        console.warn(`[IntentLayer] Handler error for event "${event}":`, err);
      }
    }
  }

  // ─── Request/Response pattern ─────────────────────
  // Use when a sender needs a value back from a handler.
  async request<T>(event: string, payload: unknown = {}): Promise<T | null> {
    const matched = this.handlers.filter(h => h.event === event);
    for (const { handler } of matched) {
      try {
        const result = await handler(payload);
        if (result !== undefined) return result as T;
      } catch (err) {
        console.warn(`[IntentLayer] Request error for event "${event}":`, err);
      }
    }
    return null;
  }
}
