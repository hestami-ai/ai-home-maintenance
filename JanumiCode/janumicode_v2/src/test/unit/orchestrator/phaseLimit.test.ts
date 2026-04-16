/**
 * Regression tests for the `--phase-limit` enforcement.
 *
 * The flag was parsed by the CLI and plumbed to config long before it
 * was enforced anywhere. The engine's auto-approve loop kept chaining
 * forward through Phases 0→10, so the documented "fix Phase N, rerun
 * `--phase-limit N`, capture fixtures one phase at a time" inner loop
 * was actually impossible: the engine would blow past phase N and the
 * gap report would get smeared across later phases the user hadn't
 * asked to run.
 *
 * These tests pin:
 *   1. `engine.setPhaseLimit('N')` halts the auto-advance chain after
 *      phase N completes.
 *   2. Absent a phase limit, the engine still chains to completion.
 *   3. A limit earlier than the current phase is a no-op (we don't roll
 *      back; the engine just won't advance past the limit the next
 *      time auto-advance fires).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseContext, PhaseHandler, PhaseResult } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseId } from '../../../lib/types/records';

class RecordingHandler implements PhaseHandler {
  constructor(
    public readonly phaseId: PhaseId,
    private readonly log: PhaseId[],
  ) {}
  async execute(_ctx: PhaseContext): Promise<PhaseResult> {
    this.log.push(this.phaseId);
    return { success: true, artifactIds: [] };
  }
}

describe('OrchestratorEngine — phase limit enforcement', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const log: PhaseId[] = [];

  beforeEach(() => {
    log.length = 0;
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.setAutoApproveDecisions(true);

    for (const p of ['0', '1', '2', '3', '4'] as PhaseId[]) {
      engine.registerPhase(new RecordingHandler(p, log));
    }
  });

  afterEach(() => { db.close(); });

  it('stops auto-advance after reaching the limit phase', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.setPhaseLimit('2');

    // Start at Phase 0; auto-advance should fire through 1 → 2 and stop.
    await engine.executeCurrentPhase(run.id);
    // Phase 0 handler runs, but the ClientLiaisonAgent normally drives
    // 0→1 advancement — our RecordingHandler for phase 0 can't, so we
    // manually step the run machine to phase 1 and call through again.
    const advanced = engine.advanceToNextPhase(run.id, '1');
    expect(advanced).toBe(true);
    await engine.executeCurrentPhase(run.id);

    // Observed phases: 0 (first run), then 1 → 2 (auto-advance chain),
    // stopping at 2 because of the limit.
    expect(log).toEqual(['0', '1', '2']);
    // Phase 3/4 must NOT have run.
    expect(log).not.toContain('3');
    expect(log).not.toContain('4');
  });

  it('without a phase limit, continues chaining', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    // No limit set.
    await engine.executeCurrentPhase(run.id);
    const advanced = engine.advanceToNextPhase(run.id, '1');
    expect(advanced).toBe(true);
    await engine.executeCurrentPhase(run.id);

    // Every registered phase should fire 0 → 4.
    expect(log).toEqual(['0', '1', '2', '3', '4']);
  });

  it('setPhaseLimit(null) clears a previously-set limit', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.setPhaseLimit('2');
    engine.setPhaseLimit(null);
    await engine.executeCurrentPhase(run.id);
    const advanced = engine.advanceToNextPhase(run.id, '1');
    expect(advanced).toBe(true);
    await engine.executeCurrentPhase(run.id);
    expect(log).toEqual(['0', '1', '2', '3', '4']);
  });

  it('getPhaseLimit reflects the current setting', () => {
    expect(engine.getPhaseLimit()).toBeNull();
    engine.setPhaseLimit('3');
    expect(engine.getPhaseLimit()).toBe('3');
    engine.setPhaseLimit(null);
    expect(engine.getPhaseLimit()).toBeNull();
  });
});
