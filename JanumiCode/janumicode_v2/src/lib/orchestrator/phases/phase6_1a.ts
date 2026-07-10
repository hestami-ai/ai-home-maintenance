/**
 * Wave 8 — Phase 6.1a Recursive Task Decomposition.
 *
 * Saturation-loop recursive decomposer for implementation tasks,
 * mirroring the Wave 6 (FR/NFR) and Wave 7 (component) machinery. Tier
 * rubric is task-scaled:
 *   A — Epic (multi-cluster body of work, recurse without gating)
 *   B — Story (mirror-gated then recurse)
 *   C — Task (one more pass)
 *   D — Atomic-Unit (terminal, single executor session)
 *
 * Termination — assumption-saturation fixed-point (semantic_delta=0 AND
 * queue empty) is the desired exit. Safety rails (depth_cap=5,
 * budget_cap=250, fanout_cap=10, divergence detection, dedup-offline
 * tracking) trigger explicit `status='deferred'` supersessions when
 * they trip — never silent gaps.
 *
 * Invocation — Phase 6 calls runTaskSaturationLoop AFTER 6.1 has emitted
 * the depth-0 implementation_plan. The loop expects depth-0
 * `task_decomposition_node` rows already written by Phase 6 (one per
 * root task). It seeds its queue from those rows and recursively
 * expands in place.
 */

import { randomUUID } from 'node:crypto';
import type { PhaseContext } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  TaskDecompositionNodeContent,
  TaskDecompositionPipelineContent,
  TaskAssumptionSetSnapshotContent,
  TaskAssumptionEntry,
  DecompositionTask,
  TaskCompletionCriterion,
  DecompositionTier,
  DecompositionNodeStatus,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  TechnicalConstraint,
} from '../../types/records';
import type { MirrorItemDecision } from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { canonicalComponentDir } from './layoutContract';
import { resolveTechConstraintIds, resolveComponentId } from '../idResolver';

// ── Shared helpers ─────────────────────────────────────────────────

function mintLogicalNodeId(): string {
  return randomUUID();
}

function collisionSafeDisplayKey(
  rawId: string,
  siblingDisplayKeys: Set<string>,
  logicalNodeId: string,
): string {
  if (!siblingDisplayKeys.has(rawId)) return rawId;
  return `${rawId}#${logicalNodeId.slice(0, 4)}`;
}

function normalizeTier(raw: unknown): DecompositionTier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

// ── Loop config ────────────────────────────────────────────────────

export interface TaskSaturationConfig {
  recordSubPhaseId: 'task_saturation';
  templateSubPhase: string;
  gateSurfacePrefix: string;
}

const DEFAULT_CONFIG: TaskSaturationConfig = {
  recordSubPhaseId: 'task_saturation',
  templateSubPhase: 'task_saturation',
  gateSurfacePrefix: 'task-decomp-gate-',
};

// ── Inputs ─────────────────────────────────────────────────────────

export interface TaskSaturationInput {
  /** Phase 1.0c technical constraints — anchor leaf-task tooling choices. */
  technicalConstraints: TechnicalConstraint[];
  /** Component summary text (Phase 4.2a leaves preferred, else 4.2 roots). */
  componentSummary: string;
  /**
   * Per-component scoped context blocks (component_id → PROJECT TYPE + that
   * component's own block). PA-1: a single-task decomposition sees ITS component,
   * not the whole ~46-component backlog. Falls back to `componentSummary`.
   */
  componentSummaryById?: Record<string, string>;
  /** Root tasks written by Phase 6.1 (one DecompositionTask per root). */
  rootTasks: DecompositionTask[];
  /** Governed-stream record IDs for the depth-0 root nodes. Pairs 1:1 with rootTasks. */
  rootNodeRecordIds: string[];
  /** Logical node IDs for the depth-0 root nodes. Pairs 1:1 with rootTasks. */
  rootLogicalIds: string[];
}

// ── Internal queue entry ───────────────────────────────────────────

interface QueueEntry {
  parentRecordId: string;
  nodeId: string;
  parentNodeId: string | null;
  rootTaskId: string;
  depth: number;
  task: DecompositionTask;
  displayKey: string;
  tierHint: DecompositionTier | 'root';
  releaseId: string | null;
  releaseOrdinal: number | null;
  activeConstraints: string[];
}

// ── Resume state ───────────────────────────────────────────────────

interface ResumeState {
  queue: QueueEntry[];
  allAssumptions: TaskAssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionTask[]>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

/** Latest record per logical node_id (by produced_at). */
function selectLatestNodeRecordsByNodeId(
  allNodes: GovernedStreamRecord[],
): Map<string, GovernedStreamRecord> {
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as TaskDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) {
      latestByNodeId.set(c.node_id, r);
    }
  }
  return latestByNodeId;
}

/**
 * Rebuild the pending-work queue, the per-parent sibling roster, and the
 * deepest depth seen from the latest node records.
 */
function rebuildQueueAndSiblings(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): {
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionTask[]>;
  maxDepthReached: number;
} {
  const queue: QueueEntry[] = [];
  const siblingsByParent = new Map<string | null, DecompositionTask[]>();
  let maxDepthReached = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as TaskDecompositionNodeContent;
    if (c.depth > maxDepthReached) maxDepthReached = c.depth;
    const siblingsKey = c.parent_node_id;
    const sibArr = siblingsByParent.get(siblingsKey) ?? [];
    sibArr.push(c.task);
    siblingsByParent.set(siblingsKey, sibArr);

    if (c.status === 'pending') {
      const tierHint: DecompositionTier | 'root' = c.depth === 0
        ? 'root'
        : (c.tier ?? 'A');
      queue.push({
        parentRecordId: r.id,
        nodeId: c.node_id,
        parentNodeId: c.parent_node_id,
        rootTaskId: c.root_task_id,
        depth: c.depth,
        task: c.task,
        displayKey: c.display_key,
        tierHint,
        releaseId: c.release_id,
        releaseOrdinal: c.release_ordinal,
        activeConstraints: c.task.active_constraints ?? [],
      });
    }
  }
  return { queue, siblingsByParent, maxDepthReached };
}

/** Assumptions and pass number from the highest-numbered snapshot. */
function loadLatestAssumptionSnapshot(
  snapshotRecords: GovernedStreamRecord[],
): { allAssumptions: TaskAssumptionEntry[]; passNumber: number } {
  let allAssumptions: TaskAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as TaskAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  return { allAssumptions, passNumber };
}

/** Highest `TA-<n>` sequence number among the given assumptions (0 if none). */
function computeMaxAssumptionSeq(allAssumptions: TaskAssumptionEntry[]): number {
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^TA-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }
  return assumptionSeq;
}

/**
 * Earliest / latest pipeline record bounds. Returns null when no pipeline
 * records exist for this run (the caller treats that as "cannot resume").
 */
function resolvePipelineBounds(
  pipelineRecords: GovernedStreamRecord[],
): {
  pipelineStartRecord: GovernedStreamRecord;
  pipelinePasses: DecompositionPassEntry[];
  currentPipelineRecordId: string;
} | null {
  if (pipelineRecords.length === 0) return null;
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest,
  pipelineRecords[0]);
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest,
  pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as TaskDecompositionPipelineContent;
  return {
    pipelineStartRecord,
    pipelinePasses: latestContent.passes,
    currentPipelineRecordId: latestPipelineRecord.id,
  };
}

export function rebuildTaskSaturationStateFromStream(
  ctx: PhaseContext,
  config: TaskSaturationConfig,
  pipelineId: string,
): ResumeState | null {
  const { engine, workflowRun } = ctx;
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'task_decomposition_node', false,
  );
  if (allNodes.length === 0) return null;

  const latestByNodeId = selectLatestNodeRecordsByNodeId(allNodes);
  const { queue, siblingsByParent, maxDepthReached } = rebuildQueueAndSiblings(latestByNodeId);

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'task_assumption_set_snapshot',
  );
  const { allAssumptions, passNumber } = loadLatestAssumptionSnapshot(snapshotRecords);
  const assumptionSeq = computeMaxAssumptionSeq(allAssumptions);

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'task_decomposition_pipeline', false,
  ).filter(r => {
    const c = r.content as unknown as TaskDecompositionPipelineContent;
    return c.pipeline_id === pipelineId;
  });
  const pipelineBounds = resolvePipelineBounds(pipelineRecords);
  if (!pipelineBounds) return null;

  getLogger().info('workflow', `Phase ${config.recordSubPhaseId} RESUME: state reconstructed from stream`, {
    queueSize: queue.length,
    assumptions: allAssumptions.length,
    passNumber,
    maxDepthReached,
  });

  return {
    queue,
    allAssumptions,
    assumptionSeq,
    siblingsByParent,
    maxDepthReached,
    passNumber,
    pipelinePasses: pipelineBounds.pipelinePasses,
    pipelineStartRecord: pipelineBounds.pipelineStartRecord,
    currentPipelineRecordId: pipelineBounds.currentPipelineRecordId,
  };
}

// ── Sanitizers ─────────────────────────────────────────────────────

function extractChildAcSet(c: Record<string, unknown>): Set<string> {
  return new Set(
    (Array.isArray(c.traces_to) ? c.traces_to as unknown[] : [])
      .filter((x): x is string => typeof x === 'string' && x.startsWith('AC-')),
  );
}

function sanitizeCriterion(
  r: Record<string, unknown>,
  idx: number,
  taskId: string,
  childAcSet: Set<string>,
): TaskCompletionCriterion {
  const desc = typeof r.description === 'string' ? r.description : '';
  const cid = typeof r.criterion_id === 'string' ? r.criterion_id : `cc-${taskId}-${String(idx + 1).padStart(3, '0')}`;
  const vm = typeof r.verification_method === 'string' ? r.verification_method : undefined;
  const ar = typeof r.artifact_ref === 'string' ? r.artifact_ref : undefined;
  const validVms = ['schema_check', 'invariant', 'output_comparison', 'test_execution'];
  const rawVacs = r.verifies_acceptance_criteria ?? r.verifies_acs;
  const citedVacs = Array.isArray(rawVacs)
    ? (rawVacs as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const scopedVacs = childAcSet.size > 0
    ? citedVacs.filter(ac => childAcSet.has(ac))
    : citedVacs;
  const verifies_acceptance_criteria = citedVacs.length === 0
    ? undefined
    : scopedVacs;
  return {
    criterion_id: cid,
    description: desc,
    verification_method: vm && validVms.includes(vm)
      ? vm as TaskCompletionCriterion['verification_method'] : undefined,
    artifact_ref: ar,
    verifies_acceptance_criteria: verifies_acceptance_criteria && verifies_acceptance_criteria.length > 0
      ? verifies_acceptance_criteria : undefined,
  };
}

function extractStringArrayField(
  c: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const raw = c[key];
  return Array.isArray(raw)
    ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined;
}

function resolveChildTechConstraints(
  c: Record<string, unknown>,
  childId: string,
  logContext: { rootId: string; childIndex: number },
  techOracle: ReadonlySet<string>,
  techConstraints: readonly TechnicalConstraint[],
): { active_constraints: string[] | undefined; traces_to: string[] | undefined } {
  const rawConstraints = extractStringArrayField(c, 'active_constraints');
  const rawTraces = extractStringArrayField(c, 'traces_to');
  const resolvedC = rawConstraints ? resolveTechConstraintIds(rawConstraints, techOracle, techConstraints) : null;
  const resolvedT = rawTraces ? resolveTechConstraintIds(rawTraces, techOracle, techConstraints) : null;
  const techRewrites = [...(resolvedC?.rewrites ?? []), ...(resolvedT?.rewrites ?? [])];
  if (techRewrites.length > 0) {
    getLogger().warn('workflow', 'Phase 6.1a: resolved drifted TECH-* constraint ids to registry', {
      ...logContext, childId, rewrites: techRewrites,
    });
  }
  return { active_constraints: resolvedC?.ids, traces_to: resolvedT?.ids };
}

function sanitizeChildTask(
  c: Record<string, unknown>,
  logContext: { rootId: string; childIndex: number },
  techOracle: ReadonlySet<string>,
  techConstraints: readonly TechnicalConstraint[],
): DecompositionTask | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : null;
  if (!id || !name) {
    getLogger().warn('workflow', 'Phase 6.1a: dropped malformed child (missing id or name)', {
      ...logContext, missing: { id: !id, name: !name },
    });
    return null;
  }
  const description = typeof c.description === 'string' ? c.description : '';
  const componentId = typeof c.component_id === 'string' ? c.component_id : '';
  const componentResp = typeof c.component_responsibility === 'string'
    ? c.component_responsibility : '';
  if (!description || !componentId || !componentResp) {
    getLogger().warn('workflow', 'Phase 6.1a: dropped malformed child (missing description / component refs)', {
      ...logContext, childId: id,
      missing: { description: !description, componentId: !componentId, componentResp: !componentResp },
    });
    return null;
  }
  // The child's own cited AC set (traces_to AC-* ids) bounds any CC→AC link
  // it carries — propagated alongside AC inheritance so a saturation child's
  // completion criteria stay test-bindable. When the child cites no ACs the
  // link passes through (packet synthesis falls back to the task's AC set).
  const childAcSet = extractChildAcSet(c);
  const rawCriteria = Array.isArray(c.completion_criteria)
    ? c.completion_criteria as Array<Record<string, unknown>> : [];
  const completion_criteria: TaskCompletionCriterion[] = rawCriteria
    .map((r, idx) => sanitizeCriterion(r, idx, id, childAcSet))
    .filter(r => r.description.length > 0);
  if (completion_criteria.length === 0) {
    getLogger().warn('workflow', 'Phase 6.1a: dropped malformed child (no valid completion criteria)', {
      ...logContext, childId: id, rawCount: rawCriteria.length,
    });
    return null;
  }
  const taskType = c.task_type === 'refactoring' ? 'refactoring' as const : 'standard' as const;
  const validComplexity = ['low', 'medium', 'high'];
  const estimated_complexity = typeof c.estimated_complexity === 'string'
    && validComplexity.includes(c.estimated_complexity)
    ? c.estimated_complexity as DecompositionTask['estimated_complexity']
    : undefined;
  const complexity_flag = typeof c.complexity_flag === 'string' ? c.complexity_flag : undefined;
  // PA-9: snap LLM-drifted TECH-* constraint ids (missing "-1" suffix, drifted
  // separator, close typo) back to the canonical registry so a saturation
  // child's active_constraints / traces_to actually join it. Unresolvable
  // residuals (semantic aliases, noise) pass through unchanged and are logged.
  const resolvedTech = resolveChildTechConstraints(c, id, logContext, techOracle, techConstraints);
  return {
    id,
    name,
    description,
    task_type: taskType,
    component_id: componentId,
    component_responsibility: componentResp,
    estimated_complexity,
    complexity_flag,
    completion_criteria,
    // Deterministic write-scope (Project Layout Contract): saturation children
    // inherit the canonical component dir regardless of what the LLM emitted,
    // so a task's whole subtree stays under src/<component>.
    write_directory_paths: [canonicalComponentDir(componentId || 'unknown', 'src')],
    read_directory_paths: extractStringArrayField(c, 'read_directory_paths'),
    dependency_task_ids: extractStringArrayField(c, 'dependency_task_ids'),
    active_constraints: resolvedTech.active_constraints,
    traces_to: resolvedTech.traces_to,
  };
}

// ── Prompt formatting ──────────────────────────────────────────────

export function formatRootTaskForPrompt(t: DecompositionTask): string {
  const ccs = t.completion_criteria.map(r => `  - [${r.criterion_id}] ${r.description}`).join('\n');
  const writes = (t.write_directory_paths ?? []).join(', ') || '(none)';
  const reads = (t.read_directory_paths ?? []).join(', ') || '(none)';
  const deps = (t.dependency_task_ids ?? []).join(', ') || '(none)';
  // Surface parent traces_to so saturation children can re-cite parent
  // responsibility / Tech-Spec ids in their own traces_to[]. Without
  // this the model has no anchor and either omits or fabricates.
  const traces = ((t as unknown as Record<string, unknown>).traces_to as string[] | undefined)?.join(', ') || '(none)';
  // PA-10: surface the node's OWN inherited active_constraints (narrowed TECH-*
  // ids) in the parent block. Without this the model sees only the global
  // GOVERNING CONSTRAINTS menu and has to reconstruct which constraints apply to
  // THIS task from instructional examples → wrong/omitted TECH-* on children.
  const activeConstraints = (t.active_constraints ?? []).join(', ') || '(none inherited)';
  return [
    `Task id: ${t.id}`,
    `Name: ${t.name}`,
    `Description: ${t.description}`,
    `Component: ${t.component_id}`,
    `Component responsibility: ${t.component_responsibility}`,
    `Active constraints (inherited by this task — children MUST honor these TECH-* ids): ${activeConstraints}`,
    t.estimated_complexity ? `Complexity: ${t.estimated_complexity}` : null,
    'Completion criteria:',
    ccs,
    `Write paths: ${writes}`,
    `Read paths: ${reads}`,
    `Dependencies: ${deps}`,
    `Traces to: ${traces}`,
  ].filter(Boolean).join('\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (tcs.length === 0) return '(none captured in Phase 1.0c)';
  return tcs.map(t => {
    const versionSuffix = t.version ? ` ${t.version}` : '';
    const tech = t.technology ? ` [${t.technology}${versionSuffix}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

// ── Run state (threaded by reference through the pass helpers) ──────

type SaturationEngine = PhaseContext['engine'];
type DecompositionCaps = ReturnType<SaturationEngine['configManager']['get']>['decomposition'];
type SaturationTemplate = NonNullable<ReturnType<SaturationEngine['templateLoader']['findTemplate']>>;

/**
 * All shared, resolved-immutable + mutable state for one saturation run.
 * Threaded by reference through every pass / entry / post-pass helper so each
 * queue / sibling / counter / cursor write-back lands on the SAME object — the
 * behavior-preserving replacement for the original single-function closure.
 */
interface SaturationRun {
  ctx: PhaseContext;
  engine: SaturationEngine;
  workflowRun: PhaseContext['workflowRun'];
  input: TaskSaturationInput;
  config: TaskSaturationConfig;
  caps: DecompositionCaps;
  template: SaturationTemplate;
  techIdOracle: Set<string>;
  componentOracle: string[];
  pipelineId: string;
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
  embeddingClient: EmbeddingClient;
  embeddingCache: Map<string, number[]>;
  dedupThreshold: number;
  dedupEnabled: boolean;
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
  allAssumptions: TaskAssumptionEntry[];
  assumptionSeq: number;
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionTask[]>;
  callsByRoot: Map<string, number>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  parentChain: Map<string, string | null>;
  fellOpenCompIds: Set<string>;
  resolvedCompIds: Set<string>;
  consecutiveGrowthPasses: number;
  consecutiveDedupOfflinePasses: number;
  dedupOfflineAnnounced: boolean;
  divergingEarlyTerminate: boolean;
}

interface PendingGateChild {
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  task: DecompositionTask;
  rationale?: string;
}

interface PostGateCleanAudit {
  parentLogicalNodeId: string;
  parentDisplayKey: string;
  parentTask: DecompositionTask;
  children: DecompositionTask[];
}

/** Pass-scoped accumulators — recreated fresh at the top of each pass. */
interface PassState {
  passAssumptions: TaskAssumptionEntry[];
  pendingGateByParent: Map<string, PendingGateChild[]>;
  downgradeNotesByParent: Map<string, string>;
  postGateCleanAudits: PostGateCleanAudit[];
}

/** Next `TA-<nnnn>` id — pre-increments the shared sequence (order-preserving). */
function mintAssumptionId(run: SaturationRun): string {
  return `TA-${String(++run.assumptionSeq).padStart(4, '0')}`;
}

// ── Main loop ──────────────────────────────────────────────────────

export async function runTaskSaturationLoop(
  ctx: PhaseContext,
  input: TaskSaturationInput,
  config: TaskSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const run = await prepareSaturationRun(ctx, input, config);
  await runSaturationPasses(run);
  finalizeSaturationRun(run);
}

// ── Setup ──────────────────────────────────────────────────────────

function resolveTemplateOrThrow(
  engine: SaturationEngine,
  config: TaskSaturationConfig,
): SaturationTemplate {
  const template = engine.templateLoader.findTemplate(
    'implementation_planner',
    config.templateSubPhase,
  );
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: task-decomposition template missing — ` +
      `expected agent_role=implementation_planner sub_phase=${config.templateSubPhase}. ` +
      `This is a configuration error; Wave 8 cannot proceed without the template.`,
    );
  }
  return template;
}

function resolveDivergenceConfig(): {
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
} {
  return {
    divergeGrowthRatio: Number.parseFloat(
      process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2'),
    divergeWarnPasses: Number.parseInt(
      process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10),
    divergeTerminatePasses: Number.parseInt(
      process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10),
    dedupOfflineWarnPasses: Number.parseInt(
      process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10),
  };
}

function resolveDedupConfig(engine: SaturationEngine): {
  embeddingClient: EmbeddingClient;
  embeddingCache: Map<string, number[]>;
  dedupThreshold: number;
  dedupEnabled: boolean;
} {
  const embeddingClient: EmbeddingClient = engine.getEmbeddingClientOverride() ?? createEmbeddingClient();
  const embeddingCache = new Map<string, number[]>();
  const dedupThreshold = Number.parseFloat(
    process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
  const dedupEnabled = Number.isFinite(dedupThreshold)
    && dedupThreshold > 0
    && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';
  return { embeddingClient, embeddingCache, dedupThreshold, dedupEnabled };
}

function seedQueueFromRoots(input: TaskSaturationInput): QueueEntry[] {
  return input.rootTasks.map((t, i) => ({
    parentRecordId: input.rootNodeRecordIds[i],
    nodeId: input.rootLogicalIds[i],
    parentNodeId: null,
    rootTaskId: input.rootLogicalIds[i],
    depth: 0,
    task: t,
    displayKey: t.id,
    tierHint: 'root' as const,
    releaseId: null,
    releaseOrdinal: null,
    activeConstraints: t.active_constraints ?? [],
  }));
}

function initSiblingsByParent(
  resumed: ResumeState | null,
  input: TaskSaturationInput,
): Map<string | null, DecompositionTask[]> {
  if (resumed) return resumed.siblingsByParent;
  const siblingsByParent = new Map<string | null, DecompositionTask[]>();
  siblingsByParent.set(null, [...input.rootTasks]);
  return siblingsByParent;
}

function resolvePipelineStartRecord(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
  config: TaskSaturationConfig,
  input: TaskSaturationInput,
  pipelineId: string,
  resumed: ResumeState | null,
): { pipelineStartRecord: GovernedStreamRecord; currentPipelineRecordId: string } {
  const pipelineStartRecord = resumed?.pipelineStartRecord ?? engine.writer.writeRecord({
    record_type: 'task_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: input.rootNodeRecordIds,
    content: {
      kind: 'task_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_task_id: '*',
      passes: [],
    } satisfies TaskDecompositionPipelineContent,
  });
  const currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;
  return { pipelineStartRecord, currentPipelineRecordId };
}

function buildParentChain(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
): Map<string, string | null> {
  const parentChain = new Map<string, string | null>();
  const existingNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'task_decomposition_node',
  );
  for (const r of existingNodes) {
    const c = r.content as unknown as TaskDecompositionNodeContent;
    parentChain.set(c.node_id, c.parent_node_id);
  }
  return parentChain;
}

async function seedDedupCacheFromExistingAssumptions(run: SaturationRun): Promise<void> {
  if (!(run.dedupEnabled && run.allAssumptions.length > 0)) return;
  try {
    const vecs = await run.embeddingClient.embed(
      run.allAssumptions.map(a => a.text),
      { signal: run.engine.getSessionAbortSignal() },
    );
    run.allAssumptions.forEach((a, i) => {
      if (vecs[i]) run.embeddingCache.set(a.id, vecs[i]);
    });
    getLogger().info('workflow', `Phase ${run.config.recordSubPhaseId}: dedup cache seeded from existing assumptions`, {
      cached: run.embeddingCache.size, total: run.allAssumptions.length,
    });
  } catch (err) {
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup seed failed — continuing without dedup`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function prepareSaturationRun(
  ctx: PhaseContext,
  input: TaskSaturationInput,
  config: TaskSaturationConfig,
): Promise<SaturationRun> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;
  const template = resolveTemplateOrThrow(engine, config);

  const constraintsText = formatTechnicalConstraints(input.technicalConstraints);
  void constraintsText;
  // PA-9: canonical TECH-* registry oracle — saturation children routinely drift
  // these ids; each child is snapped back to a registry member (or kept + logged).
  const techIdOracle = new Set(input.technicalConstraints.map(t => t.id));
  // PA-1: component oracle (every id-form keyed in the scoped map) — resolve a
  // drifted/composite task component_id before component_context falls open.
  const componentOracle = Object.keys(input.componentSummaryById ?? {});

  const pipelineId = `task-decomp-pipe-${workflowRun.id.slice(0, 8)}`;
  const resumed = rebuildTaskSaturationStateFromStream(ctx, config, pipelineId);

  // Order-sensitive: the divergence config has no side effects; the pipeline
  // start record is WRITTEN here (unless resuming); the dedup config only news
  // up the client — matching the original setup ordering.
  const divergence = resolveDivergenceConfig();
  const pipeline = resolvePipelineStartRecord(engine, workflowRun, config, input, pipelineId, resumed);
  const dedup = resolveDedupConfig(engine);

  const run: SaturationRun = {
    ctx,
    engine,
    workflowRun,
    input,
    config,
    caps,
    template,
    techIdOracle,
    componentOracle,
    pipelineId,
    pipelineStartRecord: pipeline.pipelineStartRecord,
    currentPipelineRecordId: pipeline.currentPipelineRecordId,
    embeddingClient: dedup.embeddingClient,
    embeddingCache: dedup.embeddingCache,
    dedupThreshold: dedup.dedupThreshold,
    dedupEnabled: dedup.dedupEnabled,
    divergeGrowthRatio: divergence.divergeGrowthRatio,
    divergeWarnPasses: divergence.divergeWarnPasses,
    divergeTerminatePasses: divergence.divergeTerminatePasses,
    dedupOfflineWarnPasses: divergence.dedupOfflineWarnPasses,
    allAssumptions: resumed?.allAssumptions ?? [],
    assumptionSeq: resumed?.assumptionSeq ?? 0,
    queue: resumed?.queue ?? seedQueueFromRoots(input),
    siblingsByParent: initSiblingsByParent(resumed, input),
    callsByRoot: new Map<string, number>(),
    maxDepthReached: resumed?.maxDepthReached ?? 0,
    passNumber: resumed?.passNumber ?? 0,
    pipelinePasses: resumed?.pipelinePasses ?? [],
    // Pure read (task_decomposition_node) — the dedup seed writes no records, so
    // building this before it yields identical results to the original ordering.
    parentChain: buildParentChain(engine, workflowRun),
    // PA-1 fail-safe visibility: component_context silently falls open to the FULL
    // summary when a task's component_id isn't a key in componentSummaryById. Track
    // unique missed ids and WARN once each so a high fall-open rate surfaces.
    fellOpenCompIds: new Set<string>(),
    resolvedCompIds: new Set<string>(),
    consecutiveGrowthPasses: 0,
    consecutiveDedupOfflinePasses: 0,
    dedupOfflineAnnounced: false,
    divergingEarlyTerminate: false,
  };

  await seedDedupCacheFromExistingAssumptions(run);
  return run;
}

async function runSaturationPasses(run: SaturationRun): Promise<void> {
  const { engine, workflowRun } = run;
  while (run.queue.length > 0) {
    run.passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'task_decomposition_node',
    ).length;
    const passEntries = run.queue.splice(0, run.queue.length);
    const pass: PassState = {
      passAssumptions: [],
      pendingGateByParent: new Map<string, PendingGateChild[]>(),
      downgradeNotesByParent: new Map<string, string>(),
      postGateCleanAudits: [],
    };

    for (const entry of passEntries) {
      await processPassEntry(run, pass, entry);
    }

    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'task_decomposition_node',
    ).length - nodesProducedAtPassStart;
    recordPipelinePass(run, pass, passStartedAt, nodesProducedThisPass);

    const dedupFailedThisPass = await applyPassDedup(run, pass);
    const semanticDelta = pass.passAssumptions.filter(a => !a.duplicate_of).length;
    appendAndSnapshotAssumptions(run, pass, semanticDelta);

    await runAtomicShapeAuditsIfEnabled(run, pass);
    await resolveTierBGates(run, pass);

    if (dedupFailedThisPass) noteDedupOfflinePass(run);
    else noteDedupOnlinePass(run);
    detectAndHandleDivergence(run, nodesProducedThisPass);

    if (run.divergingEarlyTerminate) break;
    if (semanticDelta === 0 && run.queue.length === 0) break;
  }
}

/** One queue entry: safety-cap gates, then decompose (deferred on any throw). */
async function processPassEntry(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { ctx, config, caps } = run;
  if (entry.depth >= caps.task_depth_cap) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: depth cap reached on branch — freezing as deferred`, {
      nodeId: entry.nodeId, displayKey: entry.displayKey, depth: entry.depth, cap: caps.task_depth_cap,
    });
    writeDeferredSupersession(ctx, entry, run.passNumber, 'depth_cap_reached', config);
    return;
  }
  const rootCalls = run.callsByRoot.get(entry.rootTaskId) ?? 0;
  if (rootCalls >= caps.task_budget_cap) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: per-root budget cap reached — deferring`, {
      rootTaskId: entry.rootTaskId, rootCalls, cap: caps.task_budget_cap,
    });
    writeDeferredSupersession(ctx, entry, run.passNumber, 'budget_cap_reached', config);
    return;
  }

  try {
    await decomposeEntry(run, pass, entry);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking node deferred`, {
      nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
    });
    writeDeferredSupersession(ctx, entry, run.passNumber, `decomposition_failed: ${reason}`, config);
  }
}

/**
 * The decomposer call + child emission for one entry. Everything here runs
 * inside the caller's try/catch, so any throw defers the node — matching the
 * original single try block (siblings → render → LLM → children → supersession).
 */
async function decomposeEntry(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { engine, workflowRun, config } = run;

  const variables = buildDecompositionVariables(run, pass, entry);
  const rendered = engine.templateLoader.render(run.template, variables);
  if (rendered.missing_variables.length > 0) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: decomposition template has unfilled variables ` +
      `[${rendered.missing_variables.join(', ')}].`,
    );
  }

  run.callsByRoot.set(entry.rootTaskId, (run.callsByRoot.get(entry.rootTaskId) ?? 0) + 1);
  const result = await engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.4,
    traceContext: {
      workflowRunId: workflowRun.id,
      phaseId: '6',
      subPhaseId: config.recordSubPhaseId,
      agentRole: 'implementation_planner',
      label: `Phase ${config.recordSubPhaseId} Pass-${run.passNumber} — decomposition of ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
    },
  });

  const parsed = result.parsed as Record<string, unknown> | null;
  const childrenRaw = Array.isArray(parsed?.children)
    ? parsed.children as Array<Record<string, unknown>> : [];
  const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
    ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
  const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;
  if (tierAssessment?.agrees_with_hint === false) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposer disagrees with tier hint`, {
      nodeId: entry.nodeId, displayKey: entry.displayKey, hint: entry.tierHint,
      assessed: tierAssessment.tier, rationale: tierAssessment.rationale,
    });
  }

  const childAssumptionIds = collectSurfacedAssumptions(run, pass, entry, surfacedRaw);

  const childDepth = entry.depth + 1;
  run.maxDepthReached = Math.max(run.maxDepthReached, childDepth);

  const { emittedChildren, emittedChildrenWithTier } = emitChildNodes(
    run, pass, entry, childrenRaw, childAssumptionIds, childDepth,
  );
  if (emittedChildren.length > 0) {
    run.siblingsByParent.set(entry.nodeId, emittedChildren);
  }

  const parentDowngraded = applyTierBDowngradeIfNeeded(run, pass, entry, tierAssessment, emittedChildrenWithTier);
  // Status transition for successful decomposition. See Wave 6 labelling-
  // correctness fix: parents that produced children need a `decomposed`
  // supersession or they stay forever labelled `pending`.
  writeDecomposedSupersession(run, entry, emittedChildren.length, parentDowngraded);
}

/** Assemble the template variables (component/sibling scoping + assumptions). */
function buildDecompositionVariables(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Record<string, string> {
  const { input, engine } = run;
  const siblings = run.siblingsByParent.get(entry.parentNodeId) ?? [];
  const ancestorIds = collectAncestorNodeIds(entry, run.parentChain);
  const scopedAssumptions = [...run.allAssumptions, ...pass.passAssumptions]
    .filter(a => !a.duplicate_of)
    .filter(a => a.surfaced_at_node == null || ancestorIds.has(a.surfaced_at_node));

  const inherited = entry.activeConstraints.length > 0
    ? input.technicalConstraints.filter(t => entry.activeConstraints.includes(t.id))
    : input.technicalConstraints;
  const activeConstraintsForPrompt = formatTechnicalConstraints(inherited);

  // Cross-branch `dependency_task_ids[]` need to point at root tasks from other
  // branches. `sibling_context` only carries same-parent siblings, so without
  // this roster the model omits valid cross-branch deps or fabricates ids.
  // Compact id-only roster (PA-1): just the valid cross-branch dependency-target
  // id namespace, not 186 `id: name` lines (~33KB) that buried the parent block.
  const depthZeroTasksText = input.rootTasks.length === 0
    ? '(none)'
    : input.rootTasks.map(t => t.id).join(', ');

  const scopedComponentCtx = resolveScopedComponentContext(run, entry);

  return {
    active_constraints: activeConstraintsForPrompt,
    parent_task: formatRootTaskForPrompt(entry.task),
    parent_tier_hint: entry.tierHint,
    sibling_context: formatSiblingContext(siblings, entry),
    component_context: scopedComponentCtx ?? input.componentSummary,
    depth_zero_tasks: depthZeroTasksText,
    existing_assumptions: scopedAssumptions.length === 0
      ? '(none yet)'
      : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
    current_depth: String(entry.depth),
    janumicode_version_sha: engine.janumiCodeVersionSha,
  };
}

/** Walk parent links to the root, guarding against cycles. */
function collectAncestorNodeIds(
  entry: QueueEntry,
  parentChain: Map<string, string | null>,
): Set<string | null> {
  const ancestorIds = new Set<string | null>();
  ancestorIds.add(entry.nodeId);
  let cursor: string | null | undefined = entry.parentNodeId;
  while (cursor) {
    if (ancestorIds.has(cursor)) break;
    ancestorIds.add(cursor);
    cursor = parentChain.get(cursor) ?? null;
  }
  return ancestorIds;
}

/**
 * PA-1: scope component_context to the task's OWN component. On a direct miss,
 * resolve the id against the component oracle before falling open to the full
 * catalog. Mutates the run's resolved/fell-open id sets so each id warns once.
 */
function resolveScopedComponentContext(
  run: SaturationRun,
  entry: QueueEntry,
): string | undefined {
  const { input, componentOracle, workflowRun } = run;
  const citedCompId = entry.task.component_id;
  let scopedComponentCtx = input.componentSummaryById?.[citedCompId];
  if (citedCompId && scopedComponentCtx === undefined && componentOracle.length > 0) {
    const resolved = resolveComponentId(citedCompId, componentOracle);
    if (resolved && resolved !== citedCompId) {
      scopedComponentCtx = input.componentSummaryById?.[resolved];
      if (!run.resolvedCompIds.has(citedCompId)) {
        run.resolvedCompIds.add(citedCompId);
        getLogger().warn('workflow', 'Phase 6.1a task_saturation: resolved drifted/composite component_id to its scoped component (PA-1)', {
          workflow_run_id: workflowRun.id, component_id: citedCompId, resolved_to: resolved,
        });
      }
    }
  }
  if (citedCompId && scopedComponentCtx === undefined
      && !run.fellOpenCompIds.has(citedCompId)) {
    run.fellOpenCompIds.add(citedCompId);
    getLogger().warn('workflow', 'Phase 6.1a task_saturation: component_context fell open to the FULL summary — component id unresolvable against the component oracle (PA-1 residual)', {
      workflow_run_id: workflowRun.id, component_id: citedCompId,
    });
  }
  return scopedComponentCtx;
}

/**
 * Render the sibling roster. Scope root-node siblings to the same component
 * (PA-1): at depth 0 `siblingsByParent.get(null)` is EVERY root task across ALL
 * components, which duplicated depth_zero_tasks and buried the parent block.
 */
function formatSiblingContext(
  siblings: DecompositionTask[],
  entry: QueueEntry,
): string {
  const isRoot = entry.parentNodeId == null;
  const sibs = siblings
    .filter(s => s.id !== entry.task.id)
    .filter(s => !isRoot || s.component_id === entry.task.component_id);
  return sibs.length === 0
    ? '(none — sole child under this parent)'
    : sibs.map(s => `- ${s.id}: ${s.name}`).join('\n');
}

/** Mint TA-ids for the surfaced assumptions, appending to the pass batch. */
function collectSurfacedAssumptions(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  surfacedRaw: Array<Record<string, unknown>>,
): string[] {
  const childAssumptionIds: string[] = [];
  for (const a of surfacedRaw) {
    const text = typeof a.text === 'string' ? a.text : null;
    if (!text) continue;
    const cat = typeof a.category === 'string' ? a.category : 'open_question';
    const validCats: TaskAssumptionEntry['category'][] = [
      'implementation_choice', 'sequencing', 'dependency',
      'tooling', 'scope_boundary', 'integration_seam', 'open_question',
    ];
    const category = (validCats as string[]).includes(cat)
      ? cat as TaskAssumptionEntry['category']
      : 'open_question';
    const citations = Array.isArray(a.citations)
      ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
    const assumption: TaskAssumptionEntry = {
      id: mintAssumptionId(run),
      text,
      source: 'decomposition',
      surfaced_at_node: entry.nodeId,
      surfaced_at_pass: run.passNumber,
      category,
      citations,
    };
    pass.passAssumptions.push(assumption);
    childAssumptionIds.push(assumption.id);
  }
  return childAssumptionIds;
}

/** Sanitize, enrich, persist and route each child (tier A/C → queue, B → gate). */
function emitChildNodes(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  childrenRaw: Array<Record<string, unknown>>,
  childAssumptionIds: string[],
  childDepth: number,
): {
  emittedChildren: DecompositionTask[];
  emittedChildrenWithTier: Array<{ task: DecompositionTask; tier: DecompositionTier; logicalNodeId: string; displayKey: string }>;
} {
  const { engine, workflowRun, config, caps } = run;
  const emittedChildren: DecompositionTask[] = [];
  const emittedChildrenWithTier: Array<{ task: DecompositionTask; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
  const siblingDisplayKeys = new Set<string>();
  let fanoutCount = 0;
  for (const c of childrenRaw) {
    if (++fanoutCount > caps.task_fanout_cap) {
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: fanout cap reached — dropping remaining children`, {
        parentNodeId: entry.nodeId, parentDisplayKey: entry.displayKey,
        cap: caps.task_fanout_cap, totalOffered: childrenRaw.length,
      });
      break;
    }
    const child = sanitizeChildTask(c, { rootId: entry.displayKey, childIndex: fanoutCount }, run.techIdOracle, run.input.technicalConstraints);
    if (!child) continue;
    const tier = normalizeTier(c.tier);
    const rationale = typeof c.decomposition_rationale === 'string'
      ? c.decomposition_rationale : undefined;
    const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
    const logicalNodeId = mintLogicalNodeId();
    const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
    siblingDisplayKeys.add(displayKey);

    const { enrichedChild, childActiveConstraints } = buildEnrichedChild(child, entry);

    const childRec = engine.writer.writeRecord({
      record_type: 'task_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'implementation_planner',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'task_decomposition_node',
        node_id: logicalNodeId,
        parent_node_id: entry.nodeId,
        display_key: displayKey,
        root_task_id: entry.rootTaskId,
        depth: childDepth,
        pass_number: run.passNumber,
        status: initialStatus,
        tier,
        task: enrichedChild,
        decomposition_rationale: rationale,
        surfaced_assumption_ids: childAssumptionIds,
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies TaskDecompositionNodeContent,
    });
    emittedChildren.push(enrichedChild);
    emittedChildrenWithTier.push({ task: enrichedChild, tier, logicalNodeId, displayKey });
    run.parentChain.set(logicalNodeId, entry.nodeId);

    routeChildByTier(run, pass, entry, {
      tier,
      enrichedChild,
      childRecordId: childRec.id,
      logicalNodeId,
      displayKey,
      childDepth,
      childActiveConstraints,
      rationale,
    });
  }
  return { emittedChildren, emittedChildrenWithTier };
}

/**
 * Deterministic child enrichment: inherit active_constraints, carry the parent's
 * leaf AC ids (task→leaf-AC binding) when the child cited none, and keep the
 * subtree under the parent's (id-drift-resolved) component_id.
 */
function buildEnrichedChild(
  child: DecompositionTask,
  entry: QueueEntry,
): { enrichedChild: DecompositionTask; childActiveConstraints: string[] } {
  const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
    ? child.active_constraints
    : entry.activeConstraints;
  const parentAcIds = (entry.task?.traces_to ?? [])
    .filter((x): x is string => typeof x === 'string' && x.startsWith('AC-'));
  const childTraces = child.traces_to ?? [];
  const childCitesAc = childTraces.some((x) => typeof x === 'string' && x.startsWith('AC-'));
  const parentComponentId = entry.task?.component_id;
  const childComponentId = (parentComponentId && parentComponentId.length > 0) ? parentComponentId : child.component_id;
  const enrichedChild: DecompositionTask = {
    ...child,
    component_id: childComponentId,
    write_directory_paths: [canonicalComponentDir(childComponentId || 'unknown', 'src')],
    active_constraints: childActiveConstraints,
    traces_to: childCitesAc ? childTraces : [...childTraces, ...parentAcIds],
  };
  return { enrichedChild, childActiveConstraints };
}

/** Route an emitted child by tier: A/C recurse (queue), B waits for the gate. */
function routeChildByTier(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  args: {
    tier: DecompositionTier;
    enrichedChild: DecompositionTask;
    childRecordId: string;
    logicalNodeId: string;
    displayKey: string;
    childDepth: number;
    childActiveConstraints: string[];
    rationale: string | undefined;
  },
): void {
  if (args.tier === 'A') {
    run.queue.push({
      parentRecordId: args.childRecordId, nodeId: args.logicalNodeId, parentNodeId: entry.nodeId,
      rootTaskId: entry.rootTaskId, depth: args.childDepth, task: args.enrichedChild,
      displayKey: args.displayKey, tierHint: 'A',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
      activeConstraints: args.childActiveConstraints,
    });
  } else if (args.tier === 'B') {
    const batch = pass.pendingGateByParent.get(entry.nodeId) ?? [];
    batch.push({ nodeRecordId: args.childRecordId, logicalNodeId: args.logicalNodeId, displayKey: args.displayKey, task: args.enrichedChild, rationale: args.rationale });
    pass.pendingGateByParent.set(entry.nodeId, batch);
  } else if (args.tier === 'C') {
    run.queue.push({
      parentRecordId: args.childRecordId, nodeId: args.logicalNodeId, parentNodeId: entry.nodeId,
      rootTaskId: entry.rootTaskId, depth: args.childDepth, task: args.enrichedChild,
      displayKey: args.displayKey, tierHint: 'C',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
      activeConstraints: args.childActiveConstraints,
    });
  }
}

/**
 * Step 4b: a previously-accepted Tier-B parent that either the decomposer
 * disagreed with, or that produced its own Tier-B children, is downgraded
 * (superseded). Returns true when the parent was downgraded (which suppresses
 * the `decomposed` supersession). Clean Tier-B parents queue a shape audit.
 */
function applyTierBDowngradeIfNeeded(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  tierAssessment: Record<string, unknown> | undefined,
  emittedChildrenWithTier: Array<{ task: DecompositionTask; tier: DecompositionTier; logicalNodeId: string; displayKey: string }>,
): boolean {
  if (entry.tierHint !== 'B') return false;
  const { engine, workflowRun, config } = run;

  const explicitDisagreement = tierAssessment?.agrees_with_hint === false
    && typeof tierAssessment.tier === 'string'
    && (tierAssessment.tier === 'A' || tierAssessment.tier === 'B');
  const producedTierBChildren = (pass.pendingGateByParent.get(entry.nodeId)?.length ?? 0) > 0;
  if (explicitDisagreement || producedTierBChildren) {
    const reason = explicitDisagreement
      ? `tier_downgrade: decomposer_assessed_${tierAssessment?.tier}_not_B`
      : 'tier_downgrade: post_gate_children_still_tier_B';
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId} Step 4b: downgrading previously-accepted Tier-B parent`, {
      nodeId: entry.nodeId, displayKey: entry.displayKey, reason,
      producedTierB: pass.pendingGateByParent.get(entry.nodeId)?.length ?? 0,
      explicitDisagreement,
    });
    const downgradedRec = engine.writer.writeRecord({
      record_type: 'task_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'task_decomposition_node',
        node_id: entry.nodeId,
        parent_node_id: entry.parentNodeId,
        display_key: entry.displayKey,
        root_task_id: entry.rootTaskId,
        depth: entry.depth,
        pass_number: run.passNumber,
        status: 'downgraded',
        task: entry.task,
        surfaced_assumption_ids: [],
        pruning_reason: reason,
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies TaskDecompositionNodeContent,
    });
    engine.writer.supersedeTaskDecompositionNodeByLogicalId(
      workflowRun.id, entry.nodeId, downgradedRec.id,
    );
    if (producedTierBChildren) {
      pass.downgradeNotesByParent.set(
        entry.nodeId,
        `The task '${entry.displayKey}' you accepted earlier turned out to ` +
        `have its own commitment layer underneath. The tasks below are ` +
        `sub-commitments within '${entry.displayKey}' that need your review as well.`,
      );
    }
    return true;
  }
  if (emittedChildrenWithTier.length > 0) {
    pass.postGateCleanAudits.push({
      parentLogicalNodeId: entry.nodeId,
      parentDisplayKey: entry.displayKey,
      parentTask: entry.task,
      children: emittedChildrenWithTier.map(x => x.task),
    });
  }
  return false;
}

/** Supersede a parent that produced children (and wasn't downgraded) as decomposed. */
function writeDecomposedSupersession(
  run: SaturationRun,
  entry: QueueEntry,
  emittedChildrenCount: number,
  parentDowngraded: boolean,
): void {
  if (!(emittedChildrenCount > 0 && !parentDowngraded)) return;
  const { engine, workflowRun, config } = run;
  // Preserve creation provenance — see phase2.ts pending→decomposed transition.
  const originalRec = engine.writer.getRecord(entry.parentRecordId);
  const originalSubPhase = originalRec?.sub_phase_id ?? config.recordSubPhaseId;
  const decomposedRec = engine.writer.writeRecord({
    record_type: 'task_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: originalSubPhase,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'task_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_task_id: entry.rootTaskId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'decomposed',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      task: entry.task,
      surfaced_assumption_ids: [],
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TaskDecompositionNodeContent,
  });
  engine.writer.supersedeTaskDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, decomposedRec.id,
  );
}

/** Append this pass to the pipeline record and roll the current-record cursor. */
function recordPipelinePass(
  run: SaturationRun,
  pass: PassState,
  passStartedAt: string,
  nodesProducedThisPass: number,
): void {
  const { engine, workflowRun, config } = run;
  run.pipelinePasses.push({
    pass_number: run.passNumber,
    status: 'completed',
    started_at: passStartedAt,
    completed_at: new Date().toISOString(),
    nodes_produced: nodesProducedThisPass,
    assumption_delta: pass.passAssumptions.length,
  });
  const passUpdateRecord = engine.writer.writeRecord({
    record_type: 'task_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'task_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_task_id: '*',
      passes: [...run.pipelinePasses],
    } satisfies TaskDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, passUpdateRecord.id);
  run.currentPipelineRecordId = passUpdateRecord.id;
}

/**
 * Flag this pass's assumptions that duplicate a prior (by embedding similarity).
 * Returns true only when the embed itself failed (dedup went offline this pass).
 */
async function applyPassDedup(run: SaturationRun, pass: PassState): Promise<boolean> {
  if (!(run.dedupEnabled && pass.passAssumptions.length > 0)) return false;
  try {
    const newVecs = await run.embeddingClient.embed(
      pass.passAssumptions.map(a => a.text),
      { signal: run.engine.getSessionAbortSignal() },
    );
    for (let i = 0; i < pass.passAssumptions.length; i++) {
      const a = pass.passAssumptions[i];
      const v = newVecs[i];
      if (!v) continue;
      const priors = [...run.embeddingCache.entries()].map(([id, vector]) => ({ id, vector }));
      const match = findNearestAbove(v, priors, run.dedupThreshold);
      if (match) {
        a.duplicate_of = match.id;
        a.duplicate_similarity = match.similarity;
      }
      run.embeddingCache.set(a.id, v);
    }
    return false;
  } catch (err) {
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup embed failed this pass — flags skipped`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/** Fold the pass batch into the running set and snapshot the assumption state. */
function appendAndSnapshotAssumptions(
  run: SaturationRun,
  pass: PassState,
  semanticDelta: number,
): void {
  const { engine, workflowRun, config } = run;
  run.allAssumptions.push(...pass.passAssumptions);
  engine.writer.writeRecord({
    record_type: 'task_assumption_set_snapshot',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'implementation_planner',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: {
      kind: 'task_assumption_set_snapshot',
      pass_number: run.passNumber,
      root_task_id: '*',
      assumptions: [...run.allAssumptions],
      delta_from_previous_pass: pass.passAssumptions.length,
      semantic_delta: semanticDelta,
    } satisfies TaskAssumptionSetSnapshotContent,
  });
}

/** Step 4c (advisory): audit clean Tier-B parents' children for atomic shape. */
async function runAtomicShapeAuditsIfEnabled(run: SaturationRun, pass: PassState): Promise<void> {
  if (!(run.caps.task_reasoning_review_on_tier_c && pass.postGateCleanAudits.length > 0)) return;
  for (const audit of pass.postGateCleanAudits) {
    await runAtomicShapeAudit(
      run.ctx,
      audit.parentLogicalNodeId,
      audit.parentDisplayKey,
      audit.parentTask,
      audit.children,
      run.passNumber,
      run.config.recordSubPhaseId,
    );
  }
}

/** Present the Tier-B mirror gates, then prune human-rejected children / queue the rest. */
async function resolveTierBGates(run: SaturationRun, pass: PassState): Promise<void> {
  if (pass.pendingGateByParent.size === 0) return;
  const { engine, workflowRun, config } = run;
  const bundlePlans = emitTierBGateBundles(
    run.ctx, pass.pendingGateByParent, pass.downgradeNotesByParent, config,
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
        writePrunedSupersession(run.ctx, plan.parentNodeId, child, 'human-rejected', config);
      } else {
        run.queue.push({
          parentRecordId: child.nodeRecordId,
          nodeId: child.logicalNodeId,
          parentNodeId: plan.parentNodeId,
          rootTaskId: child.rootTaskId,
          depth: child.depth,
          task: child.task,
          displayKey: child.displayKey,
          tierHint: 'B',
          releaseId: child.releaseId,
          releaseOrdinal: child.releaseOrdinal,
          activeConstraints: child.task.active_constraints ?? [],
        });
      }
    }
  }
}

/** Track consecutive dedup-offline passes and announce once past the threshold. */
/** A pass where assumption dedup was offline: bump the streak, warn once at threshold. */
function noteDedupOfflinePass(run: SaturationRun): void {
  run.consecutiveDedupOfflinePasses++;
  if (run.consecutiveDedupOfflinePasses >= run.dedupOfflineWarnPasses && !run.dedupOfflineAnnounced) {
    getLogger().warn('workflow',
      `Phase ${run.config.recordSubPhaseId}: assumption dedup has been offline for ${run.consecutiveDedupOfflinePasses} consecutive passes`,
      { consecutiveDedupOfflinePasses: run.consecutiveDedupOfflinePasses, passNumber: run.passNumber });
    run.dedupOfflineAnnounced = true;
  }
}

/** A pass where assumption dedup was online: reset the offline streak + announcement. */
function noteDedupOnlinePass(run: SaturationRun): void {
  run.dedupOfflineAnnounced = false;
  run.consecutiveDedupOfflinePasses = 0;
}

/** Divergence rail: warn then EARLY-TERMINATE (defer the queue) on sustained growth. */
function detectAndHandleDivergence(run: SaturationRun, nodesProducedThisPass: number): void {
  const priorPass = run.pipelinePasses.length >= 2
    ? run.pipelinePasses.at(-2)
    : null;
  const growthObserved = priorPass
    && priorPass.nodes_produced > 0
    && nodesProducedThisPass > priorPass.nodes_produced * run.divergeGrowthRatio;
  if (growthObserved) {
    run.consecutiveGrowthPasses++;
    if (run.consecutiveGrowthPasses >= run.divergeWarnPasses) {
      getLogger().warn('workflow',
        `Phase ${run.config.recordSubPhaseId}: saturation loop appears to be diverging`,
        { passNumber: run.passNumber, consecutiveGrowthPasses: run.consecutiveGrowthPasses });
    }
    if (run.consecutiveGrowthPasses >= run.divergeTerminatePasses) {
      getLogger().warn('workflow',
        `Phase ${run.config.recordSubPhaseId}: EARLY TERMINATE — diverging loop`,
        { passNumber: run.passNumber, remainingQueueSize: run.queue.length });
      for (const remaining of run.queue) {
        writeDeferredSupersession(run.ctx, remaining, run.passNumber, 'diverging', run.config);
      }
      run.queue.length = 0;
      run.divergingEarlyTerminate = true;
    }
  } else {
    run.consecutiveGrowthPasses = 0;
  }
}

// ── Finalization ───────────────────────────────────────────────────

/** Pick the termination reason in the original precedence order. */
function resolveTerminationReason(run: SaturationRun, maxRootCalls: number): DecompositionTerminationReason {
  if (run.divergingEarlyTerminate) return 'diverging';
  if (maxRootCalls >= run.caps.task_budget_cap) return 'budget_cap';
  if (run.maxDepthReached >= run.caps.task_depth_cap) return 'depth_cap';
  if (run.dedupOfflineAnnounced) return 'dedup_offline';
  return 'fixed_point';
}

/** Tally the final tier distribution and atomic-leaf count over all node records. */
function summarizeFinalNodes(
  finalNodes: GovernedStreamRecord[],
): { tierDistribution: { A: number; B: number; C: number; D: number }; atomicLeafCount: number } {
  const tierDistribution: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 };
  let atomicLeafCount = 0;
  for (const n of finalNodes) {
    const c = n.content as unknown as TaskDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }
  return { tierDistribution, atomicLeafCount };
}

/** Best-effort workflow_runs telemetry (budget / depth / active pipeline). */
function writeTaskDecompositionTelemetry(run: SaturationRun, totalLlmCalls: number): void {
  const { engine, workflowRun, config } = run;
  try {
    const db = engine.db;
    db.prepare(`
      UPDATE workflow_runs
      SET task_decomposition_budget_calls_used = ?,
          task_decomposition_max_depth_reached = MAX(task_decomposition_max_depth_reached, ?),
          active_task_pipeline_id = ?
      WHERE id = ?
    `).run(totalLlmCalls, run.maxDepthReached, run.pipelineId, workflowRun.id);
  } catch (err) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: telemetry write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Write the terminal pipeline record + telemetry once the loop has settled. */
function finalizeSaturationRun(run: SaturationRun): void {
  const { engine, workflowRun, config } = run;
  const totalLlmCalls = [...run.callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = run.callsByRoot.size > 0 ? Math.max(...run.callsByRoot.values()) : 0;
  const terminationReason = resolveTerminationReason(run, maxRootCalls);

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node');
  const { tierDistribution, atomicLeafCount } = summarizeFinalNodes(finalNodes);

  const pipelineFinalRecord = engine.writer.writeRecord({
    record_type: 'task_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'task_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_task_id: '*',
      passes: run.pipelinePasses.map((p, i) =>
        i === run.pipelinePasses.length - 1
          ? { ...p, termination_reason: terminationReason }
          : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: run.maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies TaskDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, pipelineFinalRecord.id);

  writeTaskDecompositionTelemetry(run, totalLlmCalls);
}

// ── Helpers — supersession writers ─────────────────────────────────

function writeDeferredSupersession(
  ctx: PhaseContext,
  entry: QueueEntry,
  passNumber: number,
  reason: string,
  config: TaskSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const deferredRec = engine.writer.writeRecord({
    record_type: 'task_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'task_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_task_id: entry.rootTaskId,
      depth: entry.depth,
      pass_number: passNumber,
      status: 'deferred',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      task: entry.task,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TaskDecompositionNodeContent,
  });
  engine.writer.supersedeTaskDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, deferredRec.id,
  );
}

interface PrunedChildItem {
  itemId: string;
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  task: DecompositionTask;
  rootTaskId: string;
  depth: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
}

function writePrunedSupersession(
  ctx: PhaseContext,
  parentNodeId: string,
  child: PrunedChildItem,
  reason: string,
  config: TaskSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const prunedRec = engine.writer.writeRecord({
    record_type: 'task_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [child.nodeRecordId],
    content: {
      kind: 'task_decomposition_node',
      node_id: child.logicalNodeId,
      parent_node_id: parentNodeId,
      display_key: child.displayKey,
      root_task_id: child.rootTaskId,
      depth: child.depth,
      pass_number: 0,
      status: 'pruned',
      tier: 'B',
      task: child.task,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: child.releaseId,
      release_ordinal: child.releaseOrdinal,
    } satisfies TaskDecompositionNodeContent,
  });
  engine.writer.supersedeTaskDecompositionNodeByLogicalId(
    workflowRun.id, child.logicalNodeId, prunedRec.id,
  );
}

// ── Mirror gate bundles (Tier-B emergence) ─────────────────────────

interface BundlePlan {
  bundleRecordId: string;
  parentNodeId: string;
  childItems: PrunedChildItem[];
}

function emitTierBGateBundles(
  ctx: PhaseContext,
  pendingGateByParent: Map<string, Array<{
    nodeRecordId: string;
    logicalNodeId: string;
    displayKey: string;
    task: DecompositionTask;
    rationale?: string;
  }>>,
  downgradeNotesByParent: Map<string, string>,
  config: TaskSaturationConfig,
): BundlePlan[] {
  const { engine, workflowRun } = ctx;
  const plans: BundlePlan[] = [];

  const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node');
  const byLogicalId = new Map<string, TaskDecompositionNodeContent>();
  for (const r of allNodes) {
    const c = r.content as unknown as TaskDecompositionNodeContent;
    byLogicalId.set(c.node_id, c);
  }

  for (const [parentNodeId, children] of pendingGateByParent) {
    const parentContent = byLogicalId.get(parentNodeId);
    if (!parentContent) continue;
    const childDepth = parentContent.depth + 1;
    const downgradeNote = downgradeNotesByParent.get(parentNodeId);

    const childItems: PrunedChildItem[] = children.map((child, idx) => ({
      itemId: `child-${idx}`,
      nodeRecordId: child.nodeRecordId,
      logicalNodeId: child.logicalNodeId,
      displayKey: child.displayKey,
      task: child.task,
      rootTaskId: parentContent.root_task_id,
      depth: childDepth,
      releaseId: parentContent.release_id,
      releaseOrdinal: parentContent.release_ordinal,
    }));

    const bundleId = `${config.gateSurfacePrefix}${parentContent.display_key}`;
    const items = childItems.map(c => ({
      item_id: c.itemId,
      title: `${c.task.name} (${c.displayKey})`,
      description: c.task.completion_criteria.map(cc => `• ${cc.description}`).join('\n'),
      details: {
        task_id: c.task.id,
        component_id: c.task.component_id,
        completion_criteria: c.task.completion_criteria.length,
        dependencies: c.task.dependency_task_ids ?? [],
        active_constraints: c.task.active_constraints ?? [],
      },
    }));
    const bundleContext = downgradeNote
      ? `${downgradeNote}\n\nReview each Tier-B sub-commitment below; reject any that should not be in scope.`
      : `These are scope commitments under "${parentContent.display_key}" identified during recursive task decomposition. Accept the ones in scope; reject any out-of-scope.`;

    const bundleRec = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'decision_bundle',
        bundle_id: bundleId,
        bundle_type: 'mirror_decision',
        title: `Tier-B Task Commitments under "${parentContent.display_key}"`,
        context: bundleContext,
        items,
      } as Record<string, unknown>,
    });
    engine.eventBus.emit('mirror:presented', {
      mirrorId: bundleId,
      artifactType: 'task_decomposition_bundle',
    });

    plans.push({
      bundleRecordId: bundleRec.id,
      parentNodeId,
      childItems,
    });
  }
  return plans;
}

// ── Step 4c — atomic-shape audit (advisory) ────────────────────────

async function runAtomicShapeAudit(
  ctx: PhaseContext,
  parentLogicalNodeId: string,
  parentDisplayKey: string,
  parentTask: DecompositionTask,
  children: DecompositionTask[],
  passNumber: number,
  recordSubPhaseId: 'task_saturation',
): Promise<void> {
  const { engine, workflowRun } = ctx;

  const childrenText = children.map(c => {
    const criteriaText = c.completion_criteria.map(r => `  • ${r.description}`).join('\n');
    return `${c.id} (${c.name}):\n${criteriaText}`;
  }).join('\n\n');

  const prompt = `You are auditing a Tier-C task decomposition for atomic-unit shape.

Parent task (Tier-B, accepted by human at prior gate):
${parentTask.name} (${parentDisplayKey})
${parentTask.completion_criteria.map(r => `• ${r.description}`).join('\n')}

Tier-C children produced under this parent:
${childrenText}

For EACH child, audit four properties:
1. single_executor_session — the work fits in one focused work cycle (~30–90 min) for one executor.
2. completion_criteria_verifiable — every completion criterion is independently verifiable (test, schema check, output comparison).
3. no_subtask_implied — no completion criterion implies a hidden subtask that should be its own unit.
4. scope_within_one_component — the work touches one component's files; cross-component coordination is in dependencies, not in this task.

Return JSON:
{
  "audits": [
    {
      "child_id": "<id>",
      "single_executor_session": true|false,
      "completion_criteria_verifiable": true|false,
      "no_subtask_implied": true|false,
      "scope_within_one_component": true|false,
      "findings": ["<short findings, one per failed property>"]
    }
  ]
}

JSON Output Contract: starts with {, ends with }, no markdown fences, no prose, no trailing commas.`;

  const routing = engine.configManager.getLLMRouting().reasoning_review;
  try {
    const result = await engine.llmCaller.call({
      provider: routing.primary.provider,
      model: routing.primary.model,
      baseUrl: routing.primary.base_url,
      prompt,
      responseFormat: 'json',
      temperature: routing.temperature,
      traceContext: {
        workflowRunId: workflowRun.id,
        phaseId: '6',
        subPhaseId: recordSubPhaseId,
        agentRole: 'reasoning_review',
        label: `Phase ${recordSubPhaseId} Step-4c — atomic-shape audit on ${parentDisplayKey}`,
      },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const audits = Array.isArray(parsed?.audits) ? parsed.audits as Array<Record<string, unknown>> : [];
    for (const audit of audits) {
      const childId = typeof audit.child_id === 'string' ? audit.child_id : null;
      if (!childId) continue;
      const findings = Array.isArray(audit.findings) ? audit.findings as unknown[] : [];
      if (findings.length > 0) {
        getLogger().warn('workflow', `Phase ${recordSubPhaseId} Step 4c: atomic-shape findings`, {
          parent: parentDisplayKey, child: childId, findings,
        });
      }
    }
  } catch (err) {
    getLogger().warn('workflow', `Phase ${recordSubPhaseId} Step 4c: audit failed — skipping`, {
      parent: parentDisplayKey, error: err instanceof Error ? err.message : String(err),
    });
  }
  void parentLogicalNodeId;
  void passNumber;
}
