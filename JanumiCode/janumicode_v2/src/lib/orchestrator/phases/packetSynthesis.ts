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
import type { OrchestratorEngine } from '../orchestratorEngine';
import type {
  WorkflowRun,
  ImplementationPacketContent,
  PacketSynthesisFailureContent,
  GovernedStreamRecord,
  PropertySpec,
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
  type BuilderCrossCuttingConstraint,
} from './packetSynthesis/packetBuilder';
import { ARTIFACT_ID_SPECS } from './packetSynthesis/artifactIdSpec';
import { mintEntityId, mintEndpointId } from './phase5/dataModelIdMinter';
import { buildRequirementLineage } from './packetSynthesis/idResolution';
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
      || r.record_type === 'test_decomposition_node'
      // FR/NFR-saturation leaves carry decomposed user-story ids (US-002-D1)
      // and their composite ACs (AC-US-002-D1-001) under content.user_story.
      // Phase 7 test cases + Phase 8 evals trace to THOSE leaf ids, not just
      // the canonical roots — without indexing them every leaf reference is a
      // false P7_INVENTED_ID_REFERENCE (slice-131: 8111 of them).
      || r.record_type === 'requirement_decomposition_node',
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

export function collectUserStories(records: GovernedStreamRecord[]): BuilderUserStory[] {
  const byId = new Map<string, BuilderUserStory>();
  // Roots first (the canonical 27 US-001..US-NNN from fr_bloom_skeleton).
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'fr_bloom_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    if (content.kind !== 'functional_requirements') continue;
    const us = content.user_stories;
    if (!Array.isArray(us)) continue;
    for (const story of us as BuilderUserStory[]) {
      if (story?.id && !byId.has(story.id)) byId.set(story.id, story);
    }
  }
  // Atomic FR-rooted saturation leaves — each carries a user_story under
  // the leaf's own id (e.g. `FR-CAM-1.1`, `US-004-AUTH-D1`). These are the
  // anchors for composite AC ids that Phase 7 test cases reference. Without
  // them in the userStories pool, packet_synthesis cannot recover the
  // parent story from a test case's `acceptance_criterion_ids[]`.
  // Latest-per-node selection — supersession-aware.
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of records) {
    if (r.record_type !== 'requirement_decomposition_node') continue;
    const c = r.content as Record<string, unknown>;
    if (c.kind !== 'requirement_decomposition_node') continue;
    if (c.root_kind && c.root_kind !== 'fr') continue;
    if (c.status !== 'atomic') continue;
    const nodeId = typeof c.node_id === 'string' ? c.node_id : null;
    if (!nodeId) continue;
    const existing = latestByNodeId.get(nodeId);
    if (!existing || r.produced_at > existing.produced_at) {
      latestByNodeId.set(nodeId, r);
    }
  }
  for (const r of latestByNodeId.values()) {
    const c = r.content as Record<string, unknown>;
    const story = c.user_story as BuilderUserStory | undefined;
    if (!story?.id || byId.has(story.id)) continue;
    byId.set(story.id, story);
  }
  return [...byId.values()];
}

export function collectNfrs(records: GovernedStreamRecord[]): BuilderNfr[] {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'nfr_bloom_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    // The nfr_bloom_skeleton artifact stores its kind as
    // `non_functional_requirements` (with underscore) and the array
    // under `requirements`. The earlier collector mismatched both
    // (looked for `nonfunctional_requirements` as both kind and array
    // key), silently returning [] for every run. ts-108 audit traced
    // every implementation_packet having `nfrs: []` to this bug:
    // the executor at Phase 9 was receiving no NFR context for any
    // task even though Phase 2.2 had emitted them correctly.
    if (content.kind !== 'non_functional_requirements') continue;
    const arr = content.requirements;
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
  // Phase 5.1 emits `data_models` with shape:
  //   { kind: 'data_models', models: [{ component_id, entities: [{ id, name, fields[] }] }] }
  // Entity `id` is producer-minted (Pillar A, dataModelIdMinter: DM-<comp>-<name>)
  // — we read it directly so the packet and the coherence index reference the
  // SAME real id (no synthetic minting → no false P7). Array key from the
  // single-source spec so collector + index can't drift.
  const spec = ARTIFACT_ID_SPECS.dataModels;
  const out: BuilderDataModel[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== spec.subPhaseId) continue;
    const content = r.content as Record<string, unknown>;
    const models = content[spec.arrayKey];
    if (!Array.isArray(models)) continue;
    for (const m of models as Array<Record<string, unknown>>) {
      const componentId = typeof m.component_id === 'string' ? m.component_id : '';
      const entities = Array.isArray(m.entities) ? (m.entities as Array<Record<string, unknown>>) : [];
      for (const e of entities) {
        const name = typeof e.name === 'string' ? e.name : '';
        const id = typeof e.id === 'string' ? e.id : mintEntityId(componentId, name);
        if (!name) continue;
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
  return out;
}

function collectApiDefs(records: GovernedStreamRecord[]): BuilderApiDef[] {
  // Phase 5.2 emits `api_definitions` with shape:
  //   { kind: 'api_definitions', definitions: [{ component_id, endpoints: [{ id, path, method, ... }] }] }
  // Endpoint `id` is producer-minted (Pillar A: API-<comp>-<method>-<path>).
  const spec = ARTIFACT_ID_SPECS.apiDefinitions;
  const out: BuilderApiDef[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== spec.subPhaseId) continue;
    const content = r.content as Record<string, unknown>;
    const defs = content[spec.arrayKey];
    if (!Array.isArray(defs)) continue;
    for (const d of defs as Array<Record<string, unknown>>) {
      const componentId = typeof d.component_id === 'string' ? d.component_id : '';
      const endpoints = Array.isArray(d.endpoints) ? (d.endpoints as Array<Record<string, unknown>>) : [];
      for (const ep of endpoints) {
        const method = typeof ep.method === 'string' ? ep.method : '';
        const path = typeof ep.path === 'string' ? ep.path : '';
        if (!method && !path) continue;
        const id = typeof ep.id === 'string' ? ep.id : mintEndpointId(componentId, method, path);
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

export function collectTestSuites(records: GovernedStreamRecord[]): BuilderTestSuite[] {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'test_case_skeleton') continue;
    const content = r.content as Record<string, unknown>;
    const arr = content.test_suites;
    if (Array.isArray(arr)) return arr as BuilderTestSuite[];
  }
  return [];
}

function extractCriteriaArray(
  records: GovernedStreamRecord[],
  subPhase: string,
  kind: BuilderEvaluationCriterion['kind'],
  idField: string,
): BuilderEvaluationCriterion[] {
  const out: BuilderEvaluationCriterion[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== subPhase) continue;
    const content = r.content as Record<string, unknown>;
    const criteria = content.criteria;
    if (!Array.isArray(criteria)) continue;
    for (const c of criteria) {
      const obj = c as Record<string, unknown>;
      // ts-108 audit: evaluation_metrics actually emits `nfr_id` (not
      // `nonfunctional_requirement_id`), `measurement_method` (not
      // `evaluation_method`), and `threshold` (not `success_condition`).
      // Accept both field families so the collector tolerates either
      // schema. Same pattern as the FR/NFR collector key fixes.
      const targetId = (obj[idField]
        ?? obj.functional_requirement_id
        ?? obj.nonfunctional_requirement_id
        ?? obj.nfr_id
        ?? obj.fr_id) as string | undefined;
      if (!targetId) continue;
      const evaluation_method = typeof obj.evaluation_method === 'string'
        ? obj.evaluation_method
        : (typeof obj.measurement_method === 'string' ? obj.measurement_method : '');
      const success_condition = typeof obj.success_condition === 'string'
        ? obj.success_condition
        : (typeof obj.threshold === 'string' ? obj.threshold : '');
      // A quality criterion may carry a generative property_spec (Phase 8).
      // Validate the minimal shape here so a malformed spec never reaches the
      // executor as a property with no rule to check.
      const ps = obj.property_spec;
      let property_spec: PropertySpec | undefined;
      if (ps !== null && typeof ps === 'object') {
        const p = ps as Record<string, unknown>;
        if (typeof p.invariant === 'string' && p.invariant.length > 0
          && typeof p.input_domain === 'string' && p.input_domain.length > 0) {
          property_spec = p as unknown as PropertySpec;
        }
      }
      out.push({
        kind,
        target_id: targetId,
        evaluation_method,
        success_condition,
        ...(property_spec ? { property_spec } : {}),
      });
    }
  }
  return out;
}

function extractThresholdScenarios(records: GovernedStreamRecord[]): BuilderEvaluationCriterion[] {
  const out: BuilderEvaluationCriterion[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (r.sub_phase_id !== 'evaluation_thresholds') continue;
    const content = r.content as Record<string, unknown>;
    const scenarios = content.scenarios;
    if (!Array.isArray(scenarios)) continue;
    for (const s of scenarios) {
      const obj = s as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : '';
      if (!id) continue;
      out.push({
        kind: 'reasoning',
        target_id: id,
        evaluation_method: typeof obj.description === 'string' ? obj.description : '',
        success_condition: typeof obj.pass_criteria === 'string' ? obj.pass_criteria : '',
      });
    }
  }
  return out;
}

export function collectEvaluationCriteria(records: GovernedStreamRecord[]): BuilderEvaluationCriterion[] {
  // evaluation_design + evaluation_metrics emit `criteria` arrays with
  // shape {target_id, evaluation_method, success_condition}.
  // evaluation_thresholds emits a different shape (`scenarios[]` with
  // {id, description, pass_criteria}); each scenario becomes a
  // reasoning-kind criterion via `extractThresholdScenarios`.
  return [
    ...extractCriteriaArray(records, 'evaluation_design', 'functional', 'functional_requirement_id'),
    ...extractCriteriaArray(records, 'evaluation_metrics', 'quality', 'nonfunctional_requirement_id'),
    ...extractThresholdScenarios(records),
  ];
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

export function collectComplianceItems(records: GovernedStreamRecord[]): Map<string, BuilderComplianceItem> {
  const byId = new Map<string, BuilderComplianceItem>();
  // compliance_retention_discovery emits its array under
  // `complianceExtractedItems` (camelCase); the previous spelling
  // (`compliance_extracted_items`, snake) silently returned no items.
  // Same shape-mismatch class as the collectNfrs fix.
  const mappings: Array<{ subPhase: string; arrayKey: string; kind: BuilderComplianceItem['kind'] }> = [
    { subPhase: 'compliance_retention_discovery', arrayKey: 'complianceExtractedItems', kind: 'compliance' },
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

/** Lever 1a cross-cutting NFR concerns (the `cross_cutting_constraints` artifact). */
export function collectCrossCuttingConstraints(
  records: GovernedStreamRecord[],
): BuilderCrossCuttingConstraint[] {
  const out: BuilderCrossCuttingConstraint[] = [];
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (!r.is_current_version) continue;
    const content = r.content as Record<string, unknown>;
    if (content.kind !== 'cross_cutting_constraints') continue;
    const concerns = content.concerns;
    if (!Array.isArray(concerns)) continue;
    for (const c of concerns as Array<Record<string, unknown>>) {
      if (typeof c.id !== 'string') continue;
      out.push({
        id: c.id,
        name: typeof c.name === 'string' ? c.name : c.id,
        responsibilities: Array.isArray(c.responsibilities)
          ? (c.responsibilities as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        applies_to_components: Array.isArray(c.applies_to_components)
          ? (c.applies_to_components as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      });
    }
  }
  return out;
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
    'requirement_decomposition_node',
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

  const lineage = buildRequirementLineage(allRecords);
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
    crossCuttingConstraints: collectCrossCuttingConstraints(allRecords),
    lineage,
  });

  // Run coherence verifier. Pass the lineage canonicalizer so P4 accepts a
  // root-grained eval as satisfying the leaf stories the packet carries.
  const atomicTaskIds = new Set(atomicTasks.map((t) => t.content.task.id));
  const verifierResult = verifyCoherence({ packets, upstreamIndex, atomicTaskIds, canonicalize: lineage.canonicalize });
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
    // (packet.synthesized used to fire as a Tier-1 lifecycle event with
    // per-field counts so `grep | jq` could answer "how many packets
    // failed coherence?" With the legacy lifecycle stream retired, the
    // packet record itself fires record.added, the coherence verdict is
    // in the packet content, and per-sub-phase summaries roll up
    // packet counts via the record.* event stream.)
  }

  // Honest completion-criteria test-coverage report (aggregate of the per-CC
  // P8_CC_NO_TEST binding). Mirrors the other coverage reports — surfaces real
  // gaps (no fabrication); the executor authors tests for uncovered criteria.
  {
    let ccTotal = 0;
    let ccCovered = 0;
    const uncovered: Array<{ packet_id: string; task_id: string; criterion_id: string }> = [];
    for (const p of packets) {
      for (const cc of p.task.completion_criteria) {
        if (cc.verification_method !== 'test_execution') continue;
        ccTotal++;
        if (cc.covered_by_test_ids && cc.covered_by_test_ids.length > 0) ccCovered++;
        else uncovered.push({ packet_id: p.packet_id, task_id: p.task.id, criterion_id: cc.criterion_id });
      }
    }
    engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'completion_criteria_coverage_report',
        total_test_execution_criteria: ccTotal,
        covered: ccCovered,
        uncovered_count: uncovered.length,
        coverage_percentage: ccTotal > 0 ? Math.round((ccCovered / ccTotal) * 100) : 100,
        uncovered,
      },
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
