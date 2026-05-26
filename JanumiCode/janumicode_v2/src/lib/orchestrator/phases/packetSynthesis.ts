/**
 * Packet synthesis sub-phase — runs as the first sub-phase of Phase 9.
 *
 * Walks the governed stream for the current workflow run, calls the
 * pure indexer / builder / verifier under packetSynthesis/, persists
 * one implementation_packet record per atomic Phase 6.1a task, writes
 * a packet_synthesis_failure record when any coherence assertion fails,
 * and updates workflow_runs telemetry columns.
 *
 * Routing on coherence failure is deferred to b.4 (cycle_controller
 * loop activation). In this minimum-viable form:
 *   - auto mode: log warnings, continue to Phase 9 task execution
 *   - interactive mode: log warnings (the mirror is also a follow-up)
 *
 * Even without routing, this sub-phase delivers significant value:
 *   - packets are written and visible in the governed stream
 *   - the trace report can render packet + coherence sections
 *   - Phase 9 (b.3) reads packets and gets full context per task
 *
 * See docs/design/implementation-packet-synthesis.md.
 */

import { getLogger } from '../../logging';
import { emitLifecycle } from '../../trace/lifecycle';
import type { OrchestratorEngine } from '../orchestratorEngine';
import type {
  WorkflowRun,
  ImplementationPacketContent,
  PacketSynthesisFailureContent,
  GovernedStreamRecord,
} from '../../types/records';
import { indexArtifacts, type UpstreamArtifactInput } from './packetSynthesis/upstreamIndex';
import {
  buildPackets,
  type BuilderAtomicTask,
  type BuilderUserStory,
  type BuilderNfr,
  type BuilderComponent,
  type BuilderDataModel,
  type BuilderApiDef,
  type BuilderTestSuite,
  type BuilderEvaluationCriterion,
  type BuilderTechnicalConstraint,
  type BuilderComplianceItem,
} from './packetSynthesis/packetBuilder';
import { verifyCoherence, applyCoherenceResults } from './packetSynthesis/coherenceVerifier';

export interface PacketSynthesisContext {
  workflowRun: WorkflowRun;
  engine: OrchestratorEngine;
}

export interface PacketSynthesisResult {
  packets: ImplementationPacketContent[];
  totalBlockingFailures: number;
  totalAdvisoryFindings: number;
  totalAiProposedRoots: number;
  failedPackets: number;
}

// ── DB walking ──────────────────────────────────────────────────────

function collectArtifacts(records: GovernedStreamRecord[]): UpstreamArtifactInput[] {
  return records
    .filter((r) => r.record_type === 'artifact_produced')
    .map((r) => ({
      sub_phase_id: r.sub_phase_id ?? '',
      content: r.content as Record<string, unknown>,
    }))
    .filter((a) => a.sub_phase_id.length > 0);
}

function collectSaturationNodes(records: GovernedStreamRecord[]): Array<{ recordType: string; content: Record<string, unknown> }> {
  return records
    .filter((r) =>
      r.record_type === 'component_decomposition_node'
      || r.record_type === 'data_model_decomposition_node'
      || r.record_type === 'task_decomposition_node'
      || r.record_type === 'test_decomposition_node',
    )
    .map((r) => ({
      recordType: r.record_type as string,
      content: r.content as Record<string, unknown>,
    }));
}

function collectAtomicTasks(records: GovernedStreamRecord[]): BuilderAtomicTask[] {
  const out: BuilderAtomicTask[] = [];
  for (const r of records) {
    if (r.record_type !== 'task_decomposition_node') continue;
    const content = r.content as Record<string, unknown>;
    if (content.status !== 'atomic') continue;
    const nodeId = typeof content.node_id === 'string' ? content.node_id : r.id;
    out.push({
      node_id: nodeId,
      content: content as unknown as BuilderAtomicTask['content'],
    });
  }
  return out;
}

function collectUserStories(records: GovernedStreamRecord[]): BuilderUserStory[] {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'fr_bloom_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    if (content.kind !== 'functional_requirements') continue;
    const us = content.user_stories;
    if (Array.isArray(us)) return us as BuilderUserStory[];
  }
  return [];
}

function collectNfrs(records: GovernedStreamRecord[]): BuilderNfr[] {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'nfr_bloom_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    if (content.kind !== 'nonfunctional_requirements') continue;
    const arr = content.nonfunctional_requirements;
    if (Array.isArray(arr)) return arr as BuilderNfr[];
  }
  return [];
}

function collectComponents(records: GovernedStreamRecord[]): Map<string, BuilderComponent> {
  const byId = new Map<string, BuilderComponent>();
  // Skeleton roots first.
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'component_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    const comps = content.components;
    if (!Array.isArray(comps)) continue;
    for (const c of comps as BuilderComponent[]) {
      if (c.id) byId.set(c.id, c);
    }
  }
  // Saturation children — overwrite the skeleton with the more-decomposed
  // leaf shape when present.
  for (const r of records) {
    if (r.record_type !== 'component_decomposition_node') continue;
    const content = r.content as Record<string, unknown>;
    const entity = content.component as BuilderComponent | undefined;
    if (entity?.id) byId.set(entity.id, entity);
  }
  return byId;
}

function collectDataModels(records: GovernedStreamRecord[]): BuilderDataModel[] {
  // Phase 5.1 emits `data_models` artifact with shape:
  //   { kind: 'data_models', models: [{ component_id, entities: [{ name, fields[] }] }] }
  // Flatten one BuilderDataModel per (component_id, entity) pair so the
  // downstream packet builder can find entities by component_id without
  // re-walking nested structure. Synthesizing the per-entity id from
  // component_id + entity name keeps it stable across runs.
  const out: BuilderDataModel[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'data_model_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    const models = content.models;
    if (!Array.isArray(models)) continue;
    for (const m of models as Array<Record<string, unknown>>) {
      const componentId = typeof m.component_id === 'string' ? m.component_id : '';
      const entities = Array.isArray(m.entities) ? (m.entities as Array<Record<string, unknown>>) : [];
      for (const e of entities) {
        const name = typeof e.name === 'string' ? e.name : '';
        if (!name) continue;
        const id = `dm-${componentId}-${name}`.toLowerCase();
        const fields = Array.isArray(e.fields)
          ? (e.fields as Array<Record<string, unknown>>).map((f) => ({
              name: typeof f.name === 'string' ? f.name : '',
              type: typeof f.type === 'string' ? f.type : '',
              constraints: typeof f.constraints === 'string'
                ? f.constraints
                : Array.isArray(f.constraints) ? f.constraints.join(', ') : undefined,
            }))
          : [];
        if (!out.find((x) => x.id === id)) out.push({ id, name, component_id: componentId, fields });
      }
    }
  }
  // Saturation leaves keep their existing shape — `content.data_model` is
  // a BuilderDataModel directly. Preserve the path for backward compat.
  for (const r of records) {
    if (r.record_type !== 'data_model_decomposition_node') continue;
    const content = r.content as Record<string, unknown>;
    const dm = content.data_model as BuilderDataModel | undefined;
    if (dm?.id && !out.find((x) => x.id === dm.id)) out.push(dm);
  }
  return out;
}

function collectApiDefs(records: GovernedStreamRecord[]): BuilderApiDef[] {
  // Phase 5.2 emits `api_definitions` artifact with shape:
  //   { kind: 'api_definitions', definitions: [{ component_id, endpoints: [{ path, method, inputs, outputs, error_codes }] }] }
  // Flatten one BuilderApiDef per (component_id, method, path).
  const out: BuilderApiDef[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'api_definitions') continue;
    const content = r.content as Record<string, unknown>;
    const defs = content.definitions;
    if (!Array.isArray(defs)) continue;
    for (const d of defs as Array<Record<string, unknown>>) {
      const componentId = typeof d.component_id === 'string' ? d.component_id : '';
      const endpoints = Array.isArray(d.endpoints) ? (d.endpoints as Array<Record<string, unknown>>) : [];
      for (const ep of endpoints) {
        const method = typeof ep.method === 'string' ? ep.method : '';
        const path = typeof ep.path === 'string' ? ep.path : '';
        if (!method && !path) continue;
        const id = `api-${componentId}-${method}-${path}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        if (out.find((x) => x.id === id)) continue;
        out.push({
          id,
          method,
          path,
          description: typeof ep.description === 'string' ? ep.description : undefined,
          component_id: componentId,
          request_shape: ep.inputs ?? ep.request_shape,
          response_shape: ep.outputs ?? ep.response_shape,
          error_codes: Array.isArray(ep.error_codes) ? ep.error_codes as string[] : undefined,
        });
      }
    }
  }
  return out;
}

function collectTestSuites(records: GovernedStreamRecord[]): BuilderTestSuite[] {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'test_case_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    const arr = content.test_suites;
    if (Array.isArray(arr)) return arr as BuilderTestSuite[];
  }
  return [];
}

function collectEvaluationCriteria(records: GovernedStreamRecord[]): BuilderEvaluationCriterion[] {
  const out: BuilderEvaluationCriterion[] = [];
  const mappings: Array<{ subPhase: string; kind: BuilderEvaluationCriterion['kind']; idField: string }> = [
    { subPhase: 'evaluation_design', kind: 'functional', idField: 'functional_requirement_id' },
    { subPhase: 'evaluation_metrics', kind: 'quality', idField: 'nonfunctional_requirement_id' },
    { subPhase: 'evaluation_thresholds', kind: 'reasoning', idField: 'functional_requirement_id' },
  ];
  for (const { subPhase, kind, idField } of mappings) {
    for (const r of records) {
      if (r.record_type !== 'artifact_produced') continue;
      if (r.sub_phase_id !== subPhase) continue;
      const content = r.content as Record<string, unknown>;
      const criteria = content.criteria;
      if (!Array.isArray(criteria)) continue;
      for (const c of criteria) {
        const obj = c as Record<string, unknown>;
        const targetId = (obj[idField] ?? obj.functional_requirement_id ?? obj.nonfunctional_requirement_id) as string | undefined;
        if (!targetId) continue;
        out.push({
          kind,
          target_id: targetId,
          evaluation_method: typeof obj.evaluation_method === 'string' ? obj.evaluation_method : '',
          success_condition: typeof obj.success_condition === 'string' ? obj.success_condition : '',
        });
      }
    }
  }
  return out;
}

function collectTechnicalConstraints(records: GovernedStreamRecord[]): Map<string, BuilderTechnicalConstraint> {
  const byId = new Map<string, BuilderTechnicalConstraint>();
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'technical_constraints_discovery') continue;
    const content = r.content as Record<string, unknown>;
    const arr = content.technicalConstraints;
    if (!Array.isArray(arr)) continue;
    for (const t of arr as BuilderTechnicalConstraint[]) {
      if (t.id) byId.set(t.id, t);
    }
  }
  return byId;
}

function collectComplianceItems(records: GovernedStreamRecord[]): Map<string, BuilderComplianceItem> {
  const byId = new Map<string, BuilderComplianceItem>();
  const mappings: Array<{ subPhase: string; arrayKey: string; kind: BuilderComplianceItem['kind'] }> = [
    { subPhase: 'compliance_retention_discovery', arrayKey: 'compliance_extracted_items', kind: 'compliance' },
    { subPhase: 'vv_requirements_discovery', arrayKey: 'vvRequirements', kind: 'vv_requirement' },
  ];
  for (const { subPhase, arrayKey, kind } of mappings) {
    for (const r of records) {
      if (r.record_type !== 'artifact_produced') continue;
      if (r.sub_phase_id !== subPhase) continue;
      const content = r.content as Record<string, unknown>;
      const arr = content[arrayKey];
      if (!Array.isArray(arr)) continue;
      for (const item of arr as Array<Record<string, unknown>>) {
        const id = item.id;
        if (typeof id !== 'string' || id.length === 0) continue;
        byId.set(id, {
          id,
          kind,
          description: typeof item.text === 'string' ? item.text :
                       typeof item.target === 'string' ? item.target : '',
          measurable_condition: typeof item.threshold === 'string' ? item.threshold : undefined,
        });
      }
    }
  }
  // QA-N synthetic ids — string-array, no original id field.
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'integrations_qa_bloom') continue;
    const content = r.content as Record<string, unknown>;
    const arr = content.qualityAttributes;
    if (!Array.isArray(arr)) continue;
    (arr as string[]).forEach((q, i) => {
      const id = `QA-${i + 1}`;
      byId.set(id, { id, kind: 'quality_attribute', description: typeof q === 'string' ? q : '' });
    });
  }
  return byId;
}

// ── Main entry ──────────────────────────────────────────────────────

export function runPacketSynthesisSubPhase(
  ctx: PacketSynthesisContext,
): PacketSynthesisResult {
  const { workflowRun, engine } = ctx;
  engine.stateMachine.setSubPhase(workflowRun.id, 'packet_synthesis');
  const logger = getLogger();

  // Walk the DB once per record type we need.
  const recordTypes = [
    'artifact_produced',
    'task_decomposition_node',
    'component_decomposition_node',
    'data_model_decomposition_node',
    'test_decomposition_node',
  ] as const;
  const allRecords: GovernedStreamRecord[] = [];
  for (const rt of recordTypes) {
    allRecords.push(...engine.writer.getRecordsByType(workflowRun.id, rt));
  }

  // Build the upstream-id index.
  const upstreamIndex = indexArtifacts({
    artifacts: collectArtifacts(allRecords),
    saturationNodes: collectSaturationNodes(allRecords),
  });

  // Collect builder inputs.
  const atomicTasks = collectAtomicTasks(allRecords);
  if (atomicTasks.length === 0) {
    logger.warn('workflow', 'packet_synthesis: no atomic Phase 6.1a tasks found — emitting no packets', {
      workflow_run_id: workflowRun.id,
    });
    return { packets: [], totalBlockingFailures: 0, totalAdvisoryFindings: 0, totalAiProposedRoots: 0, failedPackets: 0 };
  }

  const packets = buildPackets({
    atomicTasks,
    userStories: collectUserStories(allRecords),
    nfrs: collectNfrs(allRecords),
    componentsById: collectComponents(allRecords),
    dataModels: collectDataModels(allRecords),
    apiDefinitions: collectApiDefs(allRecords),
    testSuites: collectTestSuites(allRecords),
    evaluationCriteria: collectEvaluationCriteria(allRecords),
    technicalConstraintsById: collectTechnicalConstraints(allRecords),
    complianceItemsById: collectComplianceItems(allRecords),
  });

  // Run coherence verifier.
  const atomicTaskIds = new Set(atomicTasks.map((t) => t.content.task.id));
  const verifierResult = verifyCoherence({ packets, upstreamIndex, atomicTaskIds });
  applyCoherenceResults(packets, verifierResult.byPacketId);

  // Persist each packet.
  for (const packet of packets) {
    engine.writer.writeRecord({
      record_type: 'implementation_packet',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: packet as unknown as Record<string, unknown>,
    });
    // Tier-1 lifecycle: emit one packet.synthesized per packet with the
    // coherence verdict and the per-field shape that the ts-18 archaeology
    // was reduced to inferring from the DB. With this in place,
    // `grep '"event":"packet.synthesized"' lifecycle.ndjson | jq` answers
    // "how many packets failed coherence?" in one shell command.
    emitLifecycle('packet.synthesized', {
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      packet_id: packet.packet_id,
      task_id: packet.task?.id ?? null,
      component_id: packet.component?.id ?? null,
      coherence_passed: packet.coherence.passed,
      blocking_failure_codes: packet.coherence.blocking_failures.map((f) => f.split(':')[0]),
      blocking_failure_count: packet.coherence.blocking_failures.length,
      advisory_finding_count: packet.coherence.advisory_findings.length,
      user_story_count: packet.user_stories?.length ?? 0,
      nfr_count: packet.nfrs?.length ?? 0,
      data_model_count: packet.data_models?.length ?? 0,
      api_definition_count: packet.api_definitions?.length ?? 0,
      test_case_count: packet.test_cases?.length ?? 0,
      evaluation_criteria_count: packet.evaluation_criteria?.length ?? 0,
      active_constraint_count: packet.active_constraints?.length ?? 0,
    });
  }

  // Persist failure record if any blocking failures occurred.
  if (verifierResult.totals.blockingFailures > 0) {
    const failuresByPacket: Record<string, string[]> = {};
    for (const p of packets) {
      if (p.coherence.blocking_failures.length > 0) {
        failuresByPacket[p.packet_id] = p.coherence.blocking_failures;
      }
    }
    const crossPacketFailures: Record<string, string[]> = {};
    for (const [code, details] of verifierResult.crossPacket) {
      crossPacketFailures[code] = details;
    }
    const failureContent: PacketSynthesisFailureContent = {
      kind: 'packet_synthesis_failure',
      schemaVersion: '1.0',
      failures_by_packet: failuresByPacket,
      cross_packet_failures: crossPacketFailures,
      total_packets: verifierResult.totals.packetsTotal,
      failed_packets: verifierResult.totals.packetsFailed,
      total_blocking_failures: verifierResult.totals.blockingFailures,
      total_advisory_findings: verifierResult.totals.advisoryFindings,
      total_ai_proposed_root_count: verifierResult.totals.aiProposedRootCount,
    };
    engine.writer.writeRecord({
      record_type: 'packet_synthesis_failure',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: failureContent as unknown as Record<string, unknown>,
    });
    logger.warn('workflow', 'packet_synthesis: coherence failures detected (auto-routing to cycle_controller is b.4, currently log-only)', {
      workflow_run_id: workflowRun.id,
      packets_total: verifierResult.totals.packetsTotal,
      packets_failed: verifierResult.totals.packetsFailed,
      blocking_failures: verifierResult.totals.blockingFailures,
      advisory_findings: verifierResult.totals.advisoryFindings,
      ai_proposed_root_count: verifierResult.totals.aiProposedRootCount,
    });
  } else {
    logger.info('workflow', 'packet_synthesis: all packets coherent', {
      workflow_run_id: workflowRun.id,
      packets_total: verifierResult.totals.packetsTotal,
      advisory_findings: verifierResult.totals.advisoryFindings,
      ai_proposed_root_count: verifierResult.totals.aiProposedRootCount,
    });
  }

  // Update workflow_runs telemetry columns.
  try {
    engine.db.prepare(
      `UPDATE workflow_runs
         SET packet_count = ?,
             packet_coherence_blocking_count = ?,
             packet_coherence_advisory_count = ?
       WHERE id = ?`,
    ).run(
      verifierResult.totals.packetsTotal,
      verifierResult.totals.blockingFailures,
      verifierResult.totals.advisoryFindings,
      workflowRun.id,
    );
  } catch (err) {
    logger.warn('workflow', 'packet_synthesis: failed to update workflow_runs telemetry', { error: String(err) });
  }

  return {
    packets,
    totalBlockingFailures: verifierResult.totals.blockingFailures,
    totalAdvisoryFindings: verifierResult.totals.advisoryFindings,
    totalAiProposedRoots: verifierResult.totals.aiProposedRootCount,
    failedPackets: verifierResult.totals.packetsFailed,
  };
}
