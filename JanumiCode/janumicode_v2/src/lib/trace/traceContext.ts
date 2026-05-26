/**
 * AsyncLocalStorage-backed trace context for the transformation trace
 * layer. Carries workflow + phase + sub-phase identifiers plus the
 * current step-chain so any code path that emits a transformation_step
 * can do so without arg-threading.
 *
 * Design notes:
 *  - The chain is a stack of step_ids: bottom = root, top = current.
 *    pushStep() before doing work; popStep() in a finally block.
 *  - `currentParentStep()` returns the top of the stack (the parent for
 *    the next step emitted), or null if no step is active.
 *  - withTraceContext() enters a fresh ALS frame with the supplied
 *    workflow/phase/sub-phase coordinates. Nested calls merge correctly
 *    via AsyncLocalStorage semantics.
 *  - Mutations (push/pop/setSubPhase) operate on the *current* frame's
 *    fields. They do not allocate a new frame — that would lose
 *    propagation across await boundaries when the caller is outside
 *    a fresh `run()`.
 *  - The store is `Mutable<TraceCtx>` so push/pop can update step_chain
 *    in place. AsyncLocalStorage allows this because every async
 *    descendant shares the same store reference; mutations are visible.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/** The mutable trace context carried through async work. */
export interface TraceCtx {
  workflow_run_id: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  /** Stack of step_ids. Bottom = root, top = current parent for the next step. */
  step_chain: string[];
}

const als = new AsyncLocalStorage<TraceCtx>();

/**
 * Enter a new trace context. All async work inside `fn` (including
 * awaits) inherits the same ctx. Nested withTraceContext() calls create
 * a new frame; descendants see only the innermost frame.
 */
export function withTraceContext<T>(
  ctx: Omit<TraceCtx, 'step_chain'> & { step_chain?: string[] },
  fn: () => T,
): T {
  const full: TraceCtx = {
    workflow_run_id: ctx.workflow_run_id,
    phase_id: ctx.phase_id ?? null,
    sub_phase_id: ctx.sub_phase_id ?? null,
    step_chain: ctx.step_chain ?? [],
  };
  return als.run(full, fn);
}

/** Returns the current TraceCtx, or null if not inside a withTraceContext frame. */
export function currentTraceContext(): TraceCtx | null {
  return als.getStore() ?? null;
}

/**
 * Returns the current step_id (top of the chain), or null if no step
 * is active. This is the parent_step_id for the next step emitted.
 */
export function currentParentStep(): string | null {
  const ctx = als.getStore();
  if (!ctx || ctx.step_chain.length === 0) return null;
  return ctx.step_chain[ctx.step_chain.length - 1];
}

/** Push a step_id onto the chain (call before doing work). */
export function pushStep(step_id: string): void {
  const ctx = als.getStore();
  if (!ctx) return;
  ctx.step_chain.push(step_id);
}

/**
 * Pop the most-recent step_id. Call in a `finally` block to ensure
 * the chain remains balanced even if the wrapped work throws.
 */
export function popStep(): void {
  const ctx = als.getStore();
  if (!ctx) return;
  ctx.step_chain.pop();
}

/**
 * Update the sub_phase_id on the current frame. Useful when sub-phase
 * boundaries are crossed inside the same withTraceContext frame.
 */
export function setSubPhase(sub_phase_id: string | null): void {
  const ctx = als.getStore();
  if (!ctx) return;
  ctx.sub_phase_id = sub_phase_id;
}

/**
 * Convenience wrapper that pushes a step_id, runs the body, and pops
 * in a finally block. Use when the body is synchronous-shaped from
 * the caller's perspective (an `await`able promise factory).
 */
export async function withStep<T>(step_id: string, fn: () => Promise<T>): Promise<T> {
  pushStep(step_id);
  try {
    return await fn();
  } finally {
    popStep();
  }
}

/**
 * Snapshot the current ctx (for cases where you want to capture trace
 * coordinates at a point in time, e.g. when scheduling a later async
 * task that will run outside the current ALS frame). The returned
 * object is a deep clone of the chain; mutating it does not affect
 * the live store.
 */
export function snapshotTraceContext(): TraceCtx | null {
  const ctx = als.getStore();
  if (!ctx) return null;
  return {
    workflow_run_id: ctx.workflow_run_id,
    phase_id: ctx.phase_id,
    sub_phase_id: ctx.sub_phase_id,
    step_chain: [...ctx.step_chain],
  };
}
