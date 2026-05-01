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

  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as TaskDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) {
      latestByNodeId.set(c.node_id, r);
    }
  }

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

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'task_assumption_set_snapshot',
  );
  let allAssumptions: TaskAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as TaskAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^TA-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'task_decomposition_pipeline', false,
  ).filter(r => {
    const c = r.content as unknown as TaskDecompositionPipelineContent;
    return c.pipeline_id === pipelineId;
  });
  if (pipelineRecords.length === 0) return null;
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest,
  pipelineRecords[0]);
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest,
  pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as TaskDecompositionPipelineContent;

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
    pipelinePasses: latestContent.passes,
    pipelineStartRecord,
    currentPipelineRecordId: latestPipelineRecord.id,
  };
}

// ── Sanitizers ─────────────────────────────────────────────────────

function sanitizeChildTask(
  c: Record<string, unknown>,
  logContext: { rootId: string; childIndex: number },
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
  const rawCriteria = Array.isArray(c.completion_criteria)
    ? c.completion_criteria as Array<Record<string, unknown>> : [];
  const completion_criteria: TaskCompletionCriterion[] = rawCriteria
    .map((r, idx) => {
      const desc = typeof r.description === 'string' ? r.description : '';
      const cid = typeof r.criterion_id === 'string' ? r.criterion_id : `cc-${id}-${String(idx + 1).padStart(3, '0')}`;
      const vm = typeof r.verification_method === 'string' ? r.verification_method : undefined;
      const ar = typeof r.artifact_ref === 'string' ? r.artifact_ref : undefined;
      const validVms = ['schema_check', 'invariant', 'output_comparison', 'test_execution'];
      return {
        criterion_id: cid,
        description: desc,
        verification_method: vm && validVms.includes(vm)
          ? vm as TaskCompletionCriterion['verification_method'] : undefined,
        artifact_ref: ar,
      };
    })
    .filter(r => r.description.length > 0);
  if (completion_criteria.length === 0) {
    getLogger().warn('workflow', 'Phase 6.1a: dropped malformed child (no valid completion criteria)', {
      ...logContext, childId: id, rawCount: rawCriteria.length,
    });
    return null;
  }
  const taskType = c.task_type === 'refactoring' ? 'refactoring' as const : 'standard' as const;
  const backing_tool = typeof c.backing_tool === 'string' ? c.backing_tool : undefined;
  const validComplexity = ['low', 'medium', 'high'];
  const estimated_complexity = typeof c.estimated_complexity === 'string'
    && validComplexity.includes(c.estimated_complexity)
    ? c.estimated_complexity as DecompositionTask['estimated_complexity']
    : undefined;
  const complexity_flag = typeof c.complexity_flag === 'string' ? c.complexity_flag : undefined;
  const stringArr = (key: string): string[] | undefined => {
    const raw = c[key];
    return Array.isArray(raw)
      ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
  };
  return {
    id,
    name,
    description,
    task_type: taskType,
    component_id: componentId,
    component_responsibility: componentResp,
    backing_tool,
    estimated_complexity,
    complexity_flag,
    completion_criteria,
    write_directory_paths: stringArr('write_directory_paths'),
    read_directory_paths: stringArr('read_directory_paths'),
    dependency_task_ids: stringArr('dependency_task_ids'),
    active_constraints: stringArr('active_constraints'),
    traces_to: stringArr('traces_to'),
  };
}

// ── Prompt formatting ──────────────────────────────────────────────

function formatRootTaskForPrompt(t: DecompositionTask): string {
  const ccs = t.completion_criteria.map(r => `  - [${r.criterion_id}] ${r.description}`).join('\n');
  const writes = (t.write_directory_paths ?? []).join(', ') || '(none)';
  const reads = (t.read_directory_paths ?? []).join(', ') || '(none)';
  const deps = (t.dependency_task_ids ?? []).join(', ') || '(none)';
  return [
    `Task id: ${t.id}`,
    `Name: ${t.name}`,
    `Description: ${t.description}`,
    `Component: ${t.component_id}`,
    `Component responsibility: ${t.component_responsibility}`,
    t.backing_tool ? `Backing tool: ${t.backing_tool}` : null,
    t.estimated_complexity ? `Complexity: ${t.estimated_complexity}` : null,
    'Completion criteria:',
    ccs,
    `Write paths: ${writes}`,
    `Read paths: ${reads}`,
    `Dependencies: ${deps}`,
  ].filter(Boolean).join('\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (tcs.length === 0) return '(none captured in Phase 1.0c)';
  return tcs.map(t => {
    const tech = t.technology ? ` [${t.technology}${t.version ? ` ${t.version}` : ''}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

// ── Main loop ──────────────────────────────────────────────────────

export async function runTaskSaturationLoop(
  ctx: PhaseContext,
  input: TaskSaturationInput,
  config: TaskSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;

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

  const constraintsText = formatTechnicalConstraints(input.technicalConstraints);
  void constraintsText;

  const pipelineId = `task-decomp-pipe-${workflowRun.id.slice(0, 8)}`;

  const resumed = rebuildTaskSaturationStateFromStream(ctx, config, pipelineId);

  const allAssumptions: TaskAssumptionEntry[] = resumed?.allAssumptions ?? [];
  let assumptionSeq = resumed?.assumptionSeq ?? 0;
  const newAssumptionId = (): string => `TA-${String(++assumptionSeq).padStart(4, '0')}`;

  const queue: QueueEntry[] = resumed?.queue ?? input.rootTasks.map((t, i) => ({
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

  const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionTask[]>();
  if (!resumed) {
    siblingsByParent.set(null, [...input.rootTasks]);
  }

  const callsByRoot = new Map<string, number>();
  let maxDepthReached = resumed?.maxDepthReached ?? 0;
  let passNumber = resumed?.passNumber ?? 0;

  const divergeGrowthRatio = Number.parseFloat(
    process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2');
  const divergeWarnPasses = Number.parseInt(
    process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10);
  const divergeTerminatePasses = Number.parseInt(
    process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10);
  const dedupOfflineWarnPasses = Number.parseInt(
    process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10);
  let consecutiveGrowthPasses = 0;
  let consecutiveDedupOfflinePasses = 0;
  let dedupOfflineAnnounced = false;
  let divergingEarlyTerminate = false;

  const pipelinePasses: DecompositionPassEntry[] = resumed?.pipelinePasses ?? [];
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
  let currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;

  const embeddingClient: EmbeddingClient = engine.getEmbeddingClientOverride() ?? createEmbeddingClient();
  const embeddingCache = new Map<string, number[]>();
  const dedupThreshold = Number.parseFloat(
    process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
  const dedupEnabled = Number.isFinite(dedupThreshold)
    && dedupThreshold > 0
    && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';

  if (dedupEnabled && allAssumptions.length > 0) {
    try {
      const vecs = await embeddingClient.embed(
        allAssumptions.map(a => a.text),
        { signal: engine.getSessionAbortSignal() },
      );
      allAssumptions.forEach((a, i) => {
        if (vecs[i]) embeddingCache.set(a.id, vecs[i]);
      });
      getLogger().info('workflow', `Phase ${config.recordSubPhaseId}: dedup cache seeded from existing assumptions`, {
        cached: embeddingCache.size, total: allAssumptions.length,
      });
    } catch (err) {
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup seed failed — continuing without dedup`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const parentChain = new Map<string, string | null>();
  {
    const existingNodes = engine.writer.getRecordsByType(
      workflowRun.id, 'task_decomposition_node',
    );
    for (const r of existingNodes) {
      const c = r.content as unknown as TaskDecompositionNodeContent;
      parentChain.set(c.node_id, c.parent_node_id);
    }
  }

  while (queue.length > 0) {
    passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'task_decomposition_node',
    ).length;
    const passEntries = queue.splice(0, queue.length);
    const passAssumptions: TaskAssumptionEntry[] = [];
    const pendingGateByParent = new Map<string, Array<{
      nodeRecordId: string;
      logicalNodeId: string;
      displayKey: string;
      task: DecompositionTask;
      rationale?: string;
    }>>();
    const downgradeNotesByParent = new Map<string, string>();
    const postGateCleanAudits: Array<{
      parentLogicalNodeId: string;
      parentDisplayKey: string;
      parentTask: DecompositionTask;
      children: DecompositionTask[];
    }> = [];

    for (const entry of passEntries) {
      if (entry.depth >= caps.task_depth_cap) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: depth cap reached on branch — freezing as deferred`, {
          nodeId: entry.nodeId, displayKey: entry.displayKey, depth: entry.depth, cap: caps.task_depth_cap,
        });
        writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
        continue;
      }
      const rootCalls = callsByRoot.get(entry.rootTaskId) ?? 0;
      if (rootCalls >= caps.task_budget_cap) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: per-root budget cap reached — deferring`, {
          rootTaskId: entry.rootTaskId, rootCalls, cap: caps.task_budget_cap,
        });
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
          parent_task: formatRootTaskForPrompt(entry.task),
          parent_tier_hint: entry.tierHint,
          sibling_context: siblings.length <= 1
            ? '(none — sole child under this parent)'
            : siblings
                .filter(s => s.id !== entry.task.id)
                .map(s => `- ${s.id}: ${s.name}`).join('\n'),
          component_context: input.componentSummary,
          existing_assumptions: scopedAssumptions.length === 0
            ? '(none yet)'
            : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
          current_depth: String(entry.depth),
          janumicode_version_sha: engine.janumiCodeVersionSha,
        };

        const rendered = engine.templateLoader.render(template, variables);
        if (rendered.missing_variables.length > 0) {
          throw new Error(
            `Phase ${config.recordSubPhaseId}: decomposition template has unfilled variables ` +
            `[${rendered.missing_variables.join(', ')}].`,
          );
        }

        callsByRoot.set(entry.rootTaskId, (callsByRoot.get(entry.rootTaskId) ?? 0) + 1);
        const result = await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: workflowRun.id,
            phaseId: '6',
            subPhaseId: config.recordSubPhaseId,
            agentRole: 'implementation_planner',
            label: `Phase ${config.recordSubPhaseId} Pass-${passNumber} — decomposition of ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
          },
        });

        const parsed = result.parsed as Record<string, unknown> | null;
        const childrenRaw = Array.isArray(parsed?.children)
          ? parsed.children as Array<Record<string, unknown>> : [];
        const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
          ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
        const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;
        if (tierAssessment && tierAssessment.agrees_with_hint === false) {
          getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposer disagrees with tier hint`, {
            nodeId: entry.nodeId, displayKey: entry.displayKey, hint: entry.tierHint,
            assessed: tierAssessment.tier, rationale: tierAssessment.rationale,
          });
        }

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
          const child = sanitizeChildTask(c, { rootId: entry.displayKey, childIndex: fanoutCount });
          if (!child) continue;
          const tier = normalizeTier(c.tier);
          const rationale = typeof c.decomposition_rationale === 'string'
            ? c.decomposition_rationale : undefined;
          const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
          const logicalNodeId = mintLogicalNodeId();
          const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
          siblingDisplayKeys.add(displayKey);

          const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
            ? child.active_constraints
            : entry.activeConstraints;
          const enrichedChild: DecompositionTask = {
            ...child,
            active_constraints: childActiveConstraints,
          };

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
              pass_number: passNumber,
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
          parentChain.set(logicalNodeId, entry.nodeId);

          if (tier === 'A') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootTaskId: entry.rootTaskId, depth: childDepth, task: enrichedChild,
              displayKey, tierHint: 'A',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          } else if (tier === 'B') {
            const batch = pendingGateByParent.get(entry.nodeId) ?? [];
            batch.push({ nodeRecordId: childRec.id, logicalNodeId, displayKey, task: enrichedChild, rationale });
            pendingGateByParent.set(entry.nodeId, batch);
          } else if (tier === 'C') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootTaskId: entry.rootTaskId, depth: childDepth, task: enrichedChild,
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
            getLogger().warn('workflow', `Phase ${config.recordSubPhaseId} Step 4b: downgrading previously-accepted Tier-B parent`, {
              nodeId: entry.nodeId, displayKey: entry.displayKey, reason,
              producedTierB: pendingGateByParent.get(entry.nodeId)?.length ?? 0,
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
                pass_number: passNumber,
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
              downgradeNotesByParent.set(
                entry.nodeId,
                `The task '${entry.displayKey}' you accepted earlier turned out to ` +
                `have its own commitment layer underneath. The tasks below are ` +
                `sub-commitments within '${entry.displayKey}' that need your review as well.`,
              );
            }
          } else if (emittedChildrenWithTier.length > 0) {
            postGateCleanAudits.push({
              parentLogicalNodeId: entry.nodeId,
              parentDisplayKey: entry.displayKey,
              parentTask: entry.task,
              children: emittedChildrenWithTier.map(x => x.task),
            });
          }
        }

        // Status transition for successful decomposition. See Wave 6
        // labelling-correctness fix: parents that produced children
        // need a `decomposed` supersession or they stay forever
        // labelled `pending`.
        if (emittedChildren.length > 0 && !parentDowngraded) {
          // Preserve creation provenance — see phase2.ts pending→decomposed
          // transition for rationale.
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
              pass_number: passNumber,
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
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking node deferred`, {
          nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
        });
        writeDeferredSupersession(ctx, entry, passNumber, `decomposition_failed: ${reason}`, config);
      }
    }

    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'task_decomposition_node',
    ).length - nodesProducedAtPassStart;
    pipelinePasses.push({
      pass_number: passNumber,
      status: 'completed',
      started_at: passStartedAt,
      completed_at: new Date().toISOString(),
      nodes_produced: nodesProducedThisPass,
      assumption_delta: passAssumptions.length,
    });
    const passUpdateRecord = engine.writer.writeRecord({
      record_type: 'task_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [pipelineStartRecord.id],
      content: {
        kind: 'task_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_task_id: '*',
        passes: [...pipelinePasses],
      } satisfies TaskDecompositionPipelineContent,
    });
    engine.writer.supersedByRollback(currentPipelineRecordId, passUpdateRecord.id);
    currentPipelineRecordId = passUpdateRecord.id;

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
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup embed failed this pass — flags skipped`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const semanticDelta = passAssumptions.filter(a => !a.duplicate_of).length;

    allAssumptions.push(...passAssumptions);
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
        pass_number: passNumber,
        root_task_id: '*',
        assumptions: [...allAssumptions],
        delta_from_previous_pass: passAssumptions.length,
        semantic_delta: semanticDelta,
      } satisfies TaskAssumptionSetSnapshotContent,
    });

    if (caps.task_reasoning_review_on_tier_c && postGateCleanAudits.length > 0) {
      for (const audit of postGateCleanAudits) {
        await runAtomicShapeAudit(
          ctx,
          audit.parentLogicalNodeId,
          audit.parentDisplayKey,
          audit.parentTask,
          audit.children,
          passNumber,
          config.recordSubPhaseId,
        );
      }
    }

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

    if (dedupFailedThisPass) {
      consecutiveDedupOfflinePasses++;
      if (consecutiveDedupOfflinePasses >= dedupOfflineWarnPasses && !dedupOfflineAnnounced) {
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: assumption dedup has been offline for ${consecutiveDedupOfflinePasses} consecutive passes`,
          { consecutiveDedupOfflinePasses, passNumber });
        dedupOfflineAnnounced = true;
      }
    } else {
      if (dedupOfflineAnnounced) {
        dedupOfflineAnnounced = false;
      }
      consecutiveDedupOfflinePasses = 0;
    }

    const priorPass = pipelinePasses.length >= 2
      ? pipelinePasses[pipelinePasses.length - 2]
      : null;
    const growthObserved = priorPass
      && priorPass.nodes_produced > 0
      && nodesProducedThisPass > priorPass.nodes_produced * divergeGrowthRatio;
    if (growthObserved) {
      consecutiveGrowthPasses++;
      if (consecutiveGrowthPasses >= divergeWarnPasses) {
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging`,
          { passNumber, consecutiveGrowthPasses });
      }
      if (consecutiveGrowthPasses >= divergeTerminatePasses) {
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: EARLY TERMINATE — diverging loop`,
          { passNumber, remainingQueueSize: queue.length });
        for (const remaining of queue) {
          writeDeferredSupersession(ctx, remaining, passNumber, 'diverging', config);
        }
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
  else if (maxRootCalls >= caps.task_budget_cap) terminationReason = 'budget_cap';
  else if (maxDepthReached >= caps.task_depth_cap) terminationReason = 'depth_cap';
  else if (dedupOfflineAnnounced) terminationReason = 'dedup_offline';
  else terminationReason = 'fixed_point';

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node');
  const tierDistribution: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 };
  let atomicLeafCount = 0;
  for (const n of finalNodes) {
    const c = n.content as unknown as TaskDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }

  const pipelineFinalRecord = engine.writer.writeRecord({
    record_type: 'task_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [pipelineStartRecord.id],
    content: {
      kind: 'task_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_task_id: '*',
      passes: pipelinePasses.map((p, i) =>
        i === pipelinePasses.length - 1
          ? { ...p, termination_reason: terminationReason }
          : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies TaskDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(currentPipelineRecordId, pipelineFinalRecord.id);

  try {
    const db = engine.db;
    db.prepare(`
      UPDATE workflow_runs
      SET task_decomposition_budget_calls_used = ?,
          task_decomposition_max_depth_reached = MAX(task_decomposition_max_depth_reached, ?),
          active_task_pipeline_id = ?
      WHERE id = ?
    `).run(totalLlmCalls, maxDepthReached, pipelineId, workflowRun.id);
  } catch (err) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: telemetry write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
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

  const childrenText = children.map(c =>
    `${c.id} (${c.name}):\n${c.completion_criteria.map(r => `  • ${r.description}`).join('\n')}`,
  ).join('\n\n');

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
