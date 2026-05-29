/**
 * Tests for the `record.added` per-record-type structural summary
 * (gap closer for run 108's packet_synthesis empty-field diagnosis).
 *
 * Closes the gap where AODD said "54 implementation_packet records
 * were written" but couldn't show the empty-field pattern across
 * them without opening the DB. With the summarizer registered, the
 * record.added.payload.summary carries field counts directly.
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
  summarizeRecordContent,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

let idCounter = 0;
function testId(): string {
  return `gw-summary-${++idCounter}`;
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

describe('record.added structural summary', () => {
  let workspaceRoot: string;
  let db: Database;

  beforeEach(() => {
    idCounter = 0;
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-recsum-'));
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

  // ── Pure-function summarizer tests (no DB) ───────────────────────

  it('summarizes implementation_packet with field counts + ids', () => {
    const summary = summarizeRecordContent('implementation_packet', {
      packet_id: 'pk-7',
      task: { id: 'task-3' },
      component: { id: 'comp-2' },
      user_stories: [],
      nfrs: [],
      data_models: [{ id: 'dm-1' }, { id: 'dm-2' }, { id: 'dm-3' }],
      api_definitions: [{ id: 'api-1' }],
      test_cases: [],
      evaluation_criteria: [],
      compliance_items: [],
      active_constraints: ['TECH-1', 'TECH-2', 'TECH-3', 'TECH-4'],
      coherence: { passed: false },
    });
    expect(summary).toBeDefined();
    expect(summary!.packet_id).toBe('pk-7');
    expect(summary!.task_id).toBe('task-3');
    expect(summary!.component_id).toBe('comp-2');
    expect(summary!.coherence_passed).toBe(false);
    const counts = summary!.field_counts as Record<string, number>;
    expect(counts.user_stories).toBe(0);
    expect(counts.nfrs).toBe(0);
    expect(counts.data_models).toBe(3);
    expect(counts.api_definitions).toBe(1);
    expect(counts.active_constraints).toBe(4);
  });

  it('summarizes packet_synthesis_failure with code-distribution rollup', () => {
    // PacketSynthesisFailureContent real shape:
    //   failures_by_packet: Record<packet_id, code[]>
    //   total_blocking_failures: number, etc.
    const summary = summarizeRecordContent('packet_synthesis_failure', {
      kind: 'packet_synthesis_failure',
      schemaVersion: '1.0',
      failures_by_packet: {
        'packet-1': [
          "P7_INVENTED_ID_REFERENCE: 'nfr-001' not found upstream",
          "P7_INVENTED_ID_REFERENCE: 'nfr-002' not found upstream",
        ],
        'packet-2': [
          'MISSING_REQUIRED_FIELD: user_stories is empty',
          "P7_INVENTED_ID_REFERENCE: 'us-001' not found upstream",
        ],
      },
      cross_packet_failures: {},
      total_packets: 2,
      failed_packets: 2,
      total_blocking_failures: 4,
      total_advisory_findings: 1,
      total_ai_proposed_root_count: 0,
    });
    expect(summary).toBeDefined();
    expect(summary!.blocking_failure_count).toBe(4);
    expect(summary!.advisory_finding_count).toBe(1);
    const codes = summary!.top_failure_codes as Array<{ code: string; count: number }>;
    expect(codes[0].code).toBe('P7_INVENTED_ID_REFERENCE');
    expect(codes[0].count).toBe(3);
    expect((summary!.sample_blocking_messages as string[]).length).toBe(4);
  });

  it('returns undefined for record types without a registered summarizer', () => {
    const summary = summarizeRecordContent('decision_trace', { kind: 'decision' });
    expect(summary).toBeUndefined();
  });

  it('returns undefined on summarizer throw (malformed content)', () => {
    // Pass deliberately broken content to make sure the registry's
    // try/catch swallows the error rather than breaking the emit path.
    const summary = summarizeRecordContent('implementation_packet', null as unknown as Record<string, unknown>);
    expect(summary).toBeUndefined();
  });

  // ── End-to-end through writeRecord → record.added emit ─────────

  it('writeRecord includes the structural summary in the record.added envelope', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '9', sub_phase_id: 'packet_synthesis' },
      async () => {
        writer.writeRecord({
          record_type: 'implementation_packet',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '9',
          sub_phase_id: 'packet_synthesis',
          janumicode_version_sha: 'abc',
          content: {
            packet_id: 'pk-1',
            task: { id: 't1' },
            component: { id: 'c1' },
            user_stories: [],
            nfrs: [],
            data_models: [{ id: 'dm-1' }],
            api_definitions: [],
            test_cases: [],
            evaluation_criteria: [],
            compliance_items: [],
            active_constraints: [],
          },
        });
      },
    );
    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'run-1').find(
      (e) =>
        e.event_type === 'record.added' &&
        (e.payload as Record<string, unknown>).record_type === 'implementation_packet',
    )!;
    expect(ev).toBeDefined();
    const payload = ev.payload as Record<string, unknown>;
    expect(payload.summary).toBeDefined();
    const summary = payload.summary as Record<string, unknown>;
    expect(summary.packet_id).toBe('pk-1');
    expect((summary.field_counts as Record<string, number>).nfrs).toBe(0);
    expect((summary.field_counts as Record<string, number>).data_models).toBe(1);
  });
});
