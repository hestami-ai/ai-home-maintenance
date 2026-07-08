/**
 * Deterministic validator: sr_allocation_completeness_validator
 *
 * Per validator_catalog.md §3 (Phase 4.2 bloom-class, sample 19):
 * Verify all input system_requirement ids are covered by at least one
 * component AND that any cross-allocations (a single SR mapped to multiple
 * components) are explicitly declared in the component_responsibility's
 * `cross_cuts[]` field (or equivalent).
 *
 * Input SR ids are extracted from the original prompt using the SR-xxx
 * id pattern. Output coverage is checked by scanning all component
 * `allocated_srs`, `source_requirements`, or `traces_to` arrays.
 *
 * Severity:
 *   - HIGH on uncovered SR (no component references it).
 *   - MEDIUM on undeclared cross-allocation (SR appears in multiple
 *     components but cross_cuts[] does not declare it).
 *
 * This validator emits ADVISORY findings only; targetField/targetIdentifier
 * are not populated because findings do not correspond to mutable array
 * elements — they flag coverage gaps (an input SR not referenced anywhere
 * in components[]) which cannot be remediated by dropping an array element.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const SR_ID_PATTERN = /\b(SR-[A-Z0-9-]+)\b/g;

function extractSRIds(text: string): Set<string> {
  const ids = new Set<string>();
  SR_ID_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SR_ID_PATTERN.exec(text)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function getComponentSrRefs(comp: Record<string, unknown>): Set<string> {
  const refs = new Set<string>();
  const fields = ['allocated_srs', 'source_requirements', 'traces_to', 'sr_ids'];
  for (const field of fields) {
    const val = comp[field];
    if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === 'string') refs.add(v);
      }
    }
  }
  return refs;
}

function getComponentCrossCuts(comp: Record<string, unknown>): Set<string> {
  const cuts = new Set<string>();
  const val = comp.cross_cuts;
  if (Array.isArray(val)) {
    for (const v of val) {
      if (typeof v === 'string') cuts.add(v);
    }
  }
  return cuts;
}

export function validateSrAllocationCompleteness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent, originalPrompt } = params;
  if (!outputContent || !originalPrompt) return [];

  const sourceSRs = extractSRIds(originalPrompt);
  if (sourceSRs.size === 0) return [];

  const components =
    (outputContent.components as unknown[]) ??
    (outputContent.component_model as unknown[]) ??
    (outputContent.component_skeleton as unknown[]) ??
    null;
  if (!Array.isArray(components)) return [];

  // Build SR → [components that allocate it] map
  const srToComponents = new Map<string, string[]>();
  const crossCutsPerComponent = new Map<string, Set<string>>();

  components.forEach((comp, idx) => {
    if (!comp || typeof comp !== 'object') return;
    const c = comp as Record<string, unknown>;
    let compId: string;
    if (typeof c.id === 'string') {
      compId = c.id;
    } else if (typeof c.component_id === 'string') {
      compId = c.component_id;
    } else {
      compId = `component[${idx}]`;
    }

    const refs = getComponentSrRefs(c);
    crossCutsPerComponent.set(compId, getComponentCrossCuts(c));

    for (const sr of refs) {
      const list = srToComponents.get(sr) ?? [];
      list.push(compId);
      srToComponents.set(sr, list);
    }
  });

  const findings: ValidatorFinding[] = [];

  for (const srId of sourceSRs) {
    const allocatedTo = srToComponents.get(srId);

    // 1. Uncovered SR — HIGH
    if (!allocatedTo || allocatedTo.length === 0) {
      findings.push({
        validatorId: 'sr_allocation_completeness_validator',
        severity: 'HIGH',
        type: 'uncovered_sr',
        summary: `SR '${srId}' is not allocated to any component`,
        location: `$.components[*].allocated_srs`,
        detail: `System requirement '${srId}' appears in the input prompt but no component's allocation includes it.`,
        recommendation: `Allocate '${srId}' to the component(s) responsible for delivering that system requirement.`,
      });
      continue;
    }

    // 2. Cross-allocation not declared in cross_cuts — MEDIUM
    if (allocatedTo.length > 1) {
      // Check if ALL components that allocate this SR declare it in cross_cuts
      for (const compId of allocatedTo) {
        const cuts = crossCutsPerComponent.get(compId) ?? new Set();
        if (!cuts.has(srId)) {
          findings.push({
            validatorId: 'sr_allocation_completeness_validator',
            severity: 'MEDIUM',
            type: 'undeclared_cross_allocation',
            summary: `SR '${srId}' is cross-allocated to ${allocatedTo.length} components but component '${compId}' does not declare it in cross_cuts[]`,
            location: `$.components[*][cross_cuts]`,
            detail: `SR '${srId}' appears in components: ${allocatedTo.join(', ')}. Component '${compId}' must declare the cross-allocation in its cross_cuts[] field.`,
            recommendation: `Add '${srId}' to '${compId}'.cross_cuts[] to make the cross-allocation explicit.`,
          });
        }
      }
    }
  }

  return findings;
}
