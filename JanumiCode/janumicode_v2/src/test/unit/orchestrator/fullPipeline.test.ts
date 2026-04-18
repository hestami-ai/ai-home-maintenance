import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../../lib/orchestrator/phases/phase0';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { Phase2Handler } from '../../../lib/orchestrator/phases/phase2';
import { Phase3Handler } from '../../../lib/orchestrator/phases/phase3';
import { Phase4Handler } from '../../../lib/orchestrator/phases/phase4';
import { Phase5Handler } from '../../../lib/orchestrator/phases/phase5';
import { Phase6Handler } from '../../../lib/orchestrator/phases/phase6';
import { Phase7Handler } from '../../../lib/orchestrator/phases/phase7';
import { Phase8Handler } from '../../../lib/orchestrator/phases/phase8';
import { ConfigManager } from '../../../lib/config/configManager';
import path from 'path';

describe('Full Pipeline — Phase 0 through Phase 8', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.setAutoApproveDecisions(true);

    // Production default orchestrator routing is `gemini_cli`, which
    // would try to spawn the binary in the test env. Bare-engine tests
    // (no createTestEngine) need an explicit stub route — direct_llm_api
    // + a no-op provider lets Phase 1.0 IQC complete with empty JSON,
    // which `defaultReport` then fills in. (createTestEngine handles
    // this automatically; this test predates it.)
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'stub', model: 'stub' },
    });
    const stubCall = () => Promise.resolve({
      text: '', parsed: null, toolCalls: [],
      provider: 'stub', model: 'stub',
      inputTokens: null, outputTokens: null,
      usedFallback: false, retryAttempts: 0,
    });
    engine.llmCaller.registerProvider({ name: 'stub', call: stubCall });
    // Phase 2-8 helpers hardcode `provider: 'ollama'`. Register a
    // stub under that name too so their LLM calls succeed with an
    // empty response and fall through to the inner deterministic
    // fallback — after the correctness-halt refactor, an unregistered
    // provider would throw and halt the phase.
    engine.llmCaller.registerProvider({ name: 'ollama', call: stubCall });

    // Register all planning phases
    engine.registerPhase(new Phase0Handler());
    engine.registerPhase(new Phase1Handler());
    engine.registerPhase(new Phase2Handler());
    engine.registerPhase(new Phase3Handler());
    engine.registerPhase(new Phase4Handler());
    engine.registerPhase(new Phase5Handler());
    engine.registerPhase(new Phase6Handler());
    engine.registerPhase(new Phase7Handler());
    engine.registerPhase(new Phase8Handler());
  });

  afterEach(() => { db.close(); });

  it('executes all planning phases (0-8) producing a complete execution plan', { timeout: 60_000 }, async () => {
    const { run } = engine.startWorkflowRun('ws-1');

    // Phase 0 — Workspace Initialization
    let result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Provide raw intent before Phase 1
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a URL shortening service that supports custom short codes, tracks click analytics, and has rate limiting for API consumers' },
    });

    // Phase 1 — Intent Capture
    engine.advanceToNextPhase(run.id, '1');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 2 — Requirements
    engine.advanceToNextPhase(run.id, '2');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 3 — System Specification
    engine.advanceToNextPhase(run.id, '3');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 4 — Architecture
    engine.advanceToNextPhase(run.id, '4');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 5 — Technical Specification
    engine.advanceToNextPhase(run.id, '5');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 6 — Implementation Planning
    engine.advanceToNextPhase(run.id, '6');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 7 — Test Planning
    engine.advanceToNextPhase(run.id, '7');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Phase 8 — Evaluation Planning
    engine.advanceToNextPhase(run.id, '8');
    result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Verify the pipeline produced a substantial number of artifacts
    const allArtifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    expect(allArtifacts.length).toBeGreaterThanOrEqual(20);

    // Verify state machine is at Phase 8
    const finalRun = engine.stateMachine.getWorkflowRun(run.id);
    expect(finalRun!.current_phase_id).toBe('8');
  });

  it('tracks events throughout the pipeline', { timeout: 60_000 }, async () => {
    const phaseEvents: string[] = [];
    engine.eventBus.on('phase:started', (p) => phaseEvents.push(`start:${p.phaseId}`));
    engine.eventBus.on('phase:completed', (p) => phaseEvents.push(`complete:${p.phaseId}`));
    engine.eventBus.on('phase_gate:pending', (p) => phaseEvents.push(`gate:${p.phaseId}`));

    const { run } = engine.startWorkflowRun('ws-1');

    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a task manager' },
    });

    // Run through all phases
    await engine.executeCurrentPhase(run.id); // Phase 0
    for (const phase of ['1', '2', '3', '4', '5', '6', '7', '8'] as const) {
      engine.advanceToNextPhase(run.id, phase);
      await engine.executeCurrentPhase(run.id);
    }

    // Should have start+complete for each phase
    expect(phaseEvents.filter(e => e.startsWith('start:')).length).toBeGreaterThanOrEqual(9);
    expect(phaseEvents.filter(e => e.startsWith('complete:')).length).toBeGreaterThanOrEqual(9);
    // Phase gate events for Phases 1-8
    expect(phaseEvents.filter(e => e.startsWith('gate:')).length).toBeGreaterThanOrEqual(7);
  });
});
