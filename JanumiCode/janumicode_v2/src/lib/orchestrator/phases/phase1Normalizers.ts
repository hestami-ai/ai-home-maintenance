/**
 * Phase 1 extraction normalizers — pure functions, separated from the
 * Phase1Handler class so they can be regression-tested without spinning
 * up the orchestrator. Each normalizer accepts the raw `parsed` array
 * the LLM returned and produces a typed, schema-shaped array, dropping
 * items whose required fields are missing.
 *
 * Why this matters: cal-22b dropped all 21 technical constraints in
 * the Hestami calibration because the LLM-emitted items lacked a `text`
 * field (content was in `rationale` and `source_ref.excerpt`). The
 * normalizer's `text.length > 0` filter then silently discarded every
 * one of them. Downstream phases reinvented Python/FastAPI defaults
 * because the active-constraints channel was empty. Lifting the
 * normalizers here makes the LLM-shape-tolerance behavior explicit and
 * directly testable.
 */

import type { TechnicalConstraint, SourceRef, WorkflowV2, WorkflowStep, WorkflowTrigger } from '../../types/records';
import { traceNormalize } from '../../trace/traceNormalize';
import { normalizeIdHyphens } from '../idNormalization';

/**
 * Wire-format → record-type adapter: maps snake_case agent JSON keys to the
 * camelCase field names used in TS record types (UserJourney, Persona, etc.).
 * Called at the parse seam after JSON.parse so downstream code always sees
 * the camelCase shape the TS types expect. Keeps camelCase originals if the
 * agent happened to emit them (backward-compat during transition).
 *
 * Only remaps the specific keys that changed in the snake_case flip for
 * phase_01. DO NOT propagate into TS-internal code beyond this file.
 */
function snakeToCamel(raw: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const [snake, camel] of Object.entries(mapping)) {
    if (snake in raw && !(camel in raw)) {
      out[camel] = raw[snake];
    }
  }
  return out;
}

const JOURNEY_WIRE_MAP: Record<string, string> = {
  persona_id: 'personaId',
  additional_personas: 'additionalPersonas',
  business_domain_ids: 'businessDomainIds',
  acceptance_criteria: 'acceptanceCriteria',
  implementation_phase: 'implementationPhase',
};

const STEP_WIRE_MAP: Record<string, string> = {
  step_number: 'stepNumber',
  expected_outcome: 'expectedOutcome',
};

/**
 * Normalize a single raw journey object from wire-format (snake_case) to the
 * camelCase shape expected by UserJourney TS record consumers.
 */
export function normalizeJourneyFromWire(raw: Record<string, unknown>): Record<string, unknown> {
  const j = snakeToCamel(raw, JOURNEY_WIRE_MAP);
  if (Array.isArray(j.steps)) {
    j.steps = (j.steps as unknown[]).map((s) => {
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        return snakeToCamel(s as Record<string, unknown>, STEP_WIRE_MAP);
      }
      return s;
    });
  }
  // Normalize domain-ref id drift: gpt-oss emits `DOM-REALTIME_STATUS_UPDATES`
  // (underscores) while the accepted domain id is `DOM-REALTIME-STATUS-UPDATES`
  // (hyphens) — a mismatch the Phase 1.3c referential_integrity_journey_domain
  // verifier hard-fails on. These ids live in a bare-string array, which
  // `normalizeIdsInTree` can't reach (it only transforms string values AT a key),
  // so hyphen-normalize each entry here, producer-side.
  if (Array.isArray(j.businessDomainIds)) {
    j.businessDomainIds = (j.businessDomainIds as unknown[]).map(
      (d) => (typeof d === 'string' ? normalizeIdHyphens(d) : d),
    );
  }
  return traceNormalize('phase1.normalizeJourneyFromWire', raw, j);
}

const INTENT_DISCOVERY_WIRE_MAP: Record<string, string> = {
  analysis_summary: 'analysisSummary',
  product_vision: 'productVision',
  product_description: 'productDescription',
  user_journeys: 'userJourneys',
  phasing_strategy: 'phasingStrategy',
  success_metrics: 'successMetrics',
  ux_requirements: 'uxRequirements',
  open_questions: 'openQuestions',
};

/**
 * Normalize the top-level parsed intent_discovery JSON from snake_case wire
 * format to the camelCase fields used internally.
 */
export function normalizeIntentDiscoveryFromWire(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  return traceNormalize(
    'phase1.normalizeIntentDiscoveryFromWire',
    parsed,
    snakeToCamel(parsed, INTENT_DISCOVERY_WIRE_MAP),
  );
}

const SYNTHESIS_WIRE_MAP: Record<string, string> = {
  product_vision: 'productVision',
  product_description: 'productDescription',
  open_loops: 'openLoops',
};

/**
 * Normalize the top-level parsed product_description_synthesis JSON from
 * snake_case wire format to the camelCase fields used internally.
 */
export function normalizeSynthesisFromWire(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  return traceNormalize(
    'phase1.normalizeSynthesisFromWire',
    parsed,
    snakeToCamel(parsed, SYNTHESIS_WIRE_MAP),
  );
}

const DOMAIN_WIRE_MAP: Record<string, string> = {
  entity_preview: 'entityPreview',
  workflow_preview: 'workflowPreview',
  pain_points: 'painPoints',
};

/**
 * Normalize a single domain object from wire-format to the camelCase shape
 * expected by BusinessDomain TS record consumers.
 */
export function normalizeDomainFromWire(raw: Record<string, unknown>): Record<string, unknown> {
  const d = snakeToCamel(raw, DOMAIN_WIRE_MAP);
  // Canonicalize the domain's OWN id producer-side. gpt-oss emits partial-
  // underscore ids like `DOM-AI_CONCIERGE-INTERACTION` while journey
  // businessDomainIds are hyphen-normalized (normalizeJourneyFromWire) to
  // `DOM-AI-CONCIERGE-INTERACTION` — a mismatch the Phase 1.3c
  // referential_integrity_journey_domain verifier hard-fails on (cal-33). This
  // is the source-side sibling of the journey-ref fix: normalize both sides to
  // canonical all-hyphens so the join holds regardless of which side drifts.
  if (typeof d.id === 'string') d.id = normalizeIdHyphens(d.id);
  return traceNormalize('phase1.normalizeDomainFromWire', raw, d);
}

const PERSONA_WIRE_MAP: Record<string, string> = {
  pain_points: 'painPoints',
};

/**
 * Normalize a single persona object from wire-format to the camelCase shape
 * expected by Persona TS record consumers.
 */
export function normalizePersonaFromWire(raw: Record<string, unknown>): Record<string, unknown> {
  return traceNormalize(
    'phase1.normalizePersonaFromWire',
    raw,
    snakeToCamel(raw, PERSONA_WIRE_MAP),
  );
}

export function normalizeSourceRef(raw: unknown): SourceRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const document_path = typeof o.document_path === 'string' ? o.document_path : '';
  const excerpt = typeof o.excerpt === 'string' ? o.excerpt : '';
  if (!document_path || !excerpt) return undefined;
  return {
    document_path,
    section_heading: typeof o.section_heading === 'string' ? o.section_heading : undefined,
    excerpt,
    excerpt_start: typeof o.excerpt_start === 'number' ? o.excerpt_start : undefined,
    excerpt_end: typeof o.excerpt_end === 'number' ? o.excerpt_end : undefined,
  };
}

/**
 * Normalize technical-constraints output from Phase 1.0c.
 *
 * Tolerance order for the constraint description text:
 *   1. `text` — the canonical field per the prompt template.
 *   2. `rationale` — qwen3.5-35b-a3b often puts a coherent sentence here
 *      and leaves `text` empty.
 *   3. `source_ref.excerpt` — verbatim source quote; always grounded
 *      when present, since the prompt requires it.
 *   4. `technology` — last-resort fallback (just the named tool).
 *
 * Items still drop if NONE of those fields produce a non-empty string.
 * That preserves the original "drop unfounded captures" intent while
 * not punishing the LLM for routing the description into a sibling
 * field.
 */
/**
 * Normalize a single workflow from wire format. The Phase 1.3b
 * system_workflow_bloom prompt asks the LLM for snake_case keys
 * (`business_domain_id`, `steps[*].step_number`, `steps[*].expected_outcome`).
 * Internally JanumiCode uses camelCase shapes. This normalizer accepts
 * EITHER convention and emits the internal camelCase WorkflowV2.
 *
 * ts-14 (2026-05-18) tripped on the legacy version that read only the
 * camelCase keys — gpt-oss correctly emitted snake_case per the prompt,
 * so `businessDomainId` was always undefined, defaulted to empty string,
 * and the Phase 1.3b self-heal dropped every workflow as
 * "domain-not-accepted". See feedback_normalizer_case_dual_keys.md.
 */
export function normalizeWorkflowV2(w: Record<string, unknown>): WorkflowV2 {
  const pickKey = (obj: Record<string, unknown>, snake: string, camel: string): unknown =>
    obj[snake] !== undefined ? obj[snake] : obj[camel];

  const rawTriggers = Array.isArray(w.triggers) ? w.triggers as Array<Record<string, unknown>> : [];
  const triggers: WorkflowTrigger[] = rawTriggers
    .map(t => normalizeWorkflowTrigger(t))
    .filter((t): t is WorkflowTrigger => t !== null);

  const rawSteps = Array.isArray(w.steps) ? w.steps as Array<Record<string, unknown>> : [];
  const steps: WorkflowStep[] = rawSteps.map((s, i) => {
    const stepNumber = pickKey(s, 'step_number', 'stepNumber');
    const expectedOutcome = pickKey(s, 'expected_outcome', 'expectedOutcome');
    return {
      stepNumber: typeof stepNumber === 'number' ? stepNumber : i + 1,
      actor: typeof s.actor === 'string' ? s.actor : 'System',
      action: typeof s.action === 'string' ? s.action : '',
      expectedOutcome: typeof expectedOutcome === 'string' ? expectedOutcome : '',
    };
  });

  const rawActors = Array.isArray(w.actors)
    ? w.actors.filter((x): x is string => typeof x === 'string')
    : [];
  // Always derive backs_journeys from triggers; LLM-supplied list drifts.
  const backs_journeys = Array.from(new Set(triggers
    .filter((t): t is Extract<WorkflowTrigger, { kind: 'journey_step' }> => t.kind === 'journey_step')
    .map(t => t.journey_id)));

  const businessDomainId = pickKey(w, 'business_domain_id', 'businessDomainId');
  const normalized: WorkflowV2 = {
    id: typeof w.id === 'string' ? normalizeIdHyphens(w.id) : '',
    // Hyphen-normalize the domain ref so it joins to the now-canonical domain
    // id (see normalizeDomainFromWire) — hardens the 1.3c domain_workflow_coverage
    // check against the same gpt-oss underscore drift.
    businessDomainId: typeof businessDomainId === 'string' ? normalizeIdHyphens(businessDomainId) : '',
    name: typeof w.name === 'string' ? w.name : '',
    description: typeof w.description === 'string' ? w.description : '',
    steps,
    triggers,
    actors: rawActors,
    backs_journeys,
    source: (typeof w.source === 'string' ? w.source : undefined) as WorkflowV2['source'],
  };
  return traceNormalize('phase1.normalizeWorkflowV2', w, normalized);
}

/**
 * Normalize a single workflow trigger object. Returns null when the
 * trigger's `kind` is unknown or required fields for that kind are
 * missing — the caller drops null entries.
 */
export function normalizeWorkflowTrigger(t: Record<string, unknown>): WorkflowTrigger | null {
  const kind = t.kind;
  if (kind === 'journey_step' && typeof t.journey_id === 'string' && typeof t.step_number === 'number') {
    return { kind, journey_id: t.journey_id, step_number: t.step_number };
  }
  if (kind === 'schedule' && typeof t.cadence === 'string') {
    return { kind, cadence: t.cadence };
  }
  if (kind === 'event' && typeof t.event_type === 'string') {
    return { kind, event_type: t.event_type };
  }
  if (kind === 'compliance' && typeof t.regime_id === 'string' && typeof t.rule === 'string') {
    return { kind, regime_id: t.regime_id, rule: t.rule };
  }
  if (kind === 'integration' && typeof t.integration_id === 'string' && typeof t.event === 'string') {
    return { kind, integration_id: t.integration_id, event: t.event };
  }
  return null;
}

export function normalizeTechnicalConstraints(raw: unknown[]): TechnicalConstraint[] {
  const mapped = raw.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const sourceRef = normalizeSourceRef(o.source_ref);
    const text =
      typeof o.text === 'string' && o.text.length > 0 ? o.text
      : typeof o.rationale === 'string' && o.rationale.length > 0 ? o.rationale
      : sourceRef?.excerpt && sourceRef.excerpt.length > 0 ? sourceRef.excerpt
      : typeof o.technology === 'string' && o.technology.length > 0 ? o.technology
      : '';
    return {
      id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `TECH-${i + 1}`,
      category: typeof o.category === 'string' ? o.category : 'uncategorized',
      text,
      technology: typeof o.technology === 'string' ? o.technology : undefined,
      version: typeof o.version === 'string' ? o.version : undefined,
      rationale: typeof o.rationale === 'string' ? o.rationale : undefined,
      source_ref: sourceRef,
    };
  });
  const filtered = mapped.filter(t => t.text.length > 0);
  // cal-22b silent-drop: 21 raw items → 0 emitted because none of them
  // had a `text` field. Wrap in a synthetic { items } record so the
  // field-diff's size_changed catches the drop. The trace will say
  // "items: size [21→0]" which is exactly the signal that was needed.
  traceNormalize(
    'phase1.normalizeTechnicalConstraints',
    { items: raw },
    { items: filtered },
  );
  return filtered;
}
