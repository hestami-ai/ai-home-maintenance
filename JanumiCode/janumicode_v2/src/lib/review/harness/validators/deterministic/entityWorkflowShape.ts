/**
 * Deterministic validator: entity_workflow_shape
 *
 * Heuristic detector for nouns-vs-verbs misclassification in
 * entityPreview / workflowPreview. An item is suspect if its label
 * begins with a strong-verb prefix in entityPreview, or a clearly
 * nominal prefix in workflowPreview.
 *
 * Conservative heuristic — flag MEDIUM only. LLM fallback in a
 * future commit will sharpen these.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const VERB_LIKE_PREFIXES = [
  'create ',
  'submit ',
  'approve ',
  'reject ',
  'send ',
  'process ',
  'verify ',
  'compute ',
  'calculate ',
  'notify ',
];

const NOUN_LIKE_PREFIXES = [
  'property ',
  'invoice ',
  'tenant ',
  'owner ',
  'document ',
  'account ',
  'ledger ',
];

function getLabel(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  const v = r.name ?? r.label ?? r.title ?? r.id;
  return typeof v === 'string' ? v : null;
}

export function validateEntityWorkflowShape(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const findings: ValidatorFinding[] = [];

  const entities = (out.entity_preview ?? out.entityPreview ?? out.entities) as unknown;
  if (Array.isArray(entities)) {
    entities.forEach((e, i) => {
      const label = getLabel(e);
      if (!label) return;
      const lower = label.toLowerCase();
      if (VERB_LIKE_PREFIXES.some((p) => lower.startsWith(p))) {
        findings.push({
          validatorId: 'entity_workflow_shape',
          severity: 'MEDIUM',
          type: 'verb_in_entity',
          summary: `Entity '${label}' looks verb-led`,
          location: `$.entity_preview[${i}]`,
          detail: 'Entities should be nouns/noun-phrases. Workflow-like label here.',
          recommendation: 'Move to workflow_preview or rename to a noun phrase.',
        });
      }
    });
  }

  const workflows = (out.workflow_preview ?? out.workflowPreview ?? out.workflows) as unknown;
  if (Array.isArray(workflows)) {
    workflows.forEach((w, i) => {
      const label = getLabel(w);
      if (!label) return;
      const lower = label.toLowerCase();
      if (NOUN_LIKE_PREFIXES.some((p) => lower.startsWith(p))) {
        findings.push({
          validatorId: 'entity_workflow_shape',
          severity: 'MEDIUM',
          type: 'noun_in_workflow',
          summary: `Workflow '${label}' looks noun-led`,
          location: `$.workflow_preview[${i}]`,
          detail: 'Workflows should be verb/verb-phrases. Entity-like label here.',
          recommendation: 'Move to entity_preview or rename to a verb phrase.',
        });
      }
    });
  }

  return findings;
}
