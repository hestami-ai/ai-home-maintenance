/**
 * Unit tests for AsyncLocalStorage-backed TraceCtx propagation.
 *
 * The propagation behavior is the only piece of the trace layer that's
 * subtle enough to break silently. If ALS doesn't propagate across an
 * await, every downstream emit call returns null and the layer is
 * dead — but no test would notice because emit is intentionally
 * silent on missing context. These tests prove the propagation works
 * across the patterns the orchestrator actually uses.
 */

import { describe, it, expect } from 'vitest';
import {
  withTraceContext,
  currentTraceContext,
  currentParentStep,
  pushStep,
  popStep,
  setSubPhase,
  withStep,
  snapshotTraceContext,
} from '../../../lib/trace/traceContext';

describe('traceContext', () => {
  it('returns null outside any frame', () => {
    expect(currentTraceContext()).toBeNull();
    expect(currentParentStep()).toBeNull();
  });

  it('exposes the ctx inside withTraceContext', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-1', phase_id: '4', sub_phase_id: 'component_skeleton' },
      async () => {
        const ctx = currentTraceContext();
        expect(ctx).not.toBeNull();
        expect(ctx?.workflow_run_id).toBe('wf-1');
        expect(ctx?.phase_id).toBe('4');
        expect(ctx?.sub_phase_id).toBe('component_skeleton');
        expect(ctx?.step_chain).toEqual([]);
      },
    );
    // Frame is torn down on exit.
    expect(currentTraceContext()).toBeNull();
  });

  it('propagates across awaits and microtask boundaries', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-2', phase_id: '1', sub_phase_id: null },
      async () => {
        const before = currentTraceContext();
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 1));
        const after = currentTraceContext();
        expect(after?.workflow_run_id).toBe(before?.workflow_run_id);
      },
    );
  });

  it('propagates through Promise.all branches independently', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-3', phase_id: '2', sub_phase_id: null },
      async () => {
        const observed: string[] = [];
        await Promise.all([
          (async () => { observed.push(currentTraceContext()?.workflow_run_id ?? '_'); })(),
          (async () => {
            await new Promise((r) => setTimeout(r, 1));
            observed.push(currentTraceContext()?.workflow_run_id ?? '_');
          })(),
          (async () => { observed.push(currentTraceContext()?.workflow_run_id ?? '_'); })(),
        ]);
        expect(observed).toEqual(['wf-3', 'wf-3', 'wf-3']);
      },
    );
  });

  it('pushStep / popStep tracks the parent step chain', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-4', phase_id: '4', sub_phase_id: 's' },
      async () => {
        expect(currentParentStep()).toBeNull();
        pushStep('step-a');
        expect(currentParentStep()).toBe('step-a');
        pushStep('step-b');
        expect(currentParentStep()).toBe('step-b');
        popStep();
        expect(currentParentStep()).toBe('step-a');
        popStep();
        expect(currentParentStep()).toBeNull();
      },
    );
  });

  it('withStep balances the chain even on throw', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-5', phase_id: '4', sub_phase_id: 's' },
      async () => {
        await expect(
          withStep('throwing-step', async () => {
            expect(currentParentStep()).toBe('throwing-step');
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');
        // Chain restored.
        expect(currentParentStep()).toBeNull();
      },
    );
  });

  it('nested withTraceContext frames isolate from each other', async () => {
    await withTraceContext(
      { workflow_run_id: 'outer', phase_id: '4', sub_phase_id: null },
      async () => {
        expect(currentTraceContext()?.workflow_run_id).toBe('outer');
        await withTraceContext(
          { workflow_run_id: 'inner', phase_id: '5', sub_phase_id: null },
          async () => {
            expect(currentTraceContext()?.workflow_run_id).toBe('inner');
          },
        );
        // Returning to outer.
        expect(currentTraceContext()?.workflow_run_id).toBe('outer');
      },
    );
  });

  it('setSubPhase mutates the current frame', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-6', phase_id: '4', sub_phase_id: null },
      async () => {
        expect(currentTraceContext()?.sub_phase_id).toBeNull();
        setSubPhase('component_skeleton');
        expect(currentTraceContext()?.sub_phase_id).toBe('component_skeleton');
        setSubPhase(null);
        expect(currentTraceContext()?.sub_phase_id).toBeNull();
      },
    );
  });

  it('snapshotTraceContext clones the chain (mutation does not leak)', async () => {
    await withTraceContext(
      { workflow_run_id: 'wf-7', phase_id: '4', sub_phase_id: 's' },
      async () => {
        pushStep('A');
        const snap = snapshotTraceContext();
        expect(snap?.step_chain).toEqual(['A']);
        snap!.step_chain.push('B-fake');
        // Live store unaffected by mutation of the snapshot copy.
        expect(currentParentStep()).toBe('A');
        popStep();
      },
    );
  });
});
