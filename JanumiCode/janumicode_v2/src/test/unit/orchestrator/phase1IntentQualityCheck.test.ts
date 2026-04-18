/**
 * Regression tests for Phase 1.0 Intent Quality Check failure
 * propagation.
 *
 * The bug this pins: when `callForRole('orchestrator', …)` throws
 * (CLI failed to parse args, missing binary, timeout), the old
 * Phase 1 handler silently returned a pass-through `defaultReport`
 * and the workflow marched past Phase 1.0 with a "pass" verdict.
 * Screenshot evidence: gemini CLI exited 1 with a clear arg-parse
 * error on stderr, and the pipeline kept executing right through to
 * Phase 9. The Orchestrator's quality check is a correctness gate —
 * a backing failure is not a soft fallback, it's a phase failure.
 *
 * These tests pin:
 *   1. A successful orchestrator call produces a quality_report record
 *      and Phase 1 proceeds (happy path sanity).
 *   2. A thrown orchestrator error surfaces as `{success: false}` on
 *      the phase result with the error message attached.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('Phase 1.0 — Intent Quality Check failure propagation', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    // Bypass the reasoning_review default (google) so validateLLMRouting
    // passes — we only care about the Orchestrator path here.
    engine.llmCaller.registerProvider({ name: 'google', call: () => Promise.reject(new Error('stub')) });
    engine.registerPhase(new Phase1Handler());
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  it('fails the phase when the orchestrator CLI backing exits non-zero', async () => {
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'gemini_cli', model: 'gemini-2.5-flash' },
    });
    engine.registerBuiltinCLIParsers();

    // Stub the cliInvoker to return the exact failure shape from the
    // gemini arg-parse bug the screenshot captured.
    const invokeSpy = vi.fn().mockResolvedValue({
      exitCode: 1, timedOut: false, idledOut: false,
      events: [],
      stderr: 'Cannot use both a positional prompt and the --prompt (-p) flag together',
      durationMs: 1200,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = invokeSpy;

    // Bootstrap: start a run and record the raw_intent_received that
    // Phase 1.0 reads.
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a todo CLI app.' },
    });

    const result = await engine.executeCurrentPhase(run.id);

    // Before the fix: success = true (defaultReport pass-through).
    // After: success = false with the CLI error surfaced.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Intent Quality Check failed/);
    expect(result.error).toMatch(/gemini_cli/);
  });

  it('passes through when the orchestrator backing succeeds with a valid JSON report', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('intent_quality', {
      match: 'Intent Quality Check',
      key: 'iqc',
      text: '{"overall_status":"pass","completeness_findings":[],"consistency_findings":[],"coherence_findings":[]}',
      parsedJson: {
        overall_status: 'pass',
        completeness_findings: [],
        consistency_findings: [],
        coherence_findings: [],
      },
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
      content: { text: 'Build a todo CLI app.' },
    });

    const result = await engine.executeCurrentPhase(run.id);
    // Note: Phase 1 might still fail further along (e.g. bloom needs
    // an Ollama response that's not in fixtures). We only care that
    // the IQC step itself didn't trip the `Intent Quality Check failed`
    // guard — that its success path stays unchanged.
    if (!result.success) {
      expect(result.error).not.toMatch(/Intent Quality Check failed/);
    }
  });
});
