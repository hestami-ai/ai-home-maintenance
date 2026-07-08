/**
 * P5.1b adjudicator — the SCOPED intelligence in entity_ownership_reconciliation.
 *
 * The deterministic bridge handles grouping + owner election (lookups). This LLM
 * step makes only the genuinely-semantic calls the bridge cannot: for each SHARED
 * cross-component concept, is it an
 *   - owned_aggregate     (one context is the source of truth; others reference it),
 *   - shared_value_object (an immutable value copied BY VALUE into each context), or
 *   - separate            (a coincidental name collision — genuinely different things)?
 * and, for an owned aggregate spanning multiple components of ONE bounded context,
 * which component OWNS it.
 *
 * The LLM only PROPOSES; the deterministic bridge VALIDATES its owner suggestion
 * against real members and keeps the domain chain authoritative. Prompt-build and
 * response-parse are pure (exported for unit tests); the LLM call is injected.
 */

import { getLogger } from '../../../logging';
import type { EntityOwnershipVerdict } from '../../../types/records';
import type { Adjudicator, AdjudicationRequest, AdjudicationVerdict } from './entityOwnershipBridge';

const VERDICTS = new Set<EntityOwnershipVerdict>(['owned_aggregate', 'shared_value_object', 'separate']);

export type AdjudicatorCall = (opts: { prompt: string; responseFormat: 'json'; temperature: number; traceContext: Record<string, unknown> }) => Promise<{ parsed: unknown; text: string }>;

/** Build the classification prompt. `componentContext` is an optional per-component
 *  "id — responsibility [domain]" block that helps the model reason about ownership. */
export function buildAdjudicatorPrompt(reqs: AdjudicationRequest[], componentContext?: string): string {
  const concepts = reqs.map((r) => {
    const members = r.members.map((m) => `    - ${m.component_id}: {${m.fields.join(', ')}}`).join('\n');
    return `- concept_key "${r.concept_key}" (name: ${r.concept_name}), declared in ${r.members.length} components:\n${members}`;
  }).join('\n');

  return `You are a Domain-Driven-Design modeling adjudicator. Several components (bounded contexts / their sub-services) each independently declared an entity with the SAME name but DIFFERENT fields. Classify each shared concept so the pipeline models it correctly WITHOUT creating cross-context coupling (no shared kernel), and so each context can later be extracted into its own microservice (cross-context links are by id only).

For EACH concept, choose exactly one verdict:
- "owned_aggregate": a real entity with identity + lifecycle that ONE context is the source of truth for. The other contexts only REFERENCE it (by id). Also name owner_component_id = the single component that owns it (the source of truth — e.g. the write-side / the service whose core responsibility IS this thing). The others will become thin reference stubs.
- "shared_value_object": an immutable VALUE with no identity of its own (e.g. Address, Money, GeoPoint, a small metadata record). In DDD a value object is COPIED BY VALUE into each context — no owner, no reference. Choose this when the concept has no independent lifecycle and is embedded wherever used.
- "separate": the components used the same NAME for genuinely DIFFERENT things (a coincidental collision). Keep them independent; no owner, no reference.

Guidance: prefer "owned_aggregate" for things with an id/status/lifecycle that clearly belong to one service; prefer "shared_value_object" only for true immutable values; use "separate" sparingly. Base owner_component_id ONLY on the listed components — do not invent one.
${componentContext ? `\nComponent context (id — responsibility [domain]):\n${componentContext}\n` : ''}
Shared concepts to classify:
${concepts}

Return ONLY raw JSON (no markdown fences), shape:
{ "verdicts": [ { "concept_key": "<verbatim key>", "verdict": "owned_aggregate" | "shared_value_object" | "separate", "owner_component_id": "<one of the listed components, only for owned_aggregate>", "rationale": "<one sentence>" } ] }`;
}

/** Parse the LLM response into validated verdicts, filtered to the requested keys.
 *  Tolerates {verdicts:[...]} or a bare array. Invalid/unknown entries are dropped
 *  (the bridge then falls back to its deterministic default — no fabrication). */
export function parseAdjudicationVerdicts(parsed: unknown, validKeys: Set<string>): AdjudicationVerdict[] {
  let arr: unknown[];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).verdicts)) {
    arr = (parsed as { verdicts: unknown[] }).verdicts;
  } else {
    arr = [];
  }
  const out: AdjudicationVerdict[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const key = typeof o.concept_key === 'string' ? o.concept_key : '';
    const verdict = o.verdict as EntityOwnershipVerdict;
    if (!validKeys.has(key) || seen.has(key) || !VERDICTS.has(verdict)) continue;
    seen.add(key);
    out.push({
      concept_key: key,
      verdict,
      owner_component_id: typeof o.owner_component_id === 'string' && o.owner_component_id.trim() ? o.owner_component_id.trim() : undefined,
      rationale: typeof o.rationale === 'string' ? o.rationale : undefined,
    });
  }
  return out;
}

/** Make an injectable Adjudicator backed by an LLM call. Batches ALL shared
 *  concepts into a single classification call (there are only ~a dozen). Returns
 *  [] on any failure — the bridge then uses its deterministic defaults. */
export function makeEntityOwnershipAdjudicator(deps: {
  call: AdjudicatorCall;
  workflowRunId: string;
  componentContext?: string;
}): Adjudicator {
  return async (reqs: AdjudicationRequest[]): Promise<AdjudicationVerdict[]> => {
    if (reqs.length === 0) return [];
    const prompt = buildAdjudicatorPrompt(reqs, deps.componentContext);
    try {
      const result = await deps.call({
        prompt,
        responseFormat: 'json',
        temperature: 0.2,
        traceContext: {
          workflowRunId: deps.workflowRunId, phaseId: '5', subPhaseId: 'entity_ownership_reconciliation',
          agentRole: 'technical_spec_agent', label: `Phase 5.1b — Entity Ownership Adjudication (${reqs.length} concepts)`,
        },
      });
      return parseAdjudicationVerdicts(result.parsed, new Set(reqs.map((r) => r.concept_key)));
    } catch (err) {
      getLogger().warn('workflow', 'Phase 5.1b entity-ownership adjudicator failed — deterministic defaults apply', {
        workflow_run_id: deps.workflowRunId, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  };
}
