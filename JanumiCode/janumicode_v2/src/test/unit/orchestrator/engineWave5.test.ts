/**
 * Wave 5 regression tests for OrchestratorEngine extensions:
 *   - A.1 startWorkflowRun(workspaceId, rawIntentText?)
 *   - A.2 GovernedStreamWriter auto-emits record:added when EventBus is set
 *   - A.3 pauseForDecision / resolveDecision / rejectDecision / recreatePendingFromRecord
 *   - A.4 escalateInconsistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import type { Database } from '../../../lib/database/init';
import { createTestDatabase } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { SerializedRecord } from '../../../lib/events/eventBus';

describe('OrchestratorEngine — Wave 5 extensions', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
  });

  afterEach(() => {
    db.close();
  });

  describe('A.1 startWorkflowRun raw intent text', () => {
    it('writes content.text when rawIntentText is supplied', () => {
      const { run } = engine.startWorkflowRun('ws-1', 'Build a CLI todo app');
      const records = engine.writer.getRecordsByType(run.id, 'raw_intent_received');
      expect(records).toHaveLength(1);
      expect(records[0].content.text).toBe('Build a CLI todo app');
      expect(records[0].content.status).toBe('workflow_initiated');
    });

    it('writes empty content.text when rawIntentText is omitted', () => {
      const { run } = engine.startWorkflowRun('ws-1');
      const records = engine.writer.getRecordsByType(run.id, 'raw_intent_received');
      expect(records[0].content.text).toBe('');
    });
  });

  describe('A.2 writer auto-emits record:added', () => {
    it('emits record:added on every successful writeRecord', () => {
      const seen: SerializedRecord[] = [];
      engine.eventBus.on('record:added', (p) => seen.push(p.record));

      const { run } = engine.startWorkflowRun('ws-1', 'test');
      // startWorkflowRun writes one raw_intent_received record.
      expect(seen.length).toBeGreaterThanOrEqual(1);
      expect(seen.find(r => r.record_type === 'raw_intent_received')).toBeDefined();

      // Additional writes should also emit.
      engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: run.id,
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'test', value: 1 },
      });
      expect(seen.find(r => r.record_type === 'artifact_produced')).toBeDefined();
    });
  });

  describe('A.3 pauseForDecision / resolveDecision', () => {
    it('resolves the awaiting promise when resolveDecision is called', async () => {
      const decisionId = 'mirror-1';
      const promise = engine.pauseForDecision('run-1', decisionId, 'mirror');
      const ok = engine.resolveDecision(decisionId, { type: 'mirror_approval' });
      expect(ok).toBe(true);
      const resolution = await promise;
      expect(resolution.type).toBe('mirror_approval');
      expect(engine.hasPendingDecision(decisionId)).toBe(false);
    });

    it('returns false when resolving an unknown decision', () => {
      const ok = engine.resolveDecision('nope', { type: 'mirror_approval' });
      expect(ok).toBe(false);
    });

    it('emits decision:requested and decision:resolved events', async () => {
      const requested: string[] = [];
      const resolved: string[] = [];
      engine.eventBus.on('decision:requested', (p) => requested.push(p.decisionId));
      engine.eventBus.on('decision:resolved', (p) => resolved.push(p.decisionId));

      const promise = engine.pauseForDecision('run-1', 'mirror-2', 'mirror');
      expect(requested).toEqual(['mirror-2']);
      engine.resolveDecision('mirror-2', { type: 'mirror_approval' });
      await promise;
      expect(resolved).toEqual(['mirror-2']);
    });

    it('auto-approve mode resolves immediately', async () => {
      engine.setAutoApproveDecisions(true);
      const r1 = await engine.pauseForDecision('run-1', 'm1', 'mirror');
      expect(r1.type).toBe('mirror_approval');
      const r2 = await engine.pauseForDecision('run-1', 'menu1', 'menu');
      expect(r2.type).toBe('menu_selection');
      const r3 = await engine.pauseForDecision('run-1', 'gate1', 'phase_gate');
      expect(r3.type).toBe('phase_gate_approval');
    });

    it('rejectDecision rejects the awaiting promise', async () => {
      const promise = engine.pauseForDecision('run-1', 'r1', 'mirror');
      engine.rejectDecision('r1', 'cancelled');
      await expect(promise).rejects.toThrow('cancelled');
    });
  });

  describe('A.4 escalateInconsistency', () => {
    it('writes a consistency_challenge_escalation record and emits events', () => {
      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const errors: string[] = [];
      const escalations: string[] = [];
      engine.eventBus.on('error:occurred', (p) => errors.push(p.message));
      engine.eventBus.on('inconsistency:escalated', (p) => escalations.push(p.escalationRecordId));

      const escId = engine.escalateInconsistency({
        runId: run.id,
        userQueryRecordId: 'query-1',
        conflictingRecordIds: ['rec-a', 'rec-b'],
        description: 'These records contradict',
      });

      expect(escId).toBeTruthy();
      expect(errors[0]).toContain('Consistency escalation');
      expect(escalations).toContain(escId);

      const records = engine.writer.getRecordsByType(run.id, 'consistency_challenge_escalation');
      expect(records).toHaveLength(1);
      expect(records[0].content.description).toBe('These records contradict');
      expect(records[0].content.conflicting_record_ids).toEqual(['rec-a', 'rec-b']);
    });
  });
});
