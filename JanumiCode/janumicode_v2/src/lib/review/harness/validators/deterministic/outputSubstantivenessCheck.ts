/**
 * Deterministic validator: output_substantiveness_check
 *
 * Per validator_catalog.md §1 + §9.1: distinguish a contract-satisfying
 * minimal response from a near-empty placeholder. Per-pass length floor
 * with role-specific minima. Per sample 12's NFR-enrichment discovery.
 *
 * Severity:
 *   - below floor -> HIGH
 *   - between floor and 1.5x floor -> MEDIUM (suspicious but plausible)
 *   - above 1.5x floor -> []
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const CLASSIFICATION_ROLES: ReadonlySet<string> = new Set([
  'orchestrator:intent_lens_classification',
]);

const DEFAULT_FLOOR = 200;
const CLASSIFICATION_FLOOR = 50;

function floorFor(agentRole: string, subPhaseId: string): number {
  return CLASSIFICATION_ROLES.has(`${agentRole}:${subPhaseId}`)
    ? CLASSIFICATION_FLOOR
    : DEFAULT_FLOOR;
}

export function validateOutputSubstantiveness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const text = (params.outputText ?? '').trim();
  const len = text.length;
  const floor = floorFor(params.agentRole, params.subPhaseId);

  if (len === 0) {
    return [
      {
        validatorId: 'output_substantiveness_check',
        severity: 'HIGH',
        type: 'empty_output',
        summary: 'Agent output is empty',
        location: '$',
        detail: 'outputText is empty after trimming.',
        recommendation: 'Re-run the agent; verify upstream context was non-empty.',
      },
    ];
  }

  if (len < floor) {
    return [
      {
        validatorId: 'output_substantiveness_check',
        severity: 'HIGH',
        type: 'below_length_floor',
        summary: `Output ${len} chars < floor ${floor}`,
        location: '$',
        detail: `Output length (${len} chars) falls below the per-pass floor of ${floor}.`,
        recommendation: 'Re-run the agent; review prompt for ambiguity that may suppress generation.',
      },
    ];
  }

  if (len < Math.floor(floor * 1.5)) {
    return [
      {
        validatorId: 'output_substantiveness_check',
        severity: 'MEDIUM',
        type: 'suspicious_brevity',
        summary: `Output ${len} chars within 1.5x of floor ${floor}`,
        location: '$',
        detail: `Output is short (${len} chars) — above floor ${floor} but below 1.5x floor (${Math.floor(floor * 1.5)}).`,
        recommendation: 'Inspect output for placeholder content; consider re-run.',
      },
    ];
  }

  return [];
}
