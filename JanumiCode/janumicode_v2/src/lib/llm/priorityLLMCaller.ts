/**
 * PriorityLLMCaller — concurrency-bounded, two-lane priority queue around
 * LLMCaller. Per the user-facing concurrency design:
 *
 * - Per-provider in-flight cap (default 1) so we never exceed the underlying
 *   single-resource limit (Ollama's `OLLAMA_NUM_PARALLEL`, cloud rate limits).
 * - Two priority lanes per provider: `phase` (back-end work) and `user_query`
 *   (composer-initiated). User queries jump the queue at submission time but
 *   never preempt an in-flight call.
 * - Composer remains responsive — submission resolves a Promise that fires
 *   when the call eventually completes; the queue depth is broadcast via the
 *   EventBus so the UI can show "Queued — N requests ahead".
 */

import { LLMCaller, type LLMCallOptions, type LLMCallResult, type LLMCallerConfig, type LLMProviderAdapter } from './llmCaller';
import type { EventBus } from '../events/eventBus';

export type LLMLane = 'phase' | 'user_query';

export interface PriorityCallOptions {
  priority?: LLMLane;
}

export interface PriorityLLMCallerConfig extends LLMCallerConfig {
  /** Maximum concurrent in-flight requests per provider. Default 1. */
  maxParallel?: number;
}

interface QueuedRequest {
  request: LLMCallOptions;
  lane: LLMLane;
  resolve: (r: LLMCallResult) => void;
  reject: (e: Error) => void;
  enqueuedAt: number;
}

interface ProviderQueue {
  phase: QueuedRequest[];
  user_query: QueuedRequest[];
}

export class PriorityLLMCaller {
  private readonly inner: LLMCaller;
  private readonly queues = new Map<string, ProviderQueue>();
  private readonly inFlight = new Map<string, number>();
  private readonly maxParallel: number;
  private eventBus: EventBus | null = null;

  constructor(config: PriorityLLMCallerConfig) {
    this.inner = new LLMCaller(config);
    this.maxParallel = config.maxParallel ?? 1;
  }

  /** Forward provider registration to the inner caller. */
  registerProvider(adapter: LLMProviderAdapter): void {
    this.inner.registerProvider(adapter);
  }

  /** Connect to the EventBus so queue events surface to the webview. */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Enqueue an LLM call. The returned promise resolves when the call has
   * actually run through the inner caller (after any preceding work in the
   * same provider's queue and any internal LLMCaller retry/backoff).
   */
  call(
    request: LLMCallOptions,
    opts: PriorityCallOptions = {},
  ): Promise<LLMCallResult> {
    const lane: LLMLane = opts.priority ?? 'phase';

    return new Promise<LLMCallResult>((resolve, reject) => {
      const provider = request.provider;
      let q = this.queues.get(provider);
      if (!q) {
        q = { phase: [], user_query: [] };
        this.queues.set(provider, q);
      }
      q[lane].push({ request, lane, resolve, reject, enqueuedAt: Date.now() });

      const depth = q.phase.length + q.user_query.length;
      this.eventBus?.emit('llm:queued', { provider, lane, queueDepth: depth });

      this.tick(provider);
    });
  }

  /** Process the next request for a provider, if capacity allows. */
  private tick(provider: string): void {
    const q = this.queues.get(provider);
    if (!q) return;

    const inFlight = this.inFlight.get(provider) ?? 0;
    if (inFlight >= this.maxParallel) return;

    // user_query lane preempts phase lane at queue time. No in-flight preemption.
    const next = q.user_query.shift() ?? q.phase.shift();
    if (!next) return;

    this.inFlight.set(provider, inFlight + 1);
    this.eventBus?.emit('llm:started', { provider, lane: next.lane });
    const startedAt = Date.now();

    void this.runRequest(provider, next, startedAt);
  }

  private async runRequest(
    provider: string,
    next: QueuedRequest,
    startedAt: number,
  ): Promise<void> {
    let result: LLMCallResult | null = null;
    let error: Error | null = null;
    try {
      result = await this.inner.call(next.request);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }

    // Emit finished BEFORE resolving the caller's promise so observers see
    // the event before the awaiting code runs.
    const after = (this.inFlight.get(provider) ?? 1) - 1;
    this.inFlight.set(provider, after);
    this.eventBus?.emit('llm:finished', {
      provider,
      lane: next.lane,
      durationMs: Date.now() - startedAt,
    });

    if (result) next.resolve(result);
    else if (error) next.reject(error);

    // Drain any further work that fits.
    this.tick(provider);
  }

  /** Diagnostics: total queued requests across all providers. */
  totalQueueDepth(): number {
    let total = 0;
    for (const q of this.queues.values()) {
      total += q.phase.length + q.user_query.length;
    }
    return total;
  }
}
