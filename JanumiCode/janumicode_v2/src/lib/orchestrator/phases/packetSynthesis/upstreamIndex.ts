/**
 * Upstream-id indexer for packet synthesis (Phase 8 → 9 boundary).
 *
 * Walks every Phase 1–8 artifact in a workflow run and produces:
 *   - allUpstreamIds: every id ever produced by any phase
 *   - aiProposedIds:  subset where source === 'ai-proposed' (Phase 1 only;
 *                     Phase 2+ artifacts don't carry a `source` field)
 *   - userSpecifiedIds: subset where source === 'user-specified'
 *   - artifactsById:  id → artifact lookup, used by the packet builder
 *                     when it needs to copy full artifact content into a
 *                     packet (e.g. resolve a TECH-* id to the full
 *                     technical_constraint shape).
 *
 * Layered into two functions:
 *   1. `indexArtifacts(items)` — pure indexer over an array of
 *      `{kind, sub_phase_id, content}` records. No DB. Unit-testable.
 *   2. (TODO step 4 wiring) — a DB walker that produces the input array
 *      from a runId, then calls `indexArtifacts`.
 *
 * See docs/design/implementation-packet-synthesis.md §3.
 */

import { ALL_ID_SPECS } from './artifactIdSpec';

export interface UpstreamArtifactInput {
  /** Sub-phase id from governed_stream (e.g. 'business_domains_bloom'). */
  sub_phase_id: string;
  /** Parsed JSON content payload. */
  content: Record<string, unknown>;
}

export interface UpstreamIndex {
  /** Every id produced anywhere upstream. */
  allUpstreamIds: Set<string>;
  /** Ids where the producing item carried source === 'ai-proposed'. */
  aiProposedIds: Set<string>;
  /** Ids where the producing item carried source === 'user-specified'. */
  userSpecifiedIds: Set<string>;
  /**
   * Lookup of id → the artifact object that contains it.
   * Used by the packet builder to copy full content (e.g. resolve a
   * TECH-* id back to the full TechnicalConstraint shape).
   */
  artifactsById: Map<string, unknown>;
}

interface ExtractionRule {
  /** Path within the content to find the array of items carrying ids. */
  arrayKey: string;
  /** Field name within each item that holds the id. */
  idField: string;
  /** Position-indexed synthetic id (for bare-string arrays like QA). */
  syntheticId?: (item: unknown, index: number) => string | null;
  /** One level of sub-array nesting (e.g. user_stories[].acceptance_criteria[]). */
  nested?: ExtractionRule[];
}

/**
 * Per sub-phase extraction rules, DERIVED from the single source of truth
 * (ARTIFACT_ID_SPECS). The index and the packet collectors now read the same
 * keys, so they cannot drift (the bug that produced the false-P7 flood).
 * Extend the pipeline by adding to artifactIdSpec.ts — not here.
 */
const EXTRACTION_RULES: Record<string, ExtractionRule[]> = (() => {
  const rules: Record<string, ExtractionRule[]> = {};
  for (const spec of ALL_ID_SPECS) {
    const rule: ExtractionRule = {
      arrayKey: spec.arrayKey,
      idField: spec.idField ?? '__none__',
      ...(spec.nested ? { nested: [{ arrayKey: spec.nested.arrayKey, idField: spec.nested.idField }] } : {}),
      ...(spec.syntheticIdPrefix ? { syntheticId: (_i: unknown, i: number) => `${spec.syntheticIdPrefix}${i + 1}` } : {}),
    };
    (rules[spec.subPhaseId] ??= []).push(rule);
  }
  return rules;
})();

/**
 * Walk one content blob, applying the rules registered for its
 * sub_phase_id. Returns the (id, item, source) triples extracted.
 */
function extractFromArtifact(
  subPhaseId: string,
  content: Record<string, unknown>,
): Array<{ id: string; item: unknown; source: string | undefined }> {
  const rules = EXTRACTION_RULES[subPhaseId];
  if (!rules) return [];
  const out: Array<{ id: string; item: unknown; source: string | undefined }> = [];

  function walk(rule: ExtractionRule, parent: Record<string, unknown>): void {
    const arr = parent[rule.arrayKey];
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const raw = arr[i];
      let id: string | undefined;
      let item: unknown = raw;
      if (rule.syntheticId) {
        const synth = rule.syntheticId(raw, i);
        if (synth) id = synth;
      } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        const candidate = obj[rule.idField];
        if (typeof candidate === 'string' && candidate.length > 0) id = candidate;
      }
      if (id) {
        const src =
          raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).source === 'string'
            ? ((raw as Record<string, unknown>).source as string)
            : undefined;
        out.push({ id, item, source: src });
      }
      // Recurse into nested rules even when the outer item has no id —
      // a malformed parent shouldn't hide a valid child id.
      if (rule.nested && raw && typeof raw === 'object') {
        for (const sub of rule.nested) walk(sub, raw as Record<string, unknown>);
      }
    }
  }

  for (const r of rules) walk(r, content);
  return out;
}

/**
 * Indexer for saturation-tree node records (component_decomposition_node,
 * data_model_decomposition_node, task_decomposition_node,
 * test_decomposition_node). These don't fit the EXTRACTION_RULES pattern
 * because the id lives at `content.<entity>.id`, not at a top-level
 * array path. Handled separately.
 *
 * The indexer also picks up the node_id itself (UUID) so a packet
 * referencing a specific node by UUID can validate.
 */
function extractFromSaturationNode(
  nodeRecordType: string,
  content: Record<string, unknown>,
): string[] {
  const ids: string[] = [];
  const nodeId = content.node_id;
  if (typeof nodeId === 'string' && nodeId.length > 0) ids.push(nodeId);

  // FR/NFR-saturation leaves: the decomposed user story lives at
  // content.user_story with its OWN leaf id (e.g. US-002-D1) and composite
  // acceptance-criterion ids (AC-US-002-D1-001). Index both the leaf story id
  // and every leaf AC id — Phase 7/8 trace to these, and the canonical roots
  // alone (US-002 / AC-US002-001) leave every leaf reference flagged as a
  // false P7_INVENTED_ID_REFERENCE.
  if (nodeRecordType === 'requirement_decomposition_node') {
    const story = content.user_story;
    if (story && typeof story === 'object') {
      const s = story as Record<string, unknown>;
      if (typeof s.id === 'string' && s.id.length > 0) ids.push(s.id);
      const acs = s.acceptance_criteria;
      if (Array.isArray(acs)) {
        for (const ac of acs) {
          if (ac && typeof ac === 'object') {
            const acId = (ac as Record<string, unknown>).id;
            if (typeof acId === 'string' && acId.length > 0) ids.push(acId);
          }
        }
      }
    }
    return ids;
  }

  let entityKey: 'component' | 'entity' | 'task' | 'test_case' | null;
  if (nodeRecordType === 'component_decomposition_node') entityKey = 'component';
  else if (nodeRecordType === 'data_model_decomposition_node') entityKey = 'entity';
  else if (nodeRecordType === 'task_decomposition_node') entityKey = 'task';
  else if (nodeRecordType === 'test_decomposition_node') entityKey = 'test_case';
  else entityKey = null;
  if (!entityKey) return ids;
  const entity = content[entityKey];
  if (entity && typeof entity === 'object') {
    const idField = entityKey === 'test_case' ? 'test_case_id' : 'id';
    const candidate = (entity as Record<string, unknown>)[idField];
    if (typeof candidate === 'string' && candidate.length > 0) ids.push(candidate);
  }
  return ids;
}

export interface IndexInput {
  /** `artifact_produced` records, parsed and grouped by sub_phase_id. */
  artifacts: UpstreamArtifactInput[];
  /**
   * Saturation node records keyed by their governed_stream record_type
   * (e.g. 'task_decomposition_node'). Each entry is the parsed content.
   */
  saturationNodes?: Array<{ recordType: string; content: Record<string, unknown> }>;
}

/**
 * Pure indexer. Given a snapshot of upstream artifacts + saturation
 * nodes, returns the index. No DB; no async; deterministic.
 */
export function indexArtifacts(input: IndexInput): UpstreamIndex {
  const allUpstreamIds = new Set<string>();
  const aiProposedIds = new Set<string>();
  const userSpecifiedIds = new Set<string>();
  const artifactsById = new Map<string, unknown>();

  for (const a of input.artifacts) {
    const extracted = extractFromArtifact(a.sub_phase_id, a.content);
    for (const { id, item, source } of extracted) {
      allUpstreamIds.add(id);
      if (source === 'ai-proposed') aiProposedIds.add(id);
      else if (source === 'user-specified') userSpecifiedIds.add(id);
      // First writer wins for the artifacts map — preserves the original
      // (skeleton) item over any later supersession revisions in the
      // caller's input order.
      if (!artifactsById.has(id)) artifactsById.set(id, item);
    }
  }

  for (const node of input.saturationNodes ?? []) {
    const ids = extractFromSaturationNode(node.recordType, node.content);
    for (const id of ids) {
      allUpstreamIds.add(id);
      // Saturation entity (the full task/component/etc.) — preserve
      // first-seen.
      if (!artifactsById.has(id)) {
        // For saturation, the underlying entity is the most useful copy.
        let entityKey:
          | 'component'
          | 'data_model'
          | 'task'
          | 'test_case'
          | 'user_story'
          | null;
        if (node.recordType === 'component_decomposition_node') entityKey = 'component';
        else if (node.recordType === 'data_model_decomposition_node') entityKey = 'data_model';
        else if (node.recordType === 'task_decomposition_node') entityKey = 'task';
        else if (node.recordType === 'test_decomposition_node') entityKey = 'test_case';
        else if (node.recordType === 'requirement_decomposition_node') entityKey = 'user_story';
        else entityKey = null;
        const entity = entityKey ? node.content[entityKey] : node.content;
        artifactsById.set(id, entity ?? node.content);
      }
    }
  }

  return { allUpstreamIds, aiProposedIds, userSpecifiedIds, artifactsById };
}
