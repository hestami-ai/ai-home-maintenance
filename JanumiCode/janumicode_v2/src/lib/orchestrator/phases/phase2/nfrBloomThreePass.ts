/**
 * Phase 2.2 NFR Bloom — Wave 8 three-pass driver.
 * Mirrors frBloomThreePass: skeleton → self-heal → threshold enrichment → verifier.
 */

import { getLogger } from '../../../logging';
import type {
  ExtractedItem,
  ProductDescriptionHandoffContent,
  TechnicalConstraint,
  VVRequirement,
} from '../../../types/records';
import type { PhaseContext } from '../../orchestratorEngine';
import type { PhaseContextPacketResult } from '../dmrContext';
import {
  verifyNfrCoverage,
  type NfrCoverageVerifierResult,
  type NfrSkeleton,
  type UnreachedSeedDeclaration,
} from './verifyNfrCoverage';

export interface NfrBloomThreePassResult {
  nfrs: NfrSkeleton[];
  unreachedSeeds: UnreachedSeedDeclaration[];
  coverageGaps: NfrCoverageVerifierResult;
  selfHealDrops: string[];
}

interface FormatHelpers {
  formatExtractedItems: (items: ExtractedItem[]) => string;
  formatVVRequirements: (vvs: VVRequirement[]) => string;
  formatTechnicalConstraints: (tcs: TechnicalConstraint[]) => string;
}

export interface NfrBloomDeps {
  ctx: PhaseContext;
  handoff: ProductDescriptionHandoffContent;
  dmr: PhaseContextPacketResult;
  intentSummary: string;
  frSummary: string;
  acceptedFrIds: string[];
  format: FormatHelpers;
}

function parseSkeletonResponse(parsed: Record<string, unknown> | null): {
  nfrs: NfrSkeleton[];
  unreached: UnreachedSeedDeclaration[];
} {
  if (!parsed) return { nfrs: [], unreached: [] };
  const reqs =
    (parsed.requirements as NfrSkeleton[] | undefined) ??
    ((parsed.non_functional_requirements as Record<string, unknown> | undefined)
      ?.requirements as NfrSkeleton[] | undefined) ??
    [];
  const unreachedRaw = (parsed.unreached_seeds as unknown[] | undefined) ?? [];
  const unreached: UnreachedSeedDeclaration[] = [];
  for (const u of unreachedRaw) {
    if (!u || typeof u !== 'object') continue;
    const r = u as Record<string, unknown>;
    const seed_id = typeof r.seed_id === 'string' ? r.seed_id : null;
    const absorbed_into = typeof r.absorbed_into === 'string' ? r.absorbed_into : null;
    const reason = typeof r.reason === 'string' ? r.reason : '';
    if (seed_id && absorbed_into) unreached.push({ seed_id, absorbed_into, reason });
  }
  return { nfrs: Array.isArray(reqs) ? reqs : [], unreached };
}

function applyTracesSelfHeal(
  nfrs: NfrSkeleton[],
  handoff: ProductDescriptionHandoffContent,
  acceptedFrIds: string[],
): { cleaned: NfrSkeleton[]; drops: string[] } {
  const vvIds = new Set((handoff.vvRequirements ?? []).map(v => v.id));
  const techIds = new Set((handoff.technicalConstraints ?? []).map(t => t.id));
  const compIds = new Set((handoff.complianceExtractedItems ?? []).map(c => c.id));
  const journeyIds = new Set((handoff.userJourneys ?? []).map(j => j.id));
  const frIds = new Set(acceptedFrIds);
  const qaMax = (handoff.qualityAttributes ?? []).length;

  const drops: string[] = [];
  const cleaned = nfrs.map(n => {
    const keptTraces: string[] = [];
    for (const t of n.traces_to ?? []) {
      let ok = false;
      if (t.startsWith('US-')) ok = false;  // FR leakage — drop
      else if (t.startsWith('VV-')) ok = vvIds.has(t);
      else if (t.startsWith('TECH-')) ok = techIds.has(t);
      else if (t.startsWith('COMP-')) ok = compIds.has(t);
      else if (t.startsWith('UJ-')) ok = journeyIds.has(t);
      else if (t.startsWith('QA-')) {
        const idx = Number(t.slice(3));
        ok = Number.isInteger(idx) && idx >= 1 && idx <= qaMax;
      }
      if (ok) keptTraces.push(t);
      else drops.push(`${n.id}:traces_to:${t}`);
    }
    const keptApplies: string[] = [];
    for (const fid of n.applies_to_requirements ?? []) {
      if (frIds.has(fid)) keptApplies.push(fid);
      else drops.push(`${n.id}:applies_to_requirements:${fid}`);
    }
    return { ...n, traces_to: keptTraces, applies_to_requirements: keptApplies };
  });
  return { cleaned, drops };
}

function buildEnrichmentVariables(
  skeleton: NfrSkeleton,
  deps: NfrBloomDeps,
): Record<string, string> {
  const h = deps.handoff;
  const traced = new Set(skeleton.traces_to ?? []);
  const tracedVV = (h.vvRequirements ?? []).filter(v => traced.has(v.id));
  const tracedTech = (h.technicalConstraints ?? []).filter(t => traced.has(t.id));
  const tracedComp = (h.complianceExtractedItems ?? []).filter(c => traced.has(c.id));
  const qas = h.qualityAttributes ?? [];
  const tracedQA = (skeleton.traces_to ?? [])
    .filter(t => t.startsWith('QA-'))
    .map(t => {
      const idx = Number(t.slice(3));
      return Number.isInteger(idx) && idx >= 1 && idx <= qas.length
        ? `- ${t}: ${qas[idx - 1]}`
        : null;
    })
    .filter((x): x is string => x !== null);
  return {
    active_constraints: deps.dmr.activeConstraintsText,
    nfr_skeleton: JSON.stringify(skeleton, null, 2),
    traced_vv_requirements: deps.format.formatVVRequirements(tracedVV),
    traced_quality_attributes: tracedQA.length > 0 ? tracedQA.join('\n') : '(none)',
    traced_technical_constraints: deps.format.formatTechnicalConstraints(tracedTech),
    traced_compliance_items: deps.format.formatExtractedItems(tracedComp),
    detail_file_path: deps.dmr.detailFilePath,
    janumicode_version_sha: deps.ctx.engine.janumiCodeVersionSha,
  };
}

function parseEnrichmentResponse(
  parsed: Record<string, unknown> | null,
  skeleton: NfrSkeleton,
): NfrSkeleton {
  if (!parsed || typeof parsed !== 'object') return skeleton;
  const obj = parsed as Record<string, unknown>;
  const threshold = typeof obj.threshold === 'string' ? obj.threshold : '';
  const measurement_method = typeof obj.measurement_method === 'string' ? obj.measurement_method : '';
  if (!threshold || !measurement_method) return skeleton;
  const { ...rest } = skeleton;
  return { ...rest, threshold, measurement_method };
}

async function runSkeletonPass(deps: NfrBloomDeps): Promise<{
  nfrs: NfrSkeleton[];
  unreached: UnreachedSeedDeclaration[];
}> {
  const { ctx, handoff, dmr, intentSummary, frSummary } = deps;
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    '02_2_nonfunctional_requirements',
    'product',
  );
  if (!template) {
    getLogger().warn('workflow', 'Phase 2.2 skeleton template not found', {});
    return { nfrs: [], unreached: [] };
  }
  const variables: Record<string, string> = {
    active_constraints: dmr.activeConstraintsText,
    intent_statement_summary: intentSummary,
    functional_requirements_summary: frSummary,
    quality_attributes: (handoff.qualityAttributes ?? [])
      .map((q, i) => `- [QA-${i + 1}] ${q}`).join('\n') || '(none)',
    vv_requirements: deps.format.formatVVRequirements(handoff.vvRequirements ?? []),
    technical_constraints: deps.format.formatTechnicalConstraints(handoff.technicalConstraints ?? []),
    compliance_extracted_items: deps.format.formatExtractedItems(handoff.complianceExtractedItems ?? []),
    detail_file_path: dmr.detailFilePath,
    janumicode_version_sha: ctx.engine.janumiCodeVersionSha,
  };
  const rendered = ctx.engine.templateLoader.render(template, variables);
  if (rendered.missing_variables.length > 0) {
    getLogger().warn('workflow', 'Phase 2.2 skeleton: missing template variables', {
      missing: rendered.missing_variables,
    });
    return { nfrs: [], unreached: [] };
  }
  const result = await ctx.engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.5,
    traceContext: {
      workflowRunId: ctx.workflowRun.id,
      phaseId: '2',
      subPhaseId: '2.2',
      agentRole: 'requirements_agent',
      label: 'Phase 2.2 — NFR Skeleton Bloom (Pass 1 of 3)',
    },
  });
  return parseSkeletonResponse(result.parsed as Record<string, unknown> | null);
}

async function runEnrichmentPass(
  deps: NfrBloomDeps,
  skeletons: NfrSkeleton[],
): Promise<NfrSkeleton[]> {
  const { ctx } = deps;
  const template = ctx.engine.templateLoader.findTemplate(
    'requirements_agent',
    '02_2b_nonfunctional_requirements_threshold_enrichment',
    'product',
  );
  if (!template) {
    getLogger().warn('workflow', 'Phase 2.2b enrichment template not found — returning skeletons as-is', {});
    return skeletons;
  }
  // Semantic-aware retry: if the LLM returns content that doesn't parse
  // into a complete (threshold + measurement_method) pair (transient
  // model output failure, distinct from LLMCaller's transport-level
  // retries), re-call up to MAX_ATTEMPTS times. Sampling variance
  // typically rescues these. Fall back to the skeleton only after all
  // attempts exhausted — the Pass-3 verifier will then catch and block,
  // surfacing the affected NFR for human review.
  const MAX_ATTEMPTS = 3;
  const enriched: NfrSkeleton[] = [];
  for (const s of skeletons) {
    const variables = buildEnrichmentVariables(s, deps);
    const rendered = ctx.engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('workflow', 'Phase 2.2b: missing variables — keeping skeleton', {
        nfr_id: s.id, missing: rendered.missing_variables,
      });
      enriched.push(s);
      continue;
    }
    let final: NfrSkeleton = s;
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
            subPhaseId: '2.2b',
            agentRole: 'requirements_agent',
            label: `Phase 2.2b — NFR Threshold Enrichment (${s.id}) attempt ${attempt}/${MAX_ATTEMPTS}`,
          },
        });
        const candidate = parseEnrichmentResponse(result.parsed as Record<string, unknown> | null, s);
        // parseEnrichmentResponse returns the skeleton verbatim when the
        // LLM output lacked threshold/measurement_method. Detect that
        // and retry — the skeleton has empty threshold + measurement_method.
        if (candidate.threshold && candidate.measurement_method) {
          final = candidate;
          success = true;
          break;
        }
        getLogger().warn('workflow', `Phase 2.2b enrichment returned incomplete output — retrying`, {
          nfr_id: s.id, attempt, max_attempts: MAX_ATTEMPTS,
          missing: [
            ...(!candidate.threshold ? ['threshold'] : []),
            ...(!candidate.measurement_method ? ['measurement_method'] : []),
          ],
        });
      } catch (err) {
        getLogger().warn('workflow', `Phase 2.2b enrichment LLM call threw — retrying`, {
          nfr_id: s.id, attempt, max_attempts: MAX_ATTEMPTS, error: String(err),
        });
      }
    }
    if (!success) {
      getLogger().error('workflow', `Phase 2.2b enrichment exhausted ${MAX_ATTEMPTS} attempts — keeping skeleton (will be flagged by 2.2c verifier)`, {
        nfr_id: s.id,
      });
    }
    enriched.push(final);
  }
  return enriched;
}

export async function runNfrBloomThreePass(
  deps: NfrBloomDeps,
): Promise<NfrBloomThreePassResult> {
  const { nfrs: rawSkeletons, unreached } = await runSkeletonPass(deps);
  const { cleaned: skeletons, drops } = applyTracesSelfHeal(
    rawSkeletons, deps.handoff, deps.acceptedFrIds,
  );
  if (drops.length > 0) {
    getLogger().warn('workflow', 'Phase 2.2 self-heal: dropped invalid refs', {
      count: drops.length,
      sample: drops.slice(0, 20),
    });
  }
  const enriched = await runEnrichmentPass(deps, skeletons);
  const coverageGaps = verifyNfrCoverage({
    vvRequirements: deps.handoff.vvRequirements ?? [],
    qualityAttributesCount: (deps.handoff.qualityAttributes ?? []).length,
    technicalConstraints: deps.handoff.technicalConstraints ?? [],
    complianceItems: deps.handoff.complianceExtractedItems ?? [],
    journeys: deps.handoff.userJourneys ?? [],
    acceptedFrIds: deps.acceptedFrIds,
    nfrs: enriched,
    unreachedSeeds: unreached,
  });
  return {
    nfrs: enriched,
    unreachedSeeds: unreached,
    coverageGaps,
    selfHealDrops: drops,
  };
}
