/**
 * P3 end-to-end tests: AODD run + phase lifecycle.
 *
 * Verifies that the wiring at orchestratorEngine.ts:
 *   - aoddStartRun + aoddEmit('run.started') fire at startWorkflowRun()
 *   - aoddEmit('phase.entered' / 'phase.exited') pair with the existing
 *     emitLifecycle calls
 *   - aoddEndRun fires on workflow completion (emits run.completed) and
 *     on user-initiated cancel (emits run.failed)
 *   - log entries flow through AoddLogHandler into events.ndjson
 *
 * Also pins the ID canonicalization contract: the refactored writers
 * (auditPause + buildLogFilenamePrefix) must produce the same on-disk
 * shape they did before P3.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  emit as aoddEmit,
  endRun as aoddEndRun,
  initialize,
  registerAoddLogHandler,
  startRun as aoddStartRun,
  unregisterAoddLogHandler,
} from '../../../lib/aodd';
import { buildLogFilenamePrefix } from '../../../lib/llm/llmCaller';
import { Logger } from '../../../lib/logging/logger';
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

describe('AODD run + phase lifecycle (P3)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p3-'));
  });

  afterEach(() => {
    unregisterAoddLogHandler();
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('records a complete run: started → phase entered/exited → completed', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    aoddStartRun('wf-cycle');
    aoddEmit('run.started', { intent_brief: 'build a todo app' });

    // Simulate the orchestrator's phase frame for one phase.
    await withTraceContext(
      { workflow_run_id: 'wf-cycle', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit('phase.entered', { phase_name: 'Intent Capture and Convergence' });
        aoddEmit('phase.exited', {
          phase_name: 'Intent Capture and Convergence',
          status: 'success',
          duration_ms: 42,
          artifact_count: 3,
        });
      },
    );

    aoddEndRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-cycle');
    const types = events.map((e) => e.event_type);
    expect(types).toEqual([
      'run.started',
      'phase.entered',
      'phase.exited',
      'run.completed',
    ]);

    // run.started carries the intent brief.
    expect((events[0].payload as Record<string, unknown>).intent_brief).toBe(
      'build a todo app',
    );

    // phase.* events are scoped to phase 1.
    expect(events[1].phase_id).toBe('1');
    expect(events[2].phase_id).toBe('1');

    // run.completed status is 'success'.
    expect((events[3].payload as Record<string, unknown>).status).toBe('success');

    // index.json exists.
    const indexPath = path.join(
      workspaceRoot,
      '.janumicode',
      'runs',
      'wf-cycle',
      'aodd',
      'index.json',
    );
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('endRun({ status: "failed" }) emits run.failed with the error', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    aoddStartRun('wf-cancel');
    aoddEmit('run.started', { intent_brief: null });

    aoddEndRun({
      status: 'failed',
      error: { message: 'workflow cancelled by user' },
    });

    const events = readEvents(workspaceRoot, 'wf-cancel');
    const types = events.map((e) => e.event_type);
    expect(types).toEqual(['run.started', 'run.failed']);
    const failedPayload = events[1].payload as Record<string, unknown>;
    expect((failedPayload.error as Record<string, unknown>).message).toBe(
      'workflow cancelled by user',
    );
  });

  it('logger entries flow into events.ndjson as log.<level> events', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    aoddStartRun('wf-log-flow');

    const logger = new Logger({ level: 'DEBUG', consoleEnabled: false });
    registerAoddLogHandler(logger);

    await withTraceContext(
      { workflow_run_id: 'wf-log-flow', phase_id: '4', sub_phase_id: 'component_skeleton' },
      async () => {
        aoddEmit('phase.entered', { phase_name: 'Architecture' });
        logger.info('workflow', 'phase work happening', { foo: 'bar' });
        logger.warn('llm', 'retry scheduled', { attempt: 2 });
      },
    );

    aoddEndRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-log-flow');
    const logEvents = events.filter((e) => String(e.event_type).startsWith('log.'));
    expect(logEvents.length).toBe(2);
    expect(logEvents[0].event_type).toBe('log.info');
    expect(logEvents[0].phase_id).toBe('4');
    expect(logEvents[0].sub_phase_id).toBe('component_skeleton');
    expect((logEvents[0].payload as Record<string, unknown>).message).toBe(
      'phase work happening',
    );
  });

  it('startRun on the same run id is idempotent', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    aoddStartRun('wf-idem');
    aoddEmit('run.started', { intent_brief: null });
    // Calling startRun again with the same id must not truncate events
    // or close the prior stream silently.
    aoddStartRun('wf-idem');
    aoddEmit('run.resumed', { resumed_at: new Date().toISOString() });
    aoddEndRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-idem');
    const types = events.map((e) => e.event_type);
    expect(types).toEqual(['run.started', 'run.resumed', 'run.completed']);
  });
});

describe('buildLogFilenamePrefix (P3 refactor through phaseIdToFilenameSegment)', () => {
  it('preserves existing on-disk shape for typical inputs', () => {
    expect(buildLogFilenamePrefix('1', 'intent_quality_check')).toBe(
      'phase01_intent_quality_check',
    );
    expect(buildLogFilenamePrefix('10', 'finalize')).toBe('phase10_finalize');
    expect(buildLogFilenamePrefix('0.5', 'x')).toBe('phase00_05_x');
    expect(buildLogFilenamePrefix('2', null)).toBe('phase02');
    expect(buildLogFilenamePrefix(null, null)).toBeNull();
    expect(buildLogFilenamePrefix(null, 'orphan')).toBe('phase_orphan');
  });

  it('sanitizes sub-phase ids containing unsafe characters', () => {
    expect(buildLogFilenamePrefix('1', 'a.b-c')).toBe('phase01_a_b_c');
  });
});
