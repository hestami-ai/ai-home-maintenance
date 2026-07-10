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

/** (id, item, source) triple emitted by the artifact extractor. */
type ExtractedTriple = { id: string; item: unknown; source: string | undefined };

/**
 * Resolve the id for one array element under a rule: either the synthetic
 * position id, or the object's `idField`. Returns undefined when no valid id is
 * present. Mirrors the original syntheticId-else-object-id precedence exactly —
 * a rule with a syntheticId never falls through to the object-id path.
 */
function resolveRuleItemId(rule: ExtractionRule, raw: unknown, index: number): string | undefined {
  if (rule.syntheticId) {
    const synth = rule.syntheticId(raw, index);
    if (synth) return synth;
    return undefined;
  }
  if (raw && typeof raw === 'object') {
    const candidate = (raw as Record<string, unknown>)[rule.idField];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
}

/** Pull the `source` string off an item, or undefined when absent/non-string. */
function extractSource(raw: unknown): string | undefined {
  if (raw && typeof raw === 'object') {
    const source = (raw as Record<string, unknown>).source;
    if (typeof source === 'string') return source;
  }
  return undefined;
}

/**
 * Walk one array under `rule`, appending extracted triples to `out`, then
 * recurse into nested rules — even when the outer item has no id, so a
 * malformed parent can't hide a valid child id.
 */
function walkExtractionRule(
  rule: ExtractionRule,
  parent: Record<string, unknown>,
  out: ExtractedTriple[],
): void {
  const arr = parent[rule.arrayKey];
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    const raw = arr[i];
    const id = resolveRuleItemId(rule, raw, i);
    if (id) out.push({ id, item: raw, source: extractSource(raw) });
    if (rule.nested && raw && typeof raw === 'object') {
      for (const sub of rule.nested) walkExtractionRule(sub, raw as Record<string, unknown>, out);
    }
  }
}

/**
 * Walk one content blob, applying the rules registered for its
 * sub_phase_id. Returns the (id, item, source) triples extracted.
 */
function extractFromArtifact(subPhaseId: string, content: Record<string, unknown>): ExtractedTriple[] {
  const rules = EXTRACTION_RULES[subPhaseId];
  if (!rules) return [];
  const out: ExtractedTriple[] = [];
  for (const r of rules) walkExtractionRule(r, content, out);
  return out;
}

/**
 * Record-type → the content key whose `.id` (or `.test_case_id`) is the leaf
 * entity id for a saturation node. `data_model_decomposition_node` intentionally
 * reads `entity` here (the id source), which differs from the artifact-store
 * mapping (SATURATION_ARTIFACT_KEY) that reads `data_model`.
 */
const SATURATION_ENTITY_KEY: Record<string, 'component' | 'entity' | 'task' | 'test_case'> = {
  component_decomposition_node: 'component',
  data_model_decomposition_node: 'entity',
  task_decomposition_node: 'task',
  test_decomposition_node: 'test_case',
};

/**
 * FR/NFR-saturation leaf ids: the decomposed user story's OWN leaf id (e.g.
 * US-002-D1) plus every composite leaf acceptance-criterion id
 * (AC-US-002-D1-001). Phase 7/8 trace to these; indexing them stops every leaf
 * reference from flagging as a false P7_INVENTED_ID_REFERENCE. Does NOT include
 * the node_id — the caller prepends that.
 */
function extractRequirementLeafIds(content: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const story = content.user_story;
  if (!story || typeof story !== 'object') return ids;
  const s = story as Record<string, unknown>;
  if (typeof s.id === 'string' && s.id.length > 0) ids.push(s.id);
  const acs = s.acceptance_criteria;
  if (!Array.isArray(acs)) return ids;
  for (const ac of acs) {
    if (!ac || typeof ac !== 'object') continue;
    const acId = (ac as Record<string, unknown>).id;
    if (typeof acId === 'string' && acId.length > 0) ids.push(acId);
  }
  return ids;
}

/**
 * Leaf entity id for component/data-model/task/test saturation nodes. Returns a
 * single-element array with the id, or [] when the record type is unknown or the
 * entity carries no valid id.
 */
function extractEntityNodeId(nodeRecordType: string, content: Record<string, unknown>): string[] {
  const entityKey = SATURATION_ENTITY_KEY[nodeRecordType];
  if (!entityKey) return [];
  const entity = content[entityKey];
  if (!entity || typeof entity !== 'object') return [];
  const idField = entityKey === 'test_case' ? 'test_case_id' : 'id';
  const candidate = (entity as Record<string, unknown>)[idField];
  if (typeof candidate === 'string' && candidate.length > 0) return [candidate];
  return [];
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

  if (nodeRecordType === 'requirement_decomposition_node') {
    ids.push(...extractRequirementLeafIds(content));
    return ids;
  }

  ids.push(...extractEntityNodeId(nodeRecordType, content));
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
 * Record-type → the content key holding the full entity to copy into
 * `artifactsById`. Note `data_model_decomposition_node` reads `data_model` here
 * (the stored artifact), which differs from SATURATION_ENTITY_KEY (the id
 * source). Unknown types fall back to the whole node content.
 */
const SATURATION_ARTIFACT_KEY: Record<
  string,
  'component' | 'data_model' | 'task' | 'test_case' | 'user_story'
> = {
  component_decomposition_node: 'component',
  data_model_decomposition_node: 'data_model',
  task_decomposition_node: 'task',
  test_decomposition_node: 'test_case',
  requirement_decomposition_node: 'user_story',
};

/**
 * The most useful copy of a saturation node's entity for artifactsById — the
 * underlying entity object, or the whole node content when the entity is absent
 * or the record type is unknown.
 */
function resolveSaturationEntity(node: {
  recordType: string;
  content: Record<string, unknown>;
}): unknown {
  const entityKey = SATURATION_ARTIFACT_KEY[node.recordType];
  const entity = entityKey ? node.content[entityKey] : node.content;
  return entity ?? node.content;
}

/** Index one artifact's extracted triples into the accumulator. */
function indexArtifactItems(a: UpstreamArtifactInput, index: UpstreamIndex): void {
  const extracted = extractFromArtifact(a.sub_phase_id, a.content);
  for (const { id, item, source } of extracted) {
    index.allUpstreamIds.add(id);
    if (source === 'ai-proposed') index.aiProposedIds.add(id);
    else if (source === 'user-specified') index.userSpecifiedIds.add(id);
    // First writer wins for the artifacts map — preserves the original
    // (skeleton) item over any later supersession revisions in the
    // caller's input order.
    if (!index.artifactsById.has(id)) index.artifactsById.set(id, item);
  }
}

/**
 * Index one saturation node's ids into the accumulator (first-seen wins for the
 * artifacts map, mirroring the artifact path).
 */
function indexSaturationNode(
  node: { recordType: string; content: Record<string, unknown> },
  allUpstreamIds: Set<string>,
  artifactsById: Map<string, unknown>,
): void {
  const ids = extractFromSaturationNode(node.recordType, node.content);
  for (const id of ids) {
    allUpstreamIds.add(id);
    if (!artifactsById.has(id)) artifactsById.set(id, resolveSaturationEntity(node));
  }
}

/**
 * Pure indexer. Given a snapshot of upstream artifacts + saturation
 * nodes, returns the index. No DB; no async; deterministic.
 */
export function indexArtifacts(input: IndexInput): UpstreamIndex {
  const index: UpstreamIndex = {
    allUpstreamIds: new Set<string>(),
    aiProposedIds: new Set<string>(),
    userSpecifiedIds: new Set<string>(),
    artifactsById: new Map<string, unknown>(),
  };

  for (const a of input.artifacts) {
    indexArtifactItems(a, index);
  }

  for (const node of input.saturationNodes ?? []) {
    indexSaturationNode(node, index.allUpstreamIds, index.artifactsById);
  }

  return index;
}
