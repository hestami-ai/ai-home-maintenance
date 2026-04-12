import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../../lib/orchestrator/phases/phase0';
import { ConfigManager } from '../../../lib/config/configManager';
import path from 'path';

describe('OrchestratorEngine', () => {
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

  describe('startWorkflowRun', () => {
    it('creates a workflow run at Phase 0', () => {
      const { run } = engine.startWorkflowRun('ws-1');

      expect(run.id).toBeTruthy();
      expect(run.current_phase_id).toBe('0');
      expect(run.status).toBe('initiated');
    });

    it('emits workflow:started event', () => {
      let emitted = false;
      engine.eventBus.on('workflow:started', () => { emitted = true; });

      engine.startWorkflowRun('ws-1');
      expect(emitted).toBe(true);
    });

    it('writes a raw_intent_received record', () => {
      const { run } = engine.startWorkflowRun('ws-1');
      const records = engine.writer.getRecordsByType(run.id, 'raw_intent_received');
      expect(records.length).toBe(1);
    });
  });

  describe('phase handler registry', () => {
    it('registers and retrieves phase handlers', () => {
      const handler = new Phase0Handler();
      engine.registerPhase(handler);

      expect(engine.getPhaseHandler('0')).toBe(handler);
      expect(engine.getPhaseHandler('1')).toBeUndefined();
    });
  });

  describe('executeCurrentPhase', () => {
    it('returns error when no handler registered', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });

    it('returns error for nonexistent run', async () => {
      const result = await engine.executeCurrentPhase('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('executes Phase 0 successfully', async () => {
      engine.registerPhase(new Phase0Handler());
      const { run } = engine.startWorkflowRun('ws-1');

      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(true);
      expect(result.artifactIds.length).toBeGreaterThanOrEqual(2);
    });

    it('emits phase:started and phase:completed events for Phase 0', async () => {
      engine.registerPhase(new Phase0Handler());
      const events: string[] = [];

      engine.eventBus.on('phase:started', (p) => events.push(`started:${p.phaseId}`));
      engine.eventBus.on('phase:completed', (p) => events.push(`completed:${p.phaseId}`));

      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);

      expect(events).toContain('started:0');
      expect(events).toContain('completed:0');
    });
  });

  describe('advanceToNextPhase', () => {
    it('advances from Phase 0 to Phase 1', () => {
      const { run } = engine.startWorkflowRun('ws-1');
      const success = engine.advanceToNextPhase(run.id, '1');

      expect(success).toBe(true);
      const updated = engine.stateMachine.getWorkflowRun(run.id);
      expect(updated!.current_phase_id).toBe('1');
    });

    it('rejects invalid transitions', () => {
      const { run } = engine.startWorkflowRun('ws-1');
      const success = engine.advanceToNextPhase(run.id, '5');
      expect(success).toBe(false);
    });
  });
});
