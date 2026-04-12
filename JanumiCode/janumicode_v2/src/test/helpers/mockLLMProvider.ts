/**
 * MockLLMProvider — hermetic LLM provider adapter for tests.
 *
 * Used by Layer A (workflowDriver) and Layer C (e2e smoke). Lets tests
 * register fixture responses keyed by a substring of the rendered prompt;
 * the first matching fixture wins. Returns a default empty-success response
 * when no fixture matches so tests don't crash on uncovered prompts.
 *
 * Fixtures can be:
 *   - inline objects via setFixture(matchKey, fixture)
 *   - JSON files under src/test/fixtures/llm/<name>.json loaded via
 *     loadFixturesFromDir()
 *
 * The mock provider responds under BOTH the 'mock' provider name AND any
 * other provider name passed in the LLMCallOptions, so tests don't have to
 * stub out the JANUMICODE_LLM_PROVIDER env var to use it. The phase
 * handlers and the Liaison both call `provider: 'ollama'` directly; the
 * mock just intercepts those calls when registered.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  ToolCall,
} from '../../lib/llm/llmCaller';

export interface MockFixture {
  /** Substring matched against the rendered prompt. First match wins. */
  match: string;
  /** Plain text response (used when no parsedJson is provided). */
  text?: string;
  /** Parsed JSON object (Phase 1 templates expect responseFormat: 'json'). */
  parsedJson?: Record<string, unknown>;
  /** Tool calls returned by the model (for native tool-calling tests). */
  toolCalls?: ToolCall[];
  /** Synthetic latency in ms (default 0). */
  latencyMs?: number;
}

export class MockLLMProvider implements LLMProviderAdapter {
  /**
   * The provider adapter name. The Liaison registers this provider on its
   * internal PriorityLLMCaller as well, so it answers to both 'mock' and
   * any provider name the call site uses (we just pretend to be that
   * provider in the response).
   */
  readonly name = 'mock';

  private readonly fixtures: MockFixture[] = [];
  private readonly callLog: Array<{
    options: LLMCallOptions;
    matchedFixture: string | null;
    timestamp: number;
  }> = [];

  /** Register an inline fixture. Most recent registration wins on ties. */
  setFixture(matchKey: string, fixture: Omit<MockFixture, 'match'>): void {
    this.fixtures.unshift({ match: matchKey, ...fixture });
  }

  /** Load all fixtures from a directory. Each `.json` file is one fixture. */
  async loadFixturesFromDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(dir, entry), 'utf-8');
      const fixture = JSON.parse(raw) as MockFixture;
      if (!fixture.match) {
        throw new Error(`Fixture ${entry} missing required "match" field`);
      }
      this.fixtures.push(fixture);
    }
  }

  /** All recorded calls, in submission order. Useful for assertions. */
  getCallLog(): ReadonlyArray<{
    options: LLMCallOptions;
    matchedFixture: string | null;
    timestamp: number;
  }> {
    return this.callLog;
  }

  /** Reset state between tests. */
  reset(): void {
    this.fixtures.length = 0;
    this.callLog.length = 0;
  }

  /**
   * Return a wrapper LLMProviderAdapter with a different `name` that
   * forwards to this mock's call() method (and shares its fixture store).
   * Used by workflowDriver to register the mock under every provider name
   * the engine and Liaison might call (`ollama`, `anthropic`, `google`)
   * without duplicating fixture state.
   */
  bindAsProvider(name: string): LLMProviderAdapter {
    return {
      name,
      call: (options: LLMCallOptions) => this.call({ ...options, provider: name }),
    };
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const fixture = this.fixtures.find((f) => options.prompt.includes(f.match));
    this.callLog.push({
      options,
      matchedFixture: fixture?.match ?? null,
      timestamp: Date.now(),
    });

    if (fixture?.latencyMs) {
      await new Promise((r) => setTimeout(r, fixture.latencyMs));
    }

    if (fixture) {
      return this.buildResult(options, fixture);
    }

    // Default: empty-success response. Phase 1 fallback paths handle empty
    // parsed JSON gracefully so tests don't crash on uncovered prompts.
    return this.buildEmptyResult(options);
  }

  private buildResult(options: LLMCallOptions, fixture: MockFixture): LLMCallResult {
    const text = fixture.parsedJson
      ? JSON.stringify(fixture.parsedJson)
      : fixture.text ?? '';
    return {
      text,
      parsed: fixture.parsedJson ?? null,
      toolCalls: fixture.toolCalls ?? [],
      provider: options.provider, // pretend to be the requested provider
      model: options.model,
      inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
      outputTokens: Math.ceil(text.length / 4),
      usedFallback: false,
      retryAttempts: 0,
    };
  }

  private buildEmptyResult(options: LLMCallOptions): LLMCallResult {
    // For json mode, return a structurally valid empty object so callers
    // that read parsed.foo don't blow up with "cannot read property of null".
    if (options.responseFormat === 'json') {
      const empty = {};
      return {
        text: '{}',
        parsed: empty,
        toolCalls: [],
        provider: options.provider,
        model: options.model,
        inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
        outputTokens: 1,
        usedFallback: false,
        retryAttempts: 0,
      };
    }
    return {
      text: '',
      parsed: null,
      toolCalls: [],
      provider: options.provider,
      model: options.model,
      inputTokens: Math.ceil((options.prompt.length + (options.system?.length ?? 0)) / 4),
      outputTokens: 0,
      usedFallback: false,
      retryAttempts: 0,
    };
  }
}
