/**
 * Regression tests for Phase 1.0a Intent Lens Classification.
 *
 * 1.0a is a new LLM-backed sub-phase that picks one of six lenses
 * (product | feature | bug | infra | legal | unclassified) and stores
 * it on the workflow_run. Downstream handlers (1.2 bloom, 1.5 synthesis)
 * then resolve lens-tailored templates.
 *
 * These tests pin:
 *   1. A successful classification writes an intent_lens_classification
 *      record AND sets workflow_runs.intent_lens to the classified lens.
 *   2. When the classifier returns a lens outside the shipped template
 *      set (product, feature), fallback_lens is set to 'product' so
 *      downstream keeps moving while lens-specific templates land.
 *   3. When the classifier fails (no template / LLM error), Phase 1.0a
 *      degrades to unclassified + product fallback rather than halting
 *      the pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('Phase 1.0a — Intent Lens Classification', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.llmCaller.registerProvider({
      name: 'google',
      call: () => Promise.reject(new Error('stub')),
    });
    engine.registerPhase(new Phase1Handler());
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  /**
   * Seeds the mock provider with: IQC pass, lens classifier response,
   * and minimal bloom response so the pipeline can walk past 1.0a.
   */
  function seedFixtures(mock: MockLLMProvider, lensResponse: Record<string, unknown>): void {
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: {
        overall_status: 'pass',
        completeness_findings: [],
        consistency_findings: [],
        coherence_findings: [],
      },
    });
    mock.setFixture('lens', {
      match: 'Intent Lens Classification',
      parsedJson: lensResponse,
    });
  }

  it('writes lens to workflow_runs when classifier returns a supported lens', async () => {
    const mock = new MockLLMProvider();
    seedFixtures(mock, {
      lens: 'product',
      confidence: 0.92,
      rationale: 'Raw intent says "build" plus persona language.',
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a todo CLI app for busy developers.' },
    });

    await engine.executeCurrentPhase(run.id);

    const updatedRun = engine.stateMachine.getWorkflowRun(run.id);
    expect(updatedRun?.intent_lens).toBe('product');

    const records = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const lensRecord = records.find(
      r => (r.content as { kind?: string }).kind === 'intent_lens_classification',
    );
    expect(lensRecord).toBeDefined();
    expect((lensRecord!.content as { lens: string }).lens).toBe('product');
    expect((lensRecord!.content as { fallback_lens: string }).fallback_lens).toBe('product');
  });

  it('falls back to product for unsupported lenses (bug / infra / legal)', async () => {
    const mock = new MockLLMProvider();
    seedFixtures(mock, {
      lens: 'infra',
      confidence: 0.88,
      rationale: 'Deploy / k8s language throughout.',
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Migrate our k8s cluster to a new region.' },
    });

    await engine.executeCurrentPhase(run.id);

    const records = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const lensRecord = records.find(
      r => (r.content as { kind?: string }).kind === 'intent_lens_classification',
    );
    expect(lensRecord).toBeDefined();
    const content = lensRecord!.content as { lens: string; fallback_lens: string };
    expect(content.lens).toBe('infra');
    expect(content.fallback_lens).toBe('product');

    const updatedRun = engine.stateMachine.getWorkflowRun(run.id);
    expect(updatedRun?.intent_lens).toBe('infra');
  });

  it('degrades to unclassified + product fallback when the classifier LLM returns unparseable output', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('iqc', {
      match: 'Intent Quality Check',
      parsedJson: {
        overall_status: 'pass',
        completeness_findings: [],
        consistency_findings: [],
        coherence_findings: [],
      },
    });
    mock.setFixture('lens-empty', {
      match: 'Intent Lens Classification',
      parsedJson: {},
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('ollama'));
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'ollama', model: 'qwen3.5:9b' },
    });

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build something.' },
    });

    await engine.executeCurrentPhase(run.id);

    const records = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    const lensRecord = records.find(
      r => (r.content as { kind?: string }).kind === 'intent_lens_classification',
    );
    expect(lensRecord).toBeDefined();
    const content = lensRecord!.content as { lens: string; fallback_lens: string };
    expect(content.lens).toBe('unclassified');
    expect(content.fallback_lens).toBe('product');
  });
});
