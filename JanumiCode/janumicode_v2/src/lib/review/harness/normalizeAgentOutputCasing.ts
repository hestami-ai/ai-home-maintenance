/**
 * Defense-in-depth: if an agent emits camelCase variants of known canonical
 * snake_case keys, add the snake_case alias so validators see consistent shape.
 * Returns a shallow-cloned object; original keys preserved.
 */
const KNOWN_ALIASES: Record<string, string> = {
  userStories: 'user_stories',
  acceptanceCriteria: 'acceptance_criteria',
  measurableCondition: 'measurable_condition',
  nonFunctionalRequirements: 'requirements',
  nfrs: 'requirements',
  hasConcerns: 'has_concerns',
  productIntent: 'product_intent',
  openQuestions: 'open_questions',
  lensCorrectnessRationale: 'lens_correctness_rationale',
  // Phase 01 snake_case flip (added with wave-8 standardization)
  entityPreview: 'entity_preview',
  workflowPreview: 'workflow_preview',
  userJourneys: 'user_journeys',
  personaId: 'persona_id',
  complianceExtractedItems: 'compliance_extracted_items',
  openLoops: 'open_loops',
};

export function normalizeAgentOutputCasing(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const obj = payload as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  for (const [camel, snake] of Object.entries(KNOWN_ALIASES)) {
    if (camel in obj && !(snake in obj)) {
      out[snake] = obj[camel];
    }
  }
  // Recurse into known nested array shapes that carry their own aliasable keys.
  if (Array.isArray(out.user_stories)) {
    out.user_stories = (out.user_stories as unknown[]).map((s) => normalizeAgentOutputCasing(s));
  }
  if (Array.isArray(out.requirements)) {
    out.requirements = (out.requirements as unknown[]).map((s) => normalizeAgentOutputCasing(s));
  }
  if (Array.isArray(out.user_journeys)) {
    out.user_journeys = (out.user_journeys as unknown[]).map((s) => normalizeAgentOutputCasing(s));
  }
  if (Array.isArray(out.compliance_extracted_items)) {
    out.compliance_extracted_items = (out.compliance_extracted_items as unknown[]).map(
      (s) => normalizeAgentOutputCasing(s),
    );
  }
  return out;
}
