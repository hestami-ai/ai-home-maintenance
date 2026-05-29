/**
 * Downstream-phase scope gatekeeper helper.
 *
 * Replicates the Phase 1 pattern (`Phase1Handler.runScopeGatekeeperForBloom`
 * + `collectGatekeeperUpstreamContext`) for downstream phases (2.1, 2.2,
 * 4.2, 6.1, 7.1) so each bloom output gets the same LLM-backed prune
 * before downstream consumers see it. Each call writes a
 * `scope_prune_decision` audit record and supersedes the original
 * artifact with the pruned version when items were dropped.
 *
 * The shared upstream-context builder pulls **all** prior-phase
 * accepted sets (Phase 1.0a–f + 1.2–1.5 + 2.1 + 2.2 + 4.2) so a Phase 7
 * gatekeeper, for example, sees the same picture a human reviewer would:
 * the spec-grounded extractions plus everything that's already passed
 * a gatekeeper pass upstream.
 *
 * Configured to be ALWAYS-ON in production (same `JANUMICODE_SCOPE_GATEKEEPER`
 * switch as Phase 1). Iteration runs that need to disable can still set
 * `=off`. Per-phase opt-out isn't supported — if you need to bypass for
 * a single phase, set the env var.
 */

import type { PhaseContext } from '../orchestratorEngine';
import {
  runScopeGatekeeperPrune,
  type BloomItemForPrune,
  type GatekeeperUpstreamContext,
} from '../scopeGatekeeper';
import type { PhaseId, ScopePruneDecisionContent } from '../../types/records';
import { getLogger } from '../../logging';

export interface DownstreamGatekeeperRequest {
  phaseId: PhaseId;
  subPhaseId: string;
  bloomDescription: string;
  items: BloomItemForPrune[];
  originalArtifactId: string;
  /**
   * Optional sub-phase-specific overlay added to the base gatekeeper
   * prompt. Use for guidance about the artifact shape that's being
   * pruned (e.g., "drop user stories that describe Out-of-Scope
   * behavior even when their `traces_to` cites an accepted journey").
   */
  overlay?: string;
}

export interface DownstreamGatekeeperOutcome {
  kept_ids: string[];
  dropped: Array<{ id: string; reason: string }>;
  rationale_summary: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Run the scope gatekeeper for a downstream bloom artifact.
 *
 * Returns `{ skipped: true }` when the env switch disables the
 * gatekeeper or when the items list is empty (nothing to prune). The
 * caller should treat skipped as "keep all" — don't supersede the
 * artifact in that case.
 */
export async function runDownstreamScopeGatekeeper(
  ctx: PhaseContext,
  req: DownstreamGatekeeperRequest,
): Promise<DownstreamGatekeeperOutcome> {
  const { engine, workflowRun } = ctx;
  const enabled = (process.env.JANUMICODE_SCOPE_GATEKEEPER ?? 'on') !== 'off';
  if (!enabled) return { kept_ids: req.items.map(i => i.id), dropped: [], rationale_summary: 'gatekeeper disabled by env', skipped: true };
  if (req.items.length === 0) {
    return { kept_ids: [], dropped: [], rationale_summary: 'no items to prune', skipped: true };
  }

  const upstream = collectDownstreamGatekeeperUpstreamContext(ctx);

  const diRoute = engine.configManager.getRoutingModel('domain_interpreter');
  const result = await runScopeGatekeeperPrune(
    engine.llmCaller,
    { provider: diRoute.provider, model: diRoute.model, baseUrl: diRoute.baseUrl },
    {
      workflowRunId: workflowRun.id,
      phaseId: req.phaseId,
      subPhaseId: req.subPhaseId,
      bloomDescription: req.bloomDescription,
      items: req.items,
      upstreamContext: upstream,
      agentRole: 'domain_interpreter',
      overlay: req.overlay,
    },
  );

  // Audit record — emit even on no-op so the run history shows the
  // gatekeeper was consulted at every supported boundary.
  const auditContent: ScopePruneDecisionContent = {
    kind: 'scope_prune_decision',
    schemaVersion: '1.0',
    sub_phase_id: req.subPhaseId,
    original_artifact_id: req.originalArtifactId,
    pruned_artifact_id: '',  // caller fixes up after the pruned write
    kept_ids: result.kept_ids,
    dropped: result.dropped.map((d) => {
      const orig = req.items.find((it) => it.id === d.id);
      return { id: d.id, label: orig?.label, reason: d.reason };
    }),
    rationale_summary: result.rationale_summary,
    gatekeeper_provider: result.provider,
    gatekeeper_model: result.model,
    duration_ms: result.duration_ms,
  };
  engine.writer.writeRecord({
    record_type: 'scope_prune_decision',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: req.phaseId,
    sub_phase_id: req.subPhaseId,
    produced_by_agent_role: 'domain_interpreter',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [req.originalArtifactId],
    content: auditContent as unknown as Record<string, unknown>,
  });

  getLogger().info('workflow', 'Downstream scope gatekeeper prune complete', {
    workflow_run_id: workflowRun.id,
    sub_phase_id: req.subPhaseId,
    items_in: req.items.length,
    kept: result.kept_ids.length,
    dropped: result.dropped.length,
    duration_ms: result.duration_ms,
  });

  return {
    kept_ids: result.kept_ids,
    dropped: result.dropped,
    rationale_summary: result.rationale_summary,
    error: result.error,
  };
}

/**
 * Build the upstream-context object from the governed stream. Mirrors
 * `Phase1Handler.collectGatekeeperUpstreamContext` plus the Phase 2/4
 * accepted sets (post-gatekeeper) so downstream phases see the full
 * authoritative cumulative view.
 */
function collectDownstreamGatekeeperUpstreamContext(ctx: PhaseContext): GatekeeperUpstreamContext {
  const { engine, workflowRun } = ctx;
  const all = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
  const byKind = new Map<string, Record<string, unknown>>();
  for (const r of all) {
    if (!r.is_current_version) continue;
    const c = r.content as Record<string, unknown>;
    const kind = typeof c.kind === 'string' ? c.kind : undefined;
    if (kind) byKind.set(kind, c);
  }
  const id = byKind.get('intent_discovery');
  const tcd = byKind.get('technical_constraints_discovery');
  const crd = byKind.get('compliance_retention_discovery');
  const vvd = byKind.get('vv_requirements_discovery');
  const sc = byKind.get('scope_classification');
  const bdb = byKind.get('business_domains_bloom');
  const ujb = byKind.get('user_journey_bloom');
  const swb = byKind.get('system_workflow_bloom');
  const eb  = byKind.get('entities_bloom');
  const fr  = byKind.get('functional_requirements');
  const nfr = byKind.get('non_functional_requirements');
  const cm  = byKind.get('component_model');

  return {
    analysisSummary: typeof id?.analysisSummary === 'string' ? id.analysisSummary as string : undefined,
    intentConstraints: asTextArray(id?.constraints),
    intentRequirements: asTextArray(id?.requirements),
    intentOpenQuestions: asTextArray(id?.openQuestions),
    technicalConstraints: asTextArray(tcd?.technicalConstraints),
    complianceItems: asTextArray(crd?.complianceExtractedItems),
    vvRequirements: Array.isArray(vvd?.vvRequirements)
      ? (vvd.vvRequirements as Array<Record<string, unknown>>).map(v => ({
          id: typeof v.id === 'string' ? v.id : undefined,
          target: typeof v.target === 'string' ? v.target : undefined,
          threshold: typeof v.threshold === 'string' ? v.threshold : undefined,
        }))
      : undefined,
    scopeClassification: sc ? { breadth: sc.breadth as string, depth: sc.depth as string } : undefined,
    acceptedDomains: asIdNameArray(bdb?.domains),
    acceptedPersonas: asIdNameArray(bdb?.personas),
    acceptedJourneys: Array.isArray(ujb?.userJourneys)
      ? (ujb.userJourneys as Array<Record<string, unknown>>).map(j => ({
          id: String(j.id),
          title: String(j.title ?? j.name ?? ''),
          personaId: typeof j.personaId === 'string' ? j.personaId : (typeof j.persona_id === 'string' ? j.persona_id : undefined),
        }))
      : undefined,
    acceptedWorkflows: Array.isArray(swb?.workflows)
      ? (swb.workflows as Array<Record<string, unknown>>).map(w => ({
          id: String(w.id),
          name: String(w.name ?? ''),
          businessDomainId: typeof w.businessDomainId === 'string' ? w.businessDomainId : (typeof w.business_domain_id === 'string' ? w.business_domain_id : undefined),
        }))
      : undefined,
    acceptedEntities: Array.isArray(eb?.entities)
      ? (eb.entities as Array<Record<string, unknown>>).map(e => ({
          id: String(e.id),
          name: String(e.name ?? ''),
          businessDomainId: typeof e.businessDomainId === 'string' ? e.businessDomainId : (typeof e.business_domain_id === 'string' ? e.business_domain_id : undefined),
        }))
      : undefined,
    acceptedUserStories: Array.isArray(fr?.user_stories)
      ? (fr.user_stories as Array<Record<string, unknown>>).map(s => ({
          id: String(s.id),
          action: String(s.action ?? ''),
          role: typeof s.role === 'string' ? s.role : undefined,
          outcome: typeof s.outcome === 'string' ? s.outcome : undefined,
        }))
      : undefined,
    acceptedNfrs: Array.isArray(nfr?.requirements)
      ? (nfr.requirements as Array<Record<string, unknown>>).map(n => ({
          id: String(n.id),
          category: typeof n.category === 'string' ? n.category : undefined,
          description: typeof n.description === 'string' ? n.description : undefined,
          threshold: typeof n.threshold === 'string' ? n.threshold : undefined,
        }))
      : undefined,
    acceptedComponents: Array.isArray(cm?.components)
      ? (cm.components as Array<Record<string, unknown>>).map(c => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          domain_id: typeof c.domain_id === 'string' ? c.domain_id : (typeof c.domainId === 'string' ? c.domainId : undefined),
        }))
      : undefined,
  };
}

function asTextArray(v: unknown): Array<{ id?: string; text: string; type?: string }> | undefined {
  if (!Array.isArray(v)) return undefined;
  return (v as Array<Record<string, unknown>>).map(it => ({
    id: typeof it.id === 'string' ? it.id : undefined,
    text: typeof it.text === 'string' ? it.text : (typeof it.description === 'string' ? it.description : ''),
    type: typeof it.type === 'string' ? it.type : undefined,
  }));
}

function asIdNameArray(v: unknown): Array<{ id: string; name: string; description?: string }> | undefined {
  if (!Array.isArray(v)) return undefined;
  return (v as Array<Record<string, unknown>>).map(it => ({
    id: String(it.id),
    name: String(it.name ?? ''),
    description: typeof it.description === 'string' ? it.description : undefined,
  }));
}
