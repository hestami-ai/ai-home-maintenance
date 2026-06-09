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
 * Build the lineage resolver from the run's governed-stream records.
 * Reads system_requirements, non_functional_requirements, and the FR
 * requirement_decomposition_node tree (for leaf→root canonicalization).
 */
export function buildRequirementLineage(records: GovernedStreamRecord[]): RequirementLineage {
  // SR → its source US/NFR ids.
  const srToSources = new Map<string, string[]>();
  // NFR → the US ids it applies to.
  const nfrApplies = new Map<string, string[]>();

  // Decomposition tree for leaf→root canonicalization.
  const byDisplayKey = new Map<string, DecompNode>();
  const byNodeId = new Map<string, DecompNode>();
  // Leaf acceptance-criterion id → its owning leaf user-story id. Built
  // structurally from the decomposition leaves (no AC-id string parsing).
  const acToStory = new Map<string, string>();

  for (const r of records) {
    if (r.record_type === 'artifact_produced') {
      const c = r.content as Record<string, unknown>;
      if (c.kind === 'system_requirements' && Array.isArray(c.items)) {
        for (const it of c.items as Array<Record<string, unknown>>) {
          const id = typeof it.id === 'string' ? it.id : '';
          const src = Array.isArray(it.source_requirement_ids)
            ? (it.source_requirement_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
          if (id) srToSources.set(id, src);
        }
      } else if (c.kind === 'non_functional_requirements' && Array.isArray(c.requirements)) {
        for (const n of c.requirements as Array<Record<string, unknown>>) {
          const id = typeof n.id === 'string' ? n.id : '';
          const applies = Array.isArray(n.applies_to_requirements)
            ? (n.applies_to_requirements as unknown[]).filter((x): x is string => typeof x === 'string') : [];
          if (id) nfrApplies.set(id, applies);
        }
      }
    } else if (r.record_type === 'requirement_decomposition_node') {
      const c = r.content as unknown as DecompNode;
      if (c.display_key) byDisplayKey.set(c.display_key, c);
      if (c.node_id) byNodeId.set(c.node_id, c);
      // Map each leaf AC id → its owning leaf user-story id (structural).
      const story = (r.content as Record<string, unknown>).user_story as Record<string, unknown> | undefined;
      const storyId = story && typeof story.id === 'string' ? story.id : undefined;
      const acs = story && Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [];
      if (storyId) {
        for (const ac of acs as Array<Record<string, unknown>>) {
          if (ac && typeof ac.id === 'string' && ac.id.length > 0) acToStory.set(ac.id, storyId);
        }
      }
    }
  }

  /** Walk parent_node_id to the depth-0 root's display_key. */
  function canonicalize(id: string): string {
    const node = byDisplayKey.get(id);
    if (!node) return id;
    if (node.depth === 0) return node.display_key ?? id;
    let cur: DecompNode | undefined = node;
    const guard = new Set<string>();
    while (cur && cur.parent_node_id && !guard.has(cur.parent_node_id)) {
      guard.add(cur.parent_node_id);
      const next = byNodeId.get(cur.parent_node_id);
      if (!next) break;
      cur = next;
      if (cur.depth === 0) return cur.display_key ?? id;
    }
    return cur?.display_key ?? id;
  }

  function classify(id: string, usIds: Set<string>, nfrIds: Set<string>): void {
    const c = canonicalize(id);
    if (c.startsWith(US_PREFIX)) usIds.add(c);
    else if (c.startsWith(NFR_PREFIX)) {
      nfrIds.add(c);
      // An NFR also implies the user stories it governs.
      for (const us of nfrApplies.get(c) ?? nfrApplies.get(id) ?? []) classify(us, usIds, nfrIds);
    }
  }

  function resolveTraces(traces: Iterable<string>): { usIds: Set<string>; nfrIds: Set<string> } {
    const usIds = new Set<string>();
    const nfrIds = new Set<string>();
    for (const raw of traces) {
      const t = canonicalize(raw);
      if (t.startsWith(SR_PREFIX)) {
        // SR → its source US/NFR ids (one hop).
        for (const src of srToSources.get(t) ?? srToSources.get(raw) ?? []) classify(src, usIds, nfrIds);
      } else {
        classify(t, usIds, nfrIds);
      }
    }
    return { usIds, nfrIds };
  }

  function resolveAcs(acIds: Iterable<string>): { storyIds: Set<string> } {
    const storyIds = new Set<string>();
    for (const ac of acIds) {
      const story = acToStory.get(ac);
      if (story) storyIds.add(story);
    }
    return { storyIds };
  }

  return { resolveTraces, canonicalize, resolveAcs };
}
