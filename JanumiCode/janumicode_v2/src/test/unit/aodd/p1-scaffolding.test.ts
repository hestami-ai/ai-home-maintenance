/**
 * P1 scaffolding smoke tests.
 *
 * Verifies the AODD emit/initialize/startRun/endRun cycle writes a
 * well-formed events.ndjson when a TraceCtx is present, and is a
 * silent no-op otherwise. Also pins the ID canonicalization contract.
 *
 * These tests serve a defensive purpose for later phases: when P2+
 * wire callers into AODD, accidental regressions in the seam (e.g.
 * forgetting to honor the no-context fallback) will trip these tests
 * first.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AODD_SCHEMA_VERSION,
  closeStreams,
  emit,
  endRun,
  initialize,
  isAoddEnabled,
  startRun,
} from '../../../lib/aodd';
import { phaseIdToFilenameSegment } from '../../../lib/aodd/idCanonicalize';
import { withTraceContext } from '../../../lib/trace/traceContext';

function readEvents(workspaceRoot: string, runId: string): unknown[] {
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

describe('AODD P1 scaffolding', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p1-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('emit is a silent no-op when unconfigured', () => {
    const id = emit('phase.entered', { phase_name: 'Test' });
    expect(id).toBeNull();
  });

  it('emit is a silent no-op when configured but no run is active', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    const id = emit('phase.entered', { phase_name: 'Test' });
    expect(id).toBeNull();
    expect(isAoddEnabled()).toBe(false);
  });

  it('emits with null phase/sub-phase when no TraceCtx is present (run-level events)', () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-no-ctx');
    const id = emit('run.resumed', { resumed_at: '2026-05-26T00:00:00Z' });
    expect(id).not.toBeNull();
    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-no-ctx');
    expect(events.length).toBeGreaterThanOrEqual(2); // run.resumed + run.completed
    const first = events[0] as Record<string, unknown>;
    expect(first.run_id).toBe('wf-no-ctx');
    expect(first.phase_id).toBeNull();
    expect(first.sub_phase_id).toBeNull();
  });

  it('emit writes a well-formed event line when a run + ctx are active', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-ok');

    await withTraceContext(
      { workflow_run_id: 'wf-ok', phase_id: '1', sub_phase_id: 'entities_bloom' },
      async () => {
        const id = emit('phase.entered', { phase_name: 'Intent Capture' });
        expect(id).not.toBeNull();
        expect(id).toMatch(/^[0-9A-Z]{26}$/); // ULID shape
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-ok');
    // Expect at least: phase.entered + run.completed (emitted by endRun).
    expect(events.length).toBeGreaterThanOrEqual(2);

    const phaseEvent = events[0] as Record<string, unknown>;
    expect(phaseEvent.schema_version).toBe(AODD_SCHEMA_VERSION);
    expect(phaseEvent.event_type).toBe('phase.entered');
    expect(phaseEvent.run_id).toBe('wf-ok');
    expect(phaseEvent.phase_id).toBe('1');
    expect(phaseEvent.sub_phase_id).toBe('entities_bloom');
    expect(phaseEvent.payload).toEqual({ phase_name: 'Intent Capture' });
    expect(typeof phaseEvent.ts).toBe('string');
    expect(typeof phaseEvent.event_id).toBe('string');
  });

  it('writes index.json on endRun with first/last event ids and count', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-index');

    await withTraceContext(
      { workflow_run_id: 'wf-index', phase_id: '1', sub_phase_id: 'sub' },
      async () => {
        emit('phase.entered', { phase_name: 'P' });
        emit('phase.exited', {
          phase_name: 'P',
          status: 'success',
          duration_ms: 1,
          artifact_count: 0,
        });
      },
    );

    endRun({ status: 'success' });

    const indexPath = path.join(
      workspaceRoot,
      '.janumicode',
      'runs',
      'wf-index',
      'aodd',
      'index.json',
    );
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(index.schema_version).toBe(AODD_SCHEMA_VERSION);
    expect(index.run_id).toBe('wf-index');
    expect(index.status).toBe('success');
    expect(typeof index.events.first_event_id).toBe('string');
    expect(typeof index.events.last_event_id).toBe('string');
    expect(index.events.count).toBeGreaterThanOrEqual(3); // 2 emits + run.completed
  });

  it('JANUMICODE_AODD=off disables AODD even when initialize() is called', () => {
    const prev = process.env.JANUMICODE_AODD;
    process.env.JANUMICODE_AODD = 'off';
    try {
      initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
      startRun('wf-off');
      const id = emit('phase.entered', { phase_name: 'P' });
      expect(id).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_AODD;
      else process.env.JANUMICODE_AODD = prev;
    }
  });
});

describe('phaseIdToFilenameSegment', () => {
  it('renders unpadded segments by default', () => {
    expect(phaseIdToFilenameSegment('0')).toBe('phase0');
    expect(phaseIdToFilenameSegment('0.5')).toBe('phase0_5');
    expect(phaseIdToFilenameSegment('1')).toBe('phase1');
    expect(phaseIdToFilenameSegment('10')).toBe('phase10');
  });

  it('zero-pads each component when padded:true', () => {
    // Matches the existing behavior of llmCaller.ts buildLogFilenamePrefix:
    // every dot-separated component is independently padStart(2, '0').
    expect(phaseIdToFilenameSegment('0', { padded: true })).toBe('phase00');
    expect(phaseIdToFilenameSegment('0.5', { padded: true })).toBe('phase00_05');
    expect(phaseIdToFilenameSegment('1', { padded: true })).toBe('phase01');
    expect(phaseIdToFilenameSegment('10', { padded: true })).toBe('phase10');
  });
});
