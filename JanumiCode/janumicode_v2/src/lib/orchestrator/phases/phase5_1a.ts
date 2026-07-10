/**
 * Wave 9 — Phase 5.1a Recursive Data-Model Decomposition.
 *
 * Saturation-loop recursive decomposer for data-model entities,
 * mirroring the Wave 6 / 7 / 8 machinery. Tier rubric is
 * data-model-scoped:
 *   A — Aggregate Root (owns consistency boundary, recurse)
 *   B — Entity (identity within aggregate, mirror-gated)
 *   C — Sub-entity / value-type cluster (one more pass)
 *   D — Atomic value type / relation (terminal)
 *
 * Invocation — Phase 5 calls runDataModelSaturationLoop AFTER 5.1
 * has emitted the depth-0 data-model. The loop expects depth-0
 * `data_model_decomposition_node` rows already written.
 */

import { randomUUID } from 'node:crypto';
import { displayEntityRelationship, displayFieldType, displayFieldConstraint } from './summaryFormat';
import type { PhaseContext } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  DataModelDecompositionNodeContent,
  DataModelDecompositionPipelineContent,
  DataModelAssumptionSetSnapshotContent,
  DataModelAssumptionEntry,
  DecompositionEntity,
  DataModelField,
  DataModelRelationship,
  DataModelRelationshipKind,
  DecompositionTier,
  DecompositionNodeStatus,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  TechnicalConstraint,
} from '../../types/records';
import type { MirrorItemDecision } from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { resolveTechConstraintIds, resolveComponentId } from '../idResolver';

function mintLogicalNodeId(): string { return randomUUID(); }
function collisionSafeDisplayKey(rawId: string, sib: Set<string>, nid: string): string {
  if (!sib.has(rawId)) return rawId;
  return `${rawId}#${nid.slice(0, 4)}`;
}
function normalizeTier(raw: unknown): DecompositionTier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

const RELATIONSHIP_KINDS: readonly DataModelRelationshipKind[] = [
  'one_to_one', 'one_to_many', 'many_to_one', 'many_to_many', 'owns', 'references',
];

export interface DataModelSaturationConfig {
  recordSubPhaseId: 'data_model_saturation';
  templateSubPhase: string;
  gateSurfacePrefix: string;
}

const DEFAULT_CONFIG: DataModelSaturationConfig = {
  recordSubPhaseId: 'data_model_saturation',
  templateSubPhase: 'data_model_saturation',
  gateSurfacePrefix: 'data-model-gate-',
};

export interface DataModelSaturationInput {
  technicalConstraints: TechnicalConstraint[];
  componentSummary: string;
  /**
   * Per-component scoped context blocks (component_id → that component's block).
   * PA-4: a single-entity saturation call sees only its OWN component, not the
   * whole component backlog. Falls back to `componentSummary`.
   */
  componentSummaryById?: Record<string, string>;
  rootEntities: DecompositionEntity[];
  rootNodeRecordIds: string[];
  rootLogicalIds: string[];
  /**
   * Phase 3.2 system_requirements summary, threaded so the data-model
   * saturation prompt can ground `traces_to[]` (which the prompt's
   * worked example shows referencing responsibility / SR-* ids). Without
   * this, qwen3.5:9b fabricates `resp-*` ids the validator subsequently
   * fails. See thin-slice-1 audit findings.
   */
  systemRequirementsSummary: string;
}

interface QueueEntry {
  parentRecordId: string;
  nodeId: string;
  parentNodeId: string | null;
  rootEntityId: string;
  depth: number;
  entity: DecompositionEntity;
  displayKey: string;
  tierHint: DecompositionTier | 'root';
  releaseId: string | null;
  releaseOrdinal: number | null;
  activeConstraints: string[];
}

interface ResumeState {
  queue: QueueEntry[];
  allAssumptions: DataModelAssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionEntity[]>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

export function rebuildDataModelSaturationStateFromStream(
  ctx: PhaseContext,
  config: DataModelSaturationConfig,
  pipelineId: string,
): ResumeState | null {
  const { engine, workflowRun } = ctx;
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'data_model_decomposition_node', false,
  );
  if (allNodes.length === 0) return null;

  const latestByNodeId = selectLatestNodeRecordsByNodeId(allNodes);
  const { queue, siblingsByParent, maxDepthReached } =
    buildQueueAndSiblingsFromNodes(latestByNodeId);

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'data_model_assumption_set_snapshot',
  );
  const { allAssumptions, passNumber, assumptionSeq } =
    computeAssumptionsResumeState(snapshotRecords);

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'data_model_decomposition_pipeline', false,
  ).filter(r => (r.content as unknown as DataModelDecompositionPipelineContent).pipeline_id === pipelineId);
  if (pipelineRecords.length === 0) return null;
  const { pipelinePasses, pipelineStartRecord, currentPipelineRecordId } =
    buildPipelineResumeState(pipelineRecords);

  return {
    queue, allAssumptions, assumptionSeq, siblingsByParent,
    maxDepthReached, passNumber,
    pipelinePasses,
    pipelineStartRecord,
    currentPipelineRecordId,
  };
}

/**
 * Reduce every `data_model_decomposition_node` revision to the latest
 * revision per logical node_id (by produced_at). Extracted from
 * rebuildDataModelSaturationStateFromStream to keep cognitive complexity low.
 */
function selectLatestNodeRecordsByNodeId(
  allNodes: GovernedStreamRecord[],
): Map<string, GovernedStreamRecord> {
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
  }
  return latestByNodeId;
}

/**
 * Rebuild the pending-work queue, the parent→siblings index, and the max
 * depth from the latest node revisions. Only `pending` nodes re-enter the
 * queue; every node contributes its entity to its parent's sibling list.
 */
function buildQueueAndSiblingsFromNodes(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): {
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionEntity[]>;
  maxDepthReached: number;
} {
  const queue: QueueEntry[] = [];
  const siblingsByParent = new Map<string | null, DecompositionEntity[]>();
  let maxDepthReached = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
    if (c.depth > maxDepthReached) maxDepthReached = c.depth;
    const sibArr = siblingsByParent.get(c.parent_node_id) ?? [];
    sibArr.push(c.entity);
    siblingsByParent.set(c.parent_node_id, sibArr);
    if (c.status === 'pending') {
      const tierHint: DecompositionTier | 'root' = c.depth === 0 ? 'root' : (c.tier ?? 'A');
      queue.push({
        parentRecordId: r.id,
        nodeId: c.node_id,
        parentNodeId: c.parent_node_id,
        rootEntityId: c.root_entity_id,
        depth: c.depth,
        entity: c.entity,
        displayKey: c.display_key,
        tierHint,
        releaseId: c.release_id,
        releaseOrdinal: c.release_ordinal,
        activeConstraints: c.entity.active_constraints ?? [],
      });
    }
  }
  return { queue, siblingsByParent, maxDepthReached };
}

/**
 * Recover the assumption set (latest snapshot pass wins), the highest pass
 * number, and the running DA-#### sequence counter from the snapshot stream.
 */
function computeAssumptionsResumeState(
  snapshotRecords: GovernedStreamRecord[],
): {
  allAssumptions: DataModelAssumptionEntry[];
  passNumber: number;
  assumptionSeq: number;
} {
  let allAssumptions: DataModelAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as DataModelAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^DA-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }
  return { allAssumptions, passNumber, assumptionSeq };
}

/**
 * From the pipeline records already filtered to the active pipeline_id,
 * recover the earliest (anchor) record, the latest passes list, and the
 * current head record id. Caller guarantees `pipelineRecords` is non-empty.
 */
function buildPipelineResumeState(
  pipelineRecords: GovernedStreamRecord[],
): {
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
} {
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest, pipelineRecords[0]);
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest, pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as DataModelDecompositionPipelineContent;
  return {
    pipelinePasses: latestContent.passes,
    pipelineStartRecord,
    currentPipelineRecordId: latestPipelineRecord.id,
  };
}

function sanitizeChildEntity(
  c: Record<string, unknown>,
  ctx: { rootId: string; childIndex: number },
  techOracle: ReadonlySet<string>,
  techConstraints: readonly TechnicalConstraint[],
): DecompositionEntity | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : null;
  if (!id || !name) {
    getLogger().warn('workflow', 'Phase 5.1a: dropped malformed child (missing id or name)', ctx);
    return null;
  }
  const rawFields = Array.isArray(c.fields) ? c.fields as Array<Record<string, unknown>> : [];
  const fields: DataModelField[] = rawFields
    .map(f => ({
      name: typeof f.name === 'string' ? f.name : '',
      type: typeof f.type === 'string' ? f.type : '',
      constraints: typeof f.constraints === 'string' ? f.constraints : undefined,
      nullable: typeof f.nullable === 'boolean' ? f.nullable : undefined,
      is_identity: typeof f.is_identity === 'boolean' ? f.is_identity : undefined,
    }))
    .filter(f => f.name.length > 0 && f.type.length > 0);
  if (fields.length === 0) {
    getLogger().warn('workflow', 'Phase 5.1a: dropped malformed child (no valid fields)', { ...ctx, childId: id });
    return null;
  }
  const rawRels = Array.isArray(c.relationships) ? c.relationships as Array<Record<string, unknown>> : [];
  const relationships: DataModelRelationship[] = rawRels
    .map(r => {
      const target = typeof r.target_entity_id === 'string' ? r.target_entity_id : '';
      const rk = typeof r.kind === 'string' ? r.kind : 'references';
      const kind: DataModelRelationshipKind = (RELATIONSHIP_KINDS as readonly string[]).includes(rk)
        ? rk as DataModelRelationshipKind : 'references';
      const own = r.ownership;
      let ownership: 'owns' | 'references' | undefined;
      if (own === 'owns') ownership = 'owns';
      else if (own === 'references') ownership = 'references';
      else ownership = undefined;
      return { target_entity_id: target, kind, ownership };
    })
    .filter(r => r.target_entity_id.length > 0);
  const kindRaw = c.kind;
  const entityKind = kindRaw === 'aggregate' || kindRaw === 'entity' || kindRaw === 'value_type' || kindRaw === 'relation'
    ? kindRaw : undefined;
  const stringArr = (key: string): string[] | undefined => {
    const raw = c[key];
    return Array.isArray(raw)
      ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
  };
  // PA-9: snap LLM-drifted TECH-* constraint ids (missing "-1" suffix, drifted
  // separator, close typo) back to the canonical registry so a saturation
  // child's active_constraints / traces_to actually join it. Unresolvable
  // residuals (semantic aliases, noise) pass through unchanged and are logged.
  const rawConstraints = stringArr('active_constraints');
  const rawTraces = stringArr('traces_to');
  const resolvedC = rawConstraints ? resolveTechConstraintIds(rawConstraints, techOracle, techConstraints) : null;
  const resolvedT = rawTraces ? resolveTechConstraintIds(rawTraces, techOracle, techConstraints) : null;
  const techRewrites = [...(resolvedC?.rewrites ?? []), ...(resolvedT?.rewrites ?? [])];
  if (techRewrites.length > 0) {
    getLogger().warn('workflow', 'Phase 5.1a: resolved drifted TECH-* constraint ids to registry', {
      ...ctx, childId: id, rewrites: techRewrites,
    });
  }
  return {
    id, name,
    kind: entityKind,
    component_id: typeof c.component_id === 'string' ? c.component_id : null,
    fields,
    relationships,
    active_constraints: resolvedC?.ids,
    traces_to: resolvedT?.ids,
  };
}

export function formatEntityForPrompt(e: DecompositionEntity): string {
  // PA-8b: coerce type/constraints defensively — the typed contract says `string`
  // but LLM output drifts to objects/undefined, which naive interpolation renders
  // as `[object Object]` / `undefined` into the Fields block.
  const fields = e.fields.map(f => {
    const type = displayFieldType(f.type);
    const constraint = displayFieldConstraint(f.constraints);
    const constraintSuffix = constraint ? ` (${constraint})` : '';
    return `  - ${f.name}: ${type}${f.is_identity ? ' [PK]' : ''}${constraintSuffix}`;
  }).join('\n');
  const rels = (e.relationships ?? []).length === 0
    ? '(none)'
    : (e.relationships ?? []).map(r => `  - ${displayEntityRelationship(r)}`).join('\n');
  // PA-10: surface the node's OWN inherited active_constraints (narrowed TECH-*
  // storage/constraint ids) in the parent block so children honor the right
  // constraints instead of reconstructing them from the global menu.
  const activeConstraints = (e.active_constraints ?? []).join(', ') || '(none inherited)';
  return [
    `Entity id: ${e.id}`,
    `Name: ${e.name}`,
    e.kind ? `Kind: ${e.kind}` : null,
    e.component_id ? `Component: ${e.component_id}` : null,
    `Active constraints (inherited by this entity — children MUST honor these TECH-* ids): ${activeConstraints}`,
    'Fields:',
    fields,
    'Relationships:',
    rels,
  ].filter(Boolean).join('\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (tcs.length === 0) return '(none captured in Phase 1.0c)';
  return tcs.map(t => {
    const version = t.version ? ` ${t.version}` : '';
    const tech = t.technology ? ` [${t.technology}${version}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

// ── Run state (threaded by reference through the pass helpers) ──────

type SaturationEngine = PhaseContext['engine'];
type DecompositionCaps = ReturnType<SaturationEngine['configManager']['get']>['decomposition'];
type SaturationTemplate = NonNullable<ReturnType<SaturationEngine['templateLoader']['findTemplate']>>;

/**
 * All shared, resolved-immutable + mutable state for one data-model saturation
 * run. Threaded by reference through every pass / entry / post-pass helper so
 * each queue / sibling / counter / cursor write-back lands on the SAME object —
 * the behavior-preserving replacement for the original single-function closure.
 */
interface DataModelSaturationRun {
  ctx: PhaseContext;
  engine: SaturationEngine;
  workflowRun: PhaseContext['workflowRun'];
  input: DataModelSaturationInput;
  config: DataModelSaturationConfig;
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
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
  allAssumptions: DataModelAssumptionEntry[];
  assumptionSeq: number;
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionEntity[]>;
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
  entity: DecompositionEntity;
  rationale?: string;
}

/** Pass-scoped accumulators — recreated fresh at the top of each pass. */
interface PassState {
  passAssumptions: DataModelAssumptionEntry[];
  pendingGateByParent: Map<string, PendingGateChild[]>;
  downgradeNotesByParent: Map<string, string>;
}

/** Next `DA-<nnnn>` id — pre-increments the shared sequence (order-preserving). */
function mintAssumptionId(run: DataModelSaturationRun): string {
  return `DA-${String(++run.assumptionSeq).padStart(4, '0')}`;
}

// ── Main loop ──────────────────────────────────────────────────────

export async function runDataModelSaturationLoop(
  ctx: PhaseContext,
  input: DataModelSaturationInput,
  config: DataModelSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const run = await prepareSaturationRun(ctx, input, config);
  await runSaturationPasses(run);
  finalizeSaturationRun(run);
}

// ── Setup ──────────────────────────────────────────────────────────

function resolveTemplateOrThrow(
  engine: SaturationEngine,
  config: DataModelSaturationConfig,
): SaturationTemplate {
  const template = engine.templateLoader.findTemplate('technical_spec_agent', config.templateSubPhase);
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: data-model decomposition template missing — ` +
      `expected agent_role=technical_spec_agent sub_phase=${config.templateSubPhase}.`,
    );
  }
  return template;
}

function resolveDivergenceConfig(): {
  divergeGrowthRatio: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
} {
  return {
    divergeGrowthRatio: Number.parseFloat(process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2'),
    divergeTerminatePasses: Number.parseInt(process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10),
    dedupOfflineWarnPasses: Number.parseInt(process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10),
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
  const dedupThreshold = Number.parseFloat(process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
  const dedupEnabled = Number.isFinite(dedupThreshold)
    && dedupThreshold > 0
    && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';
  return { embeddingClient, embeddingCache, dedupThreshold, dedupEnabled };
}

function seedQueueFromRoots(input: DataModelSaturationInput): QueueEntry[] {
  return input.rootEntities.map((e, i) => ({
    parentRecordId: input.rootNodeRecordIds[i],
    nodeId: input.rootLogicalIds[i],
    parentNodeId: null,
    rootEntityId: input.rootLogicalIds[i],
    depth: 0,
    entity: e,
    displayKey: e.id,
    tierHint: 'root' as const,
    releaseId: null,
    releaseOrdinal: null,
    activeConstraints: e.active_constraints ?? [],
  }));
}

function initSiblingsByParent(
  resumed: ResumeState | null,
  input: DataModelSaturationInput,
): Map<string | null, DecompositionEntity[]> {
  if (resumed) return resumed.siblingsByParent;
  const siblingsByParent = new Map<string | null, DecompositionEntity[]>();
  siblingsByParent.set(null, [...input.rootEntities]);
  return siblingsByParent;
}

function resolvePipelineStartRecord(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
  config: DataModelSaturationConfig,
  input: DataModelSaturationInput,
  pipelineId: string,
  resumed: ResumeState | null,
): { pipelineStartRecord: GovernedStreamRecord; currentPipelineRecordId: string } {
  const pipelineStartRecord = resumed?.pipelineStartRecord ?? engine.writer.writeRecord({
    record_type: 'data_model_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: input.rootNodeRecordIds,
    content: {
      kind: 'data_model_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_entity_id: '*',
      passes: [],
    } satisfies DataModelDecompositionPipelineContent,
  });
  const currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;
  return { pipelineStartRecord, currentPipelineRecordId };
}

function buildParentChain(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
): Map<string, string | null> {
  const parentChain = new Map<string, string | null>();
  for (const r of engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node')) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
    parentChain.set(c.node_id, c.parent_node_id);
  }
  return parentChain;
}

async function seedDedupCacheFromExistingAssumptions(run: DataModelSaturationRun): Promise<void> {
  if (!(run.dedupEnabled && run.allAssumptions.length > 0)) return;
  try {
    const vecs = await run.embeddingClient.embed(
      run.allAssumptions.map(a => a.text),
      { signal: run.engine.getSessionAbortSignal() },
    );
    run.allAssumptions.forEach((a, i) => { if (vecs[i]) run.embeddingCache.set(a.id, vecs[i]); });
  } catch (err) {
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup seed failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function prepareSaturationRun(
  ctx: PhaseContext,
  input: DataModelSaturationInput,
  config: DataModelSaturationConfig,
): Promise<DataModelSaturationRun> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;
  // PA-9: canonical TECH-* registry oracle — saturation children routinely drift
  // these ids; each child is snapped back to a registry member (or kept + logged).
  const techIdOracle = new Set(input.technicalConstraints.map(t => t.id));
  // PA-4: component oracle (every id-form keyed in the scoped map) — used to
  // resolve a drifted/composite component_id before component_context falls open.
  const componentOracle = Object.keys(input.componentSummaryById ?? {});
  const template = resolveTemplateOrThrow(engine, config);

  const pipelineId = `data-model-decomp-pipe-${workflowRun.id.slice(0, 8)}`;
  const resumed = rebuildDataModelSaturationStateFromStream(ctx, config, pipelineId);

  // Order-sensitive: the divergence config has no side effects; the pipeline
  // start record is WRITTEN here (unless resuming); the dedup config only news
  // up the client — matching the original setup ordering.
  const divergence = resolveDivergenceConfig();
  const pipeline = resolvePipelineStartRecord(engine, workflowRun, config, input, pipelineId, resumed);
  const dedup = resolveDedupConfig(engine);

  const run: DataModelSaturationRun = {
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
    // Pure read (data_model_decomposition_node) — the dedup seed below writes no
    // records, so building this before it yields identical results to the
    // original ordering (which built parentChain right after the seed).
    parentChain: buildParentChain(engine, workflowRun),
    // PA-4 fail-safe visibility: component_context silently falls open to the FULL
    // summary when a node's component_id isn't a key in componentSummaryById (leaf /
    // mid-tier id drift). Track unique missed ids and WARN once each, so a high
    // fall-open rate is visible rather than silent (mirrors the PA-3 stop-and-fix).
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

// ── Pass loop ──────────────────────────────────────────────────────

async function runSaturationPasses(run: DataModelSaturationRun): Promise<void> {
  const { engine, workflowRun } = run;
  while (run.queue.length > 0) {
    run.passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'data_model_decomposition_node',
    ).length;
    const passEntries = run.queue.splice(0, run.queue.length);
    const pass: PassState = {
      passAssumptions: [],
      pendingGateByParent: new Map<string, PendingGateChild[]>(),
      downgradeNotesByParent: new Map<string, string>(),
    };

    for (const entry of passEntries) {
      await processPassEntry(run, pass, entry);
    }

    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'data_model_decomposition_node',
    ).length - nodesProducedAtPassStart;
    recordPipelinePass(run, pass, passStartedAt, nodesProducedThisPass);

    const dedupFailedThisPass = await applyPassDedup(run, pass);
    const semanticDelta = pass.passAssumptions.filter(a => !a.duplicate_of).length;
    appendAndSnapshotAssumptions(run, pass, semanticDelta);

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
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { ctx, config, caps } = run;
  if (entry.depth >= caps.data_model_depth_cap) {
    writeDeferredSupersession(ctx, entry, run.passNumber, 'depth_cap_reached', config);
    return;
  }
  const rootCalls = run.callsByRoot.get(entry.rootEntityId) ?? 0;
  if (rootCalls >= caps.data_model_budget_cap) {
    writeDeferredSupersession(ctx, entry, run.passNumber, 'budget_cap_reached', config);
    return;
  }

  try {
    await decomposeEntry(run, pass, entry);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking deferred`, {
      nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
    });
    writeDeferredSupersession(ctx, entry, run.passNumber, `decomposition_failed: ${reason}`, config);
  }
}

/**
 * The decomposer call + child emission for one entry. Everything here runs
 * inside the caller's try/catch, so any throw defers the node — matching the
 * original single try block (variables → render → LLM → children → supersession).
 */
async function decomposeEntry(
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { engine, workflowRun, config } = run;

  const variables = buildDecompositionVariables(run, pass, entry);
  const rendered = engine.templateLoader.render(run.template, variables);
  if (rendered.missing_variables.length > 0) {
    throw new Error(`Phase ${config.recordSubPhaseId}: template missing vars [${rendered.missing_variables.join(', ')}]`);
  }

  run.callsByRoot.set(entry.rootEntityId, (run.callsByRoot.get(entry.rootEntityId) ?? 0) + 1);
  const result = await engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.4,
    traceContext: {
      workflowRunId: workflowRun.id,
      phaseId: '5',
      subPhaseId: config.recordSubPhaseId,
      agentRole: 'technical_spec_agent',
      label: `Phase ${config.recordSubPhaseId} Pass-${run.passNumber} — ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
    },
  });

  const parsed = result.parsed as Record<string, unknown> | null;
  const childrenRaw = Array.isArray(parsed?.children)
    ? parsed.children as Array<Record<string, unknown>> : [];
  const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
    ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
  const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;

  const childAssumptionIds = collectSurfacedAssumptions(run, pass, entry, surfacedRaw);

  const childDepth = entry.depth + 1;
  run.maxDepthReached = Math.max(run.maxDepthReached, childDepth);

  const emittedChildren = emitChildNodes(run, pass, entry, childrenRaw, childAssumptionIds, childDepth);
  if (emittedChildren.length > 0) {
    run.siblingsByParent.set(entry.nodeId, emittedChildren);
  }

  const parentDowngraded = applyTierBDowngradeIfNeeded(run, pass, entry, tierAssessment);
  // Status transition for successful decomposition. Parents that produced
  // children need a `decomposed` supersession or they stay labelled `pending`.
  writeDecomposedSupersession(run, entry, emittedChildren.length, parentDowngraded);
}

/** Assemble the template variables (component/sibling scoping + assumptions). */
function buildDecompositionVariables(
  run: DataModelSaturationRun,
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

  const ancestorChainText = buildAncestorChainText(entry, run.parentChain);

  const depthZeroText = input.rootEntities.length === 0
    ? '(none)'
    : input.rootEntities.map(e => `- ${e.id}: ${e.name}`).join('\n');

  // Scope component_context to the entity's OWN component (PA-4), not the whole
  // component backlog; fall open to the full summary on a miss (logged within).
  const scopedComponentCtx = resolveScopedComponentContext(run, entry);

  return {
    active_constraints: activeConstraintsForPrompt,
    parent_entity: formatEntityForPrompt(entry.entity),
    parent_tier_hint: entry.tierHint,
    sibling_context: formatSiblingContext(siblings, entry),
    component_context: scopedComponentCtx ?? input.componentSummary,
    system_requirements_summary: input.systemRequirementsSummary,
    ancestor_chain: ancestorChainText,
    depth_zero_entities: depthZeroText,
    existing_assumptions: scopedAssumptions.length === 0
      ? '(none yet)'
      : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
    current_depth: String(entry.depth),
    janumicode_version_sha: engine.janumiCodeVersionSha,
  };
}

/** Walk parent links to the root for assumption scoping, guarding against cycles. */
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
 * Build the ancestor chain (parent's ancestors + the parent itself) for
 * `relationships[].target_entity_id` grounding. The saturation prompt's
 * traces_to_id_validity rule explicitly permits target ids that resolve to
 * ancestors above the parent; without surfacing them the model can only see
 * direct siblings + parent and would fabricate cross-aggregate refs.
 *
 * NOTE: intentionally NO cycle guard here — this mirrors the original
 * display-only walk exactly (it relies on the parent chain being acyclic).
 */
function buildAncestorChainText(
  entry: QueueEntry,
  parentChain: Map<string, string | null>,
): string {
  const ancestorIdsForPrompt: string[] = [];
  let cursorAnc: string | null = entry.parentNodeId;
  while (cursorAnc) {
    ancestorIdsForPrompt.push(cursorAnc);
    cursorAnc = parentChain.get(cursorAnc) ?? null;
  }
  return ancestorIdsForPrompt.length === 0
    ? '(none — parent is depth-0 root)'
    : ancestorIdsForPrompt.map(id => `- ${id}`).join('\n');
}

/**
 * PA-4: scope component_context to the entity's OWN component. On a direct miss,
 * resolve the id — separator/case drift OR a fabricated composite
 * `comp-<component>-<entity>` (data-model saturation invents these, e.g.
 * `comp-appointment-core-auditlogentry`) — against the component oracle before
 * falling open to the full catalog. Mutates the run's resolved/fell-open id sets
 * so each id warns once; only a genuine residual logs the fall-open.
 */
function resolveScopedComponentContext(
  run: DataModelSaturationRun,
  entry: QueueEntry,
): string | undefined {
  const { input, componentOracle, workflowRun } = run;
  const citedCompId = entry.entity.component_id;
  let scopedComponentCtx = citedCompId
    ? input.componentSummaryById?.[citedCompId]
    : undefined;
  if (citedCompId && scopedComponentCtx === undefined && componentOracle.length > 0) {
    const resolved = resolveComponentId(citedCompId, componentOracle);
    if (resolved && resolved !== citedCompId) {
      scopedComponentCtx = input.componentSummaryById?.[resolved];
      if (!run.resolvedCompIds.has(citedCompId)) {
        run.resolvedCompIds.add(citedCompId);
        getLogger().warn('workflow', 'Phase 5.1a data_model_saturation: resolved drifted/composite component_id to its scoped component (PA-4)', {
          workflow_run_id: workflowRun.id, component_id: citedCompId, resolved_to: resolved,
        });
      }
    }
  }
  if (citedCompId && scopedComponentCtx === undefined
      && !run.fellOpenCompIds.has(citedCompId)) {
    run.fellOpenCompIds.add(citedCompId);
    getLogger().warn('workflow', 'Phase 5.1a data_model_saturation: component_context fell open to the FULL summary — component id unresolvable against the component oracle (PA-4 residual)', {
      workflow_run_id: workflowRun.id, component_id: citedCompId,
    });
  }
  return scopedComponentCtx;
}

/**
 * Render the sibling roster. Scope root-node siblings to the same component
 * (PA-4): at depth 0 `siblingsByParent.get(null)` is EVERY root entity across
 * all components, which duplicated depth_zero_entities and bloated the prompt.
 */
function formatSiblingContext(
  siblings: DecompositionEntity[],
  entry: QueueEntry,
): string {
  const isRoot = entry.parentNodeId == null;
  const sibs = siblings
    .filter(s => s.id !== entry.entity.id)
    .filter(s => !isRoot || s.component_id === entry.entity.component_id);
  return sibs.length === 0
    ? '(none — sole child under this parent)'
    : sibs.map(s => `- ${s.id}: ${s.name}`).join('\n');
}

/** Mint DA-ids for the surfaced assumptions, appending to the pass batch. */
function collectSurfacedAssumptions(
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
  surfacedRaw: Array<Record<string, unknown>>,
): string[] {
  const childAssumptionIds: string[] = [];
  for (const a of surfacedRaw) {
    const text = typeof a.text === 'string' ? a.text : null;
    if (!text) continue;
    const cat = typeof a.category === 'string' ? a.category : 'open_question';
    const validCats: DataModelAssumptionEntry['category'][] = [
      'identity', 'ownership', 'cardinality', 'lifecycle',
      'consistency', 'storage_choice', 'open_question',
    ];
    const category = (validCats as string[]).includes(cat)
      ? cat as DataModelAssumptionEntry['category'] : 'open_question';
    const citations = Array.isArray(a.citations)
      ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
    const assumption: DataModelAssumptionEntry = {
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
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
  childrenRaw: Array<Record<string, unknown>>,
  childAssumptionIds: string[],
  childDepth: number,
): DecompositionEntity[] {
  const { engine, workflowRun, config, caps } = run;
  const emittedChildren: DecompositionEntity[] = [];
  const siblingDisplayKeys = new Set<string>();
  let fanoutCount = 0;
  for (const c of childrenRaw) {
    if (++fanoutCount > caps.data_model_fanout_cap) break;
    const child = sanitizeChildEntity(c, { rootId: entry.displayKey, childIndex: fanoutCount }, run.techIdOracle, run.input.technicalConstraints);
    if (!child) continue;
    const tier = normalizeTier(c.tier);
    const rationale = typeof c.decomposition_rationale === 'string' ? c.decomposition_rationale : undefined;
    const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
    const logicalNodeId = mintLogicalNodeId();
    const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
    siblingDisplayKeys.add(displayKey);

    const { enrichedChild, childActiveConstraints } = buildEnrichedChild(child, entry);

    const childRec = engine.writer.writeRecord({
      record_type: 'data_model_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'technical_spec_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'data_model_decomposition_node',
        node_id: logicalNodeId,
        parent_node_id: entry.nodeId,
        display_key: displayKey,
        root_entity_id: entry.rootEntityId,
        depth: childDepth,
        pass_number: run.passNumber,
        status: initialStatus,
        tier,
        entity: enrichedChild,
        decomposition_rationale: rationale,
        surfaced_assumption_ids: childAssumptionIds,
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies DataModelDecompositionNodeContent,
    });
    emittedChildren.push(enrichedChild);
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
  return emittedChildren;
}

/**
 * Deterministic child enrichment: inherit the parent's active_constraints when
 * the child cited none (data-model saturation carries no other write-scope /
 * AC-binding derivation, unlike the task loop).
 */
function buildEnrichedChild(
  child: DecompositionEntity,
  entry: QueueEntry,
): { enrichedChild: DecompositionEntity; childActiveConstraints: string[] } {
  const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
    ? child.active_constraints
    : entry.activeConstraints;
  const enrichedChild: DecompositionEntity = { ...child, active_constraints: childActiveConstraints };
  return { enrichedChild, childActiveConstraints };
}

/** Route an emitted child by tier: A/C recurse (queue), B waits for the gate. */
function routeChildByTier(
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
  args: {
    tier: DecompositionTier;
    enrichedChild: DecompositionEntity;
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
      rootEntityId: entry.rootEntityId, depth: args.childDepth, entity: args.enrichedChild,
      displayKey: args.displayKey, tierHint: 'A',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
      activeConstraints: args.childActiveConstraints,
    });
  } else if (args.tier === 'B') {
    const batch = pass.pendingGateByParent.get(entry.nodeId) ?? [];
    batch.push({ nodeRecordId: args.childRecordId, logicalNodeId: args.logicalNodeId, displayKey: args.displayKey, entity: args.enrichedChild, rationale: args.rationale });
    pass.pendingGateByParent.set(entry.nodeId, batch);
  } else if (args.tier === 'C') {
    run.queue.push({
      parentRecordId: args.childRecordId, nodeId: args.logicalNodeId, parentNodeId: entry.nodeId,
      rootEntityId: entry.rootEntityId, depth: args.childDepth, entity: args.enrichedChild,
      displayKey: args.displayKey, tierHint: 'C',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
      activeConstraints: args.childActiveConstraints,
    });
  }
}

/**
 * A previously-accepted Tier-B parent that either the decomposer disagreed with,
 * or that produced its own Tier-B children, is downgraded (superseded). Returns
 * true when the parent was downgraded (which suppresses the `decomposed`
 * supersession).
 */
function applyTierBDowngradeIfNeeded(
  run: DataModelSaturationRun,
  pass: PassState,
  entry: QueueEntry,
  tierAssessment: Record<string, unknown> | undefined,
): boolean {
  if (entry.tierHint !== 'B') return false;
  const { engine, workflowRun, config } = run;

  const explicitDisagreement = tierAssessment?.agrees_with_hint === false
    && typeof tierAssessment.tier === 'string'
    && (tierAssessment.tier === 'A' || tierAssessment.tier === 'B');
  const producedTierBChildren = (pass.pendingGateByParent.get(entry.nodeId)?.length ?? 0) > 0;
  if (!(explicitDisagreement || producedTierBChildren)) return false;

  const reason = explicitDisagreement
    ? `tier_downgrade: decomposer_assessed_${tierAssessment?.tier}_not_B`
    : 'tier_downgrade: post_gate_children_still_tier_B';
  const downgradedRec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_entity_id: entry.rootEntityId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'downgraded',
      entity: entry.entity,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies DataModelDecompositionNodeContent,
  });
  engine.writer.supersedeDataModelDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, downgradedRec.id,
  );
  if (producedTierBChildren) {
    pass.downgradeNotesByParent.set(
      entry.nodeId,
      `The entity '${entry.displayKey}' you accepted earlier turned out to ` +
      `have its own commitment layer underneath. The entities below need your review.`,
    );
  }
  return true;
}

/** Supersede a parent that produced children (and wasn't downgraded) as decomposed. */
function writeDecomposedSupersession(
  run: DataModelSaturationRun,
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
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: originalSubPhase,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_entity_id: entry.rootEntityId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'decomposed',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      entity: entry.entity,
      surfaced_assumption_ids: [],
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies DataModelDecompositionNodeContent,
  });
  engine.writer.supersedeDataModelDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, decomposedRec.id,
  );
}

/** Append this pass to the pipeline record and roll the current-record cursor. */
function recordPipelinePass(
  run: DataModelSaturationRun,
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
  const passUpdate = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'data_model_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_entity_id: '*',
      passes: [...run.pipelinePasses],
    } satisfies DataModelDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, passUpdate.id);
  run.currentPipelineRecordId = passUpdate.id;
}

/**
 * Flag this pass's assumptions that duplicate a prior (by embedding similarity).
 * Returns true only when the embed itself failed (dedup went offline this pass).
 */
async function applyPassDedup(run: DataModelSaturationRun, pass: PassState): Promise<boolean> {
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
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup embed failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/** Fold the pass batch into the running set and snapshot the assumption state. */
function appendAndSnapshotAssumptions(
  run: DataModelSaturationRun,
  pass: PassState,
  semanticDelta: number,
): void {
  const { engine, workflowRun, config } = run;
  run.allAssumptions.push(...pass.passAssumptions);
  engine.writer.writeRecord({
    record_type: 'data_model_assumption_set_snapshot',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'technical_spec_agent',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_assumption_set_snapshot',
      pass_number: run.passNumber,
      root_entity_id: '*',
      assumptions: [...run.allAssumptions],
      delta_from_previous_pass: pass.passAssumptions.length,
      semantic_delta: semanticDelta,
    } satisfies DataModelAssumptionSetSnapshotContent,
  });
}

/** Present the Tier-B mirror gates, then prune human-rejected children / queue the rest. */
async function resolveTierBGates(run: DataModelSaturationRun, pass: PassState): Promise<void> {
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
          rootEntityId: child.rootEntityId,
          depth: child.depth,
          entity: child.entity,
          displayKey: child.displayKey,
          tierHint: 'B',
          releaseId: child.releaseId,
          releaseOrdinal: child.releaseOrdinal,
          activeConstraints: child.entity.active_constraints ?? [],
        });
      }
    }
  }
}

/** A pass where assumption dedup was offline: bump the streak, announce once at threshold. */
function noteDedupOfflinePass(run: DataModelSaturationRun): void {
  run.consecutiveDedupOfflinePasses++;
  if (run.consecutiveDedupOfflinePasses >= run.dedupOfflineWarnPasses && !run.dedupOfflineAnnounced) {
    run.dedupOfflineAnnounced = true;
  }
}

/** A pass where assumption dedup was online: clear the announcement + reset streak. */
function noteDedupOnlinePass(run: DataModelSaturationRun): void {
  if (run.dedupOfflineAnnounced) run.dedupOfflineAnnounced = false;
  run.consecutiveDedupOfflinePasses = 0;
}

/** Divergence rail: EARLY-TERMINATE (defer the queue) on sustained node growth. */
function detectAndHandleDivergence(run: DataModelSaturationRun, nodesProducedThisPass: number): void {
  const priorPass = run.pipelinePasses.length >= 2 ? (run.pipelinePasses.at(-2) ?? null) : null;
  const growthObserved = priorPass
    && priorPass.nodes_produced > 0
    && nodesProducedThisPass > priorPass.nodes_produced * run.divergeGrowthRatio;
  if (growthObserved) {
    run.consecutiveGrowthPasses++;
    if (run.consecutiveGrowthPasses >= run.divergeTerminatePasses) {
      for (const remaining of run.queue) writeDeferredSupersession(run.ctx, remaining, run.passNumber, 'diverging', run.config);
      run.queue.length = 0;
      run.divergingEarlyTerminate = true;
    }
  } else {
    run.consecutiveGrowthPasses = 0;
  }
}

// ── Finalization ───────────────────────────────────────────────────

/** Pick the termination reason in the original precedence order. */
function resolveTerminationReason(
  run: DataModelSaturationRun,
  maxRootCalls: number,
): DecompositionTerminationReason {
  if (run.divergingEarlyTerminate) return 'diverging';
  if (maxRootCalls >= run.caps.data_model_budget_cap) return 'budget_cap';
  if (run.maxDepthReached >= run.caps.data_model_depth_cap) return 'depth_cap';
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
    const c = n.content as unknown as DataModelDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }
  return { tierDistribution, atomicLeafCount };
}

/** Best-effort workflow_runs telemetry (budget / depth / active pipeline). */
function writeDataModelDecompositionTelemetry(run: DataModelSaturationRun, totalLlmCalls: number): void {
  const { engine, workflowRun, config } = run;
  try {
    engine.db.prepare(`
      UPDATE workflow_runs
      SET data_model_decomposition_budget_calls_used = ?,
          data_model_decomposition_max_depth_reached = MAX(data_model_decomposition_max_depth_reached, ?),
          active_data_model_pipeline_id = ?
      WHERE id = ?
    `).run(totalLlmCalls, run.maxDepthReached, run.pipelineId, workflowRun.id);
  } catch (err) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: telemetry write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Write the terminal pipeline record + telemetry once the loop has settled. */
function finalizeSaturationRun(run: DataModelSaturationRun): void {
  const { engine, workflowRun, config } = run;
  const totalLlmCalls = [...run.callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = run.callsByRoot.size > 0 ? Math.max(...run.callsByRoot.values()) : 0;
  const terminationReason = resolveTerminationReason(run, maxRootCalls);

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node');
  const { tierDistribution, atomicLeafCount } = summarizeFinalNodes(finalNodes);

  const finalRec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'data_model_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_entity_id: '*',
      passes: run.pipelinePasses.map((p, i) =>
        i === run.pipelinePasses.length - 1 ? { ...p, termination_reason: terminationReason } : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: run.maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies DataModelDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, finalRec.id);

  writeDataModelDecompositionTelemetry(run, totalLlmCalls);
}

function writeDeferredSupersession(
  ctx: PhaseContext,
  entry: QueueEntry,
  passNumber: number,
  reason: string,
  config: DataModelSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_entity_id: entry.rootEntityId,
      depth: entry.depth,
      pass_number: passNumber,
      status: 'deferred',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      entity: entry.entity,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies DataModelDecompositionNodeContent,
  });
  engine.writer.supersedeDataModelDecompositionNodeByLogicalId(workflowRun.id, entry.nodeId, rec.id);
}

interface PrunedChildItem {
  itemId: string;
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  entity: DecompositionEntity;
  rootEntityId: string;
  depth: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
}

function writePrunedSupersession(
  ctx: PhaseContext,
  parentNodeId: string,
  child: PrunedChildItem,
  reason: string,
  config: DataModelSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [child.nodeRecordId],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: child.logicalNodeId,
      parent_node_id: parentNodeId,
      display_key: child.displayKey,
      root_entity_id: child.rootEntityId,
      depth: child.depth,
      pass_number: 0,
      status: 'pruned',
      tier: 'B',
      entity: child.entity,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: child.releaseId,
      release_ordinal: child.releaseOrdinal,
    } satisfies DataModelDecompositionNodeContent,
  });
  engine.writer.supersedeDataModelDecompositionNodeByLogicalId(workflowRun.id, child.logicalNodeId, rec.id);
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
    entity: DecompositionEntity;
    rationale?: string;
  }>>,
  downgradeNotes: Map<string, string>,
  config: DataModelSaturationConfig,
): BundlePlan[] {
  const { engine, workflowRun } = ctx;
  const plans: BundlePlan[] = [];
  const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node');
  const byLogical = new Map<string, DataModelDecompositionNodeContent>();
  for (const r of allNodes) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
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
      entity: c.entity,
      rootEntityId: parent.root_entity_id,
      depth: childDepth,
      releaseId: parent.release_id,
      releaseOrdinal: parent.release_ordinal,
    }));
    const bundleId = `${config.gateSurfacePrefix}${parent.display_key}`;
    const items = childItems.map(c => ({
      item_id: c.itemId,
      title: `${c.entity.name} (${c.displayKey})`,
      description: c.entity.fields.map(f => `• ${f.name}: ${displayFieldType(f.type)}`).join('\n'),
      details: {
        entity_id: c.entity.id,
        kind: c.entity.kind,
        field_count: c.entity.fields.length,
        relationships: (c.entity.relationships ?? []).map(displayEntityRelationship),
        active_constraints: c.entity.active_constraints ?? [],
      },
    }));
    const bundleContext = note
      ? `${note}\n\nReview each Tier-B sub-entity below; reject any out-of-scope.`
      : `These are scope commitments under "${parent.display_key}" identified during recursive data-model decomposition. Accept the ones in scope; reject any out-of-scope.`;
    const bundleRec = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'decision_bundle',
        bundle_id: bundleId,
        bundle_type: 'mirror_decision',
        title: `Tier-B Data-Model Commitments under "${parent.display_key}"`,
        context: bundleContext,
        items,
      } as Record<string, unknown>,
    });
    engine.eventBus.emit('mirror:presented', {
      mirrorId: bundleId,
      artifactType: 'data_model_decomposition_bundle',
    });
    plans.push({ bundleRecordId: bundleRec.id, parentNodeId, childItems });
  }
  return plans;
}
