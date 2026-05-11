/**
 * Context Engineer.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 4 §4.2 — analogous to
 * JanumiCode v2's `assembleContext()`, but legal-domain.
 *
 * The Context Engineer is the only sanctioned source for assembling the
 * downstream-state input from prior matter content. It reads:
 *   - the active matter context;
 *   - the most recent LBH whose toState matches the target;
 *   - prior state outputs in the activation;
 *   - MMP submissions in scope.
 *
 * The Context Engineer does NOT bypass the AgentInvocationScope envelope —
 * it produces the input that the orchestrator later wraps in an envelope.
 */

import type { Scope } from '../database/types.js';
import type { ActivationDal } from '../database/activationDal.js';
import type { LensPhaseManifest } from '../orchestrator/types.js';
import type { LbhService } from '../lbh/service.js';
import type { LensBoundaryHandoff } from '../lbh/types.js';

export class ContextAssemblyError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ContextAssemblyError';
  }
}

export interface AssembledContext {
  readonly scope: Scope;
  readonly activationId: string;
  readonly targetStateId: string;
  /** LBH consumed at entry, if the state requires one. */
  readonly lbh?: LensBoundaryHandoff;
  /** Outputs of the activation's completed states, keyed by stateId. */
  readonly priorStateOutputs: Readonly<Record<string, unknown>>;
}

export class ContextEngineer {
  constructor(
    private readonly activationDal: ActivationDal,
    private readonly lbh: LbhService,
  ) {}

  assemble(args: {
    scope: Scope;
    activationId: string;
    receivingManifest: LensPhaseManifest;
    targetStateId: string;
  }): AssembledContext {
    const targetState = args.receivingManifest.states.find((s) => s.stateId === args.targetStateId);
    if (!targetState) {
      throw new ContextAssemblyError(`state ${args.targetStateId} not in manifest ${args.receivingManifest.lensId}`, 'UNKNOWN_STATE');
    }

    let consumed: LensBoundaryHandoff | undefined;
    if (targetState.requiresLbhAtEntry) {
      const found = this.lbh.retrieveLatestForToState(args.targetStateId);
      if (!found) {
        // Wave 4 gate: missing LBH at a state that requires it must fail closed.
        throw new ContextAssemblyError(
          `state ${args.targetStateId} requires LBH at entry but none found`,
          'LBH_MISSING_AT_ENTRY',
        );
      }
      consumed = this.lbh.consume(found, args.receivingManifest);
    }

    // Prior state outputs
    const completed = this.activationDal.listCompletedStates(args.scope, args.activationId);
    const outputs: Record<string, unknown> = {};
    for (const stateId of completed) {
      const row = this.activationDal.getStateOutput(args.scope, args.activationId, stateId);
      if (row) {
        try {
          outputs[stateId] = JSON.parse(row.outputJson) as unknown;
        } catch {
          outputs[stateId] = row.outputJson;
        }
      }
    }

    return {
      scope: args.scope,
      activationId: args.activationId,
      targetStateId: args.targetStateId,
      lbh: consumed,
      priorStateOutputs: outputs,
    };
  }
}
