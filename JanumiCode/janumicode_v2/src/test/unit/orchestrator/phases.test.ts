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

    // Stub the Orchestrator backing — see fullPipeline.test.ts for
    // rationale. The default `gemini_cli` would spawn the real binary.
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'stub', model: 'stub' },
    });
    const stubProvider = {
      call: () => Promise.resolve({
        text: '', parsed: null, toolCalls: [],
        provider: 'stub', model: 'stub',
        inputTokens: null, outputTokens: null,
        usedFallback: false, retryAttempts: 0,
      }),
    };
    engine.llmCaller.registerProvider({ name: 'stub', ...stubProvider });
    // Phase 2-8 helpers hardcode `provider: 'ollama'`. After removing
    // the silent fallback catches (correctness invariant: unrecoverable
    // LLM failures halt the workflow), an unregistered ollama provider
    // throws and propagates. Register a no-op stub under 'ollama' so
    // those helpers hit their inner empty-response fallback path and
    // the phase flow runs end-to-end.
    engine.llmCaller.registerProvider({ name: 'ollama', ...stubProvider });

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

  // Phase 2 smoke tests retired post-Wave 8: the default-lens fallback
  // path that allowed Phase 2 to run without a product_description_handoff
  // has been removed (Phase 1 hard-fails on non-product lenses, Phase 2
  // hard-fails if the handoff is missing). Product-lens behavior is
  // covered by phase2ProductLens.test.ts which seeds a full handoff.

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

  // Full 0-5 pipeline smoke test retired post-Wave 8 for the same reason
  // as the Phase 2 smoke tests above — relied on a stub LLM producing
  // empty parsed JSON flowing through Phase 1's default-lens fallback,
  // which no longer exists. Pipeline-level coverage now lives in the
  // product-lens integration tests.
});
