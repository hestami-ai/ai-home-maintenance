/**
 * Tests for the new record.added summarizers (requirement_decomposition_node,
 * task_decomposition_node, fixed packet_synthesis_failure) and the new
 * record.superseded event emitted from GovernedStreamWriter's
 * supersession methods.
 *
 * Closes the diagnostic gaps surfaced in ts-109 audit (defects 1, 2, 4).
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
  return `gw-ext-${++idCounter}`;
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

// ── Pure summarizer tests (no DB) ───────────────────────────────────

describe('requirement_decomposition_node summarizer', () => {
  it('extracts ac_ids_count + sample + ids + status from the user_story content', () => {
    const summary = summarizeRecordContent('requirement_decomposition_node', {
      kind: 'requirement_decomposition_node',
      node_id: 'node-uuid-1',
      parent_node_id: 'node-uuid-0',
      display_key: 'FR-CAM-1.1',
      root_fr_id: 'FR-CAM',
      depth: 2,
      pass_number: 1,
      status: 'atomic',
      root_kind: 'fr',
      tier: 'C',
      user_story: {
        id: 'FR-CAM-1.1',
        role: 'sharer',
        action: 'submit URL',
        outcome: 'short URL returned',
        acceptance_criteria: [
          { id: 'AC-FR-CAM-1.1-001', description: 'd1', measurable_condition: 'm1' },
          { id: 'AC-FR-CAM-1.1-002', description: 'd2', measurable_condition: 'm2' },
          { id: 'AC-FR-CAM-1.1-003', description: 'd3', measurable_condition: 'm3' },
        ],
        priority: 'high',
      },
      surfaced_assumption_ids: [],
    });
    expect(summary).toBeDefined();
    expect(summary!.node_id).toBe('node-uuid-1');
    expect(summary!.parent_node_id).toBe('node-uuid-0');
    expect(summary!.root_kind).toBe('fr');
    expect(summary!.status).toBe('atomic');
    expect(summary!.user_story_id).toBe('FR-CAM-1.1');
    expect(summary!.ac_ids_count).toBe(3);
    expect((summary!.ac_ids_sample as string[]).length).toBe(3);
    expect((summary!.ac_ids_sample as string[])[0]).toBe('AC-FR-CAM-1.1-001');
  });

  it('handles missing user_story gracefully', () => {
    const summary = summarizeRecordContent('requirement_decomposition_node', {
      kind: 'requirement_decomposition_node',
      node_id: 'node-uuid-1',
      parent_node_id: null,
      display_key: 'FR-CAM',
      root_fr_id: 'FR-CAM',
      depth: 0,
      pass_number: 1,
      status: 'pending',
      root_kind: 'fr',
      surfaced_assumption_ids: [],
    });
    expect(summary).toBeDefined();
    expect(summary!.ac_ids_count).toBe(0);
    expect((summary!.ac_ids_sample as string[]).length).toBe(0);
  });

  it('would surface the ts-109 AC-001 hard-code pattern via ac_ids_sample', () => {
    // Two NFR-stub nodes both hard-coded to AC-001 — adaptNfrToUserStory bug.
    const stub1 = summarizeRecordContent('requirement_decomposition_node', {
      kind: 'requirement_decomposition_node',
      node_id: 'nfr-stub-1',
      parent_node_id: 'nfr-root',
      display_key: 'NFR-STUB-1',
      root_fr_id: 'nfr-root',
      depth: 1,
      pass_number: 1,
      status: 'pending',
      root_kind: 'nfr',
      user_story: {
        id: 'NFR-STUB-1',
        role: 'stub',
        action: 'stub',
        outcome: 'stub',
        acceptance_criteria: [{ id: 'AC-001', description: '', measurable_condition: '' }],
        priority: 'medium',
      },
      surfaced_assumption_ids: [],
    });
    const stub2 = summarizeRecordContent('requirement_decomposition_node', {
      kind: 'requirement_decomposition_node',
      node_id: 'nfr-stub-2',
      parent_node_id: 'nfr-root',
      display_key: 'NFR-STUB-2',
      root_fr_id: 'nfr-root',
      depth: 1,
      pass_number: 1,
      status: 'pending',
      root_kind: 'nfr',
      user_story: {
        id: 'NFR-STUB-2',
        role: 'stub',
        action: 'stub',
        outcome: 'stub',
        acceptance_criteria: [{ id: 'AC-001', description: '', measurable_condition: '' }],
        priority: 'medium',
      },
      surfaced_assumption_ids: [],
    });
    // Both summaries show the collision in their ac_ids_sample.
    expect((stub1!.ac_ids_sample as string[])[0]).toBe('AC-001');
    expect((stub2!.ac_ids_sample as string[])[0]).toBe('AC-001');
  });
});

describe('task_decomposition_node summarizer', () => {
  it('classifies traces_to by id-prefix kind', () => {
    const summary = summarizeRecordContent('task_decomposition_node', {
      kind: 'task_decomposition_node',
      node_id: 'task-uuid-1',
      parent_node_id: null,
      display_key: 'task-serve-redirect',
      root_task_id: 'task-uuid-1',
      depth: 0,
      pass_number: 1,
      status: 'atomic',
      task: {
        id: 'task-serve-redirect',
        name: 'Serve redirect',
        description: 'Implement the redirect endpoint',
        component_id: 'comp-redirect-service',
        component_responsibility: 'redirect',
        completion_criteria: [],
        // Mixed traces_to: 2 components, 0 user stories, 0 NFRs, 1 AC, 1 other.
        traces_to: ['comp-redirect-service', 'comp-cache', 'AC-FR-CAM-1.1-001', 'TECH-1'],
        active_constraints: ['TECH-1', 'TECH-2'],
      },
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    });
    expect(summary).toBeDefined();
    expect(summary!.task_id).toBe('task-serve-redirect');
    expect(summary!.component_id).toBe('comp-redirect-service');
    expect(summary!.traces_to_count).toBe(4);
    const byKind = summary!.traces_to_by_kind as Record<string, number>;
    expect(byKind.components).toBe(2);
    expect(byKind.user_stories).toBe(0);
    expect(byKind.nfrs).toBe(0);
    expect(byKind.acs).toBe(1);
    expect(byKind.other).toBe(1);
    expect(summary!.active_constraints_count).toBe(2);
  });

  it('would surface the ts-109 defect 4 root cause: traces_to has only components', () => {
    // The actual ts-109 task shape — traces_to populated only with
    // component ids, nothing else. The summary makes this immediately
    // visible.
    const summary = summarizeRecordContent('task_decomposition_node', {
      kind: 'task_decomposition_node',
      node_id: 'task-uuid-x',
      parent_node_id: null,
      display_key: 'task-x',
      root_task_id: 'task-uuid-x',
      depth: 0,
      pass_number: 1,
      status: 'atomic',
      task: {
        id: 'task-x',
        name: '',
        description: '',
        component_id: 'comp-x',
        component_responsibility: '',
        completion_criteria: [],
        traces_to: ['comp-x', 'comp-y'],
      },
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    });
    const byKind = summary!.traces_to_by_kind as Record<string, number>;
    expect(byKind.components).toBe(2);
    expect(byKind.user_stories).toBe(0); // the diagnostic signal
    expect(byKind.nfrs).toBe(0);
  });
});

describe('packet_synthesis_failure summarizer — real content shape', () => {
  it('rolls up failures_by_packet + cross_packet_failures correctly', () => {
    const summary = summarizeRecordContent('packet_synthesis_failure', {
      kind: 'packet_synthesis_failure',
      schemaVersion: '1.0',
      failures_by_packet: {
        'packet-1': ['P7_INVENTED_ID_REFERENCE: nfr-001', 'MISSING_REQUIRED_FIELD: us'],
        'packet-2': ['P7_INVENTED_ID_REFERENCE: nfr-002'],
        'packet-3': ['P7_INVENTED_ID_REFERENCE: us-001', 'P7_INVENTED_ID_REFERENCE: us-002'],
      },
      cross_packet_failures: {},
      total_packets: 3,
      failed_packets: 3,
      total_blocking_failures: 5,
      total_advisory_findings: 0,
      total_ai_proposed_root_count: 0,
    });
    expect(summary).toBeDefined();
    expect(summary!.total_packets).toBe(3);
    expect(summary!.failed_packets).toBe(3);
    expect(summary!.blocking_failure_count).toBe(5);
    const codes = summary!.top_failure_codes as Array<{ code: string; count: number }>;
    expect(codes[0].code).toBe('P7_INVENTED_ID_REFERENCE');
    expect(codes[0].count).toBe(4);
    expect(codes[1].code).toBe('MISSING_REQUIRED_FIELD');
    expect(codes[1].count).toBe(1);
    // 5 total failures, limit 5 → all collected.
    expect((summary!.sample_blocking_messages as string[]).length).toBe(5);
  });

  it('handles empty failure buckets (no records to summarize)', () => {
    const summary = summarizeRecordContent('packet_synthesis_failure', {
      kind: 'packet_synthesis_failure',
      schemaVersion: '1.0',
      failures_by_packet: {},
      cross_packet_failures: {},
      total_packets: 52,
      failed_packets: 0,
      total_blocking_failures: 0,
      total_advisory_findings: 0,
      total_ai_proposed_root_count: 0,
    });
    expect(summary!.total_packets).toBe(52);
    expect(summary!.blocking_failure_count).toBe(0);
    expect((summary!.top_failure_codes as Array<unknown>).length).toBe(0);
  });
});

// ── record.superseded — end-to-end through GovernedStreamWriter ─────

describe('record.superseded emission', () => {
  let workspaceRoot: string;
  let db: Database;

  beforeEach(() => {
    idCounter = 0;
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-superseded-'));
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

  it('supersedByRollback fires record.superseded with record_type + reason=rollback', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    let originalId: string | undefined;
    let supersedingId: string | undefined;
    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '1', sub_phase_id: 'x' },
      async () => {
        const original = writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          content: { kind: 'misc', value: 'v1' },
        });
        originalId = original.id;
        const superseding = writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '1',
          sub_phase_id: 'x',
          janumicode_version_sha: 'abc',
          content: { kind: 'misc', value: 'v2' },
        });
        supersedingId = superseding.id;
        writer.supersedByRollback(original.id, superseding.id);
      },
    );
    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'run-1').find(
      (e) => e.event_type === 'record.superseded',
    );
    expect(ev).toBeDefined();
    const payload = ev!.payload as Record<string, unknown>;
    expect(payload.record_id).toBe(originalId);
    expect(payload.superseded_by_id).toBe(supersedingId);
    expect(payload.record_type).toBe('artifact_produced');
    expect(payload.reason).toBe('rollback');
  });

  it('supersedeDecompositionNodeByLogicalId fires record.superseded with reason=decomposition_revision', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    let firstId: string | undefined;
    let revisionId: string | undefined;
    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '2', sub_phase_id: 'fr_saturation' },
      async () => {
        const first = writer.writeRecord({
          record_type: 'requirement_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '2',
          sub_phase_id: 'fr_saturation',
          janumicode_version_sha: 'abc',
          content: {
            kind: 'requirement_decomposition_node',
            node_id: 'logical-node-1',
            parent_node_id: null,
            display_key: 'FR-X',
            root_fr_id: 'FR-X',
            depth: 0,
            pass_number: 1,
            status: 'pending',
            root_kind: 'fr',
            user_story: {
              id: 'FR-X',
              role: '',
              action: '',
              outcome: '',
              acceptance_criteria: [],
              priority: 'medium',
            },
            surfaced_assumption_ids: [],
          },
        });
        firstId = first.id;
        const revision = writer.writeRecord({
          record_type: 'requirement_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '2',
          sub_phase_id: 'fr_saturation',
          janumicode_version_sha: 'abc',
          content: {
            kind: 'requirement_decomposition_node',
            node_id: 'logical-node-1', // same logical id
            parent_node_id: null,
            display_key: 'FR-X',
            root_fr_id: 'FR-X',
            depth: 0,
            pass_number: 2,
            status: 'atomic',
            root_kind: 'fr',
            user_story: {
              id: 'FR-X',
              role: '',
              action: '',
              outcome: '',
              acceptance_criteria: [],
              priority: 'medium',
            },
            surfaced_assumption_ids: [],
          },
        });
        revisionId = revision.id;
        writer.supersedeDecompositionNodeByLogicalId(
          'run-1',
          'logical-node-1',
          revision.id,
        );
      },
    );
    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'run-1').find(
      (e) => e.event_type === 'record.superseded',
    );
    expect(ev).toBeDefined();
    const payload = ev!.payload as Record<string, unknown>;
    expect(payload.record_id).toBe(firstId);
    expect(payload.superseded_by_id).toBe(revisionId);
    expect(payload.record_type).toBe('requirement_decomposition_node');
    expect(payload.reason).toBe('decomposition_revision');
  });

  it('decomposition supersession with no prior current row fires no event', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'abc', enabled: true });
    startRun('run-1');
    const writer = new GovernedStreamWriter(db, testId);

    await withTraceContext(
      { workflow_run_id: 'run-1', phase_id: '2', sub_phase_id: 'fr_saturation' },
      async () => {
        // First write of a brand-new logical node — supersedes nothing.
        const r = writer.writeRecord({
          record_type: 'requirement_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          phase_id: '2',
          sub_phase_id: 'fr_saturation',
          janumicode_version_sha: 'abc',
          content: {
            kind: 'requirement_decomposition_node',
            node_id: 'fresh-uuid',
            parent_node_id: null,
            display_key: 'FR-Z',
            root_fr_id: 'FR-Z',
            depth: 0,
            pass_number: 1,
            status: 'atomic',
            root_kind: 'fr',
            user_story: {
              id: 'FR-Z',
              role: '',
              action: '',
              outcome: '',
              acceptance_criteria: [],
              priority: 'medium',
            },
            surfaced_assumption_ids: [],
          },
        });
        writer.supersedeDecompositionNodeByLogicalId('run-1', 'fresh-uuid', r.id);
      },
    );
    endRun({ status: 'success' });

    const supersedingEvents = readEvents(workspaceRoot, 'run-1').filter(
      (e) => e.event_type === 'record.superseded',
    );
    expect(supersedingEvents.length).toBe(0);
  });
});
