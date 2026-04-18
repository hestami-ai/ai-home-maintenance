/**
 * Regression tests for the "unrecoverable failure halts workflow"
 * invariant.
 *
 * Design contract: every phase handler and cross-cutting agent makes
 * LLM / CLI calls WITHOUT silent fallback catches. A throw from
 * `engine.llmCaller.call`, `engine.callForRole`, or
 * `engine.agentInvoker.invoke` propagates out of the phase handler's
 * helpers, past the handler's execute() body, and into
 * `executeCurrentPhase`'s top-level catch — which converts it into a
 * `{success: false, error}` phase result. Downstream phases then
 * don't run.
 *
 * Before this change the pipeline silently produced "default"
 * artifacts on LLM failure, and the gap report couldn't see anything
 * was wrong.
 *
 * These tests pin:
 *   1. A throw from a phase handler surfaces as `success: false` with
 *      the original error text in the result.
 *   2. The current sub_phase_id is included in the phase-failure
 *      error message for locality.
 *   3. Downstream phases do NOT execute after a phase failure (the
 *      auto-advance chain respects the failed result).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseId } from '../../../lib/types/records';

class ThrowingHandler implements PhaseHandler {
  constructor(
    readonly phaseId: PhaseId,
    private readonly err: Error,
    private readonly subPhase?: string,
  ) {}
  execute(ctx: PhaseContext): Promise<PhaseResult> {
    if (this.subPhase) {
      ctx.engine.stateMachine.setSubPhase(ctx.workflowRun.id, this.subPhase);
    }
    throw this.err;
  }
}

class RecordingHandler implements PhaseHandler {
  public executed = false;
  constructor(readonly phaseId: PhaseId) {}
  async execute(_ctx: PhaseContext): Promise<PhaseResult> {
    this.executed = true;
    return { success: true, artifactIds: [] };
  }
}

describe('OrchestratorEngine — halt on unrecoverable LLM/CLI failure', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
  });

  afterEach(() => { db.close(); });

  it('converts a thrown error from handler.execute() into success:false on the PhaseResult', async () => {
    engine.registerPhase(new ThrowingHandler('1', new Error('Bloom LLM call failed: provider unreachable')));

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/halted/);
    expect(result.error).toMatch(/Bloom LLM call failed/);
  });

  it('includes the current sub_phase_id in the error message so the gap report can locate it', async () => {
    engine.registerPhase(new ThrowingHandler('1', new Error('orig'), '1.2'));

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Phase 1\.2/);
  });

  it('does NOT auto-advance to downstream phases after a thrown handler', async () => {
    engine.setAutoApproveDecisions(true);
    engine.registerPhase(new ThrowingHandler('1', new Error('upstream broke')));
    const downstream = new RecordingHandler('2');
    engine.registerPhase(downstream);

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.success).toBe(false);
    // The key invariant: downstream phase handlers MUST NOT have run.
    // Before the engine-level catch, the auto-advance chain either
    // crashed with an unhandled rejection (preventing downstream) or
    // silently succeeded on the fallback (running downstream on bad
    // inputs). Now the failed result stops the chain cleanly.
    expect(downstream.executed).toBe(false);
  });

  it('exposes the underlying error message verbatim (no wrapping that hides the cause)', async () => {
    const err = new Error(
      `callForRole('orchestrator') backing 'gemini_cli' failed: process exited with code 1\n` +
      `stderr: Cannot use both a positional prompt and the --prompt (-p) flag together`,
    );
    engine.registerPhase(new ThrowingHandler('1', err, '1.0'));

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    const result = await engine.executeCurrentPhase(run.id);

    expect(result.error).toContain('gemini_cli');
    expect(result.error).toContain('Cannot use both a positional prompt');
  });
});
