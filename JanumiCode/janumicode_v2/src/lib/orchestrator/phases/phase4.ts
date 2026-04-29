/**
 * Phase 4 — Architecture Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 4.
 *
 * Sub-phases:
 *   4.1 — Software Domain Identification (Architecture Agent LLM call)
 *   4.2 — Component Decomposition (Architecture Agent LLM call)
 *   4.3 — Architectural Decision Capture (Architecture Agent LLM call)
 *   4.4 — Architecture Mirror and Menu (human review + implementability)
 *   4.5 — Consistency Check and Approval (phase gate)
 */

import { randomUUID } from 'node:crypto';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  PhaseId,
  ProductDescriptionHandoffContent,
  TechnicalConstraint,
  DecompositionComponent,
  ComponentDecompositionNodeContent,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveComponentView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray } from '../parsedResponseHelpers';
import { runComponentSaturationLoop } from './phase4_2a';

// ── Artifact shape interfaces ──────────────────────────────────────

interface UbiquitousLanguageTerm {
  term: string;
  definition: string;
}

interface SoftwareDomain {
  id: string;
  name: string;
  ubiquitous_language: UbiquitousLanguageTerm[];
  system_requirement_ids?: string[];
}

interface SoftwareDomains {
  domains: SoftwareDomain[];
}

interface Responsibility {
  id: string;
  statement: string;
}

interface Dependency {
  target_component_id: string;
  dependency_type: string;
}

interface Component {
  id: string;
  name: string;
  domain_id?: string;
  responsibilities: Responsibility[];
  dependencies?: Dependency[];
  /** IDs of requirements this component satisfies (for Architecture Canvas edges) */
  satisfies_requirement_ids?: string[];
}

interface ComponentModel {
  components: Component[];
}

interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context?: string;
  decision: string;
  alternatives?: string[];
  rationale: string;
  consequences?: string[];
  /** IDs of components this ADR governs (for Architecture Canvas edges) */
  governs_components?: string[];
}

interface ArchitecturalDecisions {
  adrs: ADR[];
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase4Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '4';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const boundarySummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${prior.systemBoundary?.summary ?? 'No system boundary available'}`;
    const sysReqSummary = prior.systemRequirements?.summary ?? 'No system requirements available';
    const sysReqItems = (prior.systemRequirements?.content.items as Array<Record<string, unknown>>) ?? [];
    const derivedFromIds = prior.allRecordIds;

    // ── 4.1 — Software Domain Identification ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.1');

    const dmr41 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '4.1',
      requestingAgentRole: 'architecture_agent',
      query: `Software domain identification for project: ${prior.projectTypeDescription.slice(0, 400)}`,
      detailFileLabel: 'p4_1_domains',
      requiredOutputSpec: 'software_domains JSON — domains array with ubiquitous_language',
    });

    const domainsContent = await this.runSoftwareDomainIdentification(
      ctx, boundarySummary, sysReqSummary, dmr41,
    );

    const domainsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.1',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'software_domains', ...domainsContent },
    });
    artifactIds.push(domainsRecord.id);
    engine.ingestionPipeline.ingest(domainsRecord);

    // ── 4.2 — Component Decomposition ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.2');

    const domainsSummary = domainsContent.domains.map(d => {
      const terms = d.ubiquitous_language.map(t => `${t.term}: ${t.definition}`).join('; ');
      return `${d.id}: ${d.name} (reqs: ${(d.system_requirement_ids ?? []).join(', ')})\n  Terms: ${terms}`;
    }).join('\n');

    const dmr42 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '4.2',
      requestingAgentRole: 'architecture_agent',
      query: `Component decomposition for domains: ${domainsSummary.slice(0, 400)}`,
      detailFileLabel: 'p4_2_components',
      requiredOutputSpec: 'component_model JSON — components with responsibilities and dependencies',
    });

    const componentContent = await this.runComponentDecomposition(
      ctx, domainsSummary, sysReqSummary, dmr42,
    );

    const componentRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.2',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id],
      content: { kind: 'component_model', ...componentContent },
    });
    artifactIds.push(componentRecord.id);
    engine.ingestionPipeline.ingest(componentRecord);

    // ── 4.2a — Recursive Component Decomposition (Wave 7) ─────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.2a');

    // Read prerequisites: product handoff + Phase 1.0c technical
    // constraints. The constraints anchor each leaf component to the
    // user's stated stack (SvelteKit / Bun / PostgreSQL / etc.) so
    // downstream phases don't reinvent defaults from training data.
    const handoffRecord = engine.writer.getRecordsByType(workflowRun.id, 'product_description_handoff')[0];
    const handoff = (handoffRecord?.content ?? {}) as unknown as ProductDescriptionHandoffContent;
    const techConstraintsRecord = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery');
    const technicalConstraints: TechnicalConstraint[] = techConstraintsRecord
      ? (((techConstraintsRecord.content as Record<string, unknown>).technicalConstraints) as TechnicalConstraint[] ?? [])
      : [];

    // Convert Phase 4.2's flat ComponentModel shape into the
    // DecompositionComponent shape Wave 7 uses, and emit depth-0
    // component_decomposition_node records as seeds for the saturation
    // loop. Resume guard — skip if depth-0 nodes already exist (the
    // loop's resume helper will pick up from the prior state).
    const existingRoots = engine.writer.getRecordsByType(workflowRun.id, 'component_decomposition_node')
      .filter(r => (r.content as unknown as ComponentDecompositionNodeContent).depth === 0);
    let rootComponents: DecompositionComponent[];
    let rootNodeRecordIds: string[];
    let rootLogicalIds: string[];
    if (existingRoots.length > 0) {
      getLogger().info('workflow', 'Phase 4.2a RESUME: depth-0 nodes already present', {
        existingRoots: existingRoots.length,
      });
      rootComponents = existingRoots.map(r => (r.content as unknown as ComponentDecompositionNodeContent).component);
      rootNodeRecordIds = existingRoots.map(r => r.id);
      rootLogicalIds = existingRoots.map(r => (r.content as unknown as ComponentDecompositionNodeContent).node_id);
    } else {
      rootComponents = componentContent.components.map(c => ({
        id: c.id,
        name: c.name,
        domain_id: c.domain_id ?? null,
        responsibilities: c.responsibilities.map(r => ({ id: r.id, description: r.statement })),
        dependencies: (c.dependencies ?? []).map(d => ({
          component_id: d.target_component_id,
          // Phase 4.2's `dependency_type` is free-form string; coerce to the
          // four kinds Wave 7 supports — fall back to sync_call for unknowns.
          kind: ((['sync_call', 'async_event', 'data_read', 'data_write'] as const) as readonly string[])
            .includes(d.dependency_type)
            ? (d.dependency_type as 'sync_call' | 'async_event' | 'data_read' | 'data_write')
            : 'sync_call',
        })),
        active_constraints: technicalConstraints.map(t => t.id),
        traces_to: c.satisfies_requirement_ids,
      }));
      rootNodeRecordIds = [];
      rootLogicalIds = [];
      for (const rc of rootComponents) {
        const logicalNodeId = randomUUID();
        const rec = engine.writer.writeRecord({
          record_type: 'component_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '4',
          sub_phase_id: '4.2a',
          produced_by_agent_role: 'architecture_agent',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [componentRecord.id],
          content: {
            kind: 'component_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: rc.id,
            root_component_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            component: rc,
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: null,
          } satisfies ComponentDecompositionNodeContent,
        });
        rootNodeRecordIds.push(rec.id);
        rootLogicalIds.push(logicalNodeId);
        artifactIds.push(rec.id);
      }
    }

    // Run the saturation loop. Throws on configuration errors
    // (missing template etc.); per-node decomposition failures are
    // captured as `status='deferred'` rows inside the loop and never
    // halt the phase.
    if (rootComponents.length > 0) {
      await runComponentSaturationLoop(ctx, {
        handoff,
        technicalConstraints,
        domainsSummary,
        rootComponents,
        rootNodeRecordIds,
        rootLogicalIds,
      });
    }

    // ── 4.3 — Architectural Decision Capture ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.3');

    // Wave 7 — prefer leaf components for ADR capture so decisions
    // attach to the actual modules that will be implemented, not the
    // coarse Phase 4.2 roots. Falls back to the flat list when no
    // tree exists.
    const decompNodesForAdr = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveForAdr = buildEffectiveComponentView(decompNodesForAdr, prior);
    const adrComponentsSource = effectiveForAdr.source === 'leaves'
      ? effectiveForAdr.components.map(c => ({
          id: c.id as string,
          name: c.name as string,
          domain_id: c.domain_id as string | undefined,
          responsibilities: (c.responsibilities as Array<{ id: string; statement?: string; description?: string }>)
            .map(r => ({ id: r.id, statement: r.statement ?? r.description ?? '' })),
          dependencies: (c.dependencies as Array<{ target_component_id?: string; component_id?: string; dependency_type?: string; kind?: string }>)
            .map(d => ({
              target_component_id: d.target_component_id ?? d.component_id ?? '',
              dependency_type: d.dependency_type ?? d.kind ?? 'sync_call',
            })),
        }))
      : componentContent.components;
    const componentSummary = adrComponentsSource.map(c => {
      const resps = c.responsibilities.map(r => `  ${r.id}: ${r.statement}`).join('\n');
      const deps = (c.dependencies ?? []).map(d => `${d.target_component_id} (${d.dependency_type})`).join(', ');
      return `${c.id}: ${c.name} (domain: ${c.domain_id ?? 'unassigned'})\n  Responsibilities:\n${resps}\n  Dependencies: ${deps || 'none'}`;
    }).join('\n');

    const dmr43 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '4.3',
      requestingAgentRole: 'architecture_agent',
      query: `Architectural decisions for components: ${componentSummary.slice(0, 400)}`,
      detailFileLabel: 'p4_3_adrs',
      requiredOutputSpec: 'architectural_decisions JSON — adrs with context, decision, alternatives, consequences',
    });

    const adrsContent = await this.runADRCapture(
      ctx, componentSummary, domainsSummary, dmr43,
    );

    const adrsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.3',
      produced_by_agent_role: 'architecture_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id],
      content: { kind: 'architectural_decisions', ...adrsContent },
    });
    artifactIds.push(adrsRecord.id);
    engine.ingestionPipeline.ingest(adrsRecord);

    // ── 4.4 — Architecture Mirror and Menu ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.4');

    // Surface Wave 7 leaf-count + tier distribution in the architecture
    // mirror so the human sees how recursive decomposition expanded the
    // root components. Falls back to root count when no tree exists.
    const decompNodesForMirror = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveForMirror = buildEffectiveComponentView(decompNodesForMirror, prior);
    const tierDistribution = decompNodesForMirror.reduce<Record<string, number>>((acc, r) => {
      const c = r.content as unknown as ComponentDecompositionNodeContent;
      if (c.tier) acc[c.tier] = (acc[c.tier] ?? 0) + 1;
      return acc;
    }, {});

    const archMirror = engine.mirrorGenerator.generate({
      artifactId: componentRecord.id,
      artifactType: 'architecture_definition',
      content: {
        domains: domainsContent,
        components_count: componentContent.components.length,
        leaf_components_count: effectiveForMirror.leafCount,
        component_tier_distribution: tierDistribution,
        adrs_count: adrsContent.adrs.length,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id],
      content: {
        kind: 'architecture_mirror',
        mirror_id: archMirror.mirrorId,
        artifact_id: componentRecord.id,
        artifact_type: 'architecture_definition',
        fields: archMirror.fields,
        domains_count: domainsContent.domains.length,
        components_count: componentContent.components.length,
        leaf_components_count: effectiveForMirror.leafCount,
        component_tier_distribution: tierDistribution,
        adrs_count: adrsContent.adrs.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: archMirror.mirrorId,
      artifactType: 'architecture_definition',
    });

    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id, mirrorRecord.id, 'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected architecture definition', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 4 review failed', { error: String(err) });
      return { success: false, error: 'Architecture review failed', artifactIds };
    }

    // ── 4.5 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.5');

    const consistencyReport = this.runConsistencyCheck(
      componentContent, adrsContent, sysReqItems,
    );

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.5',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id],
      content: { kind: 'consistency_report', ...consistencyReport },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: '4.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [domainsRecord.id, componentRecord.id, adrsRecord.id, consistencyRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '4',
        software_domains_record_id: domainsRecord.id,
        component_model_record_id: componentRecord.id,
        architectural_decisions_record_id: adrsRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '4' });

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  private async runSoftwareDomainIdentification(
    ctx: PhaseContext,
    boundarySummary: string,
    sysReqSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<SoftwareDomains> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('architecture_agent', '04_1_software_domains');

    const fallback: SoftwareDomains = {
      domains: [{
        id: 'DOM-001',
        name: 'Core Domain',
        ubiquitous_language: [{ term: 'application', definition: 'The primary system being built' }],
        system_requirement_ids: ['SR-001'],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      system_boundary_summary: boundarySummary,
      system_requirements_summary: sysReqSummary,
      detail_file_path: dmr.detailFilePath,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '4',
        subPhaseId: '4.1',
        agentRole: 'architecture_agent',
        label: 'Phase 4.1 — Software Domain Identification',
      },
    });

    // Defensive parse — see parsedResponseHelpers.ts for the cal-21
    // SR-loss bug pattern this guards against. Phase 4.1 happens to
    // currently emit `{ domains: [...] }` (schema key) but the model
    // is free to switch to the kind-name envelope on retry.
    const parsed = result.parsed as Record<string, unknown> | null;
    const domains = pickItemsArray<SoftwareDomain>(parsed, ['software_domains', 'domains']);
    if (domains && domains.length > 0) return { domains };
    return fallback;
  }

  private async runComponentDecomposition(
    ctx: PhaseContext,
    domainsSummary: string,
    sysReqSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ComponentModel> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('architecture_agent', '04_2_component_decomposition');

    const fallback: ComponentModel = {
      components: [{
        id: 'COMP-001',
        name: 'Core Module',
        domain_id: 'DOM-001',
        responsibilities: [{ id: 'RESP-001', statement: 'Implement core application logic' }],
        dependencies: [],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      software_domains_summary: domainsSummary,
      system_requirements_summary: sysReqSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '4',
        subPhaseId: '4.2',
        agentRole: 'architecture_agent',
        label: 'Phase 4.2 — Component Decomposition',
      },
    });

    const parsed = result.parsed as Record<string, unknown> | null;
    const components = pickItemsArray<Component>(parsed, ['component_model', 'components']);
    if (components && components.length > 0) return { components };
    return fallback;
  }

  private async runADRCapture(
    ctx: PhaseContext,
    componentSummary: string,
    domainsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ArchitecturalDecisions> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('architecture_agent', '04_3_adr_capture');

    const fallback: ArchitecturalDecisions = {
      adrs: [{
        id: 'ADR-001',
        title: 'Primary technology stack',
        status: 'proposed',
        context: 'Technology selection for initial implementation',
        decision: 'Use the technology stack implied by the requirements',
        alternatives: ['Alternative stack'],
        rationale: 'Best fit for the described requirements and constraints',
        consequences: ['Team must have expertise in chosen stack'],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      component_model_summary: componentSummary,
      software_domains_summary: domainsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '4',
        subPhaseId: '4.3',
        agentRole: 'architecture_agent',
        label: 'Phase 4.3 — Architectural Decision Capture',
      },
    });

    // cal-21 lost 6 of 7 ADRs to this exact spot before the migration:
    // model emitted `{ architectural_decisions: [adr1..adr7] }`, the
    // old parser took adr1 as a single ADR, looked for `.adrs` inside
    // it (doesn't exist), fell back to the placeholder. Same pattern
    // as the SR-loss bug — see parsedResponseHelpers.ts.
    const parsed = result.parsed as Record<string, unknown> | null;
    const adrs = pickItemsArray<ADR>(parsed, ['architectural_decisions', 'adrs']);
    if (adrs && adrs.length > 0) return { adrs };
    return fallback;
  }

  /**
   * Deterministic consistency check across Phase 4 artifacts.
   */
  private runConsistencyCheck(
    components: ComponentModel,
    adrs: ArchitecturalDecisions,
    sysReqItems: Array<Record<string, unknown>>,
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // Invariant: Every Component has at least one Responsibility
    const emptyComponents = components.components.filter(
      c => !c.responsibilities || c.responsibilities.length === 0,
    );
    if (emptyComponents.length > 0) {
      blockingFailures.push('components-without-responsibilities');
      traceability.push({
        assertion: 'Every Component has at least one Responsibility (CM-002)',
        pass: false,
        failures: emptyComponents.map(c => ({ item_id: c.id, explanation: `Component ${c.name} has no responsibilities` })),
      });
    }

    // Invariant: No conjunction in responsibility statements (CM-001)
    const conjunctionViolations: Array<{ item_id: string; explanation: string }> = [];
    for (const comp of components.components) {
      for (const resp of comp.responsibilities ?? []) {
        if (/\band\b/i.test(resp.statement) || /\bor\b/i.test(resp.statement)) {
          conjunctionViolations.push({
            item_id: resp.id,
            explanation: `Responsibility "${resp.statement.slice(0, 80)}" contains a conjunction — split into separate responsibilities`,
          });
        }
      }
    }
    if (conjunctionViolations.length > 0) {
      warnings.push('responsibility-conjunction-violations');
      traceability.push({
        assertion: 'No Component Responsibility contains conjunctions (CM-001)',
        pass: false,
        failures: conjunctionViolations,
      });
    }

    // Invariant: Every ADR has decision and rationale
    const incompleteAdrs = adrs.adrs.filter(a => !a.decision || !a.rationale);
    if (incompleteAdrs.length > 0) {
      warnings.push('incomplete-adrs');
      traceability.push({
        assertion: 'Every ADR has decision and rationale (ADR-001, ADR-002)',
        pass: false,
        failures: incompleteAdrs.map(a => ({ item_id: a.id, explanation: `ADR ${a.title} missing decision or rationale` })),
      });
    }

    // Check: circular dependencies
    const depGraph = new Map<string, string[]>();
    for (const comp of components.components) {
      depGraph.set(comp.id, (comp.dependencies ?? []).map(d => d.target_component_id));
    }
    const cycles = this.detectCycles(depGraph);
    if (cycles.length > 0) {
      warnings.push('circular-dependencies');
      traceability.push({
        assertion: 'No circular Dependencies without explicit ADR justification',
        pass: false,
        failures: cycles.map(cycle => ({ item_id: cycle.join('->'), explanation: `Circular dependency: ${cycle.join(' -> ')}` })),
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

  /** Simple DFS cycle detection on the component dependency graph. */
  private detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) cycles.push(path.slice(cycleStart).concat(node));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      for (const neighbor of graph.get(node) ?? []) {
        dfs(neighbor, [...path, node]);
      }
      inStack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, []);
    }
    return cycles;
  }
}
