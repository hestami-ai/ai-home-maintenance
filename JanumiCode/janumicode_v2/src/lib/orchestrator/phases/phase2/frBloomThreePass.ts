/**
 * Phase 2.1 Functional-Requirements Bloom — Wave 8 three-pass driver.
 *
 *   Pass 1 (skeleton bloom): LLM emits `{id, role, action, outcome,
 *     priority, traces_to}` + ONE seed AC per FR, plus
 *     `unreached_journeys[]`. Narrow output contract keeps small-model
 *     attention focused on coverage instead of AC authoring.
 *   (self-heal): drop any `traces_to` id that doesn't resolve to an
 *     accepted upstream artifact; emit a single aggregated WARN so drift
 *     is visible without flooding the stream.
 *   Pass 2 (AC enrichment): per-FR LLM call that takes the skeleton +
 *     the traced upstream context and produces the full
 *     `acceptance_criteria[]` with measurable conditions.
 *   Pass 3 (verifier): deterministic `verifyFrCoverage` checks coverage
 *     + referential integrity + AC presence. Gaps are returned to the
 *     caller so phase2.ts can persist them and block on severity.
 */

import { getLogger } from '../../../logging';
import type {
  Entity,
  ExtractedItem,
  ProductDescriptionHandoffContent,
  UserJourney,
  VocabularyTerm,
  WorkflowV2,
} from '../../../types/records';
import type { PhaseContext } from '../../orchestratorEngine';
import type { PhaseContextPacketResult } from '../dmrContext';
import {
  verifyFrCoverage,
  type FrCoverageVerifierResult,
  type UnreachedJourneyDeclaration,
  type UserStorySkeleton,
} from './verifyFrCoverage';

export interface FrBloomThreePassResult {
  userStories: FullUserStory[];
  unreachedJourneys: UnreachedJourneyDeclaration[];
  coverageGaps: FrCoverageVerifierResult;
  selfHealDrops: string[];
}

export interface FullUserStory extends UserStorySkeleton {}

/** Format helpers — re-export shapes the enrichment prompt consumes. */
interface FormatHelpers {
  formatJourneys: (js: UserJourney[]) => string;
  formatEntities: (es: Entity[]) => string;
  formatWorkflows: (ws: WorkflowV2[]) => string;
  formatExtractedItems: (items: ExtractedItem[]) => string;
  formatVocabulary: (terms: VocabularyTerm[]) => string;
}

export interface FrBloomDeps {
  ctx: PhaseContext;
  handoff: ProductDescriptionHandoffContent;
  dmr: PhaseContextPacketResult;
  intentSummary: string;
  format: FormatHelpers;
}

/**
 * Parse the Pass-1 skeleton response, accepting both `{user_stories,
 * unreached_journeys}` and a wrapped `{functional_requirements: …}` form
 * for resilience against LLM wrapper drift.
 */
function parseSkeletonResponse(parsed: Record<string, unknown> | null): {
  stories: UserStorySkeleton[];
  unreached: UnreachedJourneyDeclaration[];
} {
  if (!parsed) return { stories: [], unreached: [] };
  const fr = parsed.functional_requirements;
  const stories =
    (parsed.user_stories as UserStorySkeleton[] | undefined) ??
    (Array.isArray(fr)
      ? (fr[0] as Record<string, unknown>)?.user_stories as UserStorySkeleton[] | undefined
      : (fr as Record<string, unknown>)?.user_stories as UserStorySkeleton[] | undefined) ??
    [];
  const unreachedRaw =
    (parsed.unreached_journeys as unknown[] | undefined) ??
    (Array.isArray(fr)
      ? ((fr[0] as Record<string, unknown>)?.unreached_journeys as unknown[] | undefined)
      : (fr as Record<string, unknown>)?.unreached_journeys as unknown[] | undefined) ??
    [];
  const unreached: UnreachedJourneyDeclaration[] = [];
  for (const u of unreachedRaw) {
    if (!u || typeof u !== 'object') continue;
    const rec = u as Record<string, unknown>;
    const jid = typeof rec.journey_id === 'string' ? rec.journey_id : null;
    const reason = typeof rec.reason === 'string' ? rec.reason : '';
    if (jid) unreached.push({ journey_id: jid, reason });
  }
  return { stories: Array.isArray(stories) ? stories : [], unreached };
}

/**
 * Self-heal: remove any `traces_to` id that doesn't resolve to an
 * accepted upstream artifact. Returns the cleaned stories plus a list
 * of `storyId:badRef` strings the caller can log / persist.
 */
function applyTracesSelfHeal(
  stories: UserStorySkeleton[],
  handoff: ProductDescriptionHandoffContent,
): { cleaned: UserStorySkeleton[]; drops: string[] } {
  const journeyIds = new Set((handoff.userJourneys ?? []).map(j => j.id));
  const entityIds = new Set((handoff.entityProposals ?? []).map(e => e.id));
  const workflowIds = new Set((handoff.workflowProposals ?? []).map(w => w.id));
  const complianceIds = new Set((handoff.complianceExtractedItems ?? []).map(c => c.id));
  const vocabIds = new Set((handoff.canonicalVocabulary ?? []).map(v => v.id));
  const openQIds = new Set((handoff.openQuestions ?? []).map(q => q.id));

  const drops: string[] = [];
  const cleaned = stories.map(s => {
    const kept: string[] = [];
    for (const t of s.traces_to ?? []) {
      let ok = false;
      if (t.startsWith('UJ-')) ok = journeyIds.has(t);
      else if (t.startsWith('ENT-')) ok = entityIds.has(t);
      else if (t.startsWith('WF-')) ok = workflowIds.has(t);
      else if (t.startsWith('COMP-')) ok = complianceIds.has(t);
      else if (t.startsWith('VOC-')) ok = vocabIds.has(t);
      else if (t.startsWith('OPEN-') || t.startsWith('Q-')) ok = openQIds.has(t);
      // Unknown prefix → drop.
      if (ok) kept.push(t);
      else drops.push(`${s.id}:${t}`);
    }
    return { ...s, traces_to: kept };
  });
  return { cleaned, drops };
}

/** Build enrichment-prompt inputs for a single FR by resolving its traces. */
function buildEnrichmentVariables(
  skeleton: UserStorySkeleton,
  deps: FrBloomDeps,
): Record<string, string> {
  const h = deps.handoff;
  const traced = new Set(skeleton.traces_to ?? []);
  const tracedJourneys = (h.userJourneys ?? []).filter(j => traced.has(j.id));
  const tracedEntities = (h.entityProposals ?? []).filter(e => traced.has(e.id));
  const tracedWorkflows = (h.workflowProposals ?? []).filter(w => traced.has(w.id));
  const tracedCompliance = (h.complianceExtractedItems ?? []).filter(c => traced.has(c.id));

  return {
    active_constraints: deps.dmr.activeConstraintsText,
    fr_skeleton: JSON.stringify(skeleton, null, 2),
    traced_journeys: deps.format.formatJourneys(tracedJourneys),
    traced_entities: deps.format.formatEntities(tracedEntities),
    traced_workflows: deps.format.formatWorkflows(tracedWorkflows),
    traced_compliance_items: deps.format.formatExtractedItems(tracedCompliance),
    canonical_vocabulary: deps.format.formatVocabulary(h.canonicalVocabulary ?? []),
    detail_file_path: deps.dmr.detailFilePath,
    janumicode_version_sha: deps.ctx.engine.janumiCodeVersionSha,
  };
}

function parseEnrichmentResponse(
  parsed: Record<string, unknown> | null,
  skeleton: UserStorySkeleton,
): FullUserStory {
  if (!parsed || typeof parsed !== 'object') return skeleton;
  // Enrichment prompt returns the single FR with full acceptance_criteria.
  // Accept either the bare object or a wrapper { user_story: … }.
  const obj = (parsed.user_story as Record<string, unknown> | undefined) ?? parsed;
  const acs = obj.acceptance_criteria;
  if (!Array.isArray(acs) || acs.length === 0) return skeleton;
  const cleaned: FullUserStory['acceptance_criteria'] = [];
  for (const ac of acs) {
    if (!ac || typeof ac !== 'object') continue;
    const r = ac as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : `AC-${cleaned.length + 1}`;
    const description = typeof r.description === 'string' ? r.description : '';
    const measurable_condition = typeof r.measurable_condition === 'string' ? r.measurable_condition : '';
    if (!measurable_condition) continue;
    cleaned.push({ id, description, measurable_condition });
  }
  if (cleaned.length === 0) return skeleton;
  return { ...skeleton, acceptance_criteria: cleaned };
}

/**
 * Run Pass 1 — skeleton bloom. Uses the product-lens
 * `02_1_functional_requirements` template (now schema_version 2.0 with
 * narrow output contract).
 */
async function runSkeletonPass(deps: FrBloomDeps): Promise<{
  stories: UserStorySkeleton[];
  unreached: UnreachedJourneyDeclaration[];
}> {
  const { ctx, handoff, dmr, intentSummary } = deps;
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    '02_1_functional_requirements',
    'product',
  );
  if (!template) {
    getLogger().warn('workflow', 'Phase 2.1: skeleton template not found', {});
    return { stories: [], unreached: [] };
  }
  const variables: Record<string, string> = {
    active_constraints: dmr.activeConstraintsText,
    intent_statement_summary: intentSummary,
    product_vision: handoff.productVision ?? '',
    accepted_journeys: deps.format.formatJourneys(handoff.userJourneys ?? []),
    accepted_entities: deps.format.formatEntities(handoff.entityProposals ?? []),
    accepted_workflows: deps.format.formatWorkflows(handoff.workflowProposals ?? []),
    compliance_extracted_items: deps.format.formatExtractedItems(handoff.complianceExtractedItems ?? []),
    canonical_vocabulary: deps.format.formatVocabulary(handoff.canonicalVocabulary ?? []),
    open_questions: deps.format.formatExtractedItems(handoff.openQuestions ?? []),
    detail_file_path: dmr.detailFilePath,
    janumicode_version_sha: ctx.engine.janumiCodeVersionSha,
  };
  const rendered = ctx.engine.templateLoader.render(template, variables);
  if (rendered.missing_variables.length > 0) {
    getLogger().warn('workflow', 'Phase 2.1 skeleton: missing template variables', {
      missing: rendered.missing_variables,
    });
    return { stories: [], unreached: [] };
  }
  const result = await ctx.engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.5,
    traceContext: {
      workflowRunId: ctx.workflowRun.id,
      phaseId: '2',
      subPhaseId: '2.1',
      agentRole: 'requirements_agent',
      label: 'Phase 2.1 — FR Skeleton Bloom (Pass 1 of 3)',
    },
  });
  return parseSkeletonResponse(result.parsed as Record<string, unknown> | null);
}

/** Run Pass 2 — per-FR AC enrichment. Runs sequentially to respect model concurrency. */
async function runEnrichmentPass(
  deps: FrBloomDeps,
  skeletons: UserStorySkeleton[],
): Promise<FullUserStory[]> {
  const { ctx } = deps;
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    '02_1b_functional_requirements_ac_enrichment',
    'product',
  );
  if (!template) {
    getLogger().warn('workflow', 'Phase 2.1b enrichment template not found — returning skeletons as-is', {});
    return skeletons;
  }
  // Semantic-aware retry: if the LLM call succeeds but returns content
  // that doesn't parse into a complete acceptance_criteria[] (transient
  // model output failure, distinct from the LLMCaller's transport-level
  // retries), re-call up to MAX_ATTEMPTS times. Sampling variance
  // typically rescues these. Falls back to the bare skeleton only after
  // all attempts exhausted — the Pass-3 verifier will then catch and
  // block, surfacing the affected FR for human review.
  const MAX_ATTEMPTS = 3;
  const enriched: FullUserStory[] = [];
  for (const s of skeletons) {
    const variables = buildEnrichmentVariables(s, deps);
    const rendered = ctx.engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('workflow', 'Phase 2.1b enrichment: missing variables — keeping skeleton as-is', {
        fr_id: s.id,
        missing: rendered.missing_variables,
      });
      enriched.push(s);
      continue;
    }
    let final: FullUserStory = s;
    let success = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await ctx.engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '2',
            subPhaseId: '2.1b',
            agentRole: 'requirements_agent',
            label: `Phase 2.1b — FR AC Enrichment (${s.id}) attempt ${attempt}/${MAX_ATTEMPTS}`,
          },
        });
        const candidate = parseEnrichmentResponse(result.parsed as Record<string, unknown> | null, s);
        // parseEnrichmentResponse returns the skeleton verbatim on parse
        // failure. The skeleton has exactly ONE seed AC from Pass 1; an
        // enriched output should carry the seed plus additional
        // measurable ACs. Treat "same array length as skeleton with
        // identical first AC measurable_condition" as a parse miss.
        const enrichedOk = candidate.acceptance_criteria.length > s.acceptance_criteria.length
          || (candidate.acceptance_criteria[0]?.measurable_condition !== s.acceptance_criteria[0]?.measurable_condition);
        if (enrichedOk) {
          final = candidate;
          success = true;
          break;
        }
        getLogger().warn('workflow', `Phase 2.1b enrichment returned skeleton-shaped output — retrying`, {
          fr_id: s.id, attempt, max_attempts: MAX_ATTEMPTS,
        });
      } catch (err) {
        getLogger().warn('workflow', `Phase 2.1b enrichment LLM call threw — retrying`, {
          fr_id: s.id, attempt, max_attempts: MAX_ATTEMPTS, error: String(err),
        });
      }
    }
    if (!success) {
      getLogger().error('workflow', `Phase 2.1b enrichment exhausted ${MAX_ATTEMPTS} attempts — keeping skeleton (will be flagged by 2.1c verifier)`, {
        fr_id: s.id,
      });
    }
    enriched.push(final);
  }
  return enriched;
}

/**
 * Run the full three-pass FR bloom. Returns enriched user stories plus
 * `unreachedJourneys[]` and `coverageGaps[]` so the caller decides how
 * to handle blocking vs advisory severity.
 */
export async function runFrBloomThreePass(
  deps: FrBloomDeps,
): Promise<FrBloomThreePassResult> {
  // Pass 1 — skeleton.
  const { stories: rawSkeletons, unreached } = await runSkeletonPass(deps);
  // Self-heal traces_to.
  const { cleaned: skeletons, drops } = applyTracesSelfHeal(rawSkeletons, deps.handoff);
  if (drops.length > 0) {
    getLogger().warn('workflow', 'Phase 2.1 self-heal: dropped invalid traces_to refs', {
      count: drops.length,
      sample: drops.slice(0, 20),
    });
  }
  // Pass 2 — per-FR AC enrichment.
  const enriched = await runEnrichmentPass(deps, skeletons);
  // Pass 3 — deterministic verifier.
  const coverageGaps = verifyFrCoverage({
    journeys: deps.handoff.userJourneys ?? [],
    entities: deps.handoff.entityProposals ?? [],
    workflows: deps.handoff.workflowProposals ?? [],
    complianceItems: deps.handoff.complianceExtractedItems ?? [],
    vocabulary: deps.handoff.canonicalVocabulary ?? [],
    openQuestionIds: (deps.handoff.openQuestions ?? []).map(q => q.id),
    userStories: enriched,
    unreachedJourneys: unreached,
  });
  return {
    userStories: enriched,
    unreachedJourneys: unreached,
    coverageGaps,
    selfHealDrops: drops,
  };
}
