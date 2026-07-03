/**
 * Wave 7 — Phase 4.2a Recursive Component Decomposition.
 *
 * Saturation-loop recursive decomposer for components, mirroring the
 * Wave 6 FR/NFR machinery in phase2.ts. Tier rubric is component-scaled:
 *   A — Macro Subsystem (recurse without gating)
 *   B — Bounded Domain (mirror-gated then recurse)
 *   C — Module (one more pass)
 *   D — Atomic Component (terminal)
 *
 * Termination — assumption-saturation fixed-point (semantic_delta=0 AND
 * queue empty) is the desired exit. Safety rails (depth_cap=6,
 * budget_cap=200, fanout_cap=12, divergence detection, dedup-offline
 * tracking) trigger explicit `status='deferred'` supersessions when
 * they trip — never silent gaps.
 *
 * Invocation — Phase 4 calls runComponentSaturationLoop AFTER 4.2 has
 * emitted the depth-0 ComponentModel. The loop expects depth-0
 * `component_decomposition_node` rows already written by Phase 4 (one
 * per root component). It seeds its queue from those rows and
 * recursively expands in place.
 *
 * Shape mirrors Wave 6 deliberately — webview cards, gold extractors,
 * resume helpers, and reasoning_review hooks all benefit from
 * structural symmetry between FR / NFR / component trees. See
 * docs/wave7_phase4_recursive_decomposition.md for the design.
 */

import { randomUUID } from 'node:crypto';
import { displayComponentDependency } from './summaryFormat';
import type { PhaseContext } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  ComponentDecompositionNodeContent,
  ComponentDecompositionPipelineContent,
  ComponentAssumptionSetSnapshotContent,
  ComponentAssumptionEntry,
  DecompositionComponent,
  ComponentResponsibility,
  ComponentDependency,
  DecompositionTier,
  DecompositionNodeStatus,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  ProductDescriptionHandoffContent,
  TechnicalConstraint,
} from '../../types/records';
import type { MirrorItemDecision } from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { emit as aoddEmit } from '../../aodd';

// ── Shared decomposition helpers ───────────────────────────────────

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

export interface ComponentSaturationConfig {
  /** Sub-phase id stamped on every record (always 'component_saturation' for Wave 7). */
  recordSubPhaseId: 'component_saturation';
  /** Template subdir (inside prompts/phases/phase_04_architecture). */
  templateSubPhase: string;
  /** Mirror-gate surface id prefix (e.g. 'comp-decomp-gate-'). */
  gateSurfacePrefix: string;
}

const DEFAULT_CONFIG: ComponentSaturationConfig = {
  recordSubPhaseId: 'component_saturation',
  templateSubPhase: 'component_saturation',
  gateSurfacePrefix: 'comp-decomp-gate-',
};

// ── Inputs ─────────────────────────────────────────────────────────

export interface ComponentSaturationInput {
  /** Product handoff for prompt context (carries vision + scope). */
  handoff: ProductDescriptionHandoffContent;
  /** Phase 1.0c technical constraints — anchor leaf-component tech choices. */
  technicalConstraints: TechnicalConstraint[];
  /**
   * Domain summary text for prompt context — Phase 4.1 software_domains
   * formatted as a brief natural-language paragraph.
   */
  domainsSummary: string;
  /** Root components written by Phase 4.2 (one DecompositionComponent per root). */
  rootComponents: DecompositionComponent[];
  /** Governed-stream record IDs for the depth-0 root nodes. Pairs 1:1 with rootComponents. */
  rootNodeRecordIds: string[];
  /** Logical node IDs for the depth-0 root nodes. Pairs 1:1 with rootComponents. */
  rootLogicalIds: string[];
}

// ── Internal queue entry ───────────────────────────────────────────

interface QueueEntry {
  parentRecordId: string;          // governed_stream row UUID of the parent record revision
  nodeId: string;                  // logical UUID (content.node_id) — stable across revisions
  parentNodeId: string | null;     // parent's logical UUID
  rootComponentId: string;         // root's logical UUID
  depth: number;
  component: DecompositionComponent;
  displayKey: string;
  tierHint: DecompositionTier | 'root';
  releaseId: string | null;
  releaseOrdinal: number | null;
  /** Active-constraints inherited from parent (TECH-* ids); narrowed for children. */
  activeConstraints: string[];
}

// ── Resume state ───────────────────────────────────────────────────

interface ResumeState {
  queue: QueueEntry[];
  allAssumptions: ComponentAssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionComponent[]>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

/**
 * Reconstruct in-memory loop state from prior governed_stream records.
 * Returns null when no prior component decomposition state exists for
 * this run (fresh start). Mirrors phase2's rebuildSaturationStateFromStream.
 */
export function rebuildComponentSaturationStateFromStream(
  ctx: PhaseContext,
  config: ComponentSaturationConfig,
  pipelineId: string,
): ResumeState | null {
  const { engine, workflowRun } = ctx;
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'component_decomposition_node', false,
  );
  if (allNodes.length === 0) return null;

  // Latest record per node_id.
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as ComponentDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) {
      latestByNodeId.set(c.node_id, r);
    }
  }

  // Parent → children map for sibling reconstruction.
  const childrenByParent = new Map<string, Set<string>>();
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as ComponentDecompositionNodeContent;
    if (c.parent_node_id) {
      const set = childrenByParent.get(c.parent_node_id) ?? new Set<string>();
      set.add(c.node_id);
      childrenByParent.set(c.parent_node_id, set);
    }
  }

  // Pending nodes (status='pending') become the resume queue. Atomic /
  // pruned / deferred / downgraded nodes are terminal — not re-queued.
  const queue: QueueEntry[] = [];
  const siblingsByParent = new Map<string | null, DecompositionComponent[]>();
  let maxDepthReached = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as ComponentDecompositionNodeContent;
    if (c.depth > maxDepthReached) maxDepthReached = c.depth;
    const siblingsKey = c.parent_node_id;
    const sibArr = siblingsByParent.get(siblingsKey) ?? [];
    sibArr.push(c.component);
    siblingsByParent.set(siblingsKey, sibArr);

    if (c.status === 'pending') {
      const tierHint: DecompositionTier | 'root' = c.depth === 0
        ? 'root'
        : (c.tier ?? 'A');
      queue.push({
        parentRecordId: r.id,
        nodeId: c.node_id,
        parentNodeId: c.parent_node_id,
        rootComponentId: c.root_component_id,
        depth: c.depth,
        component: c.component,
        displayKey: c.display_key,
        tierHint,
        releaseId: c.release_id,
        releaseOrdinal: c.release_ordinal,
        activeConstraints: c.component.active_constraints ?? [],
      });
    }
  }

  // Reconstruct the assumption set from prior snapshots (latest snapshot
  // by pass_number wins — assumption rows accumulate forward, so the
  // latest snapshot has the cumulative state).
  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'component_assumption_set_snapshot',
  );
  let allAssumptions: ComponentAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as ComponentAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  // Highest A-#### sequence id in the assumption set drives the next mint.
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^CA-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }

  // Pipeline record chain — find the latest pipeline record (passes
  // appended over time). Falls back to the start record when only the
  // initial empty container exists.
  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'component_decomposition_pipeline', false,
  ).filter(r => {
    const c = r.content as unknown as ComponentDecompositionPipelineContent;
    return c.pipeline_id === pipelineId;
  });
  if (pipelineRecords.length === 0) return null;
  // Earliest = start record (kept for derived_from chain).
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest,
  pipelineRecords[0]);
  // Latest = current pipeline record (carries the accumulated pipelinePasses).
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest,
  pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as ComponentDecompositionPipelineContent;

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

function sanitizeChildComponent(
  c: Record<string, unknown>,
  logContext: { rootId: string; childIndex: number },
): DecompositionComponent | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : null;
  if (!id || !name) {
    getLogger().warn('workflow', 'Phase 4.2a: dropped malformed child (missing id or name)', {
      ...logContext,
      missing: { id: !id, name: !name },
    });
    return null;
  }
  const rawResp = Array.isArray(c.responsibilities) ? c.responsibilities as Array<Record<string, unknown>> : [];
  const responsibilities: ComponentResponsibility[] = rawResp
    .map((r, idx) => ({
      id: typeof r.id === 'string' ? r.id : `resp-${id}-${String(idx + 1).padStart(3, '0')}`,
      description: typeof r.description === 'string' ? r.description : '',
    }))
    .filter(r => r.description.length > 0);
  if (responsibilities.length === 0) {
    getLogger().warn('workflow', 'Phase 4.2a: dropped malformed child (no valid responsibilities)', {
      ...logContext, childId: id, rawCount: rawResp.length,
    });
    return null;
  }
  const rawDeps = Array.isArray(c.dependencies) ? c.dependencies as Array<Record<string, unknown>> : [];
  const dependencies: ComponentDependency[] = rawDeps
    .map(d => ({
      component_id: typeof d.component_id === 'string' ? d.component_id : '',
      kind: ((['sync_call', 'async_event', 'data_read', 'data_write'] as const) as readonly string[])
        .includes(d.kind as string)
        ? (d.kind as ComponentDependency['kind'])
        : 'sync_call' as const,
    }))
    .filter(d => d.component_id.length > 0);
  const domain_id = typeof c.domain_id === 'string' ? c.domain_id : null;
  const active_constraints = Array.isArray(c.active_constraints)
    ? (c.active_constraints as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined;
  const traces_to = Array.isArray(c.traces_to)
    ? (c.traces_to as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined;
  return { id, name, responsibilities, dependencies, domain_id, active_constraints, traces_to };
}

// ── Prompt formatting ──────────────────────────────────────────────

function formatRootComponentForPrompt(c: DecompositionComponent): string {
  const resps = c.responsibilities.map(r => `  - [${r.id}] ${r.description}`).join('\n');
  const deps = c.dependencies.length === 0
    ? '(none)'
    : c.dependencies.map(d => `  - ${displayComponentDependency(d)}`).join('\n');
  return [
    `Component id: ${c.id}`,
    `Name: ${c.name}`,
    c.domain_id ? `Domain: ${c.domain_id}` : null,
    'Responsibilities:',
    resps,
    'Dependencies:',
    deps,
  ].filter(Boolean).join('\n');
}

function formatHandoffForComponentDecomposition(h: ProductDescriptionHandoffContent): string {
  // Lightweight summary — vision + product description + summary text.
  // The detail file (when present) carries the full handoff if needed.
  return [
    `Vision: ${h.productVision ?? '(none)'}`,
    `Description: ${(h.productDescription ?? '').slice(0, 800)}`,
    `Summary: ${(h.summary ?? '').slice(0, 800)}`,
  ].join('\n\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (tcs.length === 0) return '(none captured in Phase 1.0c)';
  return tcs.map(t => {
    const tech = t.technology ? ` [${t.technology}${t.version ? ` ${t.version}` : ''}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

// ── Main loop ──────────────────────────────────────────────────────

/**
 * Run Phase 4.2a recursive component decomposition.
 *
 * Pre-conditions (caller must satisfy):
 *   - Phase 4.2 has emitted depth-0 component_decomposition_node records
 *     for each root component, with status='pending'.
 *   - input.rootNodeRecordIds[] and input.rootLogicalIds[] pair 1:1
 *     with input.rootComponents[].
 *
 * Post-conditions:
 *   - Every reachable subtree node has been written with status in
 *     {atomic, pruned, deferred, downgraded}; no pending nodes remain.
 *   - One component_decomposition_pipeline record per workflow_run
 *     carries the final passes[], leaf count, max depth, total LLM calls.
 *   - Per-pass component_assumption_set_snapshot records for audit /
 *     resume.
 *   - workflow_runs.component_decomposition_* telemetry columns updated.
 */
export async function runComponentSaturationLoop(
  ctx: PhaseContext,
  input: ComponentSaturationInput,
  config: ComponentSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;

  const template = engine.templateLoader.findTemplate(
    'domain_interpreter',
    config.templateSubPhase,
    'product',
  );
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: decomposition product-lens template missing — ` +
      `expected agent_role=domain_interpreter sub_phase=${config.templateSubPhase} lens=product. ` +
      `This is a configuration error; Wave 7 cannot proceed without the template.`,
    );
  }

  const handoffSummary = formatHandoffForComponentDecomposition(input.handoff);
  const constraintsText = formatTechnicalConstraints(input.technicalConstraints);

  const pipelineId = `comp-decomp-pipe-${workflowRun.id.slice(0, 8)}`;

  // Resume detection.
  const resumed = rebuildComponentSaturationStateFromStream(ctx, config, pipelineId);

  const allAssumptions: ComponentAssumptionEntry[] = resumed?.allAssumptions ?? [];
  let assumptionSeq = resumed?.assumptionSeq ?? 0;
  const newAssumptionId = (): string => `CA-${String(++assumptionSeq).padStart(4, '0')}`;

  // Seed queue: fresh from input.rootComponents pairs, OR resumed state.
  const queue: QueueEntry[] = resumed?.queue ?? input.rootComponents.map((c, i) => ({
    parentRecordId: input.rootNodeRecordIds[i],
    nodeId: input.rootLogicalIds[i],
    parentNodeId: null,
    rootComponentId: input.rootLogicalIds[i],
    depth: 0,
    component: c,
    displayKey: c.id,
    tierHint: 'root' as const,
    releaseId: null,
    releaseOrdinal: null,
    activeConstraints: c.active_constraints ?? [],
  }));

  const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionComponent[]>();
  if (!resumed) {
    siblingsByParent.set(null, [...input.rootComponents]);
  }

  const callsByRoot = new Map<string, number>();
  let maxDepthReached = resumed?.maxDepthReached ?? 0;
  let passNumber = resumed?.passNumber ?? 0;

  // Divergence + dedup-offline tracking (mirrors phase2 patterns).
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
    record_type: 'component_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '4',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: input.rootNodeRecordIds,
    content: {
      kind: 'component_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_component_id: '*',
      passes: [],
    } satisfies ComponentDecompositionPipelineContent,
  });
  let currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;

  // Embedding dedup setup (mirrors phase2 — graceful degradation).
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

  // Build parent-chain map for scoped-assumption injection.
  const parentChain = new Map<string, string | null>();
  {
    const existingNodes = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    for (const r of existingNodes) {
      const c = r.content as unknown as ComponentDecompositionNodeContent;
      parentChain.set(c.node_id, c.parent_node_id);
    }
  }

  // Per-root LLM-call budget keyed by root logical id.
  while (queue.length > 0) {
    passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    ).length;
    const passEntries = queue.splice(0, queue.length);
    const passAssumptions: ComponentAssumptionEntry[] = [];
    const pendingGateByParent = new Map<string, Array<{
      nodeRecordId: string;
      logicalNodeId: string;
      displayKey: string;
      component: DecompositionComponent;
      rationale?: string;
    }>>();
    const downgradeNotesByParent = new Map<string, string>();
    const postGateCleanAudits: Array<{
      parentLogicalNodeId: string;
      parentDisplayKey: string;
      parentComponent: DecompositionComponent;
      children: DecompositionComponent[];
    }> = [];

    for (const entry of passEntries) {
      // Depth cap.
      if (entry.depth >= caps.component_depth_cap) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: depth cap reached on branch — freezing as deferred`, {
          nodeId: entry.nodeId, displayKey: entry.displayKey, depth: entry.depth, cap: caps.component_depth_cap,
        });
        writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
        continue;
      }
      // Per-root budget cap.
      const rootCalls = callsByRoot.get(entry.rootComponentId) ?? 0;
      if (rootCalls >= caps.component_budget_cap) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: per-root budget cap reached — deferring`, {
          rootComponentId: entry.rootComponentId, rootCalls, cap: caps.component_budget_cap,
        });
        writeDeferredSupersession(ctx, entry, passNumber, 'budget_cap_reached', config);
        continue;
      }

      try {
        const siblings = siblingsByParent.get(entry.parentNodeId) ?? [];
        // Scoped-assumption injection — restrict to ancestor-chain assumptions.
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

        // Active-constraints narrowing — entry's inherited list, formatted for prompt.
        const inherited = entry.activeConstraints.length > 0
          ? input.technicalConstraints.filter(t => entry.activeConstraints.includes(t.id))
          : input.technicalConstraints;
        const activeConstraintsForPrompt = formatTechnicalConstraints(inherited);

        const variables: Record<string, string> = {
          active_constraints: activeConstraintsForPrompt,
          parent_component: formatRootComponentForPrompt(entry.component),
          parent_tier_hint: entry.tierHint,
          sibling_context: siblings.length <= 1
            ? '(none — sole child under this parent)'
            : siblings
                .filter(s => s.id !== entry.component.id)
                .map(s => `- ${s.id}: ${s.name}`).join('\n'),
          domain_context: input.domainsSummary,
          existing_assumptions: scopedAssumptions.length === 0
            ? '(none yet)'
            : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
          current_depth: String(entry.depth),
          janumicode_version_sha: engine.janumiCodeVersionSha,
        };
        // Provide the handoff to the prompt's outer scope (for vision context).
        // Not a template variable today (the prompt template doesn't expose
        // it as a slot — domain_context covers this), but kept here so the
        // prompt rendering doesn't drop it silently if the template adds it.
        void handoffSummary;
        void constraintsText;

        const rendered = engine.templateLoader.render(template, variables);
        if (rendered.missing_variables.length > 0) {
          throw new Error(
            `Phase ${config.recordSubPhaseId}: decomposition template has unfilled variables ` +
            `[${rendered.missing_variables.join(', ')}].`,
          );
        }

        callsByRoot.set(entry.rootComponentId, (callsByRoot.get(entry.rootComponentId) ?? 0) + 1);
        const result = await engine.callForRole('domain_interpreter', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.5,
          traceContext: {
            workflowRunId: workflowRun.id,
            phaseId: '4',
            subPhaseId: config.recordSubPhaseId,
            agentRole: 'domain_interpreter',
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

        // Collect surfaced assumptions for this pass.
        const childAssumptionIds: string[] = [];
        for (const a of surfacedRaw) {
          const text = typeof a.text === 'string' ? a.text : null;
          if (!text) continue;
          const cat = typeof a.category === 'string' ? a.category : 'open_question';
          const validCats: ComponentAssumptionEntry['category'][] = [
            'boundary', 'cross_cutting', 'integration_pattern',
            'data_ownership', 'scaling_assumption', 'tech_choice', 'open_question',
          ];
          const category = (validCats as string[]).includes(cat)
            ? cat as ComponentAssumptionEntry['category']
            : 'open_question';
          const citations = Array.isArray(a.citations)
            ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string')
            : undefined;
          const assumption: ComponentAssumptionEntry = {
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

        // Write children. Route by tier.
        const childDepth = entry.depth + 1;
        maxDepthReached = Math.max(maxDepthReached, childDepth);
        const emittedChildren: DecompositionComponent[] = [];
        const emittedChildrenWithTier: Array<{ component: DecompositionComponent; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
        const siblingDisplayKeys = new Set<string>();
        let fanoutCount = 0;
        for (const c of childrenRaw) {
          if (++fanoutCount > caps.component_fanout_cap) {
            getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: fanout cap reached — dropping remaining children`, {
              parentNodeId: entry.nodeId, parentDisplayKey: entry.displayKey,
              cap: caps.component_fanout_cap, totalOffered: childrenRaw.length,
            });
            break;
          }
          const child = sanitizeChildComponent(c, { rootId: entry.displayKey, childIndex: fanoutCount });
          if (!child) continue;
          const tier = normalizeTier(c.tier);
          const rationale = typeof c.decomposition_rationale === 'string'
            ? c.decomposition_rationale : undefined;
          const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
          const logicalNodeId = mintLogicalNodeId();
          const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
          siblingDisplayKeys.add(displayKey);

          // Inherit / narrow active constraints.
          const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
            ? child.active_constraints
            : entry.activeConstraints;

          const enrichedChild: DecompositionComponent = {
            ...child,
            active_constraints: childActiveConstraints,
          };

          const childRec = engine.writer.writeRecord({
            record_type: 'component_decomposition_node',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '4',
            sub_phase_id: config.recordSubPhaseId,
            produced_by_agent_role: 'domain_interpreter',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            derived_from_record_ids: [entry.parentRecordId],
            content: {
              kind: 'component_decomposition_node',
              node_id: logicalNodeId,
              parent_node_id: entry.nodeId,
              display_key: displayKey,
              root_component_id: entry.rootComponentId,
              depth: childDepth,
              pass_number: passNumber,
              status: initialStatus,
              tier,
              component: enrichedChild,
              decomposition_rationale: rationale,
              surfaced_assumption_ids: childAssumptionIds,
              release_id: entry.releaseId,
              release_ordinal: entry.releaseOrdinal,
            } satisfies ComponentDecompositionNodeContent,
          });
          emittedChildren.push(enrichedChild);
          emittedChildrenWithTier.push({ component: enrichedChild, tier, logicalNodeId, displayKey });
          parentChain.set(logicalNodeId, entry.nodeId);

          if (tier === 'A') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootComponentId: entry.rootComponentId, depth: childDepth, component: enrichedChild,
              displayKey, tierHint: 'A',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          } else if (tier === 'B') {
            const batch = pendingGateByParent.get(entry.nodeId) ?? [];
            batch.push({ nodeRecordId: childRec.id, logicalNodeId, displayKey, component: enrichedChild, rationale });
            pendingGateByParent.set(entry.nodeId, batch);
          } else if (tier === 'C') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootComponentId: entry.rootComponentId, depth: childDepth, component: enrichedChild,
              displayKey, tierHint: 'C',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          }
          // Tier D: frozen atomic, no queue insertion.
        }
        if (emittedChildren.length > 0) {
          siblingsByParent.set(entry.nodeId, emittedChildren);
        }

        // Step 4b — mislabel detection on previously-accepted Tier-B parents.
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
              record_type: 'component_decomposition_node',
              schema_version: '1.0',
              workflow_run_id: workflowRun.id,
              phase_id: '4',
              sub_phase_id: config.recordSubPhaseId,
              produced_by_agent_role: 'orchestrator',
              janumicode_version_sha: engine.janumiCodeVersionSha,
              derived_from_record_ids: [entry.parentRecordId],
              content: {
                kind: 'component_decomposition_node',
                node_id: entry.nodeId,
                parent_node_id: entry.parentNodeId,
                display_key: entry.displayKey,
                root_component_id: entry.rootComponentId,
                depth: entry.depth,
                pass_number: passNumber,
                status: 'downgraded',
                component: entry.component,
                surfaced_assumption_ids: [],
                pruning_reason: reason,
                release_id: entry.releaseId,
                release_ordinal: entry.releaseOrdinal,
              } satisfies ComponentDecompositionNodeContent,
            });
            engine.writer.supersedeComponentDecompositionNodeByLogicalId(
              workflowRun.id, entry.nodeId, downgradedRec.id,
            );
            if (producedTierBChildren) {
              downgradeNotesByParent.set(
                entry.nodeId,
                `The component '${entry.displayKey}' you accepted earlier turned out to ` +
                `have its own commitment layer underneath. The components below are ` +
                `sub-commitments within '${entry.displayKey}' that need your review as well.`,
              );
            }
          } else if (emittedChildrenWithTier.length > 0) {
            // Step 4c — clean post-gate decomposition. Queue for audit.
            postGateCleanAudits.push({
              parentLogicalNodeId: entry.nodeId,
              parentDisplayKey: entry.displayKey,
              parentComponent: entry.component,
              children: emittedChildrenWithTier.map(x => x.component),
            });
          }
        }

        // Status transition — when this parent successfully produced
        // children AND was NOT downgraded by Step 4b, supersede its
        // prior `pending` row with `status='decomposed'`. Without this,
        // the parent stays at `pending` indefinitely even though its
        // work is done; the governed_stream then misreports lifecycle
        // to anyone reading it (humans, gold extractors, downstream
        // tooling). Frozen-leaf projection already ignores non-atomic
        // nodes so this is purely a labelling correctness fix.
        if (emittedChildren.length > 0 && !parentDowngraded) {
          // Preserve creation provenance — see phase2.ts pending→decomposed
          // transition for rationale.
          const originalRec = engine.writer.getRecord(entry.parentRecordId);
          const originalSubPhase = originalRec?.sub_phase_id ?? config.recordSubPhaseId;
          const decomposedRec = engine.writer.writeRecord({
            record_type: 'component_decomposition_node',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '4',
            sub_phase_id: originalSubPhase,
            produced_by_agent_role: 'orchestrator',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            derived_from_record_ids: [entry.parentRecordId],
            content: {
              kind: 'component_decomposition_node',
              node_id: entry.nodeId,
              parent_node_id: entry.parentNodeId,
              display_key: entry.displayKey,
              root_component_id: entry.rootComponentId,
              depth: entry.depth,
              pass_number: passNumber,
              status: 'decomposed',
              tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
              component: entry.component,
              surfaced_assumption_ids: [],
              release_id: entry.releaseId,
              release_ordinal: entry.releaseOrdinal,
            } satisfies ComponentDecompositionNodeContent,
          });
          engine.writer.supersedeComponentDecompositionNodeByLogicalId(
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

    // Append pass to pipeline container.
    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
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
      record_type: 'component_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [pipelineStartRecord.id],
      content: {
        kind: 'component_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_component_id: '*',
        passes: [...pipelinePasses],
      } satisfies ComponentDecompositionPipelineContent,
    });
    engine.writer.supersedByRollback(currentPipelineRecordId, passUpdateRecord.id);
    currentPipelineRecordId = passUpdateRecord.id;

    // Dedup pass.
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
            getLogger().info('workflow', `Phase ${config.recordSubPhaseId}: assumption flagged as duplicate`, {
              id: a.id, of: match.id, similarity: Number(match.similarity.toFixed(3)),
            });
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

    // Per-pass assumption snapshot.
    allAssumptions.push(...passAssumptions);
    engine.writer.writeRecord({
      record_type: 'component_assumption_set_snapshot',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'component_assumption_set_snapshot',
        pass_number: passNumber,
        root_component_id: '*',
        assumptions: [...allAssumptions],
        delta_from_previous_pass: passAssumptions.length,
        semantic_delta: semanticDelta,
      } satisfies ComponentAssumptionSetSnapshotContent,
    });

    // Step 4c — responsibility-shape audit on clean post-gate decompositions.
    if (caps.component_reasoning_review_on_tier_c && postGateCleanAudits.length > 0) {
      for (const audit of postGateCleanAudits) {
        await runResponsibilityShapeAudit(
          ctx,
          audit.parentLogicalNodeId,
          audit.parentDisplayKey,
          audit.parentComponent,
          audit.children,
          passNumber,
          config.recordSubPhaseId,
        );
      }
    }

    // Mirror gates for Tier-B batches.
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
              rootComponentId: child.rootComponentId,
              depth: child.depth,
              component: child.component,
              displayKey: child.displayKey,
              tierHint: 'B',
              releaseId: child.releaseId,
              releaseOrdinal: child.releaseOrdinal,
              activeConstraints: child.component.active_constraints ?? [],
            });
          }
        }
      }
    }

    // Dedup-offline detection.
    if (dedupFailedThisPass) {
      consecutiveDedupOfflinePasses++;
      if (consecutiveDedupOfflinePasses >= dedupOfflineWarnPasses && !dedupOfflineAnnounced) {
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: assumption dedup has been offline for ${consecutiveDedupOfflinePasses} consecutive passes — semantic_delta equals raw delta; saturation termination is likely unreachable. Check JANUMICODE_EMBEDDING_URL reachability + timeouts.`,
          { consecutiveDedupOfflinePasses, passNumber });
        dedupOfflineAnnounced = true;
      }
    } else {
      if (dedupOfflineAnnounced) {
        getLogger().info('workflow',
          `Phase ${config.recordSubPhaseId}: assumption dedup is back online after ${consecutiveDedupOfflinePasses} offline passes`,
          { passNumber });
        dedupOfflineAnnounced = false;
      }
      consecutiveDedupOfflinePasses = 0;
    }

    // Divergence detection.
    const priorPass = pipelinePasses.length >= 2
      ? pipelinePasses[pipelinePasses.length - 2]
      : null;
    const growthObserved = priorPass
      && priorPass.nodes_produced > 0
      && nodesProducedThisPass > priorPass.nodes_produced * divergeGrowthRatio;
    if (growthObserved) {
      consecutiveGrowthPasses++;
      if (consecutiveGrowthPasses >= divergeWarnPasses) {
        const ratios = pipelinePasses.slice(-divergeWarnPasses - 1)
          .map((p, i, arr) => i === 0 ? null : (p.nodes_produced / (arr[i - 1].nodes_produced || 1)))
          .slice(1).map(r => r?.toFixed(2));
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging — ${consecutiveGrowthPasses} consecutive passes with > ${divergeGrowthRatio}× node growth`,
          {
            passNumber, consecutiveGrowthPasses,
            recent_ratios: ratios,
            recent_nodes_produced: pipelinePasses.slice(-5).map(p => p.nodes_produced),
            dedupOffline: consecutiveDedupOfflinePasses > 0,
          });
      }
      if (consecutiveGrowthPasses >= divergeTerminatePasses) {
        getLogger().warn('workflow',
          `Phase ${config.recordSubPhaseId}: EARLY TERMINATE — diverging loop after ${consecutiveGrowthPasses} consecutive growth passes. Marking remaining queue as deferred with reason='diverging'.`,
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

  // Finalize pipeline container.
  const totalLlmCalls = [...callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = callsByRoot.size > 0 ? Math.max(...callsByRoot.values()) : 0;
  let terminationReason: DecompositionTerminationReason;
  if (divergingEarlyTerminate) terminationReason = 'diverging';
  else if (maxRootCalls >= caps.component_budget_cap) terminationReason = 'budget_cap';
  else if (maxDepthReached >= caps.component_depth_cap) terminationReason = 'depth_cap';
  else if (dedupOfflineAnnounced) terminationReason = 'dedup_offline';
  else terminationReason = 'fixed_point';

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'component_decomposition_node');
  const tierDistribution: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 };
  let atomicLeafCount = 0;
  for (const n of finalNodes) {
    const c = n.content as unknown as ComponentDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }

  const pipelineFinalRecord = engine.writer.writeRecord({
    record_type: 'component_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '4',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [pipelineStartRecord.id],
    content: {
      kind: 'component_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_component_id: '*',
      passes: pipelinePasses.map((p, i) =>
        i === pipelinePasses.length - 1
          ? { ...p, termination_reason: terminationReason }
          : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies ComponentDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(currentPipelineRecordId, pipelineFinalRecord.id);

  // (Saturation-terminator counts used to fire as a Tier-2 lifecycle
  // event for one-line `grep` visibility on scope creep. With the
  // legacy lifecycle stream retired, the pipeline_final record holds
  // the same counts in its content; the per-sub-phase summary rolls
  // them up via the record.* events for the pipeline + per-node writes.)

  // Persist budget telemetry to workflow_runs columns.
  try {
    const db = engine.db;
    db.prepare(`
      UPDATE workflow_runs
      SET component_decomposition_budget_calls_used = ?,
          component_decomposition_max_depth_reached = MAX(component_decomposition_max_depth_reached, ?),
          active_component_pipeline_id = ?
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
  config: ComponentSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const deferredRec = engine.writer.writeRecord({
    record_type: 'component_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '4',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'component_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_component_id: entry.rootComponentId,
      depth: entry.depth,
      pass_number: passNumber,
      status: 'deferred',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      component: entry.component,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies ComponentDecompositionNodeContent,
  });
  engine.writer.supersedeComponentDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, deferredRec.id,
  );
}

interface PrunedChildItem {
  itemId: string;
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  component: DecompositionComponent;
  rootComponentId: string;
  depth: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
}

function writePrunedSupersession(
  ctx: PhaseContext,
  parentNodeId: string,
  child: PrunedChildItem,
  reason: string,
  config: ComponentSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const prunedRec = engine.writer.writeRecord({
    record_type: 'component_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '4',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [child.nodeRecordId],
    content: {
      kind: 'component_decomposition_node',
      node_id: child.logicalNodeId,
      parent_node_id: parentNodeId,
      display_key: child.displayKey,
      root_component_id: child.rootComponentId,
      depth: child.depth,
      pass_number: 0,
      status: 'pruned',
      tier: 'B',
      component: child.component,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: child.releaseId,
      release_ordinal: child.releaseOrdinal,
    } satisfies ComponentDecompositionNodeContent,
  });
  engine.writer.supersedeComponentDecompositionNodeByLogicalId(
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
    component: DecompositionComponent;
    rationale?: string;
  }>>,
  downgradeNotesByParent: Map<string, string>,
  config: ComponentSaturationConfig,
): BundlePlan[] {
  const { engine, workflowRun } = ctx;
  const plans: BundlePlan[] = [];

  // Look up parents to carry their root + depth into the bundle.
  const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'component_decomposition_node');
  const byLogicalId = new Map<string, ComponentDecompositionNodeContent>();
  for (const r of allNodes) {
    const c = r.content as unknown as ComponentDecompositionNodeContent;
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
      component: child.component,
      rootComponentId: parentContent.root_component_id,
      depth: childDepth,
      releaseId: parentContent.release_id,
      releaseOrdinal: parentContent.release_ordinal,
    }));

    const bundleId = `${config.gateSurfacePrefix}${parentContent.display_key}`;
    const items = childItems.map(c => ({
      item_id: c.itemId,
      title: `${c.component.name} (${c.displayKey})`,
      description: c.component.responsibilities.map(r => `• ${r.description}`).join('\n'),
      details: {
        component_id: c.component.id,
        responsibilities: c.component.responsibilities.length,
        dependencies: c.component.dependencies.map(displayComponentDependency),
        active_constraints: c.component.active_constraints ?? [],
      },
    }));
    const bundleContext = downgradeNote
      ? `${downgradeNote}\n\nReview each Tier-B sub-commitment below; reject any that should not be in scope.`
      : `These are scope commitments under "${parentContent.display_key}" identified during recursive decomposition. Accept the ones in scope; reject any out-of-scope.`;

    const bundleRec = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '4',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'decision_bundle',
        bundle_id: bundleId,
        bundle_type: 'mirror_decision',
        title: `Tier-B Component Commitments under "${parentContent.display_key}"`,
        context: bundleContext,
        items,
      } as Record<string, unknown>,
    });
    engine.eventBus.emit('mirror:presented', {
      mirrorId: bundleId,
      artifactType: 'component_decomposition_bundle',
    });
    aoddEmit('mirror.presented', {
      mirror_id: bundleId,
      artifact_type: 'component_decomposition_bundle',
    });

    plans.push({
      bundleRecordId: bundleRec.id,
      parentNodeId,
      childItems,
    });
  }
  return plans;
}

// ── Step 4c — responsibility-shape audit ───────────────────────────

async function runResponsibilityShapeAudit(
  ctx: PhaseContext,
  parentLogicalNodeId: string,
  parentDisplayKey: string,
  parentComponent: DecompositionComponent,
  children: DecompositionComponent[],
  passNumber: number,
  recordSubPhaseId: 'component_saturation',
): Promise<void> {
  const { engine, workflowRun } = ctx;

  // Lightweight audit prompt — checks each child's responsibility set
  // for verb-led / mutually-exclusive / collectively-exhaust /
  // no-implied-subcomponent shape. Single LLM call, JSON output.
  const childrenText = children.map(c =>
    `${c.id} (${c.name}):\n${c.responsibilities.map(r => `  • ${r.description}`).join('\n')}`,
  ).join('\n\n');

  const prompt = `You are auditing a Tier-C component decomposition for responsibility-shape quality.

Parent component (Tier-B, accepted by human at prior gate):
${parentComponent.name} (${parentDisplayKey})
${parentComponent.responsibilities.map(r => `• ${r.description}`).join('\n')}

Tier-C children produced under this parent:
${childrenText}

For EACH child, audit four properties:
1. responsibilities_verb_led — every responsibility is a verb-led action statement (not a noun, title, or vague concern).
2. responsibilities_mutually_exclusive — no two responsibilities under the same child overlap.
3. responsibilities_collectively_exhaust — together they cover what the child claims to do.
4. no_subcomponent_implied — no responsibility implies a hidden subcomponent that should be its own module.

Return JSON:
{
  "audits": [
    {
      "child_id": "<id>",
      "responsibilities_verb_led": true|false,
      "responsibilities_mutually_exclusive": true|false,
      "responsibilities_collectively_exhaust": true|false,
      "no_subcomponent_implied": true|false,
      "findings": ["<short findings, one per failed property>"]
    }
  ]
}

JSON Output Contract: starts with {, ends with }, no markdown fences, no prose, no trailing commas.`;

  // Use the reasoning_review LLM routing directly (callForRole only
  // covers orchestrator / domain_interpreter / requirements_agent /
  // executor — auditing through the dedicated reasoning_review provider
  // matches Phase 2's Step 4c invocation pattern).
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
        phaseId: '4',
        subPhaseId: recordSubPhaseId,
        agentRole: 'reasoning_review',
        label: `Phase ${recordSubPhaseId} Step-4c — responsibility-shape audit on ${parentDisplayKey}`,
      },
    });
    const parsed = result.parsed as Record<string, unknown> | null;
    const audits = Array.isArray(parsed?.audits) ? parsed.audits as Array<Record<string, unknown>> : [];
    for (const audit of audits) {
      const childId = typeof audit.child_id === 'string' ? audit.child_id : null;
      if (!childId) continue;
      const findings = Array.isArray(audit.findings) ? audit.findings as unknown[] : [];
      // Find the matching child node in the stream by display_key
      // (children with shape failures are kept but tagged with
      // atomic_criteria_satisfied for downstream visibility — we don't
      // re-decompose, since this is a quality signal not a structural fix).
      if (findings.length > 0) {
        getLogger().warn('workflow', `Phase ${recordSubPhaseId} Step 4c: responsibility-shape findings`, {
          parent: parentDisplayKey, child: childId, findings,
        });
      }
    }
  } catch (err) {
    getLogger().warn('workflow', `Phase ${recordSubPhaseId} Step 4c: audit failed — skipping`, {
      parent: parentDisplayKey, error: err instanceof Error ? err.message : String(err),
    });
  }
  // Audit is advisory — never blocks the loop. Future enhancement could
  // emit `tier_c_responsibility_shape_audit` records analogous to Phase 2's
  // tier_c_ac_shape_audit. Deferred until calibration evidence supports
  // promoting the flag to default-on.
  void passNumber;
}
