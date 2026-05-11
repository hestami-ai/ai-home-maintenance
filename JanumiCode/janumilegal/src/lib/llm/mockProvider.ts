/**
 * Mock LLM provider — records calls and returns scripted responses.
 * Used in tests and for the trivial 2-state lens E2E exercise.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './provider.js';
import { providerRegistry } from './providerRegistry.js';

export interface ScriptedResponse {
  /** Optional matcher; if set, this script entry only matches when the predicate is true. */
  match?: (req: LLMRequest) => boolean;
  response: LLMResponse;
}

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly calls: LLMRequest[] = [];
  private readonly script: ScriptedResponse[];

  constructor(script: ScriptedResponse[] = []) {
    this.script = [...script];
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.calls.push(request);
    for (const entry of this.script) {
      if (!entry.match || entry.match(request)) {
        return entry.response;
      }
    }
    return { content: '{}', stopReason: 'end_turn' };
  }

  push(entry: ScriptedResponse): void {
    this.script.push(entry);
  }

  reset(): void {
    this.calls.length = 0;
    this.script.length = 0;
  }
}

providerRegistry.register('mock', async (settings) => {
  const script = (settings as { script?: ScriptedResponse[] }).script ?? [];
  return new MockLLMProvider(script);
});
