import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../../lib/orchestrator/phases/phase0';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { Phase2Handler } from '../../../lib/orchestrator/phases/phase2';
import { Phase3Handler } from '../../../lib/orchestrator/phases/phase3';
import { Phase4Handler } from '../../../lib/orchestrator/phases/phase4';
import { Phase5Handler } from '../../../lib/orchestrator/phases/phase5';
import { ConfigManager } from '../../../lib/config/configManager';
import path from 'path';

describe('Phase Handlers 2-5', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.setAutoApproveDecisions(true);

    // Register all phases
    engine.registerPhase(new Phase0Handler());
    engine.registerPhase(new Phase1Handler());
    engine.registerPhase(new Phase2Handler());
    engine.registerPhase(new Phase3Handler());
    engine.registerPhase(new Phase4Handler());
    engine.registerPhase(new Phase5Handler());
  });

  afterEach(() => {
    db.close();
  });

  describe('Phase 2 — Requirements Definition', () => {
    it('executes successfully and produces artifacts', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id); // Phase 0
      engine.advanceToNextPhase(run.id, '1');
      engine.advanceToNextPhase(run.id, '2');

      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(true);
      expect(result.artifactIds.length).toBeGreaterThanOrEqual(3); // FR + NFR + consistency
    });

    it('sets correct sub-phase progression', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);
      engine.advanceToNextPhase(run.id, '1');
      engine.advanceToNextPhase(run.id, '2');

      const subPhases: string[] = [];
      engine.eventBus.on('phase_gate:pending', (p) => subPhases.push(p.phaseId));

      await engine.executeCurrentPhase(run.id);

      // Should end at phase gate pending for phase 2
      expect(subPhases).toContain('2');
    });
  });

  describe('Phase 3 — System Specification', () => {
    it('executes successfully and produces boundary + requirements + contracts', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);
      engine.advanceToNextPhase(run.id, '1');
      engine.advanceToNextPhase(run.id, '2');
      await engine.executeCurrentPhase(run.id);
      engine.advanceToNextPhase(run.id, '3');

      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(true);
      expect(result.artifactIds.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Phase 4 — Architecture Definition', () => {
    it('executes successfully and produces domains + components + ADRs', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);
      for (const phase of ['1', '2', '3', '4'] as const) {
        engine.advanceToNextPhase(run.id, phase);
        if (phase !== '4') await engine.executeCurrentPhase(run.id);
      }

      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(true);
      expect(result.artifactIds.length).toBeGreaterThanOrEqual(3);
    });

    it('runs invariant checks on component model', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);
      for (const phase of ['1', '2', '3', '4'] as const) {
        engine.advanceToNextPhase(run.id, phase);
        if (phase !== '4') await engine.executeCurrentPhase(run.id);
      }

      await engine.executeCurrentPhase(run.id);

      // Check that invariant records were potentially written
      // (with empty components, the invariant check should pass vacuously)
      const invariantRecords = engine.writer.getRecordsByType(run.id, 'invariant_violation_record');
      // Empty component model should not trigger violations
      expect(invariantRecords.length).toBe(0);
    });
  });

  describe('Phase 5 — Technical Specification', () => {
    it('executes successfully and produces 4 artifact types', async () => {
      const { run } = engine.startWorkflowRun('ws-1');
      await engine.executeCurrentPhase(run.id);
      for (const phase of ['1', '2', '3', '4', '5'] as const) {
        engine.advanceToNextPhase(run.id, phase);
        if (phase !== '5') await engine.executeCurrentPhase(run.id);
      }

      const result = await engine.executeCurrentPhase(run.id);

      expect(result.success).toBe(true);
      // data_models + api_definitions + error_handling + config_params = 4
      expect(result.artifactIds.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Full Phase 0-5 pipeline', () => {
    it('executes all phases in sequence', async () => {
      const { run } = engine.startWorkflowRun('ws-1');

      const phaseResults: { phase: string; success: boolean; artifacts: number }[] = [];

      // Phase 0
      let result = await engine.executeCurrentPhase(run.id);
      phaseResults.push({ phase: '0', success: result.success, artifacts: result.artifactIds.length });

      // Before Phase 1: provide a raw intent with text
      engine.writer.writeRecord({
        record_type: 'raw_intent_received',
        schema_version: '1.0',
        workflow_run_id: run.id,
        phase_id: '1',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { text: 'Build a task management application for small teams' },
      });

      // Phases 1-5
      for (const phase of ['1', '2', '3', '4', '5'] as const) {
        engine.advanceToNextPhase(run.id, phase);
        result = await engine.executeCurrentPhase(run.id);
        phaseResults.push({ phase, success: result.success, artifacts: result.artifactIds.length });
      }

      // All should succeed
      const failedPhases = phaseResults.filter(pr => !pr.success);
      expect(failedPhases).toEqual([]);

      // Phase 0: 2+ artifacts (classification + collision)
      expect(phaseResults[0].artifacts).toBeGreaterThanOrEqual(2);
      // Phase 5: 4+ artifacts (data models, APIs, error handling, config)
      expect(phaseResults[5].artifacts).toBeGreaterThanOrEqual(4);

      // Total artifacts across all phases
      const totalArtifacts = phaseResults.reduce((sum, pr) => sum + pr.artifacts, 0);
      expect(totalArtifacts).toBeGreaterThanOrEqual(15);
    });
  });
});
