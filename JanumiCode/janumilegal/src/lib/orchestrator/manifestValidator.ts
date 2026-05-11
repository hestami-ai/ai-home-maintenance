/**
 * Manifest validator.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 2 §2.1:
 *   "Manifest loader with hard validation: schema, agent references,
 *    CLV references, VCC pre-check."
 *
 * Validation runs before a manifest is stored in lens_pack_catalog. Failure
 * here is the canonical "manifest with unknown CLV term fails to load" gate.
 */

import type { CLV } from '../clv/types.js';
import type { AgentRegistry } from '../registry/agentRegistry.js';
import type { LensPhaseManifest, LensState } from './types.js';

export interface ManifestValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function validateManifest(
  manifest: LensPhaseManifest,
  options: { clv: CLV; agentRegistry: AgentRegistry },
): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest.lensId) errors.push('lensId required');
  if (!manifest.lensVersion) errors.push('lensVersion required');
  if (!manifest.practiceArea) errors.push('practiceArea required');
  if (manifest.states.length === 0) errors.push('manifest must declare at least one state');

  // CLV bindings — every binding must resolve
  for (const binding of manifest.clvBindings) {
    if (!options.clv.has(binding)) {
      errors.push(`clvBindings: unknown CLV term '${binding}'`);
    }
  }

  // State validations
  const stateIds = new Set<string>();
  for (const state of manifest.states) {
    validateState(state, manifest, options, errors, stateIds);
  }

  return { ok: errors.length === 0, errors };
}

function validateState(
  state: LensState,
  manifest: LensPhaseManifest,
  options: { clv: CLV; agentRegistry: AgentRegistry },
  errors: string[],
  stateIds: Set<string>,
): void {
  if (!state.stateId) {
    errors.push('state with empty stateId');
    return;
  }
  if (stateIds.has(state.stateId)) {
    errors.push(`duplicate stateId '${state.stateId}'`);
    return;
  }
  stateIds.add(state.stateId);

  if (!state.inputSchema) errors.push(`state ${state.stateId}: missing inputSchema`);
  if (!state.outputSchema) errors.push(`state ${state.stateId}: missing outputSchema`);

  // Predecessors must reference declared states earlier in the list.
  // This rule is conservative; richer DAGs can be supported later by
  // changing this to a topological-order check.
  const declaredEarlier = Array.from(stateIds);
  for (const pred of state.predecessors) {
    if (!declaredEarlier.includes(pred) || pred === state.stateId) {
      errors.push(
        `state ${state.stateId}: predecessor '${pred}' not declared earlier in manifest`,
      );
    }
  }

  // permittedAgents must exist in the registry and permit this lens + state.
  for (const agentId of state.permittedAgents) {
    const agent = options.agentRegistry.get(agentId);
    if (!agent) {
      errors.push(`state ${state.stateId}: agent '${agentId}' not registered`);
      continue;
    }
    const lensAllowed =
      agent.permittedLenses.includes(manifest.lensId) || agent.permittedLenses.includes('*');
    if (!lensAllowed) {
      errors.push(
        `state ${state.stateId}: agent '${agentId}' is not permitted on lens '${manifest.lensId}'`,
      );
    }
    const stateAllowed =
      agent.permittedStates.includes(state.stateId) || agent.permittedStates.includes('*');
    if (!stateAllowed) {
      errors.push(
        `state ${state.stateId}: agent '${agentId}' is not permitted in state '${state.stateId}'`,
      );
    }
  }

  // CLV scope on the state — every term referenced must exist
  for (const termId of state.clvScope) {
    if (!options.clv.has(termId)) {
      errors.push(`state ${state.stateId}: clvScope references unknown CLV term '${termId}'`);
    }
  }
}
