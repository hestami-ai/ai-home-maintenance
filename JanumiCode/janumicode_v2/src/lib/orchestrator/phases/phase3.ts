/**
 * Phase 3 — System Specification.
 * Based on JanumiCode Spec v2.3, §4 Phase 3.
 *
 * Sub-phases:
 *   3.1 — System Boundary Definition (Systems Agent LLM call)
 *   3.2 — System Requirements Derivation (Systems Agent LLM call)
 *   3.3 — Interface Contract Specification (Systems Agent LLM call)
 *   3.4 — System Specification Mirror and Menu (human review)
 *   3.5 — Consistency Check and Approval (phase gate)
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord, PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveFrView, getFrozenFrLeaves } from './phaseContext';
import { displayCapability } from './summaryFormat';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray, pickEnvelope } from '../parsedResponseHelpers';
import { chunkedCoverageBloom } from './chunkedCoverageBloom';
import { emit as aoddEmit } from '../../aodd';

// ── Artifact shape interfaces ──────────────────────────────────────

interface ExternalSystem {
  id: string;
  name: string;
  purpose: string;
  interface_type: string;
}

interface SystemBoundary {
  in_scope: string[];
  /**
   * True scope decisions (e.g. "Tenant payment processing — deferred
   * to Phase 2"). Items that read like unresolved questions get
   * routed to `open_questions` instead so reviewers don't mistake
   * them for concluded decisions. See classifyOutOfScopeEntries().
   */
  out_of_scope: string[];
  /**
   * Unresolved Phase 1 questions that the Systems Agent surfaced
   * while drafting boundary. Distinct from out_of_scope so the
   * reviewer knows these still need an answer. Empty array when the
   * agent's out_of_scope[] looked like genuine scope decisions.
   */
  open_questions: string[];
  external_systems: ExternalSystem[];
}

/**
 * Format the system-boundary artifact into the `system_boundary_summary` prompt
 * variable fed to Phase 3.2 (system requirements) and Phase 3.3 (interface
 * contracts).
 *
 * PA-8: `in_scope`/`out_of_scope` are DECLARED `string[]` but the LLM emits scope
 * items as objects (`{capability, description, satisfies_fr}` — the boundary
 * template requires objects and forbids strings). A raw `join()` therefore renders
 * `[object Object]; [object Object]`, starving the downstream systems_agent of the
 * actual scope. `displayCapability` extracts a label whether the item is a string
 * or an object, so this can never regress to `[object Object]`.
 */
export function formatSystemBoundarySummary(
  boundary: SystemBoundary,
  projectTypeDescription: string,
): string {
  return [
    `PROJECT TYPE: ${projectTypeDescription}`,
    ``,
    `System Boundary:`,
    `In scope: ${boundary.in_scope.map(displayCapability).join('; ')}`,
    `Out of scope: ${boundary.out_of_scope.map(displayCapability).join('; ') || 'none'}`,
    boundary.open_questions.length > 0
      ? `Open questions (unresolved Phase 1 items): ${boundary.open_questions.join('; ')}`
      : ``,
    `External systems: ${boundary.external_systems.map(e => `${e.id}: ${e.name} (${e.interface_type})`).join('; ') || 'none'}`,
  ].filter(Boolean).join('\n');
}

interface SystemRequirementItem {
  id: string;
  statement: string;
  source_requirement_ids: string[];
  allocation?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface SystemRequirements {
  items: SystemRequirementItem[];
}

interface InterfaceContract {
  id: string;
  systems_involved: string[];
  protocol: string;
  data_format: string;
  auth_mechanism?: string;
  error_handling_strategy?: string;
  error_responses?: Array<{ code: string; description: string }>;
}

interface InterfaceContracts {
  contracts: InterfaceContract[];
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase3Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '3';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const intentSummary = prior.intentStatement?.summary ?? 'No intent statement available';
    // Wave 6 — prefer the frozen leaf tree from Phase 2.1a when it
    // exists; fall back to root FRs otherwise. buildEffectiveFrView
    // returns {source, stories, summary} so downstream code treats both
    // sources interchangeably.
    const decompositionNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const frView = buildEffectiveFrView(decompositionNodes, prior);
    const frSummary = frView.summary;
    const nfrSummary = prior.nonFunctionalRequirements?.summary ?? 'No NFRs available';
    const frStories = frView.stories;
    const derivedFromIds = prior.allRecordIds;
    // Roll up the Phase 1.0c technical_constraints_discovery artifact
    // into a TECH-id roster the 3.3 prompt can cite directly. Without
    // this the interface-contracts prompt's grounding rule (protocols /
    // auth choices grounded in upstream technical_constraints[]) had no
    // input to point at — qwen3.5:9b would either hallucinate a
    // protocol or attribute it to active_constraints which is the
    // DMR-derived narrative, not the canonical TECH-* list.
    const technicalConstraintsSummary = formatTechnicalConstraintsSummary(allArtifacts);

    // ── 3.1 — System Boundary Definition ──────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'system_boundary');

    const frIds = frStories.map(s => s.id as string).filter(Boolean);
    const nfrIdList = ((prior.nonFunctionalRequirements?.content.requirements as Array<Record<string, unknown>>) ?? [])
      .map(n => n.id as string).filter(Boolean);

    // SD-1: per-release cohorts for chunked SR derivation. The monolithic 3.2
    // call asked one gpt-oss:20b response to cover the full FR∪NFR id set
    // (~255 leaf ids at scale → a 13-id coverage miss incl NFRs). We instead
    // chunk generation per release-ordinal (+ one cross-cutting NFR cohort)
    // and let the orchestrator close 100% coverage via reconciliation.
    // Leaf FR ids carry their release_ordinal on the decomposition node; the
    // user_story records returned by buildEffectiveFrView do not, so read the
    // frozen leaves directly to attach the ordinal (empty → root-FR fallback,
    // a single Backlog cohort).
    const frLeaves = getFrozenFrLeaves(decompositionNodes);
    const srFrStories = buildSrFrStories(frLeaves, frStories);
    const srNfrs = buildSrNfrs(prior.nonFunctionalRequirements?.content.requirements);
    const srFrIds = srFrStories.map(s => s.id);
    const srNfrIds = srNfrs.map(n => n.id);

    const dmr31Seeds = [
      ...(prior.intentStatement ? [prior.intentStatement.recordId] : []),
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr31 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'system_boundary',
      requestingAgentRole: 'systems_agent',
      query: `System boundary for FRs ${frIds.join(', ')} and NFRs ${nfrIdList.join(', ')} (intent ${prior.intentStatement?.recordId ?? 'unknown'}).`,
      knownRelevantRecordIds: dmr31Seeds,
      detailFileLabel: 'p3_1_boundary',
      requiredOutputSpec: 'system_boundary JSON — in_scope, out_of_scope, external_systems',
    });

    const llmBoundary = await this.runSystemBoundaryDefinition(
      ctx, intentSummary, frSummary, nfrSummary, dmr31,
    );

    // Deterministic-merge step. The LLM is good at judgment
    // (grouping, descriptions) but unreliable at exhaustive lookup
    // (cal-21 captured Cloudflare from technical_constraints but
    // dropped Postgres / ClamAV / SeaweedFS / Cerbos). Pull the
    // canonical externals list from Phase 1 artifacts directly and
    // merge — LLM-elaborated descriptions win for shared ids; every
    // deterministic id is guaranteed to appear.
    //
    // ts-102 surfaced a contamination path: the LLM had been emitting
    // external_systems entries for TECH-* ids describing the product's
    // own properties (HTTPS, AES-256, JSON logs, containerised service)
    // despite explicit prompt rules. Root cause was twofold —
    // `techConstraintToExternal` injected ALL constraints as externals
    // regardless of category, and the LLM-emitted list passed through
    // unfiltered. The fix gates both paths through `EXTERNAL_SERVICE_
    // CATEGORIES` + `isPlausibleExternalSystem`.
    const techCategoryById = buildTechCategoryIndex(allArtifacts);
    const deterministicExternals = gatherDeterministicExternals(allArtifacts);
    const filteredLlmExternals = filterLlmExternals(
      llmBoundary.external_systems ?? [],
      techCategoryById,
    );
    const boundaryContent: SystemBoundary = {
      ...llmBoundary,
      external_systems: mergeExternals(filteredLlmExternals, deterministicExternals),
      out_of_scope: reconstructOutOfScopeFromIntent(
        llmBoundary.out_of_scope,
        allArtifacts,
      ),
    };

    const boundaryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'system_boundary',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'system_boundary', ...boundaryContent },
    });
    artifactIds.push(boundaryRecord.id);
    engine.ingestionPipeline.ingest(boundaryRecord);

    // ── 3.2 — System Requirements Derivation ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'system_requirements');

    const boundarySummary = formatSystemBoundarySummary(boundaryContent, prior.projectTypeDescription);

    const externalSystemIds = boundaryContent.external_systems.map(e => e.id).filter(Boolean);
    const dmr32Seeds = [
      boundaryRecord.id,
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr32 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'system_requirements',
      requestingAgentRole: 'systems_agent',
      query: `System requirements deriving from system_boundary ${boundaryRecord.id} covering FRs ${frIds.join(', ')} and NFRs ${nfrIdList.join(', ')}; externals ${externalSystemIds.join(', ')}.`,
      knownRelevantRecordIds: dmr32Seeds,
      detailFileLabel: 'p3_2_sysreq',
      requiredOutputSpec: 'system_requirements JSON — items array with id, statement, source_requirement_ids',
    });

    const srResult = await deriveSystemRequirementsChunked(ctx, {
      boundarySummary,
      activeConstraintsText: dmr32.activeConstraintsText,
      janumicodeVersionSha: engine.janumiCodeVersionSha,
      frStories: srFrStories,
      nfrs: srNfrs,
    });
    const sysReqContent = srResult.requirements;

    const sysReqRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'system_requirements',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : [])],
      content: { kind: 'system_requirements', ...sysReqContent },
    });
    artifactIds.push(sysReqRecord.id);
    engine.ingestionPipeline.ingest(sysReqRecord);

    // ── 3.3 — Interface Contract Specification ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'interface_contracts');

    const externalSystemsList = boundaryContent.external_systems
      .map(e => `${e.id}: ${e.name} (${e.interface_type})`)
      .join('\n') || 'No external systems identified';

    const techConstraintsRecordId = allArtifacts.find(
      r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery',
    )?.id;
    const dmr33Seeds = [
      boundaryRecord.id,
      sysReqRecord.id,
      ...(techConstraintsRecordId ? [techConstraintsRecordId] : []),
    ];
    const dmr33 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'interface_contracts',
      requestingAgentRole: 'systems_agent',
      query: `Interface contracts for external systems ${externalSystemIds.join(', ')} (boundary ${boundaryRecord.id}, system_requirements ${sysReqRecord.id}).`,
      knownRelevantRecordIds: dmr33Seeds,
      detailFileLabel: 'p3_3_contracts',
      requiredOutputSpec: 'interface_contracts JSON — contracts array with protocol, data_format, error handling',
    });

    const contractsContent = await this.runInterfaceContractSpecification(
      ctx, boundarySummary, externalSystemsList, technicalConstraintsSummary, dmr33,
    );

    const contractsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'interface_contracts',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, sysReqRecord.id],
      content: { kind: 'interface_contracts', ...contractsContent },
    });
    artifactIds.push(contractsRecord.id);
    engine.ingestionPipeline.ingest(contractsRecord);

    // ── 3.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'system_spec_finalize');

    const specMirror = engine.mirrorGenerator.generate({
      artifactId: boundaryRecord.id,
      artifactType: 'system_specification',
      content: {
        boundary: boundaryContent,
        system_requirements_count: sysReqContent.items.length,
        interface_contracts_count: contractsContent.contracts.length,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'system_spec_finalize',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, sysReqRecord.id, contractsRecord.id],
      content: {
        kind: 'system_specification_mirror',
        mirror_id: specMirror.mirrorId,
        artifact_id: boundaryRecord.id,
        artifact_type: 'system_specification',
        fields: specMirror.fields,
        in_scope_count: boundaryContent.in_scope.length,
        external_systems_count: boundaryContent.external_systems.length,
        system_requirements_count: sysReqContent.items.length,
        interface_contracts_count: contractsContent.contracts.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: specMirror.mirrorId,
      artifactType: 'system_specification',
    });
    aoddEmit('mirror.presented', {
      mirror_id: specMirror.mirrorId,
      artifact_type: 'system_specification',
    });

    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id, mirrorRecord.id, 'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected system specification', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 3 review failed', { error: String(err) });
      return { success: false, error: 'System specification review failed', artifactIds };
    }

    // ── 3.5 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'system_spec_gate');

    const consistencyReport = this.runConsistencyCheck(
      boundaryContent, sysReqContent, contractsContent, srFrIds, srNfrIds,
    );

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'system_spec_gate',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, sysReqRecord.id, contractsRecord.id],
      content: { kind: 'consistency_report', ...consistencyReport },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: 'system_spec_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, sysReqRecord.id, contractsRecord.id, consistencyRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '3',
        system_boundary_record_id: boundaryRecord.id,
        system_requirements_record_id: sysReqRecord.id,
        interface_contracts_record_id: contractsRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '3' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  private async runSystemBoundaryDefinition(
    ctx: PhaseContext,
    intentSummary: string,
    frSummary: string,
    nfrSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<SystemBoundary> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('systems_agent', 'system_boundary');

    const fallback: SystemBoundary = {
      in_scope: ['Core application functionality as described in requirements'],
      out_of_scope: ['Third-party integrations not specified in requirements'],
      open_questions: [],
      external_systems: [],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      functional_requirements_summary: frSummary,
      non_functional_requirements_summary: nfrSummary,
      detail_file_path: dmr.detailFilePath,
      detail_file_content: dmr.detailFileContent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing so cal-22+ can target
    // llamacpp via llama-swap. Falls back to ollama+qwen3.5:9b dev
    // defaults when no workspace-config override is set. callForRole
    // forwards provider/model/base_url from llm_routing.requirements_agent.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '3',
        subPhaseId: 'system_boundary',
        agentRole: 'systems_agent',
        label: 'Phase 3.1 — System Boundary Definition',
      },
    });

    // 3.1 has no array-vs-object envelope ambiguity (system_boundary
    // is a single object, not a list), but use the same pickEnvelope
    // helper for symmetry with 3.2/3.3 and to tolerate the agent
    // wrapping the boundary in either `{ system_boundary: {...} }` or
    // emitting the boundary fields at the top level.
    const parsed = result.parsed as Record<string, unknown> | null;
    const sb = pickEnvelope<Partial<SystemBoundary>>(parsed, ['system_boundary']);
    if (sb?.in_scope && Array.isArray(sb.in_scope)) {
      // Split LLM out_of_scope[] into real scope decisions vs open
      // questions. cal-21 surfaced this gap: items like "Determine
      // monetization model…" are unresolved Phase 1 questions
      // leaking into Phase 3 as if they were boundary decisions.
      // The reviewer needs to see them but they're not commitments.
      const { decisions, questions } = classifyOutOfScopeEntries(sb.out_of_scope ?? []);
      return {
        in_scope: sb.in_scope,
        out_of_scope: decisions,
        open_questions: questions,
        external_systems: (sb.external_systems ?? []) as ExternalSystem[],
      };
    }
    return fallback;
  }

  private async runInterfaceContractSpecification(
    ctx: PhaseContext,
    boundarySummary: string,
    externalSystemsList: string,
    technicalConstraintsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<InterfaceContracts> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('systems_agent', 'interface_contracts');

    const fallback: InterfaceContracts = {
      contracts: [{
        id: 'IC-001',
        systems_involved: ['application', 'file_system'],
        protocol: 'filesystem',
        data_format: 'text',
        error_responses: [{ code: 'ENOENT', description: 'File not found' }],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      system_boundary_summary: boundarySummary,
      external_systems_list: externalSystemsList,
      technical_constraints_summary: technicalConstraintsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing so cal-22+ can target
    // llamacpp via llama-swap. Falls back to ollama+qwen3.5:9b dev
    // defaults when no workspace-config override is set. callForRole
    // forwards provider/model/base_url from llm_routing.requirements_agent.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '3',
        subPhaseId: 'interface_contracts',
        agentRole: 'systems_agent',
        label: 'Phase 3.3 — Interface Contract Specification',
      },
    });

    // Defensive parsing — same pattern as 3.2 (see SR derivation
    // comment). The model can emit any of:
    //   1. { contracts: [...] }                              (flat)
    //   2. { interface_contracts: [...] }                    (envelope=array)
    //   3. { interface_contracts: { contracts: [...] } }     (double envelope)
    //
    // ts-103 surfaced shape #3 — the LLM produced a perfectly good
    // contracts array nested under `interface_contracts.contracts`,
    // but the previous `pickItemsArray` call only looked one level
    // deep and silently fell back to the placeholder file-system
    // contract. We now unwrap the outer envelope first, then look
    // for `contracts` on either the unwrapped or original object.
    const parsed = result.parsed as Record<string, unknown> | null;
    const unwrapped = pickEnvelope<Record<string, unknown>>(parsed, ['interface_contracts']);
    const contracts =
      pickItemsArray<InterfaceContract>(parsed, ['interface_contracts', 'contracts']) ??
      pickItemsArray<InterfaceContract>(unwrapped, ['contracts']);
    if (contracts && contracts.length > 0) return { contracts };
    return fallback;
  }

  /**
   * Deterministic consistency check across Phase 3 artifacts.
   */
  private runConsistencyCheck(
    boundary: SystemBoundary,
    sysReq: SystemRequirements,
    contracts: InterfaceContracts,
    frIds: string[],
    nfrIds: string[],
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // Invariant: Every FR AND NFR maps to at least one System Requirement.
    // SD-1 (cal-32, gpt-oss:20b): the monolithic pass dropped NFR-005 and the
    // old check only looked at FRs, so an uncovered NFR passed silently.
    // Generalized to FR∪NFR — the chunked bloom is the real closer; this stays
    // a WARNING surfacing any residual gap it could not fill.
    const uncovered = computeUncoveredRequirements(sysReq.items, [...frIds, ...nfrIds]);
    if (uncovered.length > 0) {
      warnings.push('uncovered-source-requirements');
      traceability.push({
        assertion: 'Every FR and NFR maps to at least one System Requirement',
        pass: false,
        failures: uncovered.map(id => ({ item_id: id, explanation: `Requirement ${id} has no System Requirement` })),
      });
    }

    // Invariant: Every External System has at least one Interface Contract
    const contractedSystems = new Set<string>();
    for (const c of contracts.contracts) {
      for (const sys of c.systems_involved) {
        contractedSystems.add(sys.toLowerCase());
      }
    }
    const uncoveredSystems = boundary.external_systems.filter(
      e => !contractedSystems.has(e.id.toLowerCase()) && !contractedSystems.has(e.name.toLowerCase()),
    );
    if (uncoveredSystems.length > 0) {
      warnings.push('external-systems-without-contracts');
      traceability.push({
        assertion: 'Every External System has at least one Interface Contract',
        pass: false,
        failures: uncoveredSystems.map(e => ({ item_id: e.id, explanation: `External system ${e.name} has no contract` })),
      });
    }

    // Invariant: Every Interface Contract has at least one error response
    const contractsWithoutErrors = contracts.contracts.filter(
      c => !c.error_responses || c.error_responses.length === 0,
    );
    if (contractsWithoutErrors.length > 0) {
      warnings.push('contracts-without-error-responses');
      traceability.push({
        assertion: 'Every Interface Contract specifies at least one error response',
        pass: false,
        failures: contractsWithoutErrors.map(c => ({ item_id: c.id, explanation: `Contract ${c.id} has no error responses` })),
      });
    }

    return {
      overall_pass: blockingFailures.length === 0,
      traceability_results: traceability,
      semantic_findings: [],
      blocking_failures: blockingFailures,
      warnings,
    };
  }
}

// ── SD-1: chunked System Requirements derivation (Phase 3.2) ────────
//
// Replaces the single monolithic system_requirements call — which asked one
// gpt-oss:20b response to cover the full FR∪NFR id set in one shot (a 13-id
// coverage miss incl NFRs at scale) — with per-release-cohort generation plus
// an orchestrator-owned coverage-reconciliation loop (shared chunkedCoverageBloom
// helper, the P6.1 exemplar). Each cohort call reasons over a bounded slice; the
// orchestrator owns the 100%-coverage guarantee and reports an honest residual.

/** Array-safe string coercion (no regex; mirrors phase6's asStringArray). */
function srAsStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** One-line, length-capped coercion for menu/label text. */
function srOneLine(v: unknown, cap = 160): string {
  const t = typeof v === 'string' ? v : v == null ? '' : String(v);
  const firstLine = t.split('\n')[0]?.trim() ?? '';
  return firstLine.length > cap ? `${firstLine.slice(0, cap - 1)}…` : firstLine;
}

export interface SrFrStory { id: string; release_ordinal: number | null; label: string }
export interface SrNfr { id: string; label: string }

/**
 * Build the per-story cohort input for SR derivation. Prefers the frozen leaf
 * tree (each leaf carries a release_ordinal on its decomposition node); falls
 * back to the root user-story list (no ordinals → a single Backlog cohort).
 * Ids are the same ids `frStories.map(s => s.id)` yields upstream, so the
 * coverage oracle and `source_requirement_ids` share one id-space.
 */
export function buildSrFrStories(
  leaves: ReadonlyArray<{
    release_ordinal: number | null;
    display_key: string;
    user_story: { id: string; role?: string; action?: string; outcome?: string; priority?: string };
  }>,
  rootStories: ReadonlyArray<Record<string, unknown>>,
): SrFrStory[] {
  const out: SrFrStory[] = [];
  const seen = new Set<string>();
  if (leaves.length > 0) {
    for (const l of leaves) {
      const us = l.user_story ?? { id: '' };
      const id = typeof us.id === 'string' ? us.id : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = `${l.display_key || id} [${srOneLine(us.priority, 20) || 'priority?'}]: As a ${srOneLine(us.role, 40)}, I want to ${srOneLine(us.action, 80)}, so that ${srOneLine(us.outcome, 80)}.`;
      out.push({ id, release_ordinal: l.release_ordinal ?? null, label });
    }
    return out;
  }
  for (const s of rootStories) {
    const id = typeof s.id === 'string' ? s.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const ro = typeof s.release_ordinal === 'number' ? s.release_ordinal : null;
    const label = `${id} [${srOneLine(s.priority, 20) || 'priority?'}]: As a ${srOneLine(s.role, 40)}, I want to ${srOneLine(s.action, 80)}, so that ${srOneLine(s.outcome, 80)}.`;
    out.push({ id, release_ordinal: ro, label });
  }
  return out;
}

/** Build the NFR input (id + one-line label) from the NFR requirements array. */
export function buildSrNfrs(requirements: unknown): SrNfr[] {
  const arr = Array.isArray(requirements) ? (requirements as Array<Record<string, unknown>>) : [];
  const out: SrNfr[] = [];
  const seen = new Set<string>();
  for (const n of arr) {
    const id = typeof n.id === 'string' ? n.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const text = srOneLine(n.statement ?? n.description ?? n.text ?? n.requirement, 160);
    out.push({ id, label: text ? `${id}: ${text}` : id });
  }
  return out;
}

/**
 * The deterministic coverage oracle, generalized to FR∪NFR (SD-1). Returns the
 * requirement ids that no System Requirement cites via `source_requirement_ids`.
 * Reads through `srAsStringArray` so a non-array/boolean LLM value never throws.
 */
export function computeUncoveredRequirements(
  items: ReadonlyArray<{ source_requirement_ids?: unknown }>,
  requirementIds: ReadonlyArray<string>,
): string[] {
  const covered = new Set<string>();
  for (const it of items) for (const id of srAsStringArray(it.source_requirement_ids)) covered.add(id);
  return requirementIds.filter(id => id && !covered.has(id));
}

interface SrCohort {
  /** Stable, cohort-unique key used to namespace SR ids pre-merge. */
  key: string;
  label: string;
  kind: 'release' | 'nfr';
  coverIds: string[];
  cohortRequirements: string;
  crossCuttingReference: string;
}

/**
 * Partition the requirement set into bounded generation cohorts: one per
 * release-ordinal over the FR stories (null ordinal → Backlog), plus a single
 * dedicated cross-cutting NFR cohort. NFRs ride into every release cohort as
 * reference (multi-axis SRs cite the bound) but are the coverage target only in
 * the NFR cohort — so no single generation prompt enumerates the whole FR set.
 */
function buildSrCohorts(frStories: SrFrStory[], nfrs: SrNfr[]): SrCohort[] {
  const cohorts: SrCohort[] = [];
  const byRelease = new Map<number | null, SrFrStory[]>();
  for (const s of frStories) {
    if (!byRelease.has(s.release_ordinal)) byRelease.set(s.release_ordinal, []);
    byRelease.get(s.release_ordinal)!.push(s);
  }
  const ordinals = [...byRelease.keys()].sort((a, b) =>
    (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER));
  const allNfrLines = nfrs.map(n => `- ${n.label}`).join('\n');
  for (const ord of ordinals) {
    const stories = byRelease.get(ord)!;
    cohorts.push({
      key: ord != null ? `rel-${ord}` : 'backlog',
      label: ord != null ? `Release ${ord}` : 'Backlog',
      kind: 'release',
      coverIds: stories.map(s => s.id),
      cohortRequirements: stories.map(s => `- ${s.label}`).join('\n') || '(no functional requirements in this cohort)',
      crossCuttingReference: nfrs.length > 0
        ? `Cross-cutting Non-Functional Requirements (cite an NFR id in an SR's source_requirement_ids only when that SR allocates the NFR's quality bound; global NFR coverage is closed by a dedicated cohort + the orchestrator):\n${allNfrLines}`
        : 'No non-functional requirements were identified upstream.',
    });
  }
  if (nfrs.length > 0) {
    cohorts.push({
      key: 'nfr',
      label: 'Cross-cutting NFRs',
      kind: 'nfr',
      coverIds: nfrs.map(n => n.id),
      cohortRequirements: allNfrLines,
      crossCuttingReference: 'Functional behaviour is derived by the sibling release cohorts. Your sole job here is to ensure EVERY Non-Functional Requirement above is allocated to at least one System Requirement as a measurable quality bound.',
    });
  }
  return cohorts;
}

/** Envelope-tolerant SR parse (shapes #1/#2/#3 — see parsedResponseHelpers). */
function parseSystemRequirements(parsed: Record<string, unknown> | null): SystemRequirementItem[] {
  const unwrapped = pickEnvelope<Record<string, unknown>>(parsed, ['system_requirements']);
  const items =
    pickItemsArray<SystemRequirementItem>(parsed, ['system_requirements', 'items']) ??
    pickItemsArray<SystemRequirementItem>(unwrapped, ['items']);
  if (!items) return [];
  return items.map(it => {
    const rec = it as unknown as Record<string, unknown>;
    return {
      ...it,
      statement: typeof rec.statement === 'string' ? rec.statement : String(rec.statement ?? ''),
      source_requirement_ids: srAsStringArray(rec.source_requirement_ids),
      priority: (rec.priority as SystemRequirementItem['priority']) ?? 'medium',
    };
  });
}

function summarizeSrResidual(
  residual: Set<string>,
  labelById: Map<string, string>,
  total: number,
): { uncovered: number; total: number; coverage_pct: number; ids: Array<{ id: string; label: string }> } {
  const ids = [...residual].sort().map(id => ({ id, label: srOneLine(labelById.get(id) ?? id, 80) }));
  const covered = total - residual.size;
  return {
    uncovered: residual.size,
    total,
    coverage_pct: total > 0 ? Math.round((covered / total) * 1000) / 10 : 100,
    ids,
  };
}

export interface SrDerivationInput {
  boundarySummary: string;
  activeConstraintsText: string;
  janumicodeVersionSha: string;
  /** FR stories (leaf ids + release_ordinal + one-line label) grouped into
   *  per-release cohorts. The full FR roster is intentionally NOT a single
   *  injected blob — each cohort carries only its own ids. */
  frStories: SrFrStory[];
  /** NFR ids + labels — the cross-cutting cohort's coverage target and every
   *  release cohort's reference. */
  nfrs: SrNfr[];
}

export interface SrDerivationResult {
  requirements: SystemRequirements;
  coveragePct: number;
  residual: string[];
}

type SrDerivationCtx = Pick<PhaseContext, 'engine' | 'workflowRun'>;

/**
 * Derive System Requirements via per-cohort generation + coverage
 * reconciliation. Returns the merged, globally re-numbered SRs plus an honest
 * coverage/residual report. Per-cohort generators return [] on failure (never a
 * fabricated SR); the single SR-001 fallback is kept ONLY when the whole bloom
 * yields zero SRs. SR ids are namespaced per cohort in-flight (so idOf dedup
 * can't drop a distinct SR that reused SR-001) then re-numbered SR-### on merge.
 */
export async function deriveSystemRequirementsChunked(
  ctx: SrDerivationCtx,
  input: SrDerivationInput,
): Promise<SrDerivationResult> {
  const { engine } = ctx;
  const log = getLogger();

  const targetCoverageSet = new Set<string>([
    ...input.frStories.map(s => s.id),
    ...input.nfrs.map(n => n.id),
  ]);

  const fallback: SystemRequirements = {
    items: [{
      id: 'SR-001',
      statement: 'System shall implement core functionality as specified in functional requirements',
      source_requirement_ids: [input.frStories[0]?.id ?? 'US-001'],
      priority: 'high',
    }],
  };

  const genTemplate = engine.templateLoader.findTemplate('systems_agent', 'system_requirements');
  const reconTemplate = engine.templateLoader.findTemplate('systems_agent', 'system_requirements_reconciliation');
  if (!genTemplate) {
    return { requirements: fallback, coveragePct: 0, residual: [...targetCoverageSet] };
  }

  const cohorts = buildSrCohorts(input.frStories, input.nfrs);
  const labelById = new Map<string, string>();
  for (const s of input.frStories) labelById.set(s.id, s.label);
  for (const n of input.nfrs) labelById.set(n.id, n.label);

  const maxReconPasses = Math.max(0, Number.parseInt(process.env.JANUMICODE_P3_RECON_PASSES ?? '2', 10) || 0);
  const maxIdsPerBatch = Math.max(1, Number.parseInt(process.env.JANUMICODE_P3_RECON_BATCH_IDS ?? '25', 10) || 25);

  const generateForChunk = async (cohort: SrCohort): Promise<SystemRequirementItem[]> => {
    const rendered = engine.templateLoader.render(genTemplate, {
      active_constraints: input.activeConstraintsText,
      system_boundary_summary: input.boundarySummary,
      cohort_label: cohort.label,
      cohort_requirements: cohort.cohortRequirements,
      cross_cutting_reference: cohort.crossCuttingReference,
      janumicode_version_sha: input.janumicodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return [];
    try {
      const result = await engine.callForRole('requirements_agent', {
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.4,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '3',
          subPhaseId: 'system_requirements',
          agentRole: 'systems_agent',
          label: `Phase 3.2 — System Requirements Derivation (${cohort.label})`,
        },
      });
      const items = parseSystemRequirements(result.parsed as Record<string, unknown> | null);
      // Namespace ids per cohort so two cohorts can't both surface SR-001 and
      // get collapsed by idOf dedup. Cleaned to a global SR-### on merge.
      return items.map((it, i) => ({ ...it, id: `SR-${cohort.key}-${i + 1}` }));
    } catch (err) {
      log.warn('workflow', 'Phase 3.2 per-cohort SR generation failed — continuing', {
        cohort: cohort.key, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  };

  const chunkUncovered = (uncovered: Set<string>): Array<Set<string>> => {
    const ids = [...uncovered].sort();
    const batches: Array<Set<string>> = [];
    for (let i = 0; i < ids.length; i += maxIdsPerBatch) {
      batches.push(new Set(ids.slice(i, i + maxIdsPerBatch)));
    }
    return batches;
  };

  const reconcileBatch = async (
    batch: Set<string>,
    passInfo: { pass: number; batchIndex: number; batchCount: number },
  ): Promise<SystemRequirementItem[]> => {
    if (!reconTemplate) return [];
    const menu = [...batch].sort().map(id => `- ${labelById.get(id) ?? id}`).join('\n');
    const rendered = engine.templateLoader.render(reconTemplate, {
      active_constraints: input.activeConstraintsText,
      uncovered_requirements: menu,
      system_boundary_summary: input.boundarySummary,
    });
    if (rendered.missing_variables.length > 0) return [];
    try {
      const result = await engine.callForRole('requirements_agent', {
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.4,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '3',
          subPhaseId: 'system_requirements',
          agentRole: 'systems_agent',
          label: `Phase 3.2 — Coverage Reconciliation (pass ${passInfo.pass}, batch ${passInfo.batchIndex}/${passInfo.batchCount}, ${batch.size} ids)`,
        },
      });
      const items = parseSystemRequirements(result.parsed as Record<string, unknown> | null);
      return items.map((it, i) => ({ ...it, id: `SR-recon-${passInfo.pass}-${passInfo.batchIndex}-${i + 1}` }));
    } catch (err) {
      log.warn('workflow', 'Phase 3.2 SR reconciliation batch failed — continuing', {
        pass: passInfo.pass, batch_index: passInfo.batchIndex,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  };

  const bloom = await chunkedCoverageBloom<SrCohort, SystemRequirementItem>({
    chunks: cohorts,
    generateForChunk,
    idOf: (sr) => (typeof sr.id === 'string' ? sr.id : ''),
    targetCoverageSet,
    coveredBy: (sr) => srAsStringArray(sr.source_requirement_ids),
    chunkUncovered,
    reconcileBatch,
    maxReconPasses,
    onResidual: (residual) => {
      log.warn(
        'workflow',
        'Phase 3.2 residual uncovered FR/NFR ids after reconciliation (honest gap — not fabricated)',
        summarizeSrResidual(residual, labelById, targetCoverageSet.size),
      );
    },
    logLabel: 'Phase 3.2',
  });

  if (bloom.produced.length === 0) {
    // Whole bloom produced nothing — keep exactly ONE final fallback so the
    // downstream record isn't empty (never a per-cohort fabrication).
    return { requirements: fallback, coveragePct: 0, residual: [...bloom.residual] };
  }

  // Deterministic global re-id: two cohorts must not both surface SR-001.
  const renumbered: SystemRequirementItem[] = bloom.produced.map((sr, i) => ({
    ...sr,
    id: `SR-${String(i + 1).padStart(3, '0')}`,
    source_requirement_ids: srAsStringArray(sr.source_requirement_ids),
  }));

  return {
    requirements: { items: renumbered },
    coveragePct: bloom.coveragePct,
    residual: [...bloom.residual],
  };
}

// ── Phase 3.1 helpers ────────────────────────────────────────────

/**
 * Verbs that mark an out_of_scope entry as actually an unresolved
 * question rather than a scope decision. cal-21 surfaced these as
 * "Determine monetization model…", "Establish prioritized
 * integrations…", "Clarify differentiation…". An unresolved Phase 1
 * MMP item leaking into Phase 3's out_of_scope[] reads exactly like a
 * boundary decision but is not — calibration smell, not a
 * commitment.
 *
 * Heuristic intentionally narrow: imperative leading verbs that are
 * meta-decisions ("decide what to do") rather than feature
 * descriptions ("Tenant payment processing"). False negatives
 * preferred over false positives — a real scope decision
 * misclassified as a question is harmless; a question
 * misclassified as scope is the bug we're trying to surface.
 */
const OPEN_QUESTION_LEADERS = new Set([
  'determine', 'establish', 'clarify', 'decide', 'evaluate',
  'investigate', 'assess', 'identify', 'choose', 'select',
]);

/**
 * Split the LLM's out_of_scope[] into actual scope decisions and
 * open questions. Items ending in '?', or starting with one of the
 * meta-decision verbs above, route to questions. Everything else
 * stays in decisions.
 */
function classifyOutOfScopeEntries(
  entries: unknown[],
): { decisions: string[]; questions: string[] } {
  const decisions: string[] = [];
  const questions: string[] = [];
  for (const entry of entries) {
    // The LLM occasionally emits structured entries — `{ item, rationale }`
    // or similar — instead of plain strings. Coerce to a usable string
    // (preferring known fields) and skip anything we can't reduce to text.
    let asString: string;
    if (typeof entry === 'string') {
      asString = entry;
    } else if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const candidate =
        (typeof obj.item === 'string' && obj.item) ||
        (typeof obj.text === 'string' && obj.text) ||
        (typeof obj.description === 'string' && obj.description) ||
        '';
      if (!candidate) continue;
      asString = candidate;
    } else {
      continue;
    }
    const trimmed = asString.trim();
    if (!trimmed) continue;
    if (trimmed.endsWith('?')) { questions.push(trimmed); continue; }
    const firstWord = trimmed.split(/\s+/, 1)[0]?.toLowerCase() ?? '';
    if (OPEN_QUESTION_LEADERS.has(firstWord)) { questions.push(trimmed); continue; }
    decisions.push(trimmed);
  }
  return { decisions, questions };
}

/**
 * Pre-populate `external_systems[]` with anything Phase 1 already
 * named deterministically — technical_constraints_discovery.
 * technicalConstraints[] (TECH-* ids) and integrations_qa_bloom.
 * integrations[] (INT-* ids). Phase 3.1 used to hope qwen would
 * faithfully reproduce these from a free-form context; cal-21
 * showed it picks a few high-salience ones and silently drops the
 * rest. The bookkeeping/judgment split: orchestrator does the
 * exhaustive list, LLM does the descriptions.
 *
 * Returns a list of seed externals the LLM should treat as
 * pre-confirmed. Caller merges with the LLM's own external_systems
 * list, deduping by id (LLM-provided wins for description if it
 * elaborated). When merged this way, the LLM is free to add
 * externals it derived from FRs (e.g. a third-party email service
 * mentioned only in a journey) without re-emitting the known set.
 */
function gatherDeterministicExternals(
  artifacts: GovernedStreamRecord[],
): ExternalSystem[] {
  const out: ExternalSystem[] = [];
  const seen = new Set<string>();
  const push = (e: ExternalSystem | null): void => {
    if (!e?.id || seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };
  for (const a of artifacts) {
    const c = (a.content ?? {}) as Record<string, unknown>;
    const list = pickExternalsList(c);
    if (!list) continue;
    for (const item of list.items) push(list.toExternal(item));
  }
  return out;
}

/** Per-kind extractor: returns the items[] and a shaper for that artifact kind. */
function pickExternalsList(
  c: Record<string, unknown>,
): { items: Array<Record<string, unknown>>; toExternal: (i: Record<string, unknown>) => ExternalSystem | null } | null {
  if (c.kind === 'technical_constraints_discovery') {
    const items = arr(c.technicalConstraints ?? c.technical_constraints);
    return items ? { items, toExternal: techConstraintToExternal } : null;
  }
  if (c.kind === 'integrations_qa_bloom') {
    const items = arr(c.integrations ?? c.integrationCatalog);
    return items ? { items, toExternal: integrationToExternal } : null;
  }
  return null;
}

function arr(v: unknown): Array<Record<string, unknown>> | null {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : null;
}

/**
 * Categories from `technical_constraints_discovery` that designate a
 * SEPARATE RUNNING SERVICE the product communicates with across a
 * process boundary. Only these become `external_systems[]` entries.
 *
 * Excluded categories (`infrastructure` for transport like HTTPS,
 * `security` for crypto algorithms, `deployment` for containerisation,
 * `monitoring` for log formats, `frontend`/`backend`/`mobile` for the
 * product's own surfaces, `build_ci` for CI tooling, `integration_protocol`
 * for wire protocols) describe properties of the product's own
 * implementation, not separate external systems. They remain available
 * in technical_constraints[] for downstream phases that need them.
 *
 * Conservative whitelist — favours under-emission. A new category that
 * legitimately names an external service can be added here; until then,
 * the LLM may still introduce it via its own external_systems[] (which
 * passes through this same filter via category if specified, else via
 * the `isPlausibleExternalSystem` name check).
 */
const EXTERNAL_SERVICE_CATEGORIES = new Set([
  'database',
  'cdn',
  'identity',
  'workflow_engine',
  'cache',
  'messaging',
  'queue',
  'object_storage',
  'auth_provider',
  'payment',
  'email',
  'sms',
  'maps',
  'search',
  'ml_inference',
  'observability_service',
]);

/**
 * Patterns that prove an entry is NOT an external system regardless of
 * category — protocols, formats, algorithms, runtime characteristics.
 * Applied to the LLM-emitted external_systems[] before merge so the LLM
 * can't smuggle HTTPS/AES-256/JSON-logs through with a fabricated id
 * even when the upstream TECH-* roster correctly excluded them.
 */
const NON_EXTERNAL_NAME_PATTERNS: RegExp[] = [
  /^https?$/i,
  /^aes[-_ ]?(128|256)$/i,
  /^tls$/i,
  /^json[-_ ]?logs?$/i,
  /^containeris[ez]ed?[-_ ]service$/i,
  /^docker$/i,
  /^kubernetes$/i,
  /^microservices?$/i,
  /^monolith$/i,
  /^rest$/i,
  /^graphql$/i,
  /^webhook$/i,
];

function isPlausibleExternalSystem(name: string): boolean {
  if (!name) return false;
  return !NON_EXTERNAL_NAME_PATTERNS.some(r => r.test(name.trim()));
}

function techConstraintToExternal(t: Record<string, unknown>): ExternalSystem | null {
  const id = typeof t.id === 'string' ? t.id : '';
  if (!id) return null;
  const category = (t.category as string) ?? '';
  // Allow-list: only constraints describing a separate running service
  // become external_systems. Other constraints (transport, deployment,
  // security algorithms, log formats) remain in technical_constraints[].
  if (!EXTERNAL_SERVICE_CATEGORIES.has(category.toLowerCase())) return null;
  const name = (t.technology as string) ?? (t.name as string) ?? id;
  if (!isPlausibleExternalSystem(name)) return null;
  return {
    id,
    name,
    purpose: (t.text as string) ?? (t.rationale as string) ?? '',
    interface_type: category || 'technical',
  };
}

/**
 * Filter LLM-emitted external_systems[] before merge. Drops entries
 * that fail the plausibility check by name, regardless of how the LLM
 * categorised them — a defence against the LLM emitting `{ id:
 * "TECH-HTTPS", name: "HTTPS", interface_type: "transport" }` after
 * being told not to. Also drops entries whose id starts with `TECH-`
 * but whose underlying category isn't service-like (the LLM treating
 * the upstream constraint roster as a checklist to repopulate).
 */
function filterLlmExternals(
  llmEmitted: ExternalSystem[],
  techCategoryById: Map<string, string>,
): ExternalSystem[] {
  return llmEmitted.filter(e => {
    if (!isPlausibleExternalSystem(e.name ?? '')) return false;
    if (typeof e.id === 'string' && /^TECH-/i.test(e.id)) {
      const cat = techCategoryById.get(e.id.toLowerCase());
      if (cat && !EXTERNAL_SERVICE_CATEGORIES.has(cat.toLowerCase())) return false;
    }
    return true;
  });
}

function buildTechCategoryIndex(
  artifacts: GovernedStreamRecord[],
): Map<string, string> {
  const idx = new Map<string, string>();
  for (const a of artifacts) {
    const c = (a.content ?? {}) as Record<string, unknown>;
    if (c.kind !== 'technical_constraints_discovery') continue;
    const items = arr(c.technicalConstraints ?? c.technical_constraints);
    if (!items) continue;
    for (const it of items) {
      const id = typeof it.id === 'string' ? it.id : '';
      const cat = typeof it.category === 'string' ? it.category : '';
      if (id) idx.set(id.toLowerCase(), cat);
    }
  }
  return idx;
}

/**
 * Words that signal a `confirmed_constraint` is an EXCLUSION rather
 * than a positive requirement. "no microservices", "must not store
 * plaintext", "without third-party auth" — these belong in
 * `out_of_scope` with a rationale.
 *
 * Conservative — favours under-detection. We only promote a constraint
 * to out_of_scope when its leading clause matches an exclusion verb;
 * borderline cases stay in_scope where they were already implicitly
 * captured. Better to under-emit out_of_scope than to misclassify a
 * positive constraint as an exclusion.
 */
const EXCLUSION_PATTERNS: RegExp[] = [
  /\bno\s+/i,
  /\bnot\s+/i,
  /\bwithout\s+/i,
  /\bmust\s+not\s+/i,
  /\bshall\s+not\s+/i,
  /\bcannot\s+/i,
  /\bnever\s+/i,
  /\bexcept\s+/i,
];

function isExclusionConstraint(text: string): boolean {
  return EXCLUSION_PATTERNS.some(r => r.test(text));
}

/**
 * Reconstruct `out_of_scope[]` when the LLM left it empty. Three
 * deterministic sources, in order of trust:
 *
 *  1. `intent_statement.out_of_scope[]` — passthrough. The intent
 *     synthesizer's own explicit out-of-scope list (may be empty if
 *     the synthesizer didn't carry it forward).
 *  2. `intent_statement.confirmed_constraints[]` filtered for items
 *     whose text contains an exclusion verb (no / not / without /
 *     must not). Lower trust because the intent synthesizer often
 *     rephrases spec text into positive form ("limited to a single
 *     container" instead of "no microservices"), defeating the
 *     pattern match.
 *  3. `technical_constraints[].text` filtered for exclusion verbs.
 *     The technical constraint extractor preserves source excerpts
 *     verbatim — these still contain phrases like "no microservices"
 *     that the intent synthesizer dropped. Most reliable source.
 *
 * Only runs when the LLM output is empty; non-empty LLM output stays.
 *
 * Returns string[] to match the existing `SystemBoundary.out_of_scope`
 * shape — downstream serialisation (`boundarySummary`) calls
 * `.join('; ')` so this MUST remain a flat string array.
 */
function reconstructOutOfScopeFromIntent(
  llmOutOfScope: SystemBoundary['out_of_scope'] | undefined,
  artifacts: GovernedStreamRecord[],
): SystemBoundary['out_of_scope'] {
  const existing = Array.isArray(llmOutOfScope) ? llmOutOfScope : [];
  if (existing.length > 0) return existing;

  const reconstructed: string[] = [];
  const seen = new Set<string>();
  const push = (text: string): void => {
    const t = text.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    reconstructed.push(t);
  };

  // Sources 1 & 2: intent_statement
  const intentRecord = artifacts.find(
    a => (a.content as Record<string, unknown>)?.kind === 'intent_statement',
  );
  if (intentRecord) {
    const ic = intentRecord.content as Record<string, unknown>;
    const intentOos = arr(ic.out_of_scope) ?? [];
    for (const entry of intentOos) {
      if (typeof entry === 'string') push(entry);
      else if (entry && typeof entry === 'object' && typeof (entry as { capability?: unknown }).capability === 'string') {
        push((entry as { capability: string }).capability);
      }
    }
    const constraints = arr(ic.confirmed_constraints) ?? arr(ic.confirmedConstraints) ?? [];
    for (const entry of constraints) {
      const text = typeof entry === 'string' ? entry : '';
      if (text && isExclusionConstraint(text)) push(text);
    }
  }

  // Source 3: technical_constraints[].text (verbatim spec excerpts)
  const techRecord = artifacts.find(
    a => (a.content as Record<string, unknown>)?.kind === 'technical_constraints_discovery',
  );
  if (techRecord) {
    const tc = techRecord.content as Record<string, unknown>;
    const items = arr(tc.technicalConstraints ?? tc.technical_constraints) ?? [];
    for (const it of items) {
      const text = typeof it.text === 'string' ? it.text : '';
      if (text && isExclusionConstraint(text)) push(text);
    }
  }

  return reconstructed;
}

function integrationToExternal(i: Record<string, unknown>): ExternalSystem | null {
  let id = '';
  if (typeof i.id === 'string') id = i.id;
  else if (typeof i.name === 'string') id = i.name;
  if (!id) return null;
  return {
    id,
    name: (i.name as string) ?? id,
    purpose: (i.description as string) ?? (i.purpose as string) ?? '',
    interface_type: (i.protocol as string) ?? (i.type as string) ?? 'integration',
  };
}

/**
 * Merge LLM-emitted external_systems with the deterministic seed
 * list. LLM-provided entries win for `name`/`purpose`/`interface_type`
 * (the LLM may have added context the constraint discovery row
 * lacked), but every deterministic id is guaranteed to appear in
 * the result. Comparison is case-insensitive on id.
 */
/**
 * Build the TECH-* constraint roster the 3.3 prompt cites for grounding
 * protocol / auth / vendor choices. Pulls the
 * `technical_constraints_discovery` artifact from Phase 1.0c, formats
 * each item as `TECH-ID — technology — category — text`. Returns a
 * placeholder string when no such artifact exists so the template
 * render doesn't fail required_variables validation.
 */
function formatTechnicalConstraintsSummary(
  allArtifacts: ReadonlyArray<{ content: unknown }>,
): string {
  for (const r of allArtifacts) {
    const c = r.content as Record<string, unknown>;
    if (c?.kind !== 'technical_constraints_discovery') continue;
    const items = arr(c.technicalConstraints ?? c.technical_constraints);
    if (!items?.length) continue;
    const lines = items.map(formatTechnicalConstraintLine).filter(Boolean);
    if (lines.length > 0) return lines.join('\n');
  }
  return 'No technical_constraints_discovery artifact available';
}

function formatTechnicalConstraintLine(t: Record<string, unknown>): string {
  const id = typeof t.id === 'string' ? t.id : '';
  if (!id) return '';
  const tech = (t.technology as string) ?? (t.name as string) ?? '';
  const category = (t.category as string) ?? '';
  const text = (t.text as string) ?? (t.rationale as string) ?? '';
  const parts = [id, tech];
  if (category) parts.push(category);
  if (text) parts.push(text);
  return parts.join(' — ');
}

function mergeExternals(
  llmEmitted: ExternalSystem[],
  deterministic: ExternalSystem[],
): ExternalSystem[] {
  const byId = new Map<string, ExternalSystem>();
  for (const e of deterministic) byId.set(e.id.toLowerCase(), e);
  for (const e of llmEmitted) {
    const key = e.id.toLowerCase();
    const existing = byId.get(key);
    if (existing) {
      // Prefer LLM-elaborated text when non-empty, else keep the
      // deterministic baseline.
      byId.set(key, {
        id: existing.id,  // canonical casing from constraints
        name: e.name?.trim() || existing.name,
        purpose: e.purpose?.trim() || existing.purpose,
        interface_type: e.interface_type?.trim() || existing.interface_type,
      });
    } else {
      byId.set(key, e);
    }
  }
  return Array.from(byId.values());
}

