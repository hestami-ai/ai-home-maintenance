/**
 * Orchestrator implementation.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 2 §2.2:
 *   - State handler dispatch.
 *   - Required-state enforcement (no skipping).
 *   - Allowed-transition enforcement (predecessors satisfied).
 *   - Output-schema validation per state.
 *   - Escalation routing.
 *
 * The orchestrator is the only sanctioned path for advancing a lens. It
 * computes the next-state set from the manifest + completed states, dispatches
 * the bound agent, validates output, persists, and writes op-track events.
 */

import { randomUUID, createHash } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { ActivationDal } from '../database/activationDal.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { ManifestDal } from '../database/manifestDal.js';
import type { AgentRuntime } from '../agents/runtime.js';
import type { AgentInvocationScope } from '../scope/agentInvocationScope.js';
import type { LensPhaseManifest, LensState } from './types.js';
import type { ReasoningReviewService } from '../reasoningReview/service.js';
import type { HarnessRunSummary } from '../reasoningReview/types.js';

export class OrchestratorError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export interface OrchestratorOptions {
  readonly manifestDal: ManifestDal;
  readonly activationDal: ActivationDal;
  readonly opStream: OpStreamDal;
  readonly agentRuntime: AgentRuntime;
  /**
   * Wave 11: optional reasoning-review service. When supplied, the
   * orchestrator runs the harness after every successful state completion.
   * The harness's decision is folded into the AdvanceResult:
   *   - decision='pass'     → state stays 'completed'
   *   - decision='escalate' → state still 'completed' but reasoningReview
   *                            decision is surfaced for downstream gating
   *   - decision='block'    → state result becomes 'escalated' so the
   *                            activation halts at this state
   */
  readonly reasoningReview?: ReasoningReviewService;
}

export interface AdvanceArgs {
  readonly scope: Scope;
  readonly activationId: string;
  readonly stateInput: unknown;
  /** Envelope-level fields the caller controls (privilegeFrame, authorized*). */
  readonly envelopeContext: Pick<
    AgentInvocationScope,
    'privilegeFrame' | 'authorizedSources' | 'authorizedPriorArtifacts' | 'authorizedMMP' | 'forbiddenScopes'
  >;
  /** Which agent to run for this state. Must be in the state's permittedAgents. */
  readonly agentId: string;
  /** Optional output validator hook — Wave 2 ships a noop; Wave 6 wires schema validators. */
  readonly outputValidator?: (output: unknown, state: LensState) => { ok: boolean; errors: string[] };
}

export interface AdvanceResult {
  readonly stateId: string;
  readonly status: 'completed' | 'escalated' | 'blocked';
  readonly output?: unknown;
  readonly outputHash?: string;
  readonly escalationReason?: string;
  readonly blockReason?: string;
  /** Wave 11: harness summary when reasoning-review is configured. */
  readonly reasoningReview?: HarnessRunSummary;
}

export class Orchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  /**
   * Start a new activation. Validates the manifest exists and writes an
   * activation row. Returns the activation id.
   */
  startActivation(args: { scope: Scope; lensId: string; lensVersion: string; activatedBy: string }): string {
    const manifest = this.options.manifestDal.get(args.lensId, args.lensVersion);
    if (!manifest) {
      throw new OrchestratorError(
        `manifest not found: ${args.lensId}@${args.lensVersion}`,
        'MANIFEST_NOT_FOUND',
      );
    }
    const activationId = randomUUID();
    this.options.activationDal.insertActivation({
      scope: args.scope,
      activationId,
      lensId: args.lensId,
      lensVersion: args.lensVersion,
      activatedBy: args.activatedBy,
    });
    this.options.opStream.write({
      eventType: 'lens_activation_started',
      firmId: args.scope.firmId,
      clientId: args.scope.clientId,
      matterId: args.scope.matterId,
      userId: args.activatedBy,
      payload: { activationId, lensId: args.lensId, lensVersion: args.lensVersion, stateCount: manifest.states.length },
    });
    return activationId;
  }

  /**
   * Compute the next state to execute given completed states.
   * The next state is the first state whose predecessors are all completed
   * AND that has not yet been completed itself.
   */
  computeNextState(manifest: LensPhaseManifest, completed: readonly string[]): LensState | undefined {
    const completedSet = new Set(completed);
    for (const state of manifest.states) {
      if (completedSet.has(state.stateId)) continue;
      if (state.predecessors.every((p) => completedSet.has(p))) return state;
    }
    return undefined;
  }

  /**
   * Advance a single state. The caller declares which state to advance to
   * (via stateInput's implicit assignment) and the orchestrator validates
   * that this is the legitimate next state.
   */
  async advanceNextState(args: AdvanceArgs): Promise<AdvanceResult> {
    const activation = this.options.activationDal.getActivation(args.scope, args.activationId);
    if (!activation) {
      throw new OrchestratorError(`activation not found: ${args.activationId}`, 'ACTIVATION_NOT_FOUND');
    }
    const manifest = this.options.manifestDal.get(activation.lensId, activation.lensVersion);
    if (!manifest) {
      throw new OrchestratorError(
        `manifest disappeared: ${activation.lensId}@${activation.lensVersion}`,
        'MANIFEST_NOT_FOUND',
      );
    }

    const completed = this.options.activationDal.listCompletedStates(args.scope, args.activationId);
    const nextState = this.computeNextState(manifest, completed);
    if (!nextState) {
      throw new OrchestratorError('no next state — activation complete or blocked', 'NO_NEXT_STATE');
    }

    // Required-state enforcement: nextState (computed via predecessor check)
    // is the canonical next state; any attempt to skip it is rejected by the
    // structure of this method — the caller cannot specify an arbitrary state.

    if (!nextState.permittedAgents.includes(args.agentId)) {
      throw new OrchestratorError(
        `agent ${args.agentId} not permitted in state ${nextState.stateId}`,
        'AGENT_NOT_PERMITTED_FOR_STATE',
      );
    }

    this.options.opStream.write({
      eventType: 'state_started',
      firmId: args.scope.firmId,
      clientId: args.scope.clientId,
      matterId: args.scope.matterId,
      payload: { activationId: args.activationId, stateId: nextState.stateId, agentId: args.agentId },
    });

    const envelope: AgentInvocationScope = {
      ...args.scope,
      lensId: activation.lensId,
      lensVersion: activation.lensVersion,
      stateId: nextState.stateId,
      privilegeFrame: args.envelopeContext.privilegeFrame,
      authorizedSources: args.envelopeContext.authorizedSources,
      authorizedPriorArtifacts: args.envelopeContext.authorizedPriorArtifacts,
      authorizedMMP: args.envelopeContext.authorizedMMP,
      forbiddenScopes: args.envelopeContext.forbiddenScopes,
    };

    const result = await this.options.agentRuntime.invoke(args.agentId, {
      envelope,
      input: args.stateInput,
    });

    if (result.status === 'blocked') {
      this.options.opStream.write({
        eventType: 'state_blocked',
        firmId: args.scope.firmId,
        clientId: args.scope.clientId,
        matterId: args.scope.matterId,
        payload: { activationId: args.activationId, stateId: nextState.stateId, blockReason: result.blockReason ?? 'unspecified' },
      });
      return { stateId: nextState.stateId, status: 'blocked', blockReason: result.blockReason };
    }

    if (result.status === 'escalated') {
      this.options.opStream.write({
        eventType: 'state_escalated',
        firmId: args.scope.firmId,
        clientId: args.scope.clientId,
        matterId: args.scope.matterId,
        payload: {
          activationId: args.activationId,
          stateId: nextState.stateId,
          escalationReason: result.escalationReason ?? 'unspecified',
        },
      });
      return { stateId: nextState.stateId, status: 'escalated', escalationReason: result.escalationReason };
    }

    // Output-schema validation hook (Wave 2 default: pass-through)
    if (args.outputValidator) {
      const v = args.outputValidator(result.output, nextState);
      if (!v.ok) {
        throw new OrchestratorError(
          `state ${nextState.stateId} output validation failed: ${v.errors.join('; ')}`,
          'OUTPUT_VALIDATION_FAILED',
        );
      }
    }

    const outputJson = JSON.stringify(result.output ?? {});
    const outputHash = createHash('sha256').update(outputJson).digest('hex');

    this.options.activationDal.insertStateOutput({
      scope: args.scope,
      activationId: args.activationId,
      stateId: nextState.stateId,
      outputJson,
      outputHash,
    });

    this.options.opStream.write({
      eventType: 'state_completed',
      firmId: args.scope.firmId,
      clientId: args.scope.clientId,
      matterId: args.scope.matterId,
      payload: { activationId: args.activationId, stateId: nextState.stateId, outputHash, status: 'completed' },
    });

    // Wave 11: reasoning-review harness (optional)
    let reasoningReview: HarnessRunSummary | undefined;
    if (this.options.reasoningReview) {
      reasoningReview = await this.options.reasoningReview.reviewAndPersist({
        stateId: nextState.stateId,
        agentId: args.agentId,
        stateOutput: result.output,
        stateOutputText: outputJson,
        assembledPrompt: { system: '', user: '' }, // Wave 11.1 wires the assembled prompt through the runtime
        envelope,
        priorArtifactsByState: undefined,
        upstreamFindings: undefined,
        authorizedSourceContent: undefined,
      });
      if (reasoningReview.decision === 'block') {
        return {
          stateId: nextState.stateId,
          status: 'escalated',
          escalationReason: 'reasoning-review harness decision=block',
          output: result.output,
          outputHash,
          reasoningReview,
        };
      }
    }

    return { stateId: nextState.stateId, status: 'completed', output: result.output, outputHash, reasoningReview };
  }

  /** Returns true if all required states have been completed. */
  isActivationComplete(scope: Scope, activationId: string): boolean {
    const activation = this.options.activationDal.getActivation(scope, activationId);
    if (!activation) return false;
    const manifest = this.options.manifestDal.get(activation.lensId, activation.lensVersion);
    if (!manifest) return false;
    const completed = new Set(this.options.activationDal.listCompletedStates(scope, activationId));
    return manifest.states.filter((s) => s.required).every((s) => completed.has(s.stateId));
  }
}
