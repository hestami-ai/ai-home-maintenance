/**
 * State-machine orchestrator interface (Wave 0 stubs; logic lands in Wave 2).
 *
 * Per:
 *   - docs/janumilegal_product_description.md §State Machine
 *   - docs/janumilegal_product_description_evolution.md §4 (Lens Phase Manifests)
 */

import type { Scope } from '../database/types.js';

export interface LensState {
  readonly stateId: string;
  readonly required: boolean;
  readonly predecessors: readonly string[];
  readonly permittedAgents: readonly string[];
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly validators: readonly string[];
  readonly escalationConditions: readonly string[];
  readonly clvScope: readonly string[];
  readonly artifactsProduced: readonly string[];
  /** Wave 4: when true, an LBH is emitted *after* this state completes. */
  readonly isHandoffBoundary?: boolean;
  /** Wave 4: when true, this state requires an LBH at entry (consumes from a prior handoff boundary). */
  readonly requiresLbhAtEntry?: boolean;
}

export interface ArtifactSpec {
  readonly artifactType: string;
  readonly schema: string;
}

export interface ValidatorRef {
  readonly validatorId: string;
}

export interface EscalationRule {
  readonly trigger: string;
  readonly target: string;
}

export interface ReleasePolicyRef {
  readonly policyId: string;
}

export interface LensPhaseManifest {
  readonly lensId: string;
  readonly lensVersion: string;
  readonly supersedes?: string;
  readonly practiceArea: string;
  readonly applicableJurisdictions: readonly string[];
  readonly states: readonly LensState[];
  readonly requiredArtifacts: readonly ArtifactSpec[];
  readonly validators: readonly ValidatorRef[];
  readonly escalationTriggers: readonly EscalationRule[];
  readonly releasePolicies: readonly ReleasePolicyRef[];
  readonly clvBindings: readonly string[];
  readonly dependencies: readonly { lensId: string; version: string }[];
}

export interface StateExecutionContext {
  readonly scope: Scope;
  readonly lensId: string;
  readonly lensVersion: string;
  readonly stateId: string;
  readonly activationId: string;
  readonly previousStateOutputs: Record<string, unknown>;
}

export interface StateExecutionResult {
  readonly stateId: string;
  readonly status: 'completed' | 'escalated' | 'blocked';
  readonly output?: unknown;
  readonly artifactIds?: readonly string[];
  readonly escalationReason?: string;
  readonly blockReason?: string;
}

/**
 * Orchestrator is the runtime that advances a lens state machine.
 * Wave 0 ships the interface only; Wave 2 ships the implementation.
 */
export interface Orchestrator {
  loadManifest(manifest: LensPhaseManifest): void;
  startActivation(scope: Scope, lensId: string, lensVersion: string): string;
  executeNextState(activationId: string): Promise<StateExecutionResult>;
  getActivation(activationId: string): ActivationState | undefined;
}

export interface ActivationState {
  readonly activationId: string;
  readonly scope: Scope;
  readonly lensId: string;
  readonly lensVersion: string;
  readonly completedStates: readonly string[];
  readonly currentStateId?: string;
  readonly status: 'in_progress' | 'completed' | 'blocked' | 'escalated';
}
