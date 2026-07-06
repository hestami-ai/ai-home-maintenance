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

  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
  }

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

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'data_model_assumption_set_snapshot',
  );
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

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'data_model_decomposition_pipeline', false,
  ).filter(r => (r.content as unknown as DataModelDecompositionPipelineContent).pipeline_id === pipelineId);
  if (pipelineRecords.length === 0) return null;
  const pipelineStartRecord = pipelineRecords.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest, pipelineRecords[0]);
  const latestPipelineRecord = pipelineRecords.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest, pipelineRecords[0]);
  const latestContent = latestPipelineRecord.content as unknown as DataModelDecompositionPipelineContent;

  return {
    queue, allAssumptions, assumptionSeq, siblingsByParent,
    maxDepthReached, passNumber,
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
      const ownership: 'owns' | 'references' | undefined =
        own === 'owns' ? 'owns' : own === 'references' ? 'references' : undefined;
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
    return `  - ${f.name}: ${type}${f.is_identity ? ' [PK]' : ''}${constraint ? ` (${constraint})` : ''}`;
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
    const tech = t.technology ? ` [${t.technology}${t.version ? ` ${t.version}` : ''}]` : '';
    return `- ${t.id}${tech} (${t.category}): ${t.text}`;
  }).join('\n');
}

export async function runDataModelSaturationLoop(
  ctx: PhaseContext,
  input: DataModelSaturationInput,
  config: DataModelSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;
  // PA-9: canonical TECH-* registry oracle — saturation children routinely drift
  // these ids; each child is snapped back to a registry member (or kept + logged).
  const techIdOracle = new Set(input.technicalConstraints.map(t => t.id));
  // PA-4: component oracle (every id-form keyed in the scoped map) — used to
  // resolve a drifted/composite component_id before component_context falls open.
  const componentOracle = Object.keys(input.componentSummaryById ?? {});

  const template = engine.templateLoader.findTemplate('technical_spec_agent', config.templateSubPhase);
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: data-model decomposition template missing — ` +
      `expected agent_role=technical_spec_agent sub_phase=${config.templateSubPhase}.`,
    );
  }

  const pipelineId = `data-model-decomp-pipe-${workflowRun.id.slice(0, 8)}`;
  const resumed = rebuildDataModelSaturationStateFromStream(ctx, config, pipelineId);

  const allAssumptions: DataModelAssumptionEntry[] = resumed?.allAssumptions ?? [];
  let assumptionSeq = resumed?.assumptionSeq ?? 0;
  const newAssumptionId = (): string => `DA-${String(++assumptionSeq).padStart(4, '0')}`;

  const queue: QueueEntry[] = resumed?.queue ?? input.rootEntities.map((e, i) => ({
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

  const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionEntity[]>();
  if (!resumed) siblingsByParent.set(null, [...input.rootEntities]);

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
  for (const r of engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node')) {
    const c = r.content as unknown as DataModelDecompositionNodeContent;
    parentChain.set(c.node_id, c.parent_node_id);
  }

  // PA-4 fail-safe visibility: component_context silently falls open to the FULL
  // summary when a node's component_id isn't a key in componentSummaryById (leaf /
  // mid-tier id drift). Track unique missed ids and WARN once each, so a high
  // fall-open rate is visible rather than silent (mirrors the PA-3 stop-and-fix).
  const fellOpenCompIds = new Set<string>();
  const resolvedCompIds = new Set<string>();

  while (queue.length > 0) {
    passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'data_model_decomposition_node',
    ).length;
    const passEntries = queue.splice(0, queue.length);
    const passAssumptions: DataModelAssumptionEntry[] = [];
    const pendingGateByParent = new Map<string, Array<{
      nodeRecordId: string;
      logicalNodeId: string;
      displayKey: string;
      entity: DecompositionEntity;
      rationale?: string;
    }>>();
    const downgradeNotesByParent = new Map<string, string>();

    for (const entry of passEntries) {
      if (entry.depth >= caps.data_model_depth_cap) {
        writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
        continue;
      }
      const rootCalls = callsByRoot.get(entry.rootEntityId) ?? 0;
      if (rootCalls >= caps.data_model_budget_cap) {
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

        // Build the ancestor chain (parent's ancestors + the parent
        // itself) for `relationships[].target_entity_id` grounding. The
        // saturation prompt's traces_to_id_validity rule explicitly
        // permits target ids that resolve to ancestors above the parent;
        // without surfacing them here the model can only see direct
        // siblings + parent and would fabricate cross-aggregate refs.
        const ancestorIdsForPrompt: string[] = [];
        let cursorAnc: string | null = entry.parentNodeId;
        while (cursorAnc) {
          ancestorIdsForPrompt.push(cursorAnc);
          cursorAnc = parentChain.get(cursorAnc) ?? null;
        }
        const ancestorChainText = ancestorIdsForPrompt.length === 0
          ? '(none — parent is depth-0 root)'
          : ancestorIdsForPrompt.map(id => `- ${id}`).join('\n');

        const depthZeroText = input.rootEntities.length === 0
          ? '(none)'
          : input.rootEntities.map(e => `- ${e.id}: ${e.name}`).join('\n');

        // PA-4: scope component_context to the entity's OWN component. On a direct
        // miss, resolve the id — separator/case drift OR a fabricated composite
        // `comp-<component>-<entity>` (data-model saturation invents these, e.g.
        // `comp-appointment-core-auditlogentry`) — against the component oracle
        // before falling open to the full catalog. Only a genuine residual logs.
        const citedCompId = entry.entity.component_id;
        let scopedComponentCtx = citedCompId
          ? input.componentSummaryById?.[citedCompId]
          : undefined;
        if (citedCompId && scopedComponentCtx === undefined && componentOracle.length > 0) {
          const resolved = resolveComponentId(citedCompId, componentOracle);
          if (resolved && resolved !== citedCompId) {
            scopedComponentCtx = input.componentSummaryById?.[resolved];
            if (!resolvedCompIds.has(citedCompId)) {
              resolvedCompIds.add(citedCompId);
              getLogger().warn('workflow', 'Phase 5.1a data_model_saturation: resolved drifted/composite component_id to its scoped component (PA-4)', {
                workflow_run_id: workflowRun.id, component_id: citedCompId, resolved_to: resolved,
              });
            }
          }
        }
        if (citedCompId && scopedComponentCtx === undefined
            && !fellOpenCompIds.has(citedCompId)) {
          fellOpenCompIds.add(citedCompId);
          getLogger().warn('workflow', 'Phase 5.1a data_model_saturation: component_context fell open to the FULL summary — component id unresolvable against the component oracle (PA-4 residual)', {
            workflow_run_id: workflowRun.id, component_id: citedCompId,
          });
        }

        const variables: Record<string, string> = {
          active_constraints: activeConstraintsForPrompt,
          parent_entity: formatEntityForPrompt(entry.entity),
          parent_tier_hint: entry.tierHint,
          sibling_context: (() => {
            // Scope root-node siblings to the same component (PA-4): at depth 0
            // `siblingsByParent.get(null)` is EVERY root entity across all
            // components, duplicating depth_zero_entities and bloating the prompt.
            const isRoot = entry.parentNodeId == null;
            const sibs = siblings
              .filter(s => s.id !== entry.entity.id)
              .filter(s => !isRoot || s.component_id === entry.entity.component_id);
            return sibs.length === 0
              ? '(none — sole child under this parent)'
              : sibs.map(s => `- ${s.id}: ${s.name}`).join('\n');
          })(),
          // Scope component_context to the entity's OWN component (PA-4), not the
          // whole component backlog; fall open to the full summary on a miss (logged above).
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

        const rendered = engine.templateLoader.render(template, variables);
        if (rendered.missing_variables.length > 0) {
          throw new Error(`Phase ${config.recordSubPhaseId}: template missing vars [${rendered.missing_variables.join(', ')}]`);
        }

        callsByRoot.set(entry.rootEntityId, (callsByRoot.get(entry.rootEntityId) ?? 0) + 1);
        const result = await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: workflowRun.id,
            phaseId: '5',
            subPhaseId: config.recordSubPhaseId,
            agentRole: 'technical_spec_agent',
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
          const validCats: DataModelAssumptionEntry['category'][] = [
            'identity', 'ownership', 'cardinality', 'lifecycle',
            'consistency', 'storage_choice', 'open_question',
          ];
          const category = (validCats as string[]).includes(cat)
            ? cat as DataModelAssumptionEntry['category'] : 'open_question';
          const citations = Array.isArray(a.citations)
            ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
          const assumption: DataModelAssumptionEntry = {
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
        const emittedChildren: DecompositionEntity[] = [];
        const emittedChildrenWithTier: Array<{ entity: DecompositionEntity; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
        const siblingDisplayKeys = new Set<string>();
        let fanoutCount = 0;
        for (const c of childrenRaw) {
          if (++fanoutCount > caps.data_model_fanout_cap) break;
          const child = sanitizeChildEntity(c, { rootId: entry.displayKey, childIndex: fanoutCount }, techIdOracle, input.technicalConstraints);
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
          const enrichedChild: DecompositionEntity = { ...child, active_constraints: childActiveConstraints };

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
              pass_number: passNumber,
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
          emittedChildrenWithTier.push({ entity: enrichedChild, tier, logicalNodeId, displayKey });
          parentChain.set(logicalNodeId, entry.nodeId);

          if (tier === 'A') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootEntityId: entry.rootEntityId, depth: childDepth, entity: enrichedChild,
              displayKey, tierHint: 'A',
              releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              activeConstraints: childActiveConstraints,
            });
          } else if (tier === 'B') {
            const batch = pendingGateByParent.get(entry.nodeId) ?? [];
            batch.push({ nodeRecordId: childRec.id, logicalNodeId, displayKey, entity: enrichedChild, rationale });
            pendingGateByParent.set(entry.nodeId, batch);
          } else if (tier === 'C') {
            queue.push({
              parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
              rootEntityId: entry.rootEntityId, depth: childDepth, entity: enrichedChild,
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
              downgradeNotesByParent.set(
                entry.nodeId,
                `The entity '${entry.displayKey}' you accepted earlier turned out to ` +
                `have its own commitment layer underneath. The entities below need your review.`,
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
              pass_number: passNumber,
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
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking deferred`, {
          nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
        });
        writeDeferredSupersession(ctx, entry, passNumber, `decomposition_failed: ${reason}`, config);
      }
    }

    const nodesProducedThisPass = engine.writer.getRecordsByType(
      workflowRun.id, 'data_model_decomposition_node',
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
      record_type: 'data_model_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '5',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [pipelineStartRecord.id],
      content: {
        kind: 'data_model_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_entity_id: '*',
        passes: [...pipelinePasses],
      } satisfies DataModelDecompositionPipelineContent,
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
        pass_number: passNumber,
        root_entity_id: '*',
        assumptions: [...allAssumptions],
        delta_from_previous_pass: passAssumptions.length,
        semantic_delta: semanticDelta,
      } satisfies DataModelAssumptionSetSnapshotContent,
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
  else if (maxRootCalls >= caps.data_model_budget_cap) terminationReason = 'budget_cap';
  else if (maxDepthReached >= caps.data_model_depth_cap) terminationReason = 'depth_cap';
  else if (dedupOfflineAnnounced) terminationReason = 'dedup_offline';
  else terminationReason = 'fixed_point';

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'data_model_decomposition_node');
  const tierDistribution: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 };
  let atomicLeafCount = 0;
  for (const n of finalNodes) {
    const c = n.content as unknown as DataModelDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }

  const finalRec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '5',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [pipelineStartRecord.id],
    content: {
      kind: 'data_model_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_entity_id: '*',
      passes: pipelinePasses.map((p, i) =>
        i === pipelinePasses.length - 1 ? { ...p, termination_reason: terminationReason } : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies DataModelDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(currentPipelineRecordId, finalRec.id);

  try {
    engine.db.prepare(`
      UPDATE workflow_runs
      SET data_model_decomposition_budget_calls_used = ?,
          data_model_decomposition_max_depth_reached = MAX(data_model_decomposition_max_depth_reached, ?),
          active_data_model_pipeline_id = ?
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
