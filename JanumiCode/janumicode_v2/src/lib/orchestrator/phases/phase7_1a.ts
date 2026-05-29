/**
 * Wave 10 — Phase 7.1a Recursive Test Decomposition.
 *
 * Saturation-loop recursive decomposer for test cases, mirroring the
 * Wave 6 / 7 / 8 / 9 machinery. Tier rubric is test-scoped:
 *   A — Test Suite (recurse without gating)
 *   B — Test Scenario (mirror-gated then recurse)
 *   C — Test Case (one more pass)
 *   D — Atomic Test Step (terminal)
 *
 * Termination — assumption-saturation fixed-point (semantic_delta=0 AND
 * queue empty). Safety rails (depth_cap, budget_cap, fanout_cap,
 * divergence detection) trigger explicit `status='deferred'`
 * supersessions when they trip — never silent gaps.
 *
 * Invocation — Phase 7 calls runTestSaturationLoop AFTER 7.1 has
 * emitted the depth-0 test plan. The loop expects depth-0
 * `test_decomposition_node` rows already written.
 */

import { randomUUID } from 'node:crypto';
import type { PhaseContext } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  TestDecompositionNodeContent,
  TestDecompositionPipelineContent,
  TestAssumptionSetSnapshotContent,
  TestAssumptionEntry,
  DecompositionTestCase,
  DecompositionTestStep,
  TestDecompositionTestType,
  DecompositionTier,
  DecompositionNodeStatus,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  TechnicalConstraint,
} from '../../types/records';
import type { MirrorItemDecision } from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { resolveAcReferences, type CanonicalAcIndex } from './phase7/acRefResolver';

function mintLogicalNodeId(): string { return randomUUID(); }
function collisionSafeDisplayKey(rawId: string, sib: Set<string>, nid: string): string {
  if (!sib.has(rawId)) return rawId;
  return `${rawId}#${nid.slice(0, 4)}`;
}
function normalizeTier(raw: unknown): DecompositionTier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

const TEST_TYPES: readonly TestDecompositionTestType[] = [
  'unit', 'integration', 'end_to_end', 'performance', 'contract',
];
const STEP_PHASES: readonly NonNullable<DecompositionTestStep['phase']>[] = [
  'arrange', 'act', 'assert', 'teardown',
];

export interface TestSaturationConfig {
  recordSubPhaseId: 'test_case_saturation';
  templateSubPhase: string;
  gateSurfacePrefix: string;
}

const DEFAULT_CONFIG: TestSaturationConfig = {
  recordSubPhaseId: 'test_case_saturation',
  templateSubPhase: 'test_case_saturation',
  gateSurfacePrefix: 'test-decomp-gate-',
};

export interface TestSaturationInput {
  technicalConstraints: TechnicalConstraint[];
  componentSummary: string;
  /**
   * Leaf-aware FR/AC summary (from `buildEffectiveFrView`). The
   * saturation prompt asks each child to attach `acceptance_criterion_ids`,
   * and the parent test case's existing AC ids were minted from Phase
   * 2.1a leaf decomposition. This summary MUST carry those leaf-level
   * AC ids — using the root-FR summary as a fallback caused thin-slice-1
   * to surface fabricated/rephrased AC refs.
   */
  acceptanceCriteriaSummary: string;
  /**
   * Phase 3.3 / 5.2 interface-contracts / api-definitions summary.
   * Surfaces the legitimate id roster for `traces_to[]` when the
   * saturation prompt's worked example shows `resp-*`-style
   * contract references — without this, qwen3.5:9b fabricates them.
   */
  interfaceContractsSummary: string;
  rootTestCases: DecompositionTestCase[];
  rootNodeRecordIds: string[];
  rootLogicalIds: string[];
  /**
   * Canonical AC index built from the FR view. The saturation loop
   * normalizes every child's `acceptance_criterion_ids[]` against it
   * before persistence so downstream consumers (packet synthesis,
   * coverage analysis) never see drift modes like `AC-URL-001` or
   * `AC-US-002-atomic`. Optional only to keep test callers terse;
   * production callers pass it.
   */
  canonicalAcIndex?: CanonicalAcIndex;
}

interface QueueEntry {
  parentRecordId: string;
  nodeId: string;
  parentNodeId: string | null;
  rootTestId: string;
  depth: number;
  testCase: DecompositionTestCase;
  displayKey: string;
  tierHint: DecompositionTier | 'root';
  releaseId: string | null;
  releaseOrdinal: number | null;
  activeConstraints: string[];
}

interface ResumeState {
  queue: QueueEntry[];
  allAssumptions: TestAssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionTestCase[]>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

export function rebuildTestSaturationStateFromStream(
  ctx: PhaseContext,
  config: TestSaturationConfig,
  pipelineId: string,
): ResumeState | null {
  const { engine, workflowRun } = ctx;
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'test_decomposition_node', false,
  );
  if (allNodes.length === 0) return null;

  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
  }

  const queue: QueueEntry[] = [];
  const siblingsByParent = new Map<string | null, DecompositionTestCase[]>();
  let maxDepthReached = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    if (c.depth > maxDepthReached) maxDepthReached = c.depth;
    const sibArr = siblingsByParent.get(c.parent_node_id) ?? [];
    sibArr.push(c.test_case);
    siblingsByParent.set(c.parent_node_id, sibArr);
    if (c.status === 'pending') {
      const tierHint: DecompositionTier | 'root' = c.depth === 0 ? 'root' : (c.tier ?? 'A');
      queue.push({
        parentRecordId: r.id,
        nodeId: c.node_id,
        parentNodeId: c.parent_node_id,
        rootTestId: c.root_test_id,
        depth: c.depth,
        testCase: c.test_case,
        displayKey: c.display_key,
        tierHint,
        releaseId: c.release_id,
        releaseOrdinal: c.release_ordinal,
        activeConstraints: c.test_case.active_constraints ?? [],
      });
    }
  }

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'test_assumption_set_snapshot',
  );
  let allAssumptions: TestAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as TestAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^TS-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'test_decomposition_pipeline', false,
  ).filter(r => (r.content as unknown as TestDecompositionPipelineContent).pipeline_id === pipelineId);
  if (pipelineRecords.length === 0) return null;
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest, pipelineRecords[0]);
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest, pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as TestDecompositionPipelineContent;

  return {
    queue, allAssumptions, assumptionSeq, siblingsByParent,
    maxDepthReached, passNumber,
    pipelinePasses: latestContent.passes,
    pipelineStartRecord,
    currentPipelineRecordId: latestPipelineRecord.id,
  };
}

function sanitizeChildTestCase(
  c: Record<string, unknown>,
  ctx: { rootId: string; childIndex: number },
): DecompositionTestCase | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : null;
  if (!id || !name) {
    getLogger().warn('workflow', 'Phase 7.1a: dropped malformed child (missing id or name)', ctx);
    return null;
  }
  const tt = typeof c.test_type === 'string' ? c.test_type : 'unit';
  const test_type: TestDecompositionTestType = (TEST_TYPES as readonly string[]).includes(tt)
    ? tt as TestDecompositionTestType : 'unit';
  const rawSteps = Array.isArray(c.steps) ? c.steps as Array<Record<string, unknown>> : [];
  const steps: DecompositionTestStep[] = [];
  for (let idx = 0; idx < rawSteps.length; idx++) {
    const s = rawSteps[idx];
    const description = typeof s.description === 'string' ? s.description : '';
    if (description.length === 0) continue;
    const sid = typeof s.id === 'string' && s.id.length > 0
      ? s.id
      : `step-${String(idx + 1).padStart(2, '0')}`;
    const phaseRaw = typeof s.phase === 'string' ? s.phase : undefined;
    const phase: DecompositionTestStep['phase'] = phaseRaw && (STEP_PHASES as readonly string[]).includes(phaseRaw)
      ? phaseRaw as DecompositionTestStep['phase']
      : undefined;
    steps.push({
      id: sid,
      description,
      phase,
      expected_outcome: typeof s.expected_outcome === 'string' ? s.expected_outcome : undefined,
    });
  }
  if (steps.length === 0) {
    getLogger().warn('workflow', 'Phase 7.1a: dropped malformed child (no valid steps)', { ...ctx, childId: id });
    return null;
  }
  const stringArr = (key: string): string[] | undefined => {
    const raw = c[key];
    return Array.isArray(raw)
      ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
  };
  return {
    id, name, test_type, steps,
    component_ids: stringArr('component_ids'),
    acceptance_criterion_ids: stringArr('acceptance_criterion_ids'),
    preconditions: stringArr('preconditions'),
    expected_outcome: typeof c.expected_outcome === 'string' ? c.expected_outcome : undefined,
    edge_cases: stringArr('edge_cases'),
    test_file_path: typeof c.test_file_path === 'string' ? c.test_file_path : undefined,
    active_constraints: stringArr('active_constraints'),
    traces_to: stringArr('traces_to'),
  };
}

function normalizeChildAcRefs(
  refs: ReadonlyArray<string>,
  child: DecompositionTestCase,
  index: CanonicalAcIndex | undefined,
): string[] {
  const mutable = [...refs];
  if (!index || mutable.length === 0) return mutable;
  const stepText = (child.steps ?? []).map(s => s.description).join(' ');
  const contextText = [child.expected_outcome ?? '', child.name ?? '', stepText]
    .filter(s => typeof s === 'string' && s.length > 0)
    .join(' ');
  const result = resolveAcReferences(mutable, index, { contextText });
  return result.resolvedIds.length > 0 ? result.resolvedIds : mutable;
}

function formatTestCaseForPrompt(t: DecompositionTestCase): string {
  const steps = t.steps.map(s => {
    const phase = s.phase ? ` [${s.phase}]` : '';
    const outcome = s.expected_outcome ? ` → ${s.expected_outcome}` : '';
    return `  - [${s.id}]${phase} ${s.description}${outcome}`;
  }).join('\n');
  const pre = (t.preconditions ?? []).length === 0 ? '(none)'
    : (t.preconditions ?? []).map(p => `  - ${p}`).join('\n');
  return [
    `Test id: ${t.id}`,
    `Name: ${t.name}`,
    `Type: ${t.test_type}`,
    t.component_ids && t.component_ids.length > 0 ? `Components under test: ${t.component_ids.join(', ')}` : null,
    t.acceptance_criterion_ids && t.acceptance_criterion_ids.length > 0
      ? `Validates ACs: ${t.acceptance_criterion_ids.join(', ')}` : null,
    'Preconditions:',
    pre,
    'Steps:',
    steps,
    t.expected_outcome ? `Expected outcome: ${t.expected_outcome}` : null,
    t.edge_cases && t.edge_cases.length > 0 ? `Edge cases: ${t.edge_cases.join('; ')}` : null,
  ].filter(Boolean).join('\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (tcs.length === 0) return '(none captured in Phase 1.0c)';
  return tcs.map(t => {
    const tech = t.technology ? ` [${t.technology}${t.version ? ` ${t.version}` : ''}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

export async function runTestSaturationLoop(
  ctx: PhaseContext,
  input: TestSaturationInput,
  config: TestSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;

  const template = engine.templateLoader.findTemplate('test_design_agent', config.templateSubPhase);
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: test-decomposition template missing — ` +
      `expected agent_role=testing_agent sub_phase=${config.templateSubPhase}.`,
    );
  }

  const pipelineId = `test-decomp-pipe-${workflowRun.id.slice(0, 8)}`;
  const resumed = rebuildTestSaturationStateFromStream(ctx, config, pipelineId);

  const allAssumptions: TestAssumptionEntry[] = resumed?.allAssumptions ?? [];
  let assumptionSeq = resumed?.assumptionSeq ?? 0;
  const newAssumptionId = (): string => `TS-${String(++assumptionSeq).padStart(4, '0')}`;

  const queue: QueueEntry[] = resumed?.queue ?? input.rootTestCases.map((t, i) => ({
    parentRecordId: input.rootNodeRecordIds[i],
    nodeId: input.rootLogicalIds[i],
    parentNodeId: null,
    rootTestId: input.rootLogicalIds[i],
    depth: 0,
    testCase: t,
    displayKey: t.id,
    tierHint: 'root' as const,
    releaseId: null,
    releaseOrdinal: null,
    activeConstraints: t.active_constraints ?? [],
  }));

  const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionTestCase[]>();
  if (!resumed) siblingsByParent.set(null, [...input.rootTestCases]);

  const callsByRoot = new Map<string, number>();
  let maxDepthReached = resumed?.maxDepthReached ?? 0;
  let passNumber = resumed?.passNumber ?? 0;

  const divergeGrowthRatio = Number.parseFloat(process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2');
  const divergeWarnPasses = Number.parseInt(process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10);
  const divergeTerminatePasses = Number.parseInt(process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10);
  const dedupOfflineWarnPasses = Number.parseInt(process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10);
  let consecutiveGrowthPasses = 0;
  let consecutiveDedupOfflinePasses = 0;
  let dedupOfflineAnnounced = false;
  let divergingEarlyTerminate = false;

  const pipelinePasses: DecompositionPassEntry[] = resumed?.pipelinePasses ?? [];
  const pipelineStartRecord = resumed?.pipelineStartRecord ?? engine.writer.writeRecord({
    record_type: 'test_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: input.rootNodeRecordIds,
    content: {
      kind: 'test_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_test_id: '*',
      passes: [],
    } satisfies TestDecompositionPipelineContent,
  });
  let currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;

  const embeddingClient: EmbeddingClient = engine.getEmbeddingClientOverride() ?? createEmbeddingClient();
  const embeddingCache = new Map<string, number[]>();
  const dedupThreshold = Number.parseFloat(process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
  const dedupEnabled = Number.isFinite(dedupThreshold)
    && dedupThreshold > 0
    && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';

  if (dedupEnabled && allAssumptions.length > 0) {
    try {
      const vecs = await embeddingClient.embed(
        allAssumptions.map(a => a.text),
        { signal: engine.getSessionAbortSignal() },
      );
      allAssumptions.forEach((a, i) => { if (vecs[i]) embeddingCache.set(a.id, vecs[i]); });
    } catch (err) {
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup seed failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const parentChain = new Map<string, string | null>();
  for (const r of engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node')) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    parentChain.set(c.node_id, c.parent_node_id);
  }

  while (queue.length > 0) {
    passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'test_decomposition_node',
    ).length;
    const passEntries = queue.splice(0, queue.length);
    const passAssumptions: TestAssumptionEntry[] = [];
    const pendingGateByParent = new Map<string, Array<{
      nodeRecordId: string;
      logicalNodeId: string;
      displayKey: string;
      testCase: DecompositionTestCase;
      rationale?: string;
    }>>();
    const downgradeNotesByParent = new Map<string, string>();

    for (const entry of passEntries) {
      if (entry.depth >= caps.test_depth_cap) {
        writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
        continue;
      }
      const rootCalls = callsByRoot.get(entry.rootTestId) ?? 0;
      if (rootCalls >= caps.test_budget_cap) {
        writeDeferredSupersession(ctx, entry, passNumber, 'budget_cap_reached', config);
        continue;
      }

      try {
        const siblings = siblingsByParent.get(entry.parentNodeId) ?? [];
        const ancestorIds = new Set<string | null>();
        ancestorIds.add(entry.nodeId);
        let cursor: string | null | undefined = entry.parentNodeId;
        while (cursor) {
          if (ancestorIds.has(cursor)) break;
          ancestorIds.add(cursor);
          cursor = parentChain.get(cursor) ?? null;
        }
        const scopedAssumptions = [...allAssumptions, ...passAssumptions]
          .filter(a => !a.duplicate_of)
          .filter(a => a.surfaced_at_node == null || ancestorIds.has(a.surfaced_at_node));

        const inherited = entry.activeConstraints.length > 0
          ? input.technicalConstraints.filter(t => entry.activeConstraints.includes(t.id))
          : input.technicalConstraints;
        const activeConstraintsForPrompt = formatTechnicalConstraints(inherited);

        const variables: Record<string, string> = {
          active_constraints: activeConstraintsForPrompt,
          parent_test_case: formatTestCaseForPrompt(entry.testCase),
          parent_tier_hint: entry.tierHint,
          sibling_context: siblings.length <= 1
            ? '(none — sole child under this parent)'
            : siblings.filter(s => s.id !== entry.testCase.id).map(s => `- ${s.id}: ${s.name}`).join('\n'),
          component_context: input.componentSummary,
          acceptance_criteria_summary: input.acceptanceCriteriaSummary,
          interface_contracts_summary: input.interfaceContractsSummary,
          existing_assumptions: scopedAssumptions.length === 0
            ? '(none yet)'
            : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
          current_depth: String(entry.depth),
          janumicode_version_sha: engine.janumiCodeVersionSha,
        };

        const rendered = engine.templateLoader.render(template, variables);
        if (rendered.missing_variables.length > 0) {
          throw new Error(`Phase ${config.recordSubPhaseId}: template missing vars [${rendered.missing_variables.join(', ')}]`);
        }

        callsByRoot.set(entry.rootTestId, (callsByRoot.get(entry.rootTestId) ?? 0) + 1);
        const result = await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: workflowRun.id,
            phaseId: '7',
            subPhaseId: config.recordSubPhaseId,
            agentRole: 'test_design_agent',
            label: `Phase ${config.recordSubPhaseId} Pass-${passNumber} — ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
          },
        });

        const parsed = result.parsed as Record<string, unknown> | null;
        const childrenRaw = Array.isArray(parsed?.children)
          ? parsed.children as Array<Record<string, unknown>> : [];
        const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
          ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
        const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;

        const childAssumptionIds: string[] = [];
        for (const a of surfacedRaw) {
          const text = typeof a.text === 'string' ? a.text : null;
          if (!text) continue;
          const cat = typeof a.category === 'string' ? a.category : 'open_question';
          const validCats: TestAssumptionEntry['category'][] = [
            'preconditions', 'fixture_setup', 'oracle_choice',
            'tooling', 'scope_boundary', 'flake_risk', 'open_question',
          ];
          const category = (validCats as string[]).includes(cat)
            ? cat as TestAssumptionEntry['category'] : 'open_question';
          const citations = Array.isArray(a.citations)
            ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
          const assumption: TestAssumptionEntry = {
            id: newAssumptionId(),
            text,
            source: 'decomposition',
            surfaced_at_node: entry.nodeId,
            surfaced_at_pass: passNumber,
            category,
            citations,
          };
          passAssumptions.push(assumption);
          childAssumptionIds.push(assumption.id);
        }

        const childDepth = entry.depth + 1;
        maxDepthReached = Math.max(maxDepthReached, childDepth);
        const emittedChildren: DecompositionTestCase[] = [];
        const emittedChildrenWithTier: Array<{ testCase: DecompositionTestCase; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
        const siblingDisplayKeys = new Set<string>();
        let fanoutCount = 0;
        for (const c of childrenRaw) {
          if (++fanoutCount > caps.test_fanout_cap) break;
          const child = sanitizeChildTestCase(c, { rootId: entry.displayKey, childIndex: fanoutCount });
          if (!child) continue;
          const tier = normalizeTier(c.tier);
          const rationale = typeof c.decomposition_rationale === 'string' ? c.decomposition_rationale : undefined;
          const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
          const logicalNodeId = mintLogicalNodeId();
          const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
          siblingDisplayKeys.add(displayKey);
          const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
            ? child.active_constraints
            : entry.activeConstraints;
          // Phase-exit correction: canonicalize the child's AC refs
          // against the FR index before persistence (see
          // phase7/acRefResolver.ts header). Carrying canonical ids
          // through the saturation tree keeps packet synthesis and
          // coverage analysis off the fuzzy-bridge path entirely.
          const canonicalChildAcIds = normalizeChildAcRefs(
            child.acceptance_criterion_ids ?? [],
            child,
            input.canonicalAcIndex,
          );
          const enrichedChild: DecompositionTestCase = {
            ...child,
            acceptance_criterion_ids: canonicalChildAcIds,
            active_constraints: childActiveConstraints,
          };

          const childRec = engine.writer.writeRecord({
            record_type: 'test_decomposition_node',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '7',
            sub_phase_id: config.recordSubPhaseId,
            produced_by_agent_role: 'test_design_agent',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            derived_from_record_ids: [entry.parentRecordId],
            content: {
              kind: 'test_decomposition_node',
              node_id: logicalNodeId,
              parent_node_id: entry.nodeId,
              display_key: displayKey,
              root_test_id: entry.rootTestId,
              depth: childDepth,
              pass_number: passNumber,
              status: initialStatus,
              tier,
              test_case: enrichedChild,
              decomposition_rationale: rationale,
              surfaced_assumption_ids: childAssumptionIds,
              release_id: entry.releaseId,
              release_ordinal: entry.releaseOrdinal,
            } satisfies TestDecompositionNodeContent,
          });
          emittedChildren.push(enrichedChild);
          emittedChildrenWithTier.push({ testCase: enrichedChild, tier, logicalNodeId, displayKey });
          parentChain.set(logicalNodeId, entry.nodeId);

          if (tier === 'A') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootTestId: entry.rootTestId, depth: childDepth, testCase: enrichedChild,
              displayKey, tierHint: 'A',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          } else if (tier === 'B') {
            const batch = pendingGateByParent.get(entry.nodeId) ?? [];
            batch.push({ nodeRecordId: childRec.id, logicalNodeId, displayKey, testCase: enrichedChild, rationale });
            pendingGateByParent.set(entry.nodeId, batch);
          } else if (tier === 'C') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootTestId: entry.rootTestId, depth: childDepth, testCase: enrichedChild,
              displayKey, tierHint: 'C',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          }
        }
        if (emittedChildren.length > 0) {
          siblingsByParent.set(entry.nodeId, emittedChildren);
        }

        let parentDowngraded = false;
        if (entry.tierHint === 'B') {
          const explicitDisagreement = tierAssessment
            && tierAssessment.agrees_with_hint === false
            && typeof tierAssessment.tier === 'string'
            && (tierAssessment.tier === 'A' || tierAssessment.tier === 'B');
          const producedTierBChildren = (pendingGateByParent.get(entry.nodeId)?.length ?? 0) > 0;
          if (explicitDisagreement || producedTierBChildren) {
            parentDowngraded = true;
            const reason = explicitDisagreement
              ? `tier_downgrade: decomposer_assessed_${tierAssessment?.tier}_not_B`
              : 'tier_downgrade: post_gate_children_still_tier_B';
            const downgradedRec = engine.writer.writeRecord({
              record_type: 'test_decomposition_node',
              schema_version: '1.0',
              workflow_run_id: workflowRun.id,
              phase_id: '7',
              sub_phase_id: config.recordSubPhaseId,
              produced_by_agent_role: 'orchestrator',
              janumicode_version_sha: engine.janumiCodeVersionSha,
              derived_from_record_ids: [entry.parentRecordId],
              content: {
                kind: 'test_decomposition_node',
                node_id: entry.nodeId,
                parent_node_id: entry.parentNodeId,
                display_key: entry.displayKey,
                root_test_id: entry.rootTestId,
                depth: entry.depth,
                pass_number: passNumber,
                status: 'downgraded',
                test_case: entry.testCase,
                surfaced_assumption_ids: [],
                pruning_reason: reason,
                release_id: entry.releaseId,
                release_ordinal: entry.releaseOrdinal,
              } satisfies TestDecompositionNodeContent,
            });
            engine.writer.supersedeTestDecompositionNodeByLogicalId(
              workflowRun.id, entry.nodeId, downgradedRec.id,
            );
            if (producedTierBChildren) {
              downgradeNotesByParent.set(
                entry.nodeId,
                `The test scenario '${entry.displayKey}' you accepted earlier turned out to ` +
                `have its own commitment layer underneath. The scenarios below need your review.`,
              );
            }
          }
        }

        // Status transition for successful decomposition.
        if (emittedChildren.length > 0 && !parentDowngraded) {
          // Preserve creation provenance — see phase2.ts pending→decomposed
          // transition for rationale.
          const originalRec = engine.writer.getRecord(entry.parentRecordId);
          const originalSubPhase = originalRec?.sub_phase_id ?? config.recordSubPhaseId;
          const decomposedRec = engine.writer.writeRecord({
            record_type: 'test_decomposition_node',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '7',
            sub_phase_id: originalSubPhase,
            produced_by_agent_role: 'orchestrator',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            derived_from_record_ids: [entry.parentRecordId],
            content: {
              kind: 'test_decomposition_node',
              node_id: entry.nodeId,
              parent_node_id: entry.parentNodeId,
              display_key: entry.displayKey,
              root_test_id: entry.rootTestId,
              depth: entry.depth,
              pass_number: passNumber,
              status: 'decomposed',
              tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
              test_case: entry.testCase,
              surfaced_assumption_ids: [],
              release_id: entry.releaseId,
              release_ordinal: entry.releaseOrdinal,
            } satisfies TestDecompositionNodeContent,
          });
          engine.writer.supersedeTestDecompositionNodeByLogicalId(
            workflowRun.id, entry.nodeId, decomposedRec.id,
          );
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking deferred`, {
          nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
        });
        writeDeferredSupersession(ctx, entry, passNumber, `decomposition_failed: ${reason}`, config);
      }
    }

    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'test_decomposition_node',
    ).length - nodesProducedAtPassStart;
    pipelinePasses.push({
      pass_number: passNumber,
      status: 'completed',
      started_at: passStartedAt,
      completed_at: new Date().toISOString(),
      nodes_produced: nodesProducedThisPass,
      assumption_delta: passAssumptions.length,
    });
    const passUpdate = engine.writer.writeRecord({
      record_type: 'test_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [pipelineStartRecord.id],
      content: {
        kind: 'test_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_test_id: '*',
        passes: [...pipelinePasses],
      } satisfies TestDecompositionPipelineContent,
    });
    engine.writer.supersedByRollback(currentPipelineRecordId, passUpdate.id);
    currentPipelineRecordId = passUpdate.id;

    let dedupFailedThisPass = false;
    if (dedupEnabled && passAssumptions.length > 0) {
      try {
        const newVecs = await embeddingClient.embed(
          passAssumptions.map(a => a.text),
          { signal: engine.getSessionAbortSignal() },
        );
        for (let i = 0; i < passAssumptions.length; i++) {
          const a = passAssumptions[i];
          const v = newVecs[i];
          if (!v) continue;
          const priors = [...embeddingCache.entries()].map(([id, vector]) => ({ id, vector }));
          const match = findNearestAbove(v, priors, dedupThreshold);
          if (match) {
            a.duplicate_of = match.id;
            a.duplicate_similarity = match.similarity;
          }
          embeddingCache.set(a.id, v);
        }
      } catch (err) {
        dedupFailedThisPass = true;
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup embed failed`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const semanticDelta = passAssumptions.filter(a => !a.duplicate_of).length;
    allAssumptions.push(...passAssumptions);
    engine.writer.writeRecord({
      record_type: 'test_assumption_set_snapshot',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'test_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'test_assumption_set_snapshot',
        pass_number: passNumber,
        root_test_id: '*',
        assumptions: [...allAssumptions],
        delta_from_previous_pass: passAssumptions.length,
        semantic_delta: semanticDelta,
      } satisfies TestAssumptionSetSnapshotContent,
    });

    if (pendingGateByParent.size > 0) {
      const bundlePlans = emitTierBGateBundles(
        ctx, pendingGateByParent, downgradeNotesByParent, config,
      );
      const resolutions = await Promise.all(
        bundlePlans.map(p => engine.pauseForDecision(workflowRun.id, p.bundleRecordId, 'decision_bundle')),
      );
      for (let i = 0; i < bundlePlans.length; i++) {
        const plan = bundlePlans[i];
        const resolution = resolutions[i];
        const payload = (resolution as unknown as { payload?: { mirror_decisions?: MirrorItemDecision[] } }).payload;
        const decisions = Array.isArray(payload?.mirror_decisions) ? payload.mirror_decisions : [];
        const rejectedIds = new Set(decisions.filter(d => d.action === 'rejected').map(d => d.item_id));
        for (const child of plan.childItems) {
          if (rejectedIds.has(child.itemId)) {
            writePrunedSupersession(ctx, plan.parentNodeId, child, 'human-rejected', config);
          } else {
            queue.push({
              parentRecordId: child.nodeRecordId,
              nodeId: child.logicalNodeId,
              parentNodeId: plan.parentNodeId,
              rootTestId: child.rootTestId,
              depth: child.depth,
              testCase: child.testCase,
              displayKey: child.displayKey,
              tierHint: 'B',
              releaseId: child.releaseId,
              releaseOrdinal: child.releaseOrdinal,
              activeConstraints: child.testCase.active_constraints ?? [],
            });
          }
        }
      }
    }

    if (dedupFailedThisPass) {
      consecutiveDedupOfflinePasses++;
      if (consecutiveDedupOfflinePasses >= dedupOfflineWarnPasses && !dedupOfflineAnnounced) {
        dedupOfflineAnnounced = true;
      }
    } else {
      if (dedupOfflineAnnounced) dedupOfflineAnnounced = false;
      consecutiveDedupOfflinePasses = 0;
    }

    const priorPass = pipelinePasses.length >= 2 ? pipelinePasses[pipelinePasses.length - 2] : null;
    const growthObserved = priorPass
      && priorPass.nodes_produced > 0
      && nodesProducedThisPass > priorPass.nodes_produced * divergeGrowthRatio;
    if (growthObserved) {
      consecutiveGrowthPasses++;
      if (consecutiveGrowthPasses >= divergeWarnPasses) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging`, {
          passNumber, consecutiveGrowthPasses,
        });
      }
      if (consecutiveGrowthPasses >= divergeTerminatePasses) {
        for (const remaining of queue) writeDeferredSupersession(ctx, remaining, passNumber, 'diverging', config);
        queue.length = 0;
        divergingEarlyTerminate = true;
      }
    } else {
      consecutiveGrowthPasses = 0;
    }

    if (divergingEarlyTerminate) break;
    if (semanticDelta === 0 && queue.length === 0) break;
  }

  const totalLlmCalls = [...callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = callsByRoot.size > 0 ? Math.max(...callsByRoot.values()) : 0;
  let terminationReason: DecompositionTerminationReason;
  if (divergingEarlyTerminate) terminationReason = 'diverging';
  else if (maxRootCalls >= caps.test_budget_cap) terminationReason = 'budget_cap';
  else if (maxDepthReached >= caps.test_depth_cap) terminationReason = 'depth_cap';
  else if (dedupOfflineAnnounced) terminationReason = 'dedup_offline';
  else terminationReason = 'fixed_point';

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node');
  const tierDistribution: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 };
  let atomicLeafCount = 0;
  for (const n of finalNodes) {
    const c = n.content as unknown as TestDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }

  const finalRec = engine.writer.writeRecord({
    record_type: 'test_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [pipelineStartRecord.id],
    content: {
      kind: 'test_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_test_id: '*',
      passes: pipelinePasses.map((p, i) =>
        i === pipelinePasses.length - 1 ? { ...p, termination_reason: terminationReason } : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies TestDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(currentPipelineRecordId, finalRec.id);

  try {
    engine.db.prepare(`
      UPDATE workflow_runs
      SET test_decomposition_budget_calls_used = ?,
          test_decomposition_max_depth_reached = MAX(test_decomposition_max_depth_reached, ?),
          active_test_pipeline_id = ?
      WHERE id = ?
    `).run(totalLlmCalls, maxDepthReached, pipelineId, workflowRun.id);
  } catch (err) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: telemetry write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function writeDeferredSupersession(
  ctx: PhaseContext,
  entry: QueueEntry,
  passNumber: number,
  reason: string,
  config: TestSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_test_id: entry.rootTestId,
      depth: entry.depth,
      pass_number: passNumber,
      status: 'deferred',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      test_case: entry.testCase,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(workflowRun.id, entry.nodeId, rec.id);
}

interface PrunedChildItem {
  itemId: string;
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  testCase: DecompositionTestCase;
  rootTestId: string;
  depth: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
}

function writePrunedSupersession(
  ctx: PhaseContext,
  parentNodeId: string,
  child: PrunedChildItem,
  reason: string,
  config: TestSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [child.nodeRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: child.logicalNodeId,
      parent_node_id: parentNodeId,
      display_key: child.displayKey,
      root_test_id: child.rootTestId,
      depth: child.depth,
      pass_number: 0,
      status: 'pruned',
      tier: 'B',
      test_case: child.testCase,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: child.releaseId,
      release_ordinal: child.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(workflowRun.id, child.logicalNodeId, rec.id);
}

interface BundlePlan {
  bundleRecordId: string;
  parentNodeId: string;
  childItems: PrunedChildItem[];
}

function emitTierBGateBundles(
  ctx: PhaseContext,
  pending: Map<string, Array<{
    nodeRecordId: string;
    logicalNodeId: string;
    displayKey: string;
    testCase: DecompositionTestCase;
    rationale?: string;
  }>>,
  downgradeNotes: Map<string, string>,
  config: TestSaturationConfig,
): BundlePlan[] {
  const { engine, workflowRun } = ctx;
  const plans: BundlePlan[] = [];
  const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node');
  const byLogical = new Map<string, TestDecompositionNodeContent>();
  for (const r of allNodes) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    byLogical.set(c.node_id, c);
  }
  for (const [parentNodeId, children] of pending) {
    const parent = byLogical.get(parentNodeId);
    if (!parent) continue;
    const childDepth = parent.depth + 1;
    const note = downgradeNotes.get(parentNodeId);
    const childItems: PrunedChildItem[] = children.map((c, idx) => ({
      itemId: `child-${idx}`,
      nodeRecordId: c.nodeRecordId,
      logicalNodeId: c.logicalNodeId,
      displayKey: c.displayKey,
      testCase: c.testCase,
      rootTestId: parent.root_test_id,
      depth: childDepth,
      releaseId: parent.release_id,
      releaseOrdinal: parent.release_ordinal,
    }));
    const bundleId = `${config.gateSurfacePrefix}${parent.display_key}`;
    const items = childItems.map(c => ({
      item_id: c.itemId,
      title: `${c.testCase.name} (${c.displayKey})`,
      description: c.testCase.steps.map(s => `• ${s.description}`).join('\n'),
      details: {
        test_id: c.testCase.id,
        test_type: c.testCase.test_type,
        component_ids: c.testCase.component_ids ?? [],
        acceptance_criterion_ids: c.testCase.acceptance_criterion_ids ?? [],
        active_constraints: c.testCase.active_constraints ?? [],
      },
    }));
    const bundleContext = note
      ? `${note}\n\nReview each Tier-B sub-scenario below; reject any out-of-scope.`
      : `These are scope commitments under "${parent.display_key}" identified during recursive test decomposition. Accept the ones in scope; reject any out-of-scope.`;
    const bundleRec = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'decision_bundle',
        bundle_id: bundleId,
        bundle_type: 'mirror_decision',
        title: `Tier-B Test Scenarios under "${parent.display_key}"`,
        context: bundleContext,
        items,
      } as Record<string, unknown>,
    });
    engine.eventBus.emit('mirror:presented', {
      mirrorId: bundleId,
      artifactType: 'test_decomposition_bundle',
    });
    plans.push({ bundleRecordId: bundleRec.id, parentNodeId, childItems });
  }
  return plans;
}
