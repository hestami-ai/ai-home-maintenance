/**
 * Characterization test for the CLI runner's waitForQuiescence polling
 * loop. Pins the observable exit-reason behavior of each terminal branch
 * so the S3776 decomposition (checkLoopExitSignals / classifyDoneReason /
 * applyGracefulTick helpers) is provably behavior-preserving:
 *
 *   - run.status terminal (completed/failed/rolled_back) → 'completed'
 *   - records-idle stall while still "running"           → 'stalled'
 *   - graceful quiescence (stable sub-phase N polls)      → 'completed'
 *   - mock-mode wall-clock cap while busy                 → 'completed'
 *   - workflow run vanished (getWorkflowRun undefined)    → 'completed'
 *
 * The engine + db are minimal structural fakes: waitForQuiescence only
 * touches engine.stateMachine.getWorkflowRun, engine.executingPhaseCount,
 * engine.llmCaller.inFlightCount, engine.pendingDecisions, engine
 * .abortSession, and a COUNT(*) query via db.prepare().get().
 */

import { describe, it, expect, vi } from 'vitest';
import type { Database } from '../../../lib/database/init';
import type { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { waitForQuiescence } from '../../../cli/runner';

interface FakeRun {
  status: string;
  current_phase_id: string | null;
  current_sub_phase_id: string | null;
}

interface FakeEngineOpts {
  run: FakeRun | undefined;
  executingPhaseCount?: number;
  inFlightCount?: number;
  pendingSize?: number;
}

function makeFakeEngine(o: FakeEngineOpts): { engine: OrchestratorEngine; abortReasons: string[] } {
  const abortReasons: string[] = [];
  const pending = new Map<string, unknown>();
  for (let i = 0; i < (o.pendingSize ?? 0); i++) pending.set(`d${i}`, {});
  const engine = {
    stateMachine: {
      getWorkflowRun: vi.fn(() => o.run),
    },
    executingPhaseCount: o.executingPhaseCount ?? 0,
    llmCaller: { inFlightCount: o.inFlightCount ?? 0 },
    pendingDecisions: pending,
    abortSession: vi.fn((reason: string) => { abortReasons.push(reason); }),
  } as unknown as OrchestratorEngine;
  return { engine, abortReasons };
}

// A db whose COUNT(*) always returns the same value → no progress ticks.
function makeFakeDb(count = 0): Database {
  return {
    prepare: () => ({ get: () => ({ cnt: count }) }),
  } as unknown as Database;
}

describe('waitForQuiescence (characterization)', () => {
  it("returns 'completed' when the run status is already completed", async () => {
    const { engine } = makeFakeEngine({
      run: { status: 'completed', current_phase_id: 'P10', current_sub_phase_id: 'sp' },
    });
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'run-1', {
      mockCapMs: null,
      stableThreshold: 3,
      recordsIdleStallMs: 60_000,
    });
    expect(reason).toBe('completed');
  });

  it("returns 'completed' when the run status is failed (not treated as a stall)", async () => {
    const { engine } = makeFakeEngine({
      run: { status: 'failed', current_phase_id: 'P3', current_sub_phase_id: null },
    });
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'run-2', {
      mockCapMs: null,
      stableThreshold: 3,
      recordsIdleStallMs: 60_000,
    });
    expect(reason).toBe('completed');
  });

  it("returns 'stalled' when running but no records have progressed past the idle threshold", async () => {
    const { engine } = makeFakeEngine({
      run: { status: 'running', current_phase_id: 'P4', current_sub_phase_id: 'sp4' },
    });
    // recordsIdleStallMs = -1 guarantees timeSinceProgress (>= 0) exceeds it
    // on the first tick, forcing the records-idle stall branch deterministically.
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'run-3', {
      mockCapMs: null,
      stableThreshold: 3,
      recordsIdleStallMs: -1,
    });
    expect(reason).toBe('stalled');
  });

  it("returns 'completed' via graceful quiescence when the sub-phase is stable and nothing is in flight", async () => {
    const { engine } = makeFakeEngine({
      run: { status: 'running', current_phase_id: 'P5', current_sub_phase_id: 'sp5' },
      executingPhaseCount: 0,
      inFlightCount: 0,
    });
    // First tick seeds lastSubPhase; second tick increments stableCount to 1,
    // meeting the threshold of 1 → graceful 'completed'.
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'run-4', {
      mockCapMs: null,
      stableThreshold: 1,
      recordsIdleStallMs: 60_000,
    });
    expect(reason).toBe('completed');
  });

  it("returns 'completed' when the mock-mode wall-clock cap fires while a phase is busy", async () => {
    const { engine } = makeFakeEngine({
      run: { status: 'running', current_phase_id: 'P6', current_sub_phase_id: 'sp6' },
      // A phase is perpetually executing → decision is always 'continue', so
      // only the mock-cap top-of-loop check can terminate the loop.
      executingPhaseCount: 1,
    });
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'run-5', {
      mockCapMs: 60,
      stableThreshold: 100,
      recordsIdleStallMs: 60_000,
    });
    expect(reason).toBe('completed');
  });

  it("returns 'completed' immediately when the workflow run cannot be found", async () => {
    const { engine } = makeFakeEngine({ run: undefined });
    const reason = await waitForQuiescence(engine, makeFakeDb(), 'missing', {
      mockCapMs: null,
      stableThreshold: 3,
      recordsIdleStallMs: 60_000,
    });
    expect(reason).toBe('completed');
  });
});
