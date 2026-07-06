/**
 * Tier-2 engine-replay core: fixture-map matching + the Seam A/B adapters.
 * Validates exact-key hits, the normalized (prompt-drift) fallback, and the
 * strict-vs-lenient miss policy — without any engine, LLM, or GPU.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ReplayFixtureMap } from '../../../lib/replay/replayFixtureMap';
import { ReplayLLMProvider, ReplayMissError } from '../../../lib/replay/replayLLMProvider';
import { makeCliReplayResolver } from '../../../lib/replay/installReplay';
import type { LLMCallOptions } from '../../../lib/llm/llmCaller';
import type { AgentInvocationOptions } from '../../../lib/orchestrator/agentInvoker';

function row(o: Record<string, unknown>): string {
  return JSON.stringify(o);
}

let ndjsonPath: string;
let map: ReplayFixtureMap;

beforeAll(() => {
  ndjsonPath = path.join(os.tmpdir(), `replay-fixture-${process.pid}.ndjson`);
  const lines = [
    row({
      id: 'inv-llm', record_type: 'agent_invocation', derived_from_record_ids: '[]',
      content: JSON.stringify({
        provider: 'ollama', model: 'gemma4:31b-it-qat', response_format: 'json',
        temperature: 1, max_tokens: null, system: 'sys', tools: [],
        prompt: 'Generate FRs at 2026-07-06T00:00:00Z for run 12345678-1234-1234-1234-123456789abc',
      }),
    }),
    row({
      id: 'out-llm', record_type: 'agent_output', derived_from_record_ids: '["inv-llm"]',
      content: JSON.stringify({ text: '{"frs":["FR-1"]}', thinking: 'reasoned', status: 'success', provider: 'ollama', model: 'gemma4:31b-it-qat' }),
    }),
    row({
      id: 'inv-cli', record_type: 'agent_invocation', derived_from_record_ids: '[]',
      content: JSON.stringify({ command: 'mimo', prompt: 'Implement task at 2026-07-06T00:00:00Z', cwd: '/ws' }),
    }),
    row({
      id: 'out-cli', record_type: 'agent_output', derived_from_record_ids: '["inv-cli"]',
      content: JSON.stringify({ text: 'task complete', status: 'success' }),
    }),
  ];
  fs.writeFileSync(ndjsonPath, lines.join('\n') + '\n', 'utf-8');
  map = ReplayFixtureMap.fromNdjson(ndjsonPath);
});

afterAll(() => {
  if (fs.existsSync(ndjsonPath)) fs.rmSync(ndjsonPath);
});

const baseLLM = {
  provider: 'ollama', model: 'gemma4:31b-it-qat', responseFormat: 'json' as const,
  temperature: 1, maxTokens: null, system: 'sys', tools: [], toolChoice: null,
};

describe('ReplayFixtureMap', () => {
  it('indexes LLM + CLI pairs', () => {
    expect(map.stats.llm).toBe(1);
    expect(map.stats.cli).toBe(1);
  });

  it('exact key hit', () => {
    const hit = map.lookupLLM({
      ...baseLLM,
      prompt: 'Generate FRs at 2026-07-06T00:00:00Z for run 12345678-1234-1234-1234-123456789abc',
    });
    expect(hit?.match).toBe('exact');
    expect(hit?.output.parsed).toEqual({ frs: ['FR-1'] });
  });

  it('normalized fallback survives changed timestamp + uuid (prompt drift)', () => {
    const hit = map.lookupLLM({
      ...baseLLM,
      // Different timestamp AND run uuid — exact key misses, normalized hits.
      prompt: 'Generate FRs at 2026-07-07T09:30:00Z for run ffffffff-0000-0000-0000-000000000000',
    });
    expect(hit?.match).toBe('normalized');
    expect(hit?.output.text).toBe('{"frs":["FR-1"]}');
  });

  it('miss returns null', () => {
    expect(map.lookupLLM({ ...baseLLM, prompt: 'something entirely unrelated' })).toBeNull();
  });

  it('CLI lookup is normalized by prompt', () => {
    expect(map.lookupCLI('Implement task at 2026-12-31T23:59:59Z')?.text).toBe('task complete');
    expect(map.lookupCLI('unrelated')).toBeNull();
  });
});

describe('ReplayLLMProvider (Seam A)', () => {
  function opts(prompt: string): LLMCallOptions {
    return { ...baseLLM, prompt } as unknown as LLMCallOptions;
  }

  it('returns the recorded result on a hit', async () => {
    const p = new ReplayLLMProvider('ollama', map, true);
    const r = await p.call(opts('Generate FRs at 2026-07-06T00:00:00Z for run 12345678-1234-1234-1234-123456789abc'));
    expect(r.parsed).toEqual({ frs: ['FR-1'] });
    expect(r.thinking).toBe('reasoned');
  });

  it('strict miss throws ReplayMissError (never a live call)', async () => {
    const p = new ReplayLLMProvider('ollama', map, true);
    await expect(p.call(opts('no such prompt'))).rejects.toBeInstanceOf(ReplayMissError);
  });

  it('lenient miss returns an empty-but-valid result', async () => {
    const p = new ReplayLLMProvider('ollama', map, false);
    const r = await p.call(opts('no such prompt'));
    expect(r.text).toBe('{}');
    expect(r.parsed).toEqual({});
  });
});

describe('makeCliReplayResolver (Seam B)', () => {
  function cli(o: Partial<AgentInvocationOptions>): AgentInvocationOptions {
    return { agentRole: 'executor', backingTool: 'mimo_cli', invocationId: 'x', prompt: '', cwd: '/ws', ...o } as AgentInvocationOptions;
  }

  it('returns recorded executor output on a hit', () => {
    const resolve = makeCliReplayResolver(map, true);
    const res = resolve(cli({ prompt: 'Implement task at 2026-01-01T00:00:00Z' }));
    expect(res?.success).toBe(true);
    expect(res?.cliResult?.stdoutText).toBe('task complete');
  });

  it('passes direct_llm_api through (Seam A handles it)', () => {
    const resolve = makeCliReplayResolver(map, true);
    expect(resolve(cli({ backingTool: 'direct_llm_api', prompt: 'anything' }))).toBeNull();
  });

  it('strict miss throws', () => {
    const resolve = makeCliReplayResolver(map, true);
    expect(() => resolve(cli({ prompt: 'unrecorded task' }))).toThrow(ReplayMissError);
  });

  it('lenient miss returns a hermetic empty result (no subprocess)', () => {
    const resolve = makeCliReplayResolver(map, false);
    const res = resolve(cli({ prompt: 'unrecorded task' }));
    expect(res?.success).toBe(true);
    expect(res?.cliResult?.stdoutText).toBe('');
  });
});
