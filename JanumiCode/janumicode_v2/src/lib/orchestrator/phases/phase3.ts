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
import { extractPriorPhaseContext, buildEffectiveFrView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray, pickEnvelope } from '../parsedResponseHelpers';

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

    // ── 3.1 — System Boundary Definition ──────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.1');

    const dmr31 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '3.1',
      requestingAgentRole: 'systems_agent',
      query: `System boundary for: ${intentSummary.slice(0, 400)}`,
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
    const deterministicExternals = gatherDeterministicExternals(allArtifacts);
    const boundaryContent: SystemBoundary = {
      ...llmBoundary,
      external_systems: mergeExternals(llmBoundary.external_systems, deterministicExternals),
    };

    const boundaryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: '3.1',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'system_boundary', ...boundaryContent },
    });
    artifactIds.push(boundaryRecord.id);
    engine.ingestionPipeline.ingest(boundaryRecord);

    // ── 3.2 — System Requirements Derivation ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.2');

    const boundarySummary = [
      `PROJECT TYPE: ${prior.projectTypeDescription}`,
      ``,
      `System Boundary:`,
      `In scope: ${boundaryContent.in_scope.join('; ')}`,
      `Out of scope: ${boundaryContent.out_of_scope.join('; ') || 'none'}`,
      boundaryContent.open_questions.length > 0
        ? `Open questions (unresolved Phase 1 items): ${boundaryContent.open_questions.join('; ')}`
        : ``,
      `External systems: ${boundaryContent.external_systems.map(e => `${e.id}: ${e.name} (${e.interface_type})`).join('; ') || 'none'}`,
    ].filter(Boolean).join('\n');

    const dmr32 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '3.2',
      requestingAgentRole: 'systems_agent',
      query: `System requirements derived from boundary: ${boundarySummary.slice(0, 400)}`,
      detailFileLabel: 'p3_2_sysreq',
      requiredOutputSpec: 'system_requirements JSON — items array with id, statement, source_requirement_ids',
    });

    const sysReqContent = await this.runSystemRequirementsDerivation(
      ctx, boundarySummary, frSummary, dmr32,
    );

    const sysReqRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: '3.2',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : [])],
      content: { kind: 'system_requirements', ...sysReqContent },
    });
    artifactIds.push(sysReqRecord.id);
    engine.ingestionPipeline.ingest(sysReqRecord);

    // ── 3.3 — Interface Contract Specification ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.3');

    const externalSystemsList = boundaryContent.external_systems
      .map(e => `${e.id}: ${e.name} (${e.interface_type})`)
      .join('\n') || 'No external systems identified';

    const dmr33 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '3.3',
      requestingAgentRole: 'systems_agent',
      query: `Interface contracts for external systems: ${externalSystemsList.slice(0, 400)}`,
      detailFileLabel: 'p3_3_contracts',
      requiredOutputSpec: 'interface_contracts JSON — contracts array with protocol, data_format, error handling',
    });

    const contractsContent = await this.runInterfaceContractSpecification(
      ctx, boundarySummary, externalSystemsList, dmr33,
    );

    const contractsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: '3.3',
      produced_by_agent_role: 'systems_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [boundaryRecord.id, sysReqRecord.id],
      content: { kind: 'interface_contracts', ...contractsContent },
    });
    artifactIds.push(contractsRecord.id);
    engine.ingestionPipeline.ingest(contractsRecord);

    // ── 3.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.4');

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
      sub_phase_id: '3.4',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '3.5');

    const consistencyReport = this.runConsistencyCheck(
      boundaryContent, sysReqContent, contractsContent, frStories,
    );

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '3',
      sub_phase_id: '3.5',
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
      sub_phase_id: '3.5',
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
    const template = engine.templateLoader.findTemplate('systems_agent', '03_1_system_boundary');

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
        subPhaseId: '3.1',
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

  private async runSystemRequirementsDerivation(
    ctx: PhaseContext,
    boundarySummary: string,
    frSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<SystemRequirements> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('systems_agent', '03_2_system_requirements');

    const fallback: SystemRequirements = {
      items: [{
        id: 'SR-001',
        statement: 'System shall implement core functionality as specified in functional requirements',
        source_requirement_ids: ['US-001'],
        priority: 'high',
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      system_boundary_summary: boundarySummary,
      functional_requirements_summary: frSummary,
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
        subPhaseId: '3.2',
        agentRole: 'systems_agent',
        label: 'Phase 3.2 — System Requirements Derivation',
      },
    });

    // Parse defensively — qwen-3.5:9b emits the array under whichever
    // envelope name reads naturally to it (the agent has been observed
    // returning `{ system_requirements: [...] }` directly while the
    // schema property is `items`). cal-21 lost all 16 SRs to this
    // mismatch (reading sr[0] as a single-SR object then checking
    // .items, which doesn't exist on a single SR). Order: try the
    // envelope key, then the schema key, then fall through to parsed.
    // Whichever first contains a non-empty array wins.
    const parsed = result.parsed as Record<string, unknown> | null;
    const items = pickItemsArray<SystemRequirementItem>(parsed, ['system_requirements', 'items']);
    if (items && items.length > 0) return { items };
    return fallback;
  }

  private async runInterfaceContractSpecification(
    ctx: PhaseContext,
    boundarySummary: string,
    externalSystemsList: string,
    dmr: PhaseContextPacketResult,
  ): Promise<InterfaceContracts> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('systems_agent', '03_3_interface_contracts');

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
        subPhaseId: '3.3',
        agentRole: 'systems_agent',
        label: 'Phase 3.3 — Interface Contract Specification',
      },
    });

    // Defensive parsing — same pattern as 3.2 (see SR derivation
    // comment). 3.3 happens to currently emit `{ contracts: [...] }`
    // directly so the previous single-form parse worked, but the
    // model is free to wrap in `{ interface_contracts: [...] }` on
    // any retry. Use the same envelope-vs-schema-key resolver so
    // either form is accepted and we never silently fall back when
    // the model produced real output.
    const parsed = result.parsed as Record<string, unknown> | null;
    const contracts = pickItemsArray<InterfaceContract>(parsed, ['interface_contracts', 'contracts']);
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
    frStories: Array<Record<string, unknown>>,
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // Invariant: Every FR maps to at least one System Requirement
    const coveredFrIds = new Set<string>();
    for (const item of sysReq.items) {
      for (const srcId of item.source_requirement_ids) {
        coveredFrIds.add(srcId);
      }
    }
    const uncoveredFr = frStories
      .map(s => s.id as string)
      .filter(id => id && !coveredFrIds.has(id));
    if (uncoveredFr.length > 0) {
      warnings.push('uncovered-functional-requirements');
      traceability.push({
        assertion: 'Every FR maps to at least one System Requirement',
        pass: false,
        failures: uncoveredFr.map(id => ({ item_id: id, explanation: `FR ${id} has no System Requirement` })),
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
  entries: string[],
): { decisions: string[]; questions: string[] } {
  const decisions: string[] = [];
  const questions: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
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

function techConstraintToExternal(t: Record<string, unknown>): ExternalSystem | null {
  const id = typeof t.id === 'string' ? t.id : '';
  if (!id) return null;
  return {
    id,
    name: (t.technology as string) ?? (t.name as string) ?? id,
    purpose: (t.text as string) ?? (t.rationale as string) ?? '',
    interface_type: (t.category as string) ?? 'technical',
  };
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

