/**
 * P5 LLM / prompt / validator / repair event tests.
 *
 * The wiring lives at:
 *   - src/lib/trace/templateRendered.ts    prompt.template_rendered
 *   - src/lib/llm/llmCaller.ts             prompt.materialized, llm.invoked,
 *                                          llm.returned, llm.failed, llm.cache_hit
 *   - src/lib/llm/llmCaller.ts (repair)    repair.json_succeeded, repair.json_failed
 *   - src/lib/review/harness/reviewHarness.ts  validator.run, validator.finding
 *
 * This file tests the AODD `emit()` API with the exact payload shapes those
 * call-sites use, plus a payload-spill smoke test. End-to-end coverage
 * of LLMCaller / reviewHarness happens through their own unit suites.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  emit as aoddEmit,
  endRun,
  initialize,
  maybeSpillText,
  startRun,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

function readEvents(workspaceRoot: string, runId: string): Array<Record<string, unknown>> {
  const filepath = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'events.ndjson',
  );
  if (!fs.existsSync(filepath)) return [];
  return fs
    .readFileSync(filepath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

describe('AODD LLM / prompt event shapes (P5)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p5-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('records a typical LLM call bracket: template_rendered → materialized → invoked → returned', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-llm');

    await withTraceContext(
      { workflow_run_id: 'wf-llm', phase_id: '1', sub_phase_id: 'entities_bloom' },
      async () => {
        aoddEmit('prompt.template_rendered', {
          template_key: 'phase01/entities_bloom',
          template_source_sha: 'unknown',
        });
        aoddEmit(
          'prompt.materialized',
          { invocation_id: 'inv-1', final_prompt: 'You are a helpful assistant...' },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'llm.invoked',
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            temperature: 0,
            prompt: 'You are a helpful assistant...',
          },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'llm.returned',
          {
            text: '{"entities":[]}',
            thinking: null,
            input_tokens: 100,
            output_tokens: 5,
            duration_ms: 420,
            retry_attempts: 0,
          },
          { invocation_id: 'inv-1' },
        );
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-llm');
    const sequence = events
      .map((e) => e.event_type as string)
      .filter((t) =>
        t.startsWith('prompt.') || t.startsWith('llm.'),
      );
    expect(sequence).toEqual([
      'prompt.template_rendered',
      'prompt.materialized',
      'llm.invoked',
      'llm.returned',
    ]);

    // invocation_id appears in envelope for materialized/invoked/returned.
    const materialized = events.find((e) => e.event_type === 'prompt.materialized')!;
    const invoked = events.find((e) => e.event_type === 'llm.invoked')!;
    const returned = events.find((e) => e.event_type === 'llm.returned')!;
    expect(materialized.invocation_id).toBe('inv-1');
    expect(invoked.invocation_id).toBe('inv-1');
    expect(returned.invocation_id).toBe('inv-1');
  });

  it('llm.failed carries the error message and retry_attempts', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-fail');

    await withTraceContext(
      { workflow_run_id: 'wf-fail', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        aoddEmit(
          'llm.failed',
          {
            error: { message: 'rate limited', code: 'rate_limit_error' },
            duration_ms: 1500,
            retry_attempts: 3,
          },
          { invocation_id: 'inv-X' },
        );
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-fail');
    const failed = events.find((e) => e.event_type === 'llm.failed');
    expect(failed).toBeDefined();
    const payload = failed!.payload as Record<string, unknown>;
    expect((payload.error as Record<string, unknown>).message).toBe('rate limited');
    expect(payload.retry_attempts).toBe(3);
  });

  it('llm.cache_hit references the source invocation', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-cache');

    await withTraceContext(
      { workflow_run_id: 'wf-cache', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        aoddEmit(
          'llm.cache_hit',
          {
            source_invocation_id: 'src-inv-1',
            text: '{"cached":true}',
          },
          { invocation_id: 'inv-2' },
        );
      },
    );

    endRun({ status: 'success' });

    const cache = readEvents(workspaceRoot, 'wf-cache').find(
      (e) => e.event_type === 'llm.cache_hit',
    );
    expect(cache).toBeDefined();
    expect((cache!.payload as Record<string, unknown>).source_invocation_id).toBe(
      'src-inv-1',
    );
  });

  it('repair.json_succeeded and repair.json_failed use snake_case', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-repair');

    await withTraceContext(
      { workflow_run_id: 'wf-repair', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        aoddEmit('repair.json_succeeded', {
          strategy: 'multi_attempt',
          repaired: '{"ok":true}',
        });
        aoddEmit('repair.json_failed', {
          strategy: 'multi_attempt',
          error: { message: 'no parse' },
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-repair');
    const types = events
      .map((e) => e.event_type as string)
      .filter((t) => t.startsWith('repair.'));
    expect(types).toEqual(['repair.json_succeeded', 'repair.json_failed']);
  });

  it('validator.run and validator.finding carry the right fields', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-validator');

    await withTraceContext(
      { workflow_run_id: 'wf-validator', phase_id: '3', sub_phase_id: 'api_definitions' },
      async () => {
        aoddEmit('validator.run', {
          validator_name: 'api_completeness_check',
          target_record_id: 'rec-99',
          duration_ms: 12,
        });
        aoddEmit('validator.finding', {
          validator_name: 'api_completeness_check',
          target_record_id: 'rec-99',
          severity: 'warning',
          message: 'Missing response schema on endpoint /users',
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-validator').filter((e) =>
      String(e.event_type).startsWith('validator.'),
    );
    expect(events.length).toBe(2);
    expect(events[0].event_type).toBe('validator.run');
    expect(events[1].event_type).toBe('validator.finding');
    expect((events[1].payload as Record<string, unknown>).severity).toBe('warning');
  });
});

describe('maybeSpillText (P5 payload sidecar)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p5-spill-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('returns the string verbatim when under the text threshold', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-spill-small');
    const small = 'short prompt';
    expect(maybeSpillText(small)).toBe(small);
    endRun({ status: 'success' });
  });

  it('spills to a sidecar file and returns a PayloadRef when over the threshold', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-spill-large');
    const large = 'x'.repeat(2048); // > 1KB default
    const result = maybeSpillText(large);
    expect(typeof result).toBe('object');
    const ref = result as { payload_ref: string; bytes: number; kind: string };
    expect(ref.kind).toBe('text');
    expect(ref.bytes).toBe(2048);

    const filepath = path.join(
      workspaceRoot,
      '.janumicode',
      'runs',
      'wf-spill-large',
      'aodd',
      'payloads',
      `${ref.payload_ref}.txt`,
    );
    expect(fs.existsSync(filepath)).toBe(true);
    expect(fs.readFileSync(filepath, 'utf8')).toBe(large);
    endRun({ status: 'success' });
  });
});
