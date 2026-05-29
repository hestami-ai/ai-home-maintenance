/**
 * P6 sub-phase + run summary tests.
 *
 * Verifies the write-time summary artifacts that an AI coding agent
 * reads first when asked "what happened in this run?" (design memo §4).
 *
 * Tests:
 *   - End-to-end: a synthetic run that emits prompt+LLM+validator events
 *     produces a `<sub_phase>.summary.{json,md}` per sub-phase and a
 *     `run.summary.{json,md}` at the run level.
 *   - 5W+H fields are populated from the events.
 *   - Markdown projector renders deterministic content.
 *   - Empty / no-LLM sub-phases get summaries with `model: 'none'`.
 *   - Failed runs produce a run.summary with status=failed.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  deriveSubPhaseSummary,
  emit as aoddEmit,
  endRun,
  groupBySubPhase,
  initialize,
  readEventsFile,
  renderRunSummaryMd,
  renderSubPhaseSummaryMd,
  startRun,
} from '../../../lib/aodd';
import type {
  RunSummary,
  SubPhaseSummary,
} from '../../../lib/aodd/types';
import { withTraceContext } from '../../../lib/trace/traceContext';

function readJson<T>(filepath: string): T {
  return JSON.parse(fs.readFileSync(filepath, 'utf8')) as T;
}

describe('AODD sub-phase + run summaries (P6)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p6-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('writes per-sub-phase + run summaries at endRun', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
    startRun('wf-sum');
    aoddEmit('run.started', { intent_brief: 'build a thing' });

    await withTraceContext(
      { workflow_run_id: 'wf-sum', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit('phase.entered', { phase_name: 'Intent Capture' });
      },
    );

    await withTraceContext(
      { workflow_run_id: 'wf-sum', phase_id: '1', sub_phase_id: 'entities_bloom' },
      async () => {
        aoddEmit('prompt.template_rendered', {
          template_key: 'phase01/entities_bloom',
          template_source_sha: 'abc123',
        });
        aoddEmit(
          'prompt.materialized',
          { invocation_id: 'inv-1', final_prompt: 'short prompt' },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'llm.invoked',
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            temperature: 0,
            prompt: 'short prompt',
          },
          { invocation_id: 'inv-1', agent_role: 'requirements_agent' },
        );
        aoddEmit(
          'llm.returned',
          {
            text: '{"entities":[]}',
            thinking: null,
            input_tokens: 80,
            output_tokens: 5,
            duration_ms: 300,
            retry_attempts: 0,
          },
          { invocation_id: 'inv-1' },
        );
        aoddEmit('validator.finding', {
          validator_name: 'entity_completeness',
          target_record_id: 'rec-a',
          severity: 'warning',
          message: 'Missing entity X',
        });
      },
    );

    await withTraceContext(
      { workflow_run_id: 'wf-sum', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit('phase.exited', {
          phase_name: 'Intent Capture',
          status: 'success',
          duration_ms: 350,
          artifact_count: 1,
        });
      },
    );

    endRun({ status: 'success' });

    // Sub-phase summary JSON exists.
    const subJsonPath = path.join(
      workspaceRoot,
      '.janumicode',
      'runs',
      'wf-sum',
      'aodd',
      'summaries',
      'phase1',
      'entities_bloom.summary.json',
    );
    expect(fs.existsSync(subJsonPath)).toBe(true);
    const sub = readJson<SubPhaseSummary>(subJsonPath);
    expect(sub.phase_id).toBe('1');
    expect(sub.sub_phase_id).toBe('entities_bloom');
    expect(sub.who.model).toBe('claude-sonnet-4-6');
    expect(sub.who.agent_role).toBe('requirements_agent');
    expect(sub.who.model_parameters.temperature).toBe(0);
    expect(sub.why.template_key).toBe('phase01/entities_bloom');
    expect(sub.why.template_source_sha).toBe('abc123');
    expect(sub.why.rendered_prompt_ref).toMatch(/^[0-9A-Z]{26}$/); // ULID
    expect(sub.what.decisions.length).toBe(1);
    expect(sub.what.decisions[0].kind).toBe('validator_finding');
    expect(sub.how.status).toBe('success');
    expect(sub.how.error).toBeNull();
    expect(sub.events.count).toBeGreaterThanOrEqual(5);

    // Sub-phase summary MD exists.
    const subMdPath = path.join(
      path.dirname(subJsonPath),
      'entities_bloom.summary.md',
    );
    expect(fs.existsSync(subMdPath)).toBe(true);
    const md = fs.readFileSync(subMdPath, 'utf8');
    expect(md).toContain('Sub-phase summary: phase 1 / entities_bloom');
    expect(md).toContain('claude-sonnet-4-6');
    expect(md).toContain('Missing entity X');

    // Run summary exists.
    const runJsonPath = path.join(
      workspaceRoot,
      '.janumicode',
      'runs',
      'wf-sum',
      'aodd',
      'summaries',
      'run.summary.json',
    );
    expect(fs.existsSync(runJsonPath)).toBe(true);
    const run = readJson<RunSummary>(runJsonPath);
    expect(run.run_id).toBe('wf-sum');
    expect(run.status).toBe('success');
    expect(run.intent_brief).toBe('build a thing');
    expect(run.janumicode_version_sha).toBe('v2-test');
    expect(run.totals.sub_phases).toBe(1);
    expect(run.totals.llm_invocations).toBe(1);
    expect(run.phases.length).toBe(1);
    expect(run.phases[0].phase_id).toBe('1');
    expect(run.phases[0].sub_phase_count).toBe(1);
  });

  it('failed runs produce a run.summary with status=failed', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
    startRun('wf-failed');
    aoddEmit('run.started', { intent_brief: null });
    endRun({ status: 'failed', error: { message: 'boom' } });

    const run = readJson<RunSummary>(
      path.join(
        workspaceRoot,
        '.janumicode',
        'runs',
        'wf-failed',
        'aodd',
        'summaries',
        'run.summary.json',
      ),
    );
    expect(run.status).toBe('failed');
  });

  it('sub-phases without LLM calls get summaries with model="none"', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
    startRun('wf-no-llm');

    await withTraceContext(
      { workflow_run_id: 'wf-no-llm', phase_id: '2', sub_phase_id: 'admin_only' },
      async () => {
        aoddEmit('mirror.presented', {
          mirror_id: 'm-1',
          artifact_type: 'config_check',
        });
      },
    );

    endRun({ status: 'success' });

    const sub = readJson<SubPhaseSummary>(
      path.join(
        workspaceRoot,
        '.janumicode',
        'runs',
        'wf-no-llm',
        'aodd',
        'summaries',
        'phase2',
        'admin_only.summary.json',
      ),
    );
    expect(sub.who.model).toBe('none');
    expect(sub.what.decisions.length).toBe(1);
    expect(sub.what.decisions[0].kind).toBe('mirror');
  });

  it('deriveSubPhaseSummary is a pure function (testable in isolation)', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
    startRun('wf-pure');
    aoddEmit('run.started', { intent_brief: null });
    withTraceContext(
      { workflow_run_id: 'wf-pure', phase_id: '3', sub_phase_id: 'check' },
      () => {
        aoddEmit('validator.run', {
          validator_name: 'v1',
          target_record_id: 'r1',
          duration_ms: 5,
        });
      },
    );
    endRun({ status: 'success' });

    const { events } = readEventsFile(workspaceRoot, 'wf-pure');
    const groups = groupBySubPhase(events);
    expect(groups.length).toBe(1);
    const summary = deriveSubPhaseSummary('wf-pure', groups[0]);
    expect(summary.phase_id).toBe('3');
    expect(summary.sub_phase_id).toBe('check');
    expect(summary.who.model).toBe('none');
  });

  it('Markdown projectors are deterministic for fixed input', () => {
    const fixed: SubPhaseSummary = {
      schema_version: 1,
      run_id: 'r',
      phase_id: '1',
      sub_phase_id: 's',
      started_at: '2026-01-01T00:00:00.000Z',
      completed_at: '2026-01-01T00:00:00.100Z',
      duration_ms: 100,
      who: {
        agent_role: 'requirements_agent',
        model: 'm',
        model_parameters: {},
        invocation_chain: [],
      },
      what: { inputs_consumed: [], outputs_produced: [], decisions: [] },
      why: {
        template_key: 't',
        template_source_sha: 'sha',
        rendered_prompt_ref: 'ref',
        governing_constraints: [],
      },
      how: {
        retries: 0,
        repairs: 0,
        escalations: 0,
        fallbacks: [],
        status: 'success',
        error: null,
      },
      events: { first_event_id: 'a', last_event_id: 'b', count: 2 },
    };
    expect(renderSubPhaseSummaryMd(fixed)).toBe(renderSubPhaseSummaryMd(fixed));
  });

  it('renderRunSummaryMd produces a stable shape', () => {
    const fixed: RunSummary = {
      schema_version: 1,
      run_id: 'r1',
      workspace: '/tmp/ws',
      intent_brief: 'do the thing',
      started_at: '2026-01-01T00:00:00.000Z',
      completed_at: '2026-01-01T00:00:01.000Z',
      duration_ms: 1000,
      status: 'success',
      janumicode_version_sha: 'sha',
      phases: [
        { phase_id: '1', status: 'success', sub_phase_count: 2, duration_ms: 500 },
      ],
      totals: {
        sub_phases: 2,
        llm_invocations: 3,
        retries: 0,
        repairs: 0,
        escalations: 0,
        events: 20,
      },
      events: { first_event_id: 'a', last_event_id: 'z', count: 20 },
    };
    const md = renderRunSummaryMd(fixed);
    expect(md).toContain('Run summary: r1');
    expect(md).toContain('| 1 | success | 2 | 500 |');
    expect(md).toContain('LLM invocations**: 3');
  });
});
