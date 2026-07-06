/**
 * Decomposition Viewer — realization loader (unified drill-down).
 *
 * Loads the downstream decomposition families (component / data_model / task /
 * test) and pre-joins each node to the requirement spine so the webview can
 * render US → leaf-AC → {component · task · data-model}. All id resolution goes
 * through the authoritative, regex-free {@link buildRequirementLineage}
 * (`resolveAcs`, `canonicalize`, `resolveTraces`) — the same engine Phase 6 uses
 * for task→leaf-AC binding — so the viewer matches the pipeline, not a
 * re-implementation. Referenced ids that resolve to nothing are surfaced as
 * drift, never fabricated into edges.
 */

import type { Database } from '../database/init';
import { collectGovernedStream } from '../database/iterateGovernedStream';
import { buildRequirementLineage, type RequirementLineage } from '../orchestrator/phases/packetSynthesis/idResolution';
import type { GovernedStreamRecord } from '../types/records';
import type {
  DecompLayer,
  ViewerRealizationDrift,
  ViewerRealizationNode,
  ViewerStatus,
  ViewerTier,
} from './types';

const AC_PREFIX = 'AC-';

interface DecompRow { id: string; c: Record<string, unknown>; produced_at: string; }

const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function loadRows(db: Database, workflowRunId: string, recordType: string): DecompRow[] {
  const stmt = db.prepare(
    `SELECT id, content, produced_at FROM governed_stream
      WHERE record_type = ? AND is_current_version = 1 AND workflow_run_id = ?
      ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
  );
  return collectGovernedStream<{ id: string; content: string; produced_at: string }>(
    stmt, [recordType, workflowRunId], { pageSize: 500 },
  ).map((r) => {
    try { return { id: r.id, c: JSON.parse(r.content) as Record<string, unknown>, produced_at: r.produced_at }; }
    catch { return { id: r.id, c: {}, produced_at: r.produced_at }; }
  });
}

/** Resolves realization-node cross-references to the requirement spine, tracking drift. */
class Resolver {
  readonly unresolvedAc = new Set<string>();
  readonly unresolvedComp = new Set<string>();

  constructor(
    private readonly lineage: RequirementLineage,
    private readonly validAcs: Set<string>,
    private readonly componentKeys: Set<string>,
  ) {}

  /** Resolve a component_id to a component-node key (any depth); null + drift otherwise. */
  component(id: unknown): string | null {
    if (typeof id !== 'string' || !id) return null;
    if (this.componentKeys.has(id)) return id;
    this.unresolvedComp.add(id);
    return null;
  }

  /** Requirement roots (US + NFR) this node serves, from raw traces + AC refs. */
  servesUs(traces: string[]): string[] {
    const acRefs = traces.filter((t) => t.startsWith(AC_PREFIX));
    const nonAc = traces.filter((t) => !t.startsWith(AC_PREFIX));
    const { usIds, nfrIds } = this.lineage.resolveTraces(nonAc);
    for (const story of this.lineage.resolveAcs(acRefs).storyIds) usIds.add(this.lineage.canonicalize(story));
    return [...new Set([...usIds, ...nfrIds])];
  }

  /** Keep only AC refs that name a real requirement leaf; the rest are drift. */
  validRealizes(acRefs: string[]): string[] {
    const keep: string[] = [];
    for (const ac of acRefs) {
      if (this.validAcs.has(ac)) keep.push(ac);
      else if (ac.startsWith(AC_PREFIX)) this.unresolvedAc.add(ac);
    }
    return keep;
  }
}

function baseNode(r: DecompRow, layer: DecompLayer, rootField: string, title: string): ViewerRealizationNode {
  return {
    record_id: r.id,
    node_id: str(r.c.node_id, r.id),
    layer,
    display_key: str(r.c.display_key),
    title,
    status: (r.c.status as ViewerStatus) ?? 'pending',
    tier: (r.c.tier as ViewerTier) ?? null,
    depth: typeof r.c.depth === 'number' ? r.c.depth : 0,
    parent_node_id: (r.c.parent_node_id as string | null) ?? null,
    root_id: str(r.c[rootField]),
    release_id: (r.c.release_id as string | null) ?? null,
    release_ordinal: typeof r.c.release_ordinal === 'number' ? r.c.release_ordinal : null,
    component_key: null,
    realizes_ac_ids: [],
    serves_us_ids: [],
    produced_at: r.produced_at,
  };
}

function buildComponents(rows: DecompRow[]): ViewerRealizationNode[] {
  return rows.map((r) => {
    const comp = (r.c.component ?? {}) as Record<string, unknown>;
    return baseNode(r, 'component', 'root_component_id', str(comp.name, str(r.c.display_key)));
  });
}

function buildTasks(rows: DecompRow[], res: Resolver): ViewerRealizationNode[] {
  return rows.map((r) => {
    const task = (r.c.task ?? {}) as Record<string, unknown>;
    const verifies = (Array.isArray(task.completion_criteria) ? task.completion_criteria : [])
      .flatMap((cc) => asStrArr((cc as Record<string, unknown>)?.verifies_acceptance_criteria));
    const acRefs = [...new Set([...asStrArr(task.traces_to).filter((t) => t.startsWith(AC_PREFIX)), ...verifies])];
    const n = baseNode(r, 'task', 'root_task_id', str(task.name, str(r.c.display_key)));
    n.component_key = res.component(task.component_id);
    n.realizes_ac_ids = res.validRealizes(acRefs);
    n.serves_us_ids = res.servesUs([...asStrArr(task.traces_to), ...verifies]);
    return n;
  });
}

function buildDataModels(rows: DecompRow[], res: Resolver): ViewerRealizationNode[] {
  return rows.map((r) => {
    const entity = (r.c.entity ?? {}) as Record<string, unknown>;
    const n = baseNode(r, 'data_model', 'root_entity_id', str(entity.name, str(r.c.display_key)));
    n.component_key = res.component(entity.component_id);
    n.serves_us_ids = res.servesUs(asStrArr(entity.traces_to));
    n.entity_kind = typeof entity.kind === 'string' ? entity.kind : undefined;
    return n;
  });
}

function buildTests(rows: DecompRow[], res: Resolver): ViewerRealizationNode[] {
  return rows.map((r) => {
    const tc = (r.c.test_case ?? {}) as Record<string, unknown>;
    const acRefs = asStrArr(tc.acceptance_criterion_ids);
    const n = baseNode(r, 'test', 'root_test_id', str(tc.name, str(r.c.display_key)));
    n.component_key = res.component(asStrArr(tc.component_ids)[0]);
    n.realizes_ac_ids = res.validRealizes(acRefs);
    n.serves_us_ids = res.servesUs([...acRefs, ...asStrArr(tc.traces_to)]);
    return n;
  });
}

/** Build the realization node set + drift for a run (loads its own inputs). */
export function loadRealization(
  db: Database,
  workflowRunId: string,
): { nodes: ViewerRealizationNode[]; drift: ViewerRealizationDrift } {
  // Lineage resolver reads the requirement tree + SR + NFR artifacts.
  const reqRows = loadRows(db, workflowRunId, 'requirement_decomposition_node');
  const artifactRows = db
    .prepare(
      `SELECT content FROM governed_stream
        WHERE record_type = 'artifact_produced' AND is_current_version = 1 AND workflow_run_id = ?
          AND json_extract(content, '$.kind') IN ('system_requirements','non_functional_requirements')`,
    )
    .all(workflowRunId) as Array<{ content: string }>;
  const lineageRecords = [
    ...reqRows.map((r) => ({ record_type: 'requirement_decomposition_node', content: r.c })),
    ...artifactRows.map((r) => {
      try { return { record_type: 'artifact_produced', content: JSON.parse(r.content) }; }
      catch { return { record_type: 'artifact_produced', content: {} }; }
    }),
  ] as unknown as GovernedStreamRecord[];
  const lineage = buildRequirementLineage(lineageRecords);

  // Authoritative leaf-AC inventory (acceptance_criteria[].id on leaves).
  const validAcs = new Set<string>();
  for (const r of reqRows) {
    const story = (r.c.user_story ?? {}) as Record<string, unknown>;
    for (const ac of asRecordArray(story.acceptance_criteria)) {
      if (typeof ac.id === 'string') validAcs.add(ac.id);
    }
  }

  // Component key set (display_key ∪ component.id at all depths).
  const componentRows = loadRows(db, workflowRunId, 'component_decomposition_node');
  const componentKeys = new Set<string>();
  for (const r of componentRows) {
    if (typeof r.c.display_key === 'string') componentKeys.add(r.c.display_key);
    const comp = (r.c.component ?? {}) as Record<string, unknown>;
    if (typeof comp.id === 'string') componentKeys.add(comp.id);
  }

  const res = new Resolver(lineage, validAcs, componentKeys);
  const nodes = [
    ...buildComponents(componentRows),
    ...buildTasks(loadRows(db, workflowRunId, 'task_decomposition_node'), res),
    ...buildDataModels(loadRows(db, workflowRunId, 'data_model_decomposition_node'), res),
    ...buildTests(loadRows(db, workflowRunId, 'test_decomposition_node'), res),
  ];

  return {
    nodes,
    drift: { unresolved_ac_ids: [...res.unresolvedAc], unresolved_component_ids: [...res.unresolvedComp] },
  };
}

function asRecordArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}
