/**
 * Phase 5 — Technical Specification.
 * Based on JanumiCode Spec v2.3, §4 Phase 5.
 *
 * Sub-phases:
 *   5.1 — Data Model Specification (Technical Spec Agent LLM call)
 *   5.2 — API Definition (Technical Spec Agent LLM call)
 *   5.3 — Error Handling Strategy Specification (Technical Spec Agent LLM call)
 *   5.4 — Configuration Parameter Specification (Technical Spec Agent LLM call)
 *   5.5 — Technical Specification Mirror and Menu (human review)
 *   5.6 — Consistency Check and Approval (phase gate)
 */

import { randomUUID } from 'node:crypto';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  PhaseId,
  TechnicalConstraint,
  DecompositionEntity,
  DataModelDecompositionNodeContent,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveComponentView } from './phaseContext';
import { normalizeIdsInTree, normalizeComponentIdRef } from '../idNormalization';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray } from '../parsedResponseHelpers';
import { runDataModelSaturationLoop } from './phase5_1a';
import { renderComponentBlockForTask } from './phase6';
import { mintEntityIds, mintEndpointIds } from './phase5/dataModelIdMinter';
import { chunkedCoverageBloom } from './chunkedCoverageBloom';
import type { PromptTemplate } from '../templateLoader';
import { emit as aoddEmit } from '../../aodd';

// ── Artifact shape interfaces ──────────────────────────────────────

interface DataModels {
  models: Array<{
    component_id: string;
    entities: Array<{
      /** Producer-minted stable id (DM-<comp>-<name>); see dataModelIdMinter. */
      id?: string;
      name: string;
      fields: Array<{ name: string; type: string; constraints?: string }>;
      relationships?: string[];
    }>;
  }>;
}

interface ApiDefinitions {
  definitions: Array<{
    component_id: string;
    endpoints: Array<{
      /** Producer-minted stable id (API-<comp>-<method>-<path>); see dataModelIdMinter. */
      id?: string;
      path: string;
      method: string;
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
      error_codes?: Array<Record<string, unknown>>;
      auth_requirement?: string;
    }>;
  }>;
}

interface ErrorHandlingStrategies {
  strategies: Array<{
    component_id: string;
    error_types: string[];
    detection: string;
    response: string;
    surfacing: string;
  }>;
}

interface ConfigurationParameters {
  params: Array<{
    component_id: string;
    name: string;
    type: string;
    default: unknown;
    required: boolean;
    description: string;
  }>;
}

/** One `models[]` entry (a single component's data model). */
type DataModelEntry = DataModels['models'][number];

// ── Phase 5.1 per-component chunking helpers (SD-3) ──────────────────
//
// The monolithic data_model_skeleton call asked ONE response to cover every
// input component_id (~46 leaf components). gpt-oss:20b drifts mid-response at
// that cardinality (dropped `type` keys → invalid JSON / DM-001). The remedy
// mirrors the P6.1 task_skeleton fix: one BOUNDED call per component, then the
// orchestrator owns the 100%-coverage guarantee via chunkedCoverageBloom — a
// deterministic component-coverage oracle finds components no model covered and
// routes them through focused reconciliation passes until covered (or the budget
// is spent → an honest, non-fabricated residual). Coverage keys on
// `component_id` (a direct field) rather than a traces_to walk.

/**
 * Canonical component id a data model covers. The oracle keys on this, so the
 * SAME normalization the merged tree gets (normalizeComponentIdRef,
 * `COMP-001`→`comp-001`) is applied here BEFORE coverage is computed — else a
 * case-drifted model would read as covering nothing. Missing id ⇒ ''.
 */
export function dataModelComponentRef(model: { component_id?: unknown }): string {
  return typeof model.component_id === 'string' ? normalizeComponentIdRef(model.component_id) : '';
}

/**
 * Deterministic coverage oracle: the input component ids that no produced model
 * covers. A pure mirror of the set difference chunkedCoverageBloom computes via
 * `coveredBy` — exported so the contract is unit-testable in isolation.
 */
export function computeUncoveredComponentIds(
  models: Array<{ component_id?: unknown }>,
  targetCoverageSet: Set<string>,
): Set<string> {
  const covered = new Set<string>();
  for (const m of models) {
    const ref = dataModelComponentRef(m);
    if (ref) covered.add(ref);
  }
  const out = new Set<string>();
  for (const cid of targetCoverageSet) if (!covered.has(cid)) out.add(cid);
  return out;
}

/** Partition uncovered component ids into BOUNDED batches (one reconciliation call each). */
export function chunkComponentIds(ids: string[], maxPerBatch: number): Array<Set<string>> {
  const size = Math.max(1, maxPerBatch);
  const batches: Array<Set<string>> = [];
  for (let i = 0; i < ids.length; i += size) {
    batches.push(new Set(ids.slice(i, i + size)));
  }
  return batches;
}

/**
 * Collapse a per-component generation call's `models[]` into ONE model for the
 * scoped component. The call is scoped to exactly `cid`, so every entity it
 * designs belongs to `cid` — force the attribution (a deterministic producer
 * bridge, house rule) so coverage is robust to the model echoing a display_key
 * or wrong-case id, and merge all entities (dedup by name) into one entry.
 * Returns null when the call produced no named entities (→ honest [], never a
 * fabricated placeholder).
 */
export function consolidateEntitiesForComponent(
  models: Array<{ entities?: unknown }>,
  cid: string,
): DataModelEntry | null {
  const entities: DataModelEntry['entities'] = [];
  const seenNames = new Set<string>();
  for (const m of models) {
    const ents = Array.isArray(m.entities) ? (m.entities as DataModelEntry['entities']) : [];
    for (const e of ents) {
      const name = e && typeof e.name === 'string' ? e.name : '';
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      entities.push(e);
    }
  }
  if (entities.length === 0) return null;
  return { component_id: cid, entities };
}

/**
 * Render the reconciliation routing menu: each uncovered component's canonical
 * id + its responsibilities, so the reconciliation call can design that
 * component's data models. `component_id` MUST be emitted verbatim as the id
 * shown here (the oracle re-checks coverage on it).
 */
export function renderUncoveredComponentsMenu(
  uncovered: Set<string>,
  componentByNormId: Map<string, Record<string, unknown>>,
): string {
  const lines: string[] = [];
  for (const normId of uncovered) {
    const c = componentByNormId.get(normId);
    if (!c) {
      lines.push(`- ${normId}`);
      continue;
    }
    lines.push(`- ${normId}: ${typeof c.name === 'string' ? c.name : normId}`);
    if (Array.isArray(c.responsibilities)) {
      for (const r of c.responsibilities as Array<Record<string, unknown>>) {
        const txt = typeof r.description === 'string'
          ? r.description
          : (typeof r.statement === 'string' ? r.statement : '');
        if (txt) lines.push(`    - ${txt}`);
      }
    }
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase5Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '5';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    // Wave 7 — prefer the leaf-level component view when a Phase 4.2a
    // tree exists. Falls back to the flat component_model summary when
    // the tree is absent (default-lens runs / older fixtures).
    const componentDecompositionNodes = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveComponents = buildEffectiveComponentView(componentDecompositionNodes, prior);
    if (effectiveComponents.source === 'leaves') {
      getLogger().info('workflow', 'Phase 5: consuming Wave 7 component leaves', {
        leafCount: effectiveComponents.leafCount,
        rootCount: effectiveComponents.rootCount,
      });
    }
    const componentSummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${effectiveComponents.summary || (prior.componentModel?.summary ?? 'No component model available')}`;
    // PA-4: per-component scoped context so a single-entity saturation call sees
    // only its OWN component, not the whole component backlog.
    const componentSummaryById: Record<string, string> = {};
    for (const c of effectiveComponents.components as Array<Record<string, unknown>>) {
      const cid = typeof c.id === 'string' ? c.id : '';
      if (cid) componentSummaryById[cid] = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${renderComponentBlockForTask(c)}`;
    }
    const domainsSummary = prior.softwareDomains?.summary ?? 'No domains available';
    const contractsSummary = prior.interfaceContracts?.summary ?? 'No interface contracts available';
    // Phase 3.2 SR layer threaded into every Phase 5 sub-phase:
    //   5.1 entities — what each model must support per SR
    //   5.2 endpoints — what each API call satisfies per SR
    //   5.3 error strategies — error-handling expectations per SR
    //   5.4 config params — retention, audit, SLO knobs per SR
    // Pre-cal-22 the SR layer was a placeholder so threading it
    // would have hurt; post-replay (or post-fix on next run) the
    // 16-SR list adds real signal without prompt-template changes
    // beyond `system_requirements_summary` (already wired here).
    const sysReqSummary = prior.systemRequirements?.summary ?? 'No system requirements available';
    const derivedFromIds = prior.allRecordIds;

    // ── 5.1 — Data Model Specification ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'data_model_skeleton');

    const componentIds = effectiveComponents.components
      .map(c => (typeof c.id === 'string' ? c.id : ''))
      .filter(Boolean);
    const techConstraintsArtifact = allArtifacts.find(
      r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery',
    );
    const techConstraintsRecId = techConstraintsArtifact?.id;
    // Build the canonical TECH-* roster summary up front. Every Phase 5
    // sub-phase (data_model_skeleton, api_definitions, error_handling,
    // configuration_parameters) needs to see the verbatim spec excerpts
    // — the LLM-rephrased active_constraints narrative loses critical
    // exclusion phrases ("no microservices", "logs to stdout", etc.).
    // ts-104 audit found Phase 5 prompts emitting decisions that
    // contradicted TECH-* (e.g. POST /logs endpoints despite stdout-only
    // mandate, max_events_per_minute despite rate-limiting being out of
    // scope). Same fix pattern as Phase 4 ADR (cycle from 2026-05-22).
    const techConstraintsForPrompt = (
      techConstraintsArtifact
        ? ((techConstraintsArtifact.content as Record<string, unknown>).technicalConstraints as Array<Record<string, unknown>> ?? [])
        : []
    );
    const technicalConstraintsSummary = techConstraintsForPrompt.length === 0
      ? 'No technical_constraints_discovery artifact available'
      : techConstraintsForPrompt
          .map(t => {
            const id = (t.id as string) ?? '';
            const tech = (t.technology as string) ?? (t.name as string) ?? '';
            const category = (t.category as string) ?? '';
            const text = (t.text as string) ?? (t.rationale as string) ?? '';
            return [id, tech, category, text].filter(Boolean).join(' — ');
          })
          .filter(Boolean)
          .join('\n');
    const dmr51Seeds = [
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(techConstraintsRecId ? [techConstraintsRecId] : []),
    ];
    const dmr51 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'data_model_skeleton',
      requestingAgentRole: 'technical_spec_agent',
      query: `Data model design for components ${componentIds.join(', ')} per component_model ${prior.componentModel?.recordId ?? 'unknown'}, system_requirements ${prior.systemRequirements?.recordId ?? 'unknown'}, technical_constraints ${techConstraintsRecId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr51Seeds,
      detailFileLabel: 'p5_1_data_models',
      requiredOutputSpec: 'data_models JSON — entities with fields and relationships per component',
    });

    const dataModelsContent = await this.runDataModelSpecification(
      ctx,
      effectiveComponents.components as Array<Record<string, unknown>>,
      componentIds,
      componentSummaryById,
      domainsSummary, sysReqSummary, technicalConstraintsSummary, dmr51,
    );

    // Normalize component_id refs to the canonical lowercase `comp-`
    // prefix that the Phase 4 component_skeleton + recursive component
    // decomposition tree uses. ts-13 showed the Phase 5 LLM emitting
    // `COMP-001` while Phase 4 used `comp-001`, silently breaking
    // referential integrity for downstream data_model_saturation and
    // Phase 6 task decomposition.
    const dmContent = { kind: 'data_models', ...dataModelsContent } as unknown as Record<string, unknown>;
    normalizeIdsInTree(dmContent, new Set(['component_id']), normalizeComponentIdRef);
    // Producer-side stable entity ids (Pillar A) — deterministic + idempotent,
    // so the packet collector + coherence index reference the same real id.
    mintEntityIds(dmContent as Parameters<typeof mintEntityIds>[0]);
    const dataModelsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'data_model_skeleton',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: dmContent,
    });
    artifactIds.push(dataModelsRecord.id);
    engine.ingestionPipeline.ingest(dataModelsRecord);

    // ── 5.1a — Recursive Data Model Decomposition (Wave 9) ────
    engine.stateMachine.setSubPhase(workflowRun.id, 'data_model_saturation');

    const techConstraintsRecord = allArtifacts.find(
      r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery',
    );
    const technicalConstraints: TechnicalConstraint[] = techConstraintsRecord
      ? (((techConstraintsRecord.content as Record<string, unknown>).technicalConstraints) as TechnicalConstraint[] ?? [])
      : [];

    // Resume guard — skip seeding when depth-0 nodes already exist.
    const existingDataModelRoots = engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node')
      .filter(r => (r.content as unknown as DataModelDecompositionNodeContent).depth === 0);
    let rootEntities: DecompositionEntity[];
    let rootDataModelRecordIds: string[];
    let rootDataModelLogicalIds: string[];
    if (existingDataModelRoots.length > 0) {
      getLogger().info('workflow', 'Phase 5.1a RESUME: depth-0 entity nodes already present', {
        existingRoots: existingDataModelRoots.length,
      });
      rootEntities = existingDataModelRoots.map(r => (r.content as unknown as DataModelDecompositionNodeContent).entity);
      rootDataModelRecordIds = existingDataModelRoots.map(r => r.id);
      rootDataModelLogicalIds = existingDataModelRoots.map(r => (r.content as unknown as DataModelDecompositionNodeContent).node_id);
    } else {
      // Convert Phase 5.1's data_models entries into per-entity roots.
      // Each `models[].entities[]` element becomes one depth-0 root.
      const constraintIds = technicalConstraints.map(t => t.id);
      rootEntities = dataModelsContent.models.flatMap(m =>
        m.entities.map(e => ({
          // Use the producer-minted stable id (Pillar A) so the saturation
          // tree references the same DM-* id as the skeleton + packets.
          id: e.id ?? e.name,
          name: e.name,
          kind: 'aggregate' as const,
          component_id: m.component_id,
          fields: e.fields.map(f => ({
            name: f.name,
            type: f.type,
            constraints: f.constraints,
          })),
          relationships: (e.relationships ?? []).map(rel => ({
            target_entity_id: rel,
            kind: 'references' as const,
          })),
          active_constraints: constraintIds,
        })),
      );
      rootDataModelRecordIds = [];
      rootDataModelLogicalIds = [];
      for (const entity of rootEntities) {
        const logicalNodeId = randomUUID();
        const rec = engine.writer.writeRecord({
          record_type: 'data_model_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '5',
          sub_phase_id: 'data_model_saturation',
          produced_by_agent_role: 'technical_spec_agent',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [dataModelsRecord.id],
          content: {
            kind: 'data_model_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: entity.id,
            root_entity_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            entity,
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: null,
          } satisfies DataModelDecompositionNodeContent,
        });
        rootDataModelRecordIds.push(rec.id);
        rootDataModelLogicalIds.push(logicalNodeId);
        artifactIds.push(rec.id);
      }
    }

    if (rootEntities.length > 0) {
      await runDataModelSaturationLoop(ctx, {
        technicalConstraints,
        componentSummary,
        componentSummaryById,
        rootEntities,
        rootNodeRecordIds: rootDataModelRecordIds,
        rootLogicalIds: rootDataModelLogicalIds,
        systemRequirementsSummary: sysReqSummary,
      });
    }

    // ── 5.2 — API Definition ──────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'api_definitions');

    const contractIds = ((prior.interfaceContracts?.content.contracts as Array<Record<string, unknown>>) ?? [])
      .map(c => (typeof c.id === 'string' ? c.id : ''))
      .filter(Boolean);
    const dmr52Seeds = [
      dataModelsRecord.id,
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.interfaceContracts ? [prior.interfaceContracts.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
    ];
    const dmr52 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'api_definitions',
      requestingAgentRole: 'technical_spec_agent',
      query: `API definitions for components ${componentIds.join(', ')} fulfilling interface_contracts ${contractIds.join(', ')} on data_models ${dataModelsRecord.id}.`,
      knownRelevantRecordIds: dmr52Seeds,
      detailFileLabel: 'p5_2_apis',
      requiredOutputSpec: 'api_definitions JSON — endpoints with inputs, outputs, error codes, auth',
    });

    const apiContent = await this.runApiDefinition(
      ctx, componentSummary, contractsSummary, sysReqSummary, technicalConstraintsSummary, dmr52,
    );

    // Producer-side stable endpoint ids (Pillar A) — deterministic + idempotent.
    const apiContentWithKind = { kind: 'api_definitions', ...apiContent } as unknown as Record<string, unknown>;
    mintEndpointIds(apiContentWithKind as Parameters<typeof mintEndpointIds>[0]);
    const apiRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'api_definitions',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id, ...(prior.interfaceContracts ? [prior.interfaceContracts.recordId] : [])],
      content: apiContentWithKind,
    });
    artifactIds.push(apiRecord.id);
    engine.ingestionPipeline.ingest(apiRecord);

    // ── 5.3 — Error Handling Strategy ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'error_handling');

    const apiSummary = apiContent.definitions.map(d => {
      const eps = d.endpoints.map(e => `  ${e.method} ${e.path} (auth: ${e.auth_requirement ?? 'none'})`).join('\n');
      return `Component ${d.component_id}:\n${eps}`;
    }).join('\n');

    const dmr53Seeds = [
      apiRecord.id,
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr53 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'error_handling',
      requestingAgentRole: 'technical_spec_agent',
      query: `Error handling strategies for components ${componentIds.join(', ')} against api_definitions ${apiRecord.id} per NFRs ${prior.nonFunctionalRequirements?.recordId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr53Seeds,
      detailFileLabel: 'p5_3_errors',
      requiredOutputSpec: 'error_handling_strategies JSON — strategies with error types, detection, response',
    });

    const errorContent = await this.runErrorHandlingStrategy(
      ctx, componentSummary, apiSummary, sysReqSummary, technicalConstraintsSummary, dmr53,
    );

    const errorRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'error_handling',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [apiRecord.id],
      content: { kind: 'error_handling_strategies', ...errorContent },
    });
    artifactIds.push(errorRecord.id);
    engine.ingestionPipeline.ingest(errorRecord);

    // ── 5.4 — Configuration Parameters ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'configuration_parameters');

    const dataModelsSummary = dataModelsContent.models.map(m => {
      const ents = m.entities.map(e => `  ${e.name}: ${e.fields.map(f => `${f.name}:${f.type}`).join(', ')}`).join('\n');
      return `Component ${m.component_id}:\n${ents}`;
    }).join('\n');

    const dmr54Seeds = [
      dataModelsRecord.id,
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
    ];
    const dmr54 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'configuration_parameters',
      requestingAgentRole: 'technical_spec_agent',
      query: `Configuration parameters for components ${componentIds.join(', ')} against data_models ${dataModelsRecord.id} per NFRs ${prior.nonFunctionalRequirements?.recordId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr54Seeds,
      detailFileLabel: 'p5_4_config',
      requiredOutputSpec: 'configuration_parameters JSON — params with name, type, default, description',
    });

    const configContent = await this.runConfigurationParameters(
      ctx, componentSummary, dataModelsSummary, sysReqSummary, technicalConstraintsSummary, dmr54,
    );

    const configRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'configuration_parameters',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id],
      content: { kind: 'configuration_parameters', ...configContent },
    });
    artifactIds.push(configRecord.id);
    engine.ingestionPipeline.ingest(configRecord);

    // ── 5.5 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'technical_spec_synthesis');

    const specMirror = engine.mirrorGenerator.generate({
      artifactId: dataModelsRecord.id,
      artifactType: 'technical_specification',
      content: {
        data_models_count: dataModelsContent.models.length,
        api_definitions_count: apiContent.definitions.length,
        error_strategies_count: errorContent.strategies.length,
        config_params_count: configContent.params.length,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'technical_spec_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id, apiRecord.id, errorRecord.id, configRecord.id],
      content: {
        kind: 'technical_specification_mirror',
        mirror_id: specMirror.mirrorId,
        artifact_id: dataModelsRecord.id,
        artifact_type: 'technical_specification',
        fields: specMirror.fields,
        data_models_count: dataModelsContent.models.length,
        api_definitions_count: apiContent.definitions.length,
        error_strategies_count: errorContent.strategies.length,
        config_params_count: configContent.params.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: specMirror.mirrorId,
      artifactType: 'technical_specification',
    });
    aoddEmit('mirror.presented', {
      mirror_id: specMirror.mirrorId,
      artifact_type: 'technical_specification',
    });

    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id, mirrorRecord.id, 'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected technical specification', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 5 review failed', { error: String(err) });
      return { success: false, error: 'Technical specification review failed', artifactIds };
    }

    // ── 5.6 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'technical_spec_gate');

    const consistencyReport = this.runConsistencyCheck(dataModelsContent, apiContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'technical_spec_gate',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id, apiRecord.id, errorRecord.id, configRecord.id],
      content: { kind: 'consistency_report', ...consistencyReport },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: 'technical_spec_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id, apiRecord.id, errorRecord.id, configRecord.id, consistencyRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '5',
        data_models_record_id: dataModelsRecord.id,
        api_definitions_record_id: apiRecord.id,
        error_handling_record_id: errorRecord.id,
        configuration_record_id: configRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '5' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  /**
   * Phase 5.1 data-model specification — PER-COMPONENT chunking + coverage-driven
   * reconciliation (SD-3), replacing the single monolithic call that asked one
   * response to cover all ~46 leaf components (→ mid-response format drift). One
   * bounded call per component (its scoped block only), then chunkedCoverageBloom
   * owns the 100% component-coverage guarantee. NEVER fabricates (ts-117): a
   * per-component generator returns [] on failure and the whole method returns an
   * honest empty `{models:[]}` if nothing was produced — the residual is logged,
   * never invented. The returned `{models}` shape is byte-identical to before, so
   * the per-entity depth-0 seeding + saturation loop downstream are untouched.
   */
  private async runDataModelSpecification(
    ctx: PhaseContext,
    components: Array<Record<string, unknown>>,
    componentIds: string[],
    componentSummaryById: Record<string, string>,
    domainsSummary: string,
    sysReqSummary: string, technicalConstraintsSummary: string, dmr: PhaseContextPacketResult,
  ): Promise<DataModels> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', 'data_model_skeleton');
    // Empty — NEVER fabricate placeholder content (ts-117: a fabricated
    // api fallback shipped spec-violating endpoints downstream). On
    // failure we emit an honest empty result + a loud error log so the
    // gap is visible, not silently wrong.
    const fallback: DataModels = { models: [] };
    if (!template) return fallback;

    const reconTemplate = engine.templateLoader.findTemplate('technical_spec_agent', 'data_model_reconciliation');

    // Coverage oracle (NEW — none existed): every input component_id must be
    // covered by >=1 model. Normalize the target set to the SAME canonical form
    // `coveredBy` uses so case drift can't cause a phantom miss.
    const targetCoverageSet = new Set(componentIds.map(normalizeComponentIdRef));
    const componentByNormId = new Map<string, Record<string, unknown>>();
    for (const c of components) {
      const cid = typeof c.id === 'string' ? c.id : '';
      if (cid) componentByNormId.set(normalizeComponentIdRef(cid), c);
    }

    const maxReconPasses = Math.max(0, Number.parseInt(process.env.JANUMICODE_P5_RECON_PASSES ?? '2', 10) || 0);
    const maxComponentsPerBatch = Math.max(1, Number.parseInt(process.env.JANUMICODE_P5_RECON_BATCH_COMPONENTS ?? '10', 10) || 10);

    const { produced } = await chunkedCoverageBloom<string, DataModelEntry>({
      chunks: componentIds,
      // ── Per-component generation: ONE bounded call per component ──
      generateForChunk: async (cid) => {
        const scoped = componentSummaryById[cid];
        if (!scoped) return [];
        const rendered = engine.templateLoader.render(template, {
          active_constraints: dmr.activeConstraintsText, component_model_summary: scoped,
          software_domains_summary: domainsSummary,
          system_requirements_summary: sysReqSummary,
          technical_constraints_summary: technicalConstraintsSummary,
          detail_file_path: dmr.detailFilePath,
          detail_file_content: dmr.detailFileContent,
          janumicode_version_sha: engine.janumiCodeVersionSha,
        });
        if (rendered.missing_variables.length > 0) return [];
        try {
          // LLM throws are caught here so one component never sinks the phase —
          // the reconciliation pass recovers any component it would have covered.
          // Route through requirements_agent routing for llamacpp via llama-swap.
          const result = await engine.callForRole('requirements_agent', {
            prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
            traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: 'data_model_skeleton', agentRole: 'technical_spec_agent', label: `Phase 5.1 — Data Model Specification (${cid})` },
          });
          // Defensive parse — cal-21 lost 6 of 7 data models to the SR-loss bug
          // pattern (kind-name envelope vs schema property name).
          const parsed = result.parsed as Record<string, unknown> | null;
          const models = pickItemsArray<DataModelEntry>(parsed, ['data_models', 'models']);
          if (!models || models.length === 0) {
            this.logPhase5ParseFailure(ctx, 'data_model_skeleton', result.text);
            return [];
          }
          const merged = consolidateEntitiesForComponent(models, cid);
          return merged ? [merged] : [];
        } catch (err) {
          getLogger().warn('workflow', 'Phase 5.1 per-component data-model generation failed — continuing', {
            component_id: cid, error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }
      },
      idOf: (m) => dataModelComponentRef(m),
      targetCoverageSet,
      coveredBy: (m) => {
        const ref = dataModelComponentRef(m);
        return ref ? [ref] : [];
      },
      chunkUncovered: (uncovered) => chunkComponentIds([...uncovered], maxComponentsPerBatch),
      reconcileBatch: reconTemplate
        ? (batch, info) => this.reconcileUncoveredDataModels(
            ctx, reconTemplate, batch, componentByNormId, sysReqSummary, technicalConstraintsSummary, dmr, info,
          )
        : undefined,
      maxReconPasses,
      onResidual: (residual) => {
        getLogger().warn('workflow', 'Phase 5.1 residual uncovered components after reconciliation (honest gap — upstream component divergence, not fabricated)', {
          residual: residual.size, total: targetCoverageSet.size, component_ids: [...residual],
        });
      },
      logLabel: 'Phase 5.1',
    });

    if (produced.length === 0) {
      // Honest empty — the residual log above already fired; never fabricate.
      this.logPhase5ParseFailure(ctx, 'data_model_skeleton', undefined);
      return fallback;
    }
    return { models: produced };
  }

  /**
   * Reconciliation pass: design data models for the components no per-component
   * call covered. Small/focused — sees only the uncovered components (id +
   * responsibilities) as routing targets. Returns [] on failure (caller logs the
   * residual gap; NO fabrication). Crediting robustness (accept only models whose
   * `component_id` is a still-uncovered target in THIS batch) is enforced by the
   * shared bloom helper.
   */
  private async reconcileUncoveredDataModels(
    ctx: PhaseContext,
    template: PromptTemplate,
    uncovered: Set<string>,
    componentByNormId: Map<string, Record<string, unknown>>,
    sysReqSummary: string,
    technicalConstraintsSummary: string,
    dmr: PhaseContextPacketResult,
    batchInfo?: { pass: number; batchIndex: number; batchCount: number },
  ): Promise<DataModelEntry[]> {
    const { engine } = ctx;
    const menu = renderUncoveredComponentsMenu(uncovered, componentByNormId);
    if (!menu) return [];
    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      uncovered_components: menu,
      system_requirements_summary: sysReqSummary,
      technical_constraints_summary: technicalConstraintsSummary,
    });
    if (rendered.missing_variables.length > 0) return [];
    const label = batchInfo
      ? `Phase 5.1 — Coverage Reconciliation (pass ${batchInfo.pass}, batch ${batchInfo.batchIndex}/${batchInfo.batchCount}, ${uncovered.size} components)`
      : `Phase 5.1 — Coverage Reconciliation (${uncovered.size} orphan components)`;
    try {
      const result = await engine.callForRole('requirements_agent', {
        prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
        traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: 'data_model_skeleton', agentRole: 'technical_spec_agent', label },
      });
      const parsed = result.parsed as Record<string, unknown> | null;
      const models = pickItemsArray<DataModelEntry>(parsed, ['data_models', 'models']);
      if (!models || models.length === 0) {
        getLogger().warn('workflow', 'Phase 5.1 reconciliation batch yielded no usable data models', {
          label, parse_failed: parsed == null, component_count: uncovered.size,
        });
        return [];
      }
      return models;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 5.1 reconciliation call failed', {
        label, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Loud, queryable signal that a Phase 5 sub-phase's JSON could not be
   * parsed even after deterministic structural recovery + LLM repair, so
   * an EMPTY (never fabricated) result is being emitted. The json_repair
   * trail records the repair attempts; this surfaces the downstream gap
   * explicitly rather than letting a fabricated placeholder pass silently.
   */
  private logPhase5ParseFailure(ctx: PhaseContext, subPhaseId: string, rawText: string | undefined): void {
    getLogger().error('workflow', `Phase 5 ${subPhaseId}: JSON parse + repair FAILED — emitting EMPTY result (no fabrication). Downstream will show a visible gap, not fabricated/spec-violating content.`, {
      workflow_run_id: ctx.workflowRun.id,
      sub_phase_id: subPhaseId,
      raw_excerpt: (rawText ?? '').slice(0, 400),
    });
  }

  private async runApiDefinition(
    ctx: PhaseContext, componentSummary: string, contractsSummary: string,
    sysReqSummary: string, technicalConstraintsSummary: string, dmr: PhaseContextPacketResult,
  ): Promise<ApiDefinitions> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', 'api_definitions');
    const fallback: ApiDefinitions = { definitions: [] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      interface_contracts_summary: contractsSummary,
      system_requirements_summary: sysReqSummary,
      technical_constraints_summary: technicalConstraintsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: 'api_definitions', agentRole: 'technical_spec_agent', label: 'Phase 5.2 — API Definition' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const definitions = pickItemsArray<ApiDefinitions['definitions'][number]>(parsed, ['api_definitions', 'definitions']);
    if (definitions && definitions.length > 0) return { definitions };
    this.logPhase5ParseFailure(ctx, 'api_definitions', result.text);
    return fallback;
  }

  private async runErrorHandlingStrategy(
    ctx: PhaseContext, componentSummary: string, apiSummary: string,
    sysReqSummary: string, technicalConstraintsSummary: string, dmr: PhaseContextPacketResult,
  ): Promise<ErrorHandlingStrategies> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', 'error_handling');
    const fallback: ErrorHandlingStrategies = { strategies: [] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      api_definitions_summary: apiSummary,
      system_requirements_summary: sysReqSummary,
      technical_constraints_summary: technicalConstraintsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: 'error_handling', agentRole: 'technical_spec_agent', label: 'Phase 5.3 — Error Handling Strategy' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const strategies = pickItemsArray<ErrorHandlingStrategies['strategies'][number]>(parsed, ['error_handling_strategies', 'strategies']);
    if (strategies && strategies.length > 0) return { strategies };
    this.logPhase5ParseFailure(ctx, 'error_handling', result.text);
    return fallback;
  }

  private async runConfigurationParameters(
    ctx: PhaseContext, componentSummary: string, dataModelsSummary: string,
    sysReqSummary: string, technicalConstraintsSummary: string, dmr: PhaseContextPacketResult,
  ): Promise<ConfigurationParameters> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', 'configuration_parameters');
    const fallback: ConfigurationParameters = { params: [] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      data_models_summary: dataModelsSummary,
      system_requirements_summary: sysReqSummary,
      technical_constraints_summary: technicalConstraintsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: 'configuration_parameters', agentRole: 'technical_spec_agent', label: 'Phase 5.4 — Configuration Parameters' },
    });
    // cal-21 lost 23 of 24 configuration parameters here. Same bug.
    const parsed = result.parsed as Record<string, unknown> | null;
    const params = pickItemsArray<ConfigurationParameters['params'][number]>(parsed, ['configuration_parameters', 'params']);
    if (params && params.length > 0) return { params };
    this.logPhase5ParseFailure(ctx, 'configuration_parameters', result.text);
    return fallback;
  }

  /** Deterministic consistency check across Phase 5 artifacts. */
  private runConsistencyCheck(
    dataModels: DataModels, apiDefs: ApiDefinitions,
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // DM-001: No entity field without a type
    const untypedFields: Array<{ item_id: string; explanation: string }> = [];
    for (const model of dataModels.models) {
      for (const entity of model.entities) {
        for (const field of entity.fields) {
          if (!field.type) untypedFields.push({ item_id: `${entity.name}.${field.name}`, explanation: `Field ${field.name} in ${entity.name} has no type` });
        }
      }
    }
    if (untypedFields.length > 0) {
      blockingFailures.push('untyped-entity-fields');
      traceability.push({ assertion: 'Every entity field has a specified type (DM-001)', pass: false, failures: untypedFields });
    }

    // API-001: Every endpoint has auth_requirement
    const noAuthEndpoints: Array<{ item_id: string; explanation: string }> = [];
    for (const def of apiDefs.definitions) {
      for (const ep of def.endpoints) {
        if (!ep.auth_requirement) noAuthEndpoints.push({ item_id: `${def.component_id}:${ep.method} ${ep.path}`, explanation: `Endpoint ${ep.method} ${ep.path} has no auth_requirement` });
      }
    }
    if (noAuthEndpoints.length > 0) {
      warnings.push('endpoints-without-auth');
      traceability.push({ assertion: 'Every endpoint has an explicit auth requirement (API-001)', pass: false, failures: noAuthEndpoints });
    }

    return { overall_pass: blockingFailures.length === 0, traceability_results: traceability, semantic_findings: [], blocking_failures: blockingFailures, warnings };
  }
}
