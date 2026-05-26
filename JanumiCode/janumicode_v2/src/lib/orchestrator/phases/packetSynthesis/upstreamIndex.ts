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
  /**
   * Optional path-prefix-style synthetic id generator (used when the
   * array elements are bare strings, not objects with `id`). E.g.
   * `qualityAttributes: ['encrypts URLs', 'low latency']` becomes
   * QA-1, QA-2. The function takes (item, index) and returns the
   * synthetic id; if not provided, items without `idField` are skipped.
   */
  syntheticId?: (item: unknown, index: number) => string | null;
  /**
   * Optional sub-array path → recurse into sub-items. Used for nested
   * structures like `user_stories[].acceptance_criteria[]` where both
   * tiers carry ids.
   */
  nested?: ExtractionRule[];
}

/**
 * Per sub-phase: which array(s) in the content carry id-bearing items.
 * Keyed by sub_phase_id. Extending the pipeline with a new phase that
 * produces ids? Add an entry here.
 */
const EXTRACTION_RULES: Record<string, ExtractionRule[]> = {
  // ── Phase 1 — discovery & blooms ─────────────────────────────────
  technical_constraints_discovery: [{ arrayKey: 'technicalConstraints', idField: 'id' }],
  compliance_retention_discovery: [{ arrayKey: 'compliance_extracted_items', idField: 'id' }],
  vv_requirements_discovery: [{ arrayKey: 'vvRequirements', idField: 'id' }],
  canonical_vocabulary_discovery: [{ arrayKey: 'canonicalVocabulary', idField: 'id' }],
  business_domains_bloom: [
    { arrayKey: 'domains', idField: 'id' },
    { arrayKey: 'personas', idField: 'id' },
  ],
  user_journey_bloom: [{ arrayKey: 'userJourneys', idField: 'id' }],
  system_workflow_bloom: [{ arrayKey: 'workflows', idField: 'id' }],
  entities_bloom: [{ arrayKey: 'entities', idField: 'id' }],
  integrations_qa_bloom: [
    { arrayKey: 'integrations', idField: 'id' },
    // Quality attributes are emitted as a string[] at the gate; we
    // mirror the synthetic QA-N id pattern used in phase1.ts/buildQaItems.
    {
      arrayKey: 'qualityAttributes',
      idField: '__synthetic__',
      syntheticId: (_item, i) => `QA-${i + 1}`,
    },
  ],
  release_plan: [{ arrayKey: 'releases', idField: 'release_id' }],

  // ── Phase 2 — requirements ──────────────────────────────────────
  // The fr_bloom_skeleton emits `user_stories[].id` (US-*) plus nested
  // `acceptance_criteria[].id` (AC-* per-story namespace). The NFR
  // skeleton mirrors that shape.
  fr_bloom_skeleton: [
    {
      arrayKey: 'user_stories',
      idField: 'id',
      nested: [{ arrayKey: 'acceptance_criteria', idField: 'id' }],
    },
  ],
  nfr_bloom_skeleton: [
    {
      arrayKey: 'nonfunctional_requirements',
      idField: 'id',
      nested: [{ arrayKey: 'acceptance_criteria', idField: 'id' }],
    },
  ],

  // ── Phase 4–7 skeletons (saturation node ids handled separately) ─
  component_skeleton: [{ arrayKey: 'components', idField: 'id' }],
  data_model_skeleton: [{ arrayKey: 'data_models', idField: 'id' }],
  api_definitions: [{ arrayKey: 'api_definitions', idField: 'id' }],
  task_skeleton: [{ arrayKey: 'tasks', idField: 'id' }],
  test_case_skeleton: [
    {
      arrayKey: 'test_suites',
      idField: 'suite_id',
      nested: [{ arrayKey: 'test_cases', idField: 'test_case_id' }],
    },
  ],
};

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
  const entityKey =
    nodeRecordType === 'component_decomposition_node' ? 'component'
    : nodeRecordType === 'data_model_decomposition_node' ? 'data_model'
    : nodeRecordType === 'task_decomposition_node' ? 'task'
    : nodeRecordType === 'test_decomposition_node' ? 'test_case'
    : null;
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
        const entityKey =
          node.recordType === 'component_decomposition_node' ? 'component'
          : node.recordType === 'data_model_decomposition_node' ? 'data_model'
          : node.recordType === 'task_decomposition_node' ? 'task'
          : node.recordType === 'test_decomposition_node' ? 'test_case'
          : null;
        const entity = entityKey ? node.content[entityKey] : node.content;
        artifactsById.set(id, entity ?? node.content);
      }
    }
  }

  return { allUpstreamIds, aiProposedIds, userSpecifiedIds, artifactsById };
}
