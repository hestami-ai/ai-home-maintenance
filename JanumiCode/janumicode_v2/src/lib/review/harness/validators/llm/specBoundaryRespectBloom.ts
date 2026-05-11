/**
 * LLM validator: spec_boundary_respect_bloom.
 *
 * Bloom-family validator. Reads two prior governed-stream artifacts
 * (`product_intent_discovery.decisions` and
 * `technical_constraints_discovery.technicalConstraints`) and renders
 * them into the validator's prompt as structured grounding. The LLM then
 * judges whether the bloom output contains items that contradict any
 * stated constraint or any prior intent-discovery decision. This catches
 * the over-bloom failure mode where bloom proposes journeys / entities /
 * integrations / NFRs the spec author already excluded
 * (e.g. rate-limiting integrations when the discovery decisions list
 * "No rate limiting implemented on submissions").
 *
 * Advisory only — findings are recorded but do not block. Future
 * versions may promote HIGH findings to a re-bloom retry signal.
 */
import { makeLLMValidator } from './llmValidatorRunner';

interface DecisionEntry {
  id?: unknown;
  type?: unknown;
  text?: unknown;
}

interface TechConstraintEntry {
  id?: unknown;
  category?: unknown;
  text?: unknown;
  technology?: unknown;
  version?: unknown;
}

function formatDecisions(rawArtifacts: ReadonlyArray<Record<string, unknown>> | undefined): string {
  if (!rawArtifacts || rawArtifacts.length === 0) return '(no product_intent_discovery artifact found)';
  // Take the first artifact (current_version is unique by sub_phase_id+kind).
  const first = rawArtifacts[0];
  const decisions = Array.isArray(first.decisions) ? first.decisions as DecisionEntry[] : [];
  if (decisions.length === 0) return '(no decisions captured during intent discovery)';
  return decisions
    .map((d) => {
      const id = typeof d.id === 'string' ? d.id : '?';
      const type = typeof d.type === 'string' ? d.type : 'DECISION';
      const text = typeof d.text === 'string' ? d.text : JSON.stringify(d);
      return `- ${id} [${type}]: ${text}`;
    })
    .join('\n');
}

function formatTechConstraints(rawArtifacts: ReadonlyArray<Record<string, unknown>> | undefined): string {
  if (!rawArtifacts || rawArtifacts.length === 0) return '(no technical_constraints_discovery artifact found)';
  const first = rawArtifacts[0];
  const items = Array.isArray(first.technicalConstraints) ? first.technicalConstraints as TechConstraintEntry[] : [];
  if (items.length === 0) return '(no technical constraints extracted)';
  return items
    .map((c) => {
      const id = typeof c.id === 'string' ? c.id : '?';
      const category = typeof c.category === 'string' ? c.category : 'general';
      const text = typeof c.text === 'string' ? c.text : JSON.stringify(c);
      return `- ${id} [${category}]: ${text}`;
    })
    .join('\n');
}

export const invokeSpecBoundaryRespectBloom = makeLLMValidator({
  validatorId: 'spec_boundary_respect_bloom',
  preprocessGrounding: (params) => {
    const map = params.priorArtifactsByKind;
    const intentDiscovery = map?.get('intent_discovery');
    const techConstraintsDisc = map?.get('technical_constraints_discovery');
    return {
      DISCOVERY_DECISIONS: formatDecisions(intentDiscovery),
      TECHNICAL_CONSTRAINTS: formatTechConstraints(techConstraintsDisc),
    };
  },
});
