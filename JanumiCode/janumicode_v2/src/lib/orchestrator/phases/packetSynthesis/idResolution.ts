/**
 * Cross-phase requirement-id resolution bridge (Pillar C).
 *
 * Phase 6 tasks trace `SR-*`/`NFR-*` ids (system requirements / NFRs), but the
 * packet needs the `US-*` user stories + `NFR-*` ids each task ultimately
 * serves. The lineage is deterministic and enforced upstream:
 *   - Phase 3 `system_requirements.items[].source_requirement_ids` : SR → {US, NFR}
 *     (the Phase 3.2 prompt + a deterministic consistency check guarantee every
 *      FR/NFR id appears in at least one SR's source list)
 *   - Phase 2 `non_functional_requirements` NFR.applies_to_requirements : NFR → US
 *   - `requirement_decomposition_node` tree : leaf id (US-004-D1) → root (US-004)
 *
 * This resolver walks that lineage so a task's traces resolve to canonical
 * US/NFR ids. Pure id-graph traversal (no keywords, no heuristics) — the same
 * logic that already works in the UI's `buildSatisfiedByMap`, lifted into the
 * execution path. It becomes the PRIMARY task→US/NFR join in the packet builder
 * (the prior component/composite-AC passes remain as fallback).
 */

import type { GovernedStreamRecord } from '../../../types/records';

const US_PREFIX = 'US-';
const NFR_PREFIX = 'NFR-';
const SR_PREFIX = 'SR-';

export interface RequirementLineage {
  /** Resolve task traces (SR-/NFR-/US-/leaf ids) to canonical US + NFR ids. */
  resolveTraces(traces: Iterable<string>): { usIds: Set<string>; nfrIds: Set<string> };
  /** Canonicalize a single id to its decomposition root. */
  canonicalize(id: string): string;
  /**
   * Resolve leaf acceptance-criterion ids to the leaf user stories that own
   * them, via a STRUCTURAL map built from the decomposition leaves
   * (`user_story.acceptance_criteria[].id → user_story.id`) — never by parsing
   * the AC id string. Unknown ids are ignored. This is the task→leaf-AC→story
   * join: a Phase-6 task citing its leaf ACs in `traces_to` resolves to exactly
   * the leaf stories it implements.
   */
  resolveAcs(acIds: Iterable<string>): { storyIds: Set<string> };
}

interface DecompNode {
  node_id?: string;
  parent_node_id?: string | null;
  display_key?: string;
  depth?: number;
}

/**
 * The deterministic id-lineage maps extracted from a run's governed-stream
 * records. Populated once by {@link collectLineageMaps}; every resolver helper
 * reads (and only reads) from this bag.
 */
interface LineageMaps {
  /** SR id → its source US/NFR ids. */
  srToSources: Map<string, string[]>;
  /** NFR id → the US ids it applies to. */
  nfrApplies: Map<string, string[]>;
  /** Decomposition node display_key → node (for leaf→root canonicalization). */
  byDisplayKey: Map<string, DecompNode>;
  /** Decomposition node_id → node (parent walk). */
  byNodeId: Map<string, DecompNode>;
  /** Leaf acceptance-criterion id → its owning leaf user-story id. */
  acToStory: Map<string, string>;
}

/** Coerce an unknown value to the array of strings it contains (else `[]`). */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? (value as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
}

/** Ingest a `system_requirements` artifact: SR id → source_requirement_ids. */
function ingestSystemRequirements(
  content: Record<string, unknown>,
  srToSources: Map<string, string[]>,
): void {
  if (!Array.isArray(content.items)) return;
  for (const it of content.items as Array<Record<string, unknown>>) {
    const id = typeof it.id === 'string' ? it.id : '';
    if (id) srToSources.set(id, toStringArray(it.source_requirement_ids));
  }
}

/** Ingest a `non_functional_requirements` artifact: NFR id → applies_to US ids. */
function ingestNonFunctionalRequirements(
  content: Record<string, unknown>,
  nfrApplies: Map<string, string[]>,
): void {
  if (!Array.isArray(content.requirements)) return;
  for (const n of content.requirements as Array<Record<string, unknown>>) {
    const id = typeof n.id === 'string' ? n.id : '';
    if (id) nfrApplies.set(id, toStringArray(n.applies_to_requirements));
  }
}

/** Dispatch an `artifact_produced` record to the matching kind ingester. */
function ingestArtifactProduced(
  record: GovernedStreamRecord,
  srToSources: Map<string, string[]>,
  nfrApplies: Map<string, string[]>,
): void {
  const c = record.content as Record<string, unknown>;
  if (c.kind === 'system_requirements') {
    ingestSystemRequirements(c, srToSources);
  } else if (c.kind === 'non_functional_requirements') {
    ingestNonFunctionalRequirements(c, nfrApplies);
  }
}

/**
 * Map each leaf AC id → its owning leaf user-story id (structural, no AC-id
 * string parsing). No-op when the node carries no user_story/story id.
 */
function indexLeafAcsToStory(
  record: GovernedStreamRecord,
  acToStory: Map<string, string>,
): void {
  const story = (record.content as Record<string, unknown>).user_story as
    | Record<string, unknown>
    | undefined;
  const storyId = story && typeof story.id === 'string' ? story.id : undefined;
  if (!story || !storyId) return;
  const acs = Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [];
  for (const ac of acs as Array<Record<string, unknown>>) {
    if (ac && typeof ac.id === 'string' && ac.id.length > 0) acToStory.set(ac.id, storyId);
  }
}

/** Ingest a `requirement_decomposition_node` record into the tree + AC maps. */
function ingestDecompositionNode(
  record: GovernedStreamRecord,
  byDisplayKey: Map<string, DecompNode>,
  byNodeId: Map<string, DecompNode>,
  acToStory: Map<string, string>,
): void {
  const c = record.content as unknown as DecompNode;
  if (c.display_key) byDisplayKey.set(c.display_key, c);
  if (c.node_id) byNodeId.set(c.node_id, c);
  indexLeafAcsToStory(record, acToStory);
}

/** Build all lineage maps in one pass over the governed-stream records. */
function collectLineageMaps(records: GovernedStreamRecord[]): LineageMaps {
  const maps: LineageMaps = {
    srToSources: new Map<string, string[]>(),
    nfrApplies: new Map<string, string[]>(),
    byDisplayKey: new Map<string, DecompNode>(),
    byNodeId: new Map<string, DecompNode>(),
    acToStory: new Map<string, string>(),
  };
  for (const r of records) {
    if (r.record_type === 'artifact_produced') {
      ingestArtifactProduced(r, maps.srToSources, maps.nfrApplies);
    } else if (r.record_type === 'requirement_decomposition_node') {
      ingestDecompositionNode(r, maps.byDisplayKey, maps.byNodeId, maps.acToStory);
    }
  }
  return maps;
}

/** Walk parent_node_id to the depth-0 root's display_key. */
function canonicalizeId(
  id: string,
  byDisplayKey: Map<string, DecompNode>,
  byNodeId: Map<string, DecompNode>,
): string {
  const node = byDisplayKey.get(id);
  if (!node) return id;
  if (node.depth === 0) return node.display_key ?? id;
  let cur: DecompNode | undefined = node;
  const guard = new Set<string>();
  while (cur?.parent_node_id && !guard.has(cur.parent_node_id)) {
    guard.add(cur.parent_node_id);
    const next = byNodeId.get(cur.parent_node_id);
    if (!next) break;
    cur = next;
    if (cur.depth === 0) return cur.display_key ?? id;
  }
  return cur?.display_key ?? id;
}

/**
 * Classify a single id into the US/NFR sets by its canonical prefix. An NFR
 * also implies (recursively) the user stories it governs.
 */
function classifyId(
  id: string,
  usIds: Set<string>,
  nfrIds: Set<string>,
  maps: LineageMaps,
): void {
  const c = canonicalizeId(id, maps.byDisplayKey, maps.byNodeId);
  if (c.startsWith(US_PREFIX)) {
    usIds.add(c);
    return;
  }
  if (!c.startsWith(NFR_PREFIX)) return;
  nfrIds.add(c);
  for (const us of maps.nfrApplies.get(c) ?? maps.nfrApplies.get(id) ?? []) {
    classifyId(us, usIds, nfrIds, maps);
  }
}

/** Resolve task traces (SR-/NFR-/US-/leaf ids) to canonical US + NFR ids. */
function resolveTracesFrom(
  traces: Iterable<string>,
  maps: LineageMaps,
): { usIds: Set<string>; nfrIds: Set<string> } {
  const usIds = new Set<string>();
  const nfrIds = new Set<string>();
  for (const raw of traces) {
    const t = canonicalizeId(raw, maps.byDisplayKey, maps.byNodeId);
    if (t.startsWith(SR_PREFIX)) {
      // SR → its source US/NFR ids (one hop).
      for (const src of maps.srToSources.get(t) ?? maps.srToSources.get(raw) ?? []) {
        classifyId(src, usIds, nfrIds, maps);
      }
    } else {
      classifyId(t, usIds, nfrIds, maps);
    }
  }
  return { usIds, nfrIds };
}

/** Resolve leaf AC ids to their owning leaf user-story ids (unknown ignored). */
function resolveAcsFrom(
  acIds: Iterable<string>,
  acToStory: Map<string, string>,
): { storyIds: Set<string> } {
  const storyIds = new Set<string>();
  for (const ac of acIds) {
    const story = acToStory.get(ac);
    if (story) storyIds.add(story);
  }
  return { storyIds };
}

/**
 * Build the lineage resolver from the run's governed-stream records.
 * Reads system_requirements, non_functional_requirements, and the FR
 * requirement_decomposition_node tree (for leaf→root canonicalization).
 */
export function buildRequirementLineage(records: GovernedStreamRecord[]): RequirementLineage {
  const maps = collectLineageMaps(records);
  return {
    resolveTraces: (traces) => resolveTracesFrom(traces, maps),
    canonicalize: (id) => canonicalizeId(id, maps.byDisplayKey, maps.byNodeId),
    resolveAcs: (acIds) => resolveAcsFrom(acIds, maps.acToStory),
  };
}
