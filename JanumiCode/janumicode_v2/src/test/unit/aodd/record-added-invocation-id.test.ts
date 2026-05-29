/**
 * Tests pinning the `record.added` envelope `invocation_id` derivation
 * in `GovernedStreamWriter.writeRecord`.
 *
 * Closes the workspace-105 inspection gap: every record.added event
 * had invocation_id null even when the record was an agent_invocation
 * or a record bound to one (agent_output, tool_call, etc.).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import {
  closeStreams,
  endRun,
  initialize,
  startRun,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

let idCounter = 0;
function testId(): string {
  return `gw-${++idCounter}`;
}

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
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('record.added envelope invocation_id', () => {
  let workspaceRoot: string;
  let db: Database;

  beforeEach(() => {
    idCounter = 0;
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-rec-inv-'));
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    db.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('agent_invocation record.added carries the record id as invocation_id', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    let invocationRecordId: string | undefined;
    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        const rec = writer.writeRecord({
          record_type: 'agent_invocation',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          content: { provider: 'test', model: 'test', status: 'running' },
        });
        invocationRecordId = rec.id;
      },
    );
    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'run-1').filter(
      (e) => e.event_type === 'record.added',
    );
    expect(events.length).toBe(1);
    expect(events[0].invocation_id).toBe(invocationRecordId);
    expect((events[0].payload as Record<string, unknown>).record_type).toBe(
      'agent_invocation',
    );
  });

  it('agent_output record.added inherits invocation_id from produced_by_record_id', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        const inv = writer.writeRecord({
          record_type: 'agent_invocation',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          content: { provider: 'test', model: 'test', status: 'running' },
        });
        writer.writeRecord({
          record_type: 'agent_output',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          produced_by_record_id: inv.id,
          content: { status: 'success', text: 'ok', duration_ms: 10 },
        });
      },
    );
    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'run-1').filter(
      (e) => e.event_type === 'record.added',
    );
    expect(events.length).toBe(2);
    const invocationId = events[0].invocation_id;
    expect(events[1].invocation_id).toBe(invocationId);
    expect((events[1].payload as Record<string, unknown>).record_type).toBe(
      'agent_output',
    );
  });

  it('non-invocation-bound record types leave invocation_id null (or pick up from TraceCtx)', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        // TraceCtx has no invocation_id set; record_type is not in the
        // invocation-bound set; envelope.invocation_id should be null.
        writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          content: { kind: 'misc' },
        });
      },
    );
    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'run-1').filter(
      (e) => e.event_type === 'record.added',
    );
    expect(events.length).toBe(1);
    expect(events[0].invocation_id).toBeNull();
  });
});
