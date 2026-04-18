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

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord, PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

// ── Artifact shape interfaces ──────────────────────────────────────

interface DataModels {
  models: Array<{
    component_id: string;
    entities: Array<{
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

// ── Handler ────────────────────────────────────────────────────────

export class Phase5Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '5';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const componentSummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${prior.componentModel?.summary ?? 'No component model available'}`;
    const domainsSummary = prior.softwareDomains?.summary ?? 'No domains available';
    const contractsSummary = prior.interfaceContracts?.summary ?? 'No interface contracts available';
    const derivedFromIds = prior.allRecordIds;

    // ── 5.1 — Data Model Specification ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.1');

    const dmr51 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '5.1',
      requestingAgentRole: 'technical_spec_agent',
      query: `Data model specification for components: ${componentSummary.slice(0, 400)}`,
      detailFileLabel: 'p5_1_data_models',
      requiredOutputSpec: 'data_models JSON — entities with fields and relationships per component',
    });

    const dataModelsContent = await this.runDataModelSpecification(
      ctx, componentSummary, domainsSummary, dmr51,
    );

    const dataModelsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: '5.1',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'data_models', ...dataModelsContent },
    });
    artifactIds.push(dataModelsRecord.id);
    engine.ingestionPipeline.ingest(dataModelsRecord);

    // ── 5.2 — API Definition ──────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.2');

    const dmr52 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '5.2',
      requestingAgentRole: 'technical_spec_agent',
      query: `API definitions for components with contracts: ${contractsSummary.slice(0, 400)}`,
      detailFileLabel: 'p5_2_apis',
      requiredOutputSpec: 'api_definitions JSON — endpoints with inputs, outputs, error codes, auth',
    });

    const apiContent = await this.runApiDefinition(
      ctx, componentSummary, contractsSummary, dmr52,
    );

    const apiRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: '5.2',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id, ...(prior.interfaceContracts ? [prior.interfaceContracts.recordId] : [])],
      content: { kind: 'api_definitions', ...apiContent },
    });
    artifactIds.push(apiRecord.id);
    engine.ingestionPipeline.ingest(apiRecord);

    // ── 5.3 — Error Handling Strategy ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.3');

    const apiSummary = apiContent.definitions.map(d => {
      const eps = d.endpoints.map(e => `  ${e.method} ${e.path} (auth: ${e.auth_requirement ?? 'none'})`).join('\n');
      return `Component ${d.component_id}:\n${eps}`;
    }).join('\n');

    const dmr53 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '5.3',
      requestingAgentRole: 'technical_spec_agent',
      query: `Error handling strategy for APIs: ${apiSummary.slice(0, 400)}`,
      detailFileLabel: 'p5_3_errors',
      requiredOutputSpec: 'error_handling_strategies JSON — strategies with error types, detection, response',
    });

    const errorContent = await this.runErrorHandlingStrategy(
      ctx, componentSummary, apiSummary, dmr53,
    );

    const errorRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: '5.3',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [apiRecord.id],
      content: { kind: 'error_handling_strategies', ...errorContent },
    });
    artifactIds.push(errorRecord.id);
    engine.ingestionPipeline.ingest(errorRecord);

    // ── 5.4 — Configuration Parameters ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.4');

    const dataModelsSummary = dataModelsContent.models.map(m => {
      const ents = m.entities.map(e => `  ${e.name}: ${e.fields.map(f => `${f.name}:${f.type}`).join(', ')}`).join('\n');
      return `Component ${m.component_id}:\n${ents}`;
    }).join('\n');

    const dmr54 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '5.4',
      requestingAgentRole: 'technical_spec_agent',
      query: `Configuration parameters for data models: ${dataModelsSummary.slice(0, 400)}`,
      detailFileLabel: 'p5_4_config',
      requiredOutputSpec: 'configuration_parameters JSON — params with name, type, default, description',
    });

    const configContent = await this.runConfigurationParameters(
      ctx, componentSummary, dataModelsSummary, dmr54,
    );

    const configRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: '5.4',
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [dataModelsRecord.id],
      content: { kind: 'configuration_parameters', ...configContent },
    });
    artifactIds.push(configRecord.id);
    engine.ingestionPipeline.ingest(configRecord);

    // ── 5.5 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.5');

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
      sub_phase_id: '5.5',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '5.6');

    const consistencyReport = this.runConsistencyCheck(dataModelsContent, apiContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: '5.6',
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
      sub_phase_id: '5.6',
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

    return { success: true, artifactIds };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  private async runDataModelSpecification(
    ctx: PhaseContext, componentSummary: string, domainsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<DataModels> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', '05_1_data_models');
    const fallback: DataModels = { models: [{ component_id: 'COMP-001', entities: [{ name: 'Record', fields: [{ name: 'id', type: 'uuid' }, { name: 'created_at', type: 'timestamp' }] }] }] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      software_domains_summary: domainsSummary, detail_file_path: dmr.detailFilePath,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.llmCaller.call({
      provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: '5.1', agentRole: 'technical_spec_agent', label: 'Phase 5.1 — Data Model Specification' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const dm = parsed?.data_models ?? parsed;
    const data = (Array.isArray(dm) ? dm[0] : dm) as Partial<DataModels> | null;
    if (data?.models && Array.isArray(data.models) && data.models.length > 0) return { models: data.models as DataModels['models'] };
    return fallback;
  }

  private async runApiDefinition(
    ctx: PhaseContext, componentSummary: string, contractsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ApiDefinitions> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', '05_2_api_definitions');
    const fallback: ApiDefinitions = { definitions: [{ component_id: 'COMP-001', endpoints: [{ path: '/api/v1/resource', method: 'GET', auth_requirement: 'bearer_token' }] }] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      interface_contracts_summary: contractsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.llmCaller.call({
      provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: '5.2', agentRole: 'technical_spec_agent', label: 'Phase 5.2 — API Definition' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const ad = parsed?.api_definitions ?? parsed;
    const data = (Array.isArray(ad) ? ad[0] : ad) as Partial<ApiDefinitions> | null;
    if (data?.definitions && Array.isArray(data.definitions) && data.definitions.length > 0) return { definitions: data.definitions as ApiDefinitions['definitions'] };
    return fallback;
  }

  private async runErrorHandlingStrategy(
    ctx: PhaseContext, componentSummary: string, apiSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ErrorHandlingStrategies> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', '05_3_error_handling');
    const fallback: ErrorHandlingStrategies = { strategies: [{ component_id: 'COMP-001', error_types: ['validation_error', 'not_found'], detection: 'try/catch with typed errors', response: 'return error response with appropriate status code', surfacing: 'HTTP status codes and JSON error body' }] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      api_definitions_summary: apiSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.llmCaller.call({
      provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: '5.3', agentRole: 'technical_spec_agent', label: 'Phase 5.3 — Error Handling Strategy' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const eh = parsed?.error_handling_strategies ?? parsed;
    const data = (Array.isArray(eh) ? eh[0] : eh) as Partial<ErrorHandlingStrategies> | null;
    if (data?.strategies && Array.isArray(data.strategies) && data.strategies.length > 0) return { strategies: data.strategies as ErrorHandlingStrategies['strategies'] };
    return fallback;
  }

  private async runConfigurationParameters(
    ctx: PhaseContext, componentSummary: string, dataModelsSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<ConfigurationParameters> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('technical_spec_agent', '05_4_configuration_parameters');
    const fallback: ConfigurationParameters = { params: [{ component_id: 'COMP-001', name: 'port', type: 'integer', default: 3000, required: false, description: 'HTTP server listen port' }] };
    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText, component_model_summary: componentSummary,
      data_models_summary: dataModelsSummary,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.llmCaller.call({
      provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '5', subPhaseId: '5.4', agentRole: 'technical_spec_agent', label: 'Phase 5.4 — Configuration Parameters' },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const cp = parsed?.configuration_parameters ?? parsed;
    const data = (Array.isArray(cp) ? cp[0] : cp) as Partial<ConfigurationParameters> | null;
    if (data?.params && Array.isArray(data.params) && data.params.length > 0) return { params: data.params as ConfigurationParameters['params'] };
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
