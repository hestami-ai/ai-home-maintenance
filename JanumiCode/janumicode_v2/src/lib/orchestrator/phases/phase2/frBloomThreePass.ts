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
import { autoFlagDroppedJourneys } from './autoFlagDroppedJourneys';
import { chunkedCoverageBloom } from '../chunkedCoverageBloom';

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
    detail_file_content: deps.dmr.detailFileContent,
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
 * Run Pass 1 — skeleton bloom, fanned out PER JOURNEY (SD-5).
 *
 * The former monolithic single-call skeleton (one JSON enumerating every user
 * story across every accepted journey) overran gpt-oss:20b in cal-34: a
 * ~7K-char array truncated mid-stream, json_repair exhausted (qwen3.5 + gemma
 * both failed on the malformed 7K JSON), and the artifact fell back to an empty
 * roster — starving the whole functional pipeline. We now issue ONE focused
 * `fr_bloom_skeleton` call per accepted journey (a small, parseable US JSON
 * each) and let the shared `chunkedCoverageBloom` orchestrator own the
 * completeness guarantee: a journey that got neither a US nor a self-declared
 * `unreached` is reconciled in bounded per-journey retries, and any honest
 * residual is left to the downstream `autoFlagDroppedJourneys` backstop.
 *
 * Story ids are carried alongside a per-(journey, position) dedup KEY in
 * flight (so the helper's `idOf` dedup can't collapse a distinct story that
 * reused `US-001`), and the story's own `id` is left untouched. On merge, if
 * two journeys surfaced the SAME raw id, ALL stories are deterministically
 * renumbered to a global sequential `US-###`; when ids are already unique they
 * are preserved verbatim (matching the pre-SD-5 single-call behaviour that
 * downstream decomposition keys on). Renumbering happens BEFORE enrichment, so
 * the composite AC ids (`AC-US{nnn}-{mmm}`) mint off the final US id.
 * `traces_to` references journeys/entities/workflows (never other US ids), so
 * renumbering is safe. Returns the SAME `{ stories, unreached }` shape as the
 * old monolith, so `runFrBloomThreePass` and everything after it is unchanged.
 */
export async function runSkeletonPass(deps: FrBloomDeps): Promise<{
  stories: UserStorySkeleton[];
  unreached: UnreachedJourneyDeclaration[];
}> {
  const { ctx, handoff, dmr, intentSummary } = deps;
  const log = getLogger();
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    'fr_bloom_skeleton',
    'product',
  );
  if (!template) {
    log.warn('workflow', 'Phase 2.1: skeleton template not found', {});
    return { stories: [], unreached: [] };
  }

  const journeys = handoff.userJourneys ?? [];
  // The journey spine drives the fan-out. With zero accepted journeys there is
  // nothing to chunk — return empty honestly (the verifier then sees no journeys
  // to cover and no gaps); never fabricate.
  if (journeys.length === 0) return { stories: [], unreached: [] };

  const journeyById = new Map(journeys.map(j => [j.id, j]));

  // targetCoverageSet starts as every accepted journey id. A journey a
  // per-journey call self-declares `unreached` is a legitimate deferral, NOT an
  // uncovered gap — it is removed from this set in-flight. Fan-out is sequential
  // and completes before the helper reads this set for reconciliation/residual,
  // so mutating the shared reference during generation is consistent.
  const targetCoverageSet = new Set<string>(journeys.map(j => j.id));

  // Shared accumulator for every per-journey `unreached_journeys[]` declaration.
  const unreachedAll: UnreachedJourneyDeclaration[] = [];

  // One focused skeleton call scoped to a specific set of journeys. Renders the
  // shared template with `accepted_journeys` = ONLY the scoped journeys, parses
  // via parseSkeletonResponse, records any self-declared unreached, and returns
  // the parsed stories UN-namespaced (callers namespace by chunk).
  const callForJourneys = async (
    scoped: UserJourney[],
    label: string,
    reconciliationNote = '',
  ): Promise<{ stories: UserStorySkeleton[]; unreached: UnreachedJourneyDeclaration[] } | null> => {
    const variables: Record<string, string> = {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      product_vision: handoff.productVision ?? '',
      accepted_journeys: deps.format.formatJourneys(scoped),
      accepted_entities: deps.format.formatEntities(handoff.entityProposals ?? []),
      accepted_workflows: deps.format.formatWorkflows(handoff.workflowProposals ?? []),
      compliance_extracted_items: deps.format.formatExtractedItems(handoff.complianceExtractedItems ?? []),
      canonical_vocabulary: deps.format.formatVocabulary(handoff.canonicalVocabulary ?? []),
      open_questions: deps.format.formatExtractedItems(handoff.openQuestions ?? []),
      detail_file_path: dmr.detailFilePath,
      detail_file_content: dmr.detailFileContent,
      janumicode_version_sha: ctx.engine.janumiCodeVersionSha,
    };
    const rendered = ctx.engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) {
      log.warn('workflow', 'Phase 2.1 skeleton: missing template variables', {
        missing: rendered.missing_variables, scope: scoped.map(j => j.id),
      });
      return null;
    }
    // A reconciliation retry MUST differ from the generation prompt for the same
    // journey — otherwise the llmCaller prompt-cache returns the identical (empty)
    // result and the retry is a no-op. The focused directive both busts the cache
    // and re-orients the model on the specific coverage miss.
    const prompt = reconciliationNote
      ? `${reconciliationNote}\n\n${rendered.rendered}`
      : rendered.rendered;
    const result = await ctx.engine.callForRole('requirements_agent', {
      prompt,
      responseFormat: 'json',
      temperature: 0.5,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '2',
        subPhaseId: 'fr_bloom_skeleton',
        agentRole: 'requirements_agent',
        label,
      },
    });
    const parsed = parseSkeletonResponse(result.parsed as Record<string, unknown> | null);
    for (const u of parsed.unreached) {
      unreachedAll.push(u);
      targetCoverageSet.delete(u.journey_id); // legitimate deferral — not a gap
    }
    return parsed;
  };

  const maxReconPasses = Math.max(
    0,
    Number.parseInt(process.env.JANUMICODE_P2_FR_RECON_PASSES ?? '1', 10) || 0,
  );

  const rawId = (s: UserStorySkeleton): string => (typeof s.id === 'string' ? s.id : '');

  // The helper dedups on `idOf`. Two journeys each restart their US numbering at
  // US-001, so we carry a per-(scope, position) dedup KEY distinct from the
  // story's own id — otherwise the helper would drop the second US-001 as a
  // duplicate. The story id itself is preserved for the merge-time renumber.
  interface ProducedStory { story: UserStorySkeleton; key: string }

  const generateForChunk = async (journey: UserJourney, index: number): Promise<ProducedStory[]> => {
    try {
      const parsed = await callForJourneys(
        [journey],
        `Phase 2.1 — FR Skeleton Bloom (journey ${journey.id}, ${index + 1}/${journeys.length})`,
      );
      if (!parsed) return [];
      return parsed.stories.map((story, k) => ({ story, key: `c${index}:${k}:${rawId(story)}` }));
    } catch (err) {
      log.warn('workflow', 'Phase 2.1 per-journey skeleton generation failed — continuing', {
        journey_id: journey.id, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  };

  // One journey per reconciliation call — keeps each retry JSON small (the whole
  // point of per-journey chunking); never a monolithic recon response.
  const chunkUncovered = (uncovered: Set<string>): Array<Set<string>> =>
    [...uncovered].sort((a, b) => a.localeCompare(b)).map(id => new Set<string>([id]));

  const reconcileBatch = async (
    batch: Set<string>,
    passInfo: { pass: number; batchIndex: number; batchCount: number },
  ): Promise<ProducedStory[]> => {
    const scoped = [...batch].sort((a, b) => a.localeCompare(b))
      .map(id => journeyById.get(id))
      .filter((j): j is UserJourney => !!j);
    if (scoped.length === 0) return [];
    const reconciliationNote =
      'COVERAGE RECONCILIATION — FOCUS: A prior pass produced NO functional requirement for the '
      + 'user journey shown below and did NOT declare it unreached. Produce at least one FR that seeds '
      + 'it now (role/action/outcome + traces_to including its UJ- id + one seed acceptance criterion), '
      + 'OR, if it is genuinely covered by a sibling journey or has no behavioural content, declare it in '
      + 'unreached_journeys[] with a reason. Do not restate any other journey.';
    try {
      const parsed = await callForJourneys(
        scoped,
        `Phase 2.1 — FR Skeleton Reconciliation (pass ${passInfo.pass}, batch ${passInfo.batchIndex}/${passInfo.batchCount})`,
        reconciliationNote,
      );
      if (!parsed) return [];
      return parsed.stories.map((story, k) => ({
        story, key: `r${passInfo.pass}:${passInfo.batchIndex}:${k}:${rawId(story)}`,
      }));
    } catch (err) {
      log.warn('workflow', 'Phase 2.1 skeleton reconciliation batch failed — continuing', {
        pass: passInfo.pass, batch_index: passInfo.batchIndex,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  };

  const bloom = await chunkedCoverageBloom<UserJourney, ProducedStory>({
    chunks: journeys,
    generateForChunk,
    idOf: (p) => p.key,
    targetCoverageSet,
    coveredBy: (p) => (p.story.traces_to ?? []).filter(t => typeof t === 'string' && t.startsWith('UJ-')),
    chunkUncovered,
    reconcileBatch,
    maxReconPasses,
    onResidual: (residual) => {
      log.warn(
        'workflow',
        'Phase 2.1 residual uncovered journeys after skeleton reconciliation (honest gap — downstream autoFlagDroppedJourneys declares these unreached)',
        { residual: residual.size, sample: [...residual].sort((a, b) => a.localeCompare(b)).slice(0, 20) },
      );
    },
    logLabel: 'Phase 2.1',
  });

  const merged = bloom.produced.map(p => p.story);

  // Guarantee globally-unique US ids. Two journeys each restart at US-001, so a
  // raw-id collision across the merged set is the norm in real runs — when it
  // happens, deterministically renumber ALL stories to sequential US-###. When
  // the merged ids are already unique, preserve them verbatim (keeps single-call
  // / single-journey ids stable for downstream decomposition). traces_to is
  // untouched (references UJ-/ENT-/WF-/COMP-/…, never US ids).
  const rawIds = merged.map(rawId);
  const hasCollision = new Set(rawIds).size !== rawIds.length;
  const stories: UserStorySkeleton[] = hasCollision
    ? merged.map((s, i) => ({ ...s, id: `US-${String(i + 1).padStart(3, '0')}` }))
    : merged;

  // Dedup unreached declarations by journey_id (keep the first reason).
  const seenUnreached = new Set<string>();
  const unreached: UnreachedJourneyDeclaration[] = [];
  for (const u of unreachedAll) {
    if (seenUnreached.has(u.journey_id)) continue;
    seenUnreached.add(u.journey_id);
    unreached.push(u);
  }

  return { stories, unreached };
}

/** Run Pass 2 — per-FR AC enrichment. Runs sequentially to respect model concurrency. */
async function runEnrichmentPass(
  deps: FrBloomDeps,
  skeletons: UserStorySkeleton[],
): Promise<FullUserStory[]> {
  const { ctx } = deps;
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    'fr_bloom_enrichment',
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
            subPhaseId: 'fr_bloom_enrichment',
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
  // Enumeration-discipline backstop: auto-declare any accepted journey the FR
  // bloom neither traced nor declared unreached (mirrors autoFlagDroppedSeeds
  // for the NFR side). Small models (gpt-oss:20b) drop a journey from coverage
  // without declaring it, which hard-fails journey_fr_coverage at 2.1c.
  const journeyFlag = autoFlagDroppedJourneys({
    journeys: deps.handoff.userJourneys ?? [],
    userStories: enriched,
    unreachedJourneys: unreached,
  });
  if (journeyFlag.autoFlagged.length > 0) {
    getLogger().warn('workflow', `Phase 2.1: auto-flagged ${journeyFlag.autoFlagged.length} journey(s) the FR bloom neither traced nor declared unreached`, {
      journeys: journeyFlag.autoFlagged.map(u => u.journey_id),
    });
  }
  // Pass 3 — deterministic verifier.
  const coverageGaps = verifyFrCoverage({
    journeys: deps.handoff.userJourneys ?? [],
    entities: deps.handoff.entityProposals ?? [],
    workflows: deps.handoff.workflowProposals ?? [],
    complianceItems: deps.handoff.complianceExtractedItems ?? [],
    vocabulary: deps.handoff.canonicalVocabulary ?? [],
    openQuestionIds: (deps.handoff.openQuestions ?? []).map(q => q.id),
    userStories: enriched,
    unreachedJourneys: journeyFlag.unreachedJourneys,
  });
  return {
    userStories: enriched,
    unreachedJourneys: journeyFlag.unreachedJourneys,
    coverageGaps,
    selfHealDrops: drops,
  };
}
