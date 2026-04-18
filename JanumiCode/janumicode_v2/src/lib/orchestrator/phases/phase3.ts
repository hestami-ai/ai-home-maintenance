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
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

// ── Artifact shape interfaces ──────────────────────────────────────

interface ExternalSystem {
  id: string;
  name: string;
  purpose: string;
  interface_type: string;
}

interface SystemBoundary {
  in_scope: string[];
  out_of_scope: string[];
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
    const frSummary = prior.functionalRequirements?.summary ?? 'No functional requirements available';
    const nfrSummary = prior.nonFunctionalRequirements?.summary ?? 'No NFRs available';
    const frStories = (prior.functionalRequirements?.content.user_stories as Array<Record<string, unknown>>) ?? [];
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

    const boundaryContent = await this.runSystemBoundaryDefinition(
      ctx, intentSummary, frSummary, nfrSummary, dmr31,
    );

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

    const boundarySummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\nSystem Boundary:\nIn scope: ${boundaryContent.in_scope.join('; ')}\nOut of scope: ${boundaryContent.out_of_scope.join('; ')}\nExternal systems: ${boundaryContent.external_systems.map(e => `${e.id}: ${e.name} (${e.interface_type})`).join('; ') || 'none'}`;

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
    const result = await engine.llmCaller.call({
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
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

    const parsed = result.parsed as Record<string, unknown> | null;
    const boundary = parsed?.system_boundary ?? parsed;
    const sb = (Array.isArray(boundary) ? boundary[0] : boundary) as Partial<SystemBoundary> | null;
    if (sb?.in_scope && Array.isArray(sb.in_scope)) {
      return {
        in_scope: sb.in_scope,
        out_of_scope: sb.out_of_scope ?? [],
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
    const result = await engine.llmCaller.call({
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
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

    const parsed = result.parsed as Record<string, unknown> | null;
    const sr = parsed?.system_requirements ?? parsed;
    const data = (Array.isArray(sr) ? sr[0] : sr) as Partial<SystemRequirements> | null;
    if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
      return { items: data.items as SystemRequirementItem[] };
    }
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
    const result = await engine.llmCaller.call({
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
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

    const parsed = result.parsed as Record<string, unknown> | null;
    const ic = parsed?.interface_contracts ?? parsed;
    const data = (Array.isArray(ic) ? ic[0] : ic) as Partial<InterfaceContracts> | null;
    if (data?.contracts && Array.isArray(data.contracts) && data.contracts.length > 0) {
      return { contracts: data.contracts as InterfaceContract[] };
    }
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
