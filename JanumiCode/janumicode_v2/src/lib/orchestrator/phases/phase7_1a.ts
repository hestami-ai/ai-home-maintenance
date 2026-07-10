/**
 * Wave 10 — Phase 7.1a Recursive Test Decomposition.
 *
 * Saturation-loop recursive decomposer for test cases, mirroring the
 * Wave 6 / 7 / 8 / 9 machinery. Tier rubric is test-scoped:
 *   A — Test Suite (recurse without gating)
 *   B — Test Scenario (mirror-gated then recurse)
 *   C — Test Case (one more pass)
 *   D — Atomic Test Step (terminal)
 *
 * Termination — assumption-saturation fixed-point (semantic_delta=0 AND
 * queue empty). Safety rails (depth_cap, budget_cap, fanout_cap,
 * divergence detection) trigger explicit `status='deferred'`
 * supersessions when they trip — never silent gaps.
 *
 * Invocation — Phase 7 calls runTestSaturationLoop AFTER 7.1 has
 * emitted the depth-0 test plan. The loop expects depth-0
 * `test_decomposition_node` rows already written.
 */

import { randomUUID } from 'node:crypto';
import type { PhaseContext } from '../orchestratorEngine';
import type {
  GovernedStreamRecord,
  TestDecompositionNodeContent,
  TestDecompositionPipelineContent,
  TestAssumptionSetSnapshotContent,
  TestAssumptionEntry,
  DecompositionTestCase,
  DecompositionTestStep,
  TestDecompositionTestType,
  PropertySpec,
  DecompositionTier,
  DecompositionNodeStatus,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  TechnicalConstraint,
} from '../../types/records';
import type { MirrorItemDecision } from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { resolveAcReferences, type CanonicalAcIndex } from './phase7/acRefResolver';

function mintLogicalNodeId(): string { return randomUUID(); }
function collisionSafeDisplayKey(rawId: string, sib: Set<string>, nid: string): string {
  if (!sib.has(rawId)) return rawId;
  return `${rawId}#${nid.slice(0, 4)}`;
}
function normalizeTier(raw: unknown): DecompositionTier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

const TEST_TYPES: readonly TestDecompositionTestType[] = [
  'unit', 'integration', 'end_to_end', 'performance', 'contract', 'property',
];
const PROPERTY_KINDS: readonly NonNullable<PropertySpec['property_kind']>[] = [
  'round_trip', 'idempotence', 'commutativity', 'invariant',
  'conservation', 'ordering', 'oracle', 'metamorphic',
];
const STEP_PHASES: readonly NonNullable<DecompositionTestStep['phase']>[] = [
  'arrange', 'act', 'assert', 'teardown',
];

export interface TestSaturationConfig {
  recordSubPhaseId: 'test_case_saturation';
  templateSubPhase: string;
  gateSurfacePrefix: string;
}

const DEFAULT_CONFIG: TestSaturationConfig = {
  recordSubPhaseId: 'test_case_saturation',
  templateSubPhase: 'test_case_saturation',
  gateSurfacePrefix: 'test-decomp-gate-',
};

export interface TestSaturationInput {
  technicalConstraints: TechnicalConstraint[];
  componentSummary: string;
  /**
   * Per-component scoped context blocks (component_id → that component's block).
   * PA-2: a single-test-case saturation call sees only its OWN component(s), not
   * the whole ~17-component model. Falls back to `componentSummary`.
   */
  componentSummaryById?: Record<string, string>;
  /**
   * Leaf-aware FR/AC summary (from `buildEffectiveFrView`). The
   * saturation prompt asks each child to attach `acceptance_criterion_ids`,
   * and the parent test case's existing AC ids were minted from Phase
   * 2.1a leaf decomposition. This summary MUST carry those leaf-level
   * AC ids — using the root-FR summary as a fallback caused thin-slice-1
   * to surface fabricated/rephrased AC refs.
   */
  acceptanceCriteriaSummary: string;
  /**
   * Phase 3.3 / 5.2 interface-contracts / api-definitions summary.
   * Surfaces the legitimate id roster for `traces_to[]` when the
   * saturation prompt's worked example shows `resp-*`-style
   * contract references — without this, qwen3.5:9b fabricates them.
   */
  interfaceContractsSummary: string;
  rootTestCases: DecompositionTestCase[];
  rootNodeRecordIds: string[];
  rootLogicalIds: string[];
  /**
   * Canonical AC index built from the FR view. The saturation loop
   * normalizes every child's `acceptance_criterion_ids[]` against it
   * before persistence so downstream consumers (packet synthesis,
   * coverage analysis) never see drift modes like `AC-URL-001` or
   * `AC-US-002-atomic`. Optional only to keep test callers terse;
   * production callers pass it.
   */
  canonicalAcIndex?: CanonicalAcIndex;
}

interface QueueEntry {
  parentRecordId: string;
  nodeId: string;
  parentNodeId: string | null;
  rootTestId: string;
  depth: number;
  testCase: DecompositionTestCase;
  displayKey: string;
  tierHint: DecompositionTier | 'root';
  releaseId: string | null;
  releaseOrdinal: number | null;
  activeConstraints: string[];
}

interface ResumeState {
  queue: QueueEntry[];
  allAssumptions: TestAssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionTestCase[]>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

/**
 * Reduce all `test_decomposition_node` versions to the latest record per
 * logical node_id (by produced_at). Mirrors the current-version resolution
 * used elsewhere in the loop.
 */
function latestNodeRecordsById(
  allNodes: GovernedStreamRecord[],
): Map<string, GovernedStreamRecord> {
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of allNodes) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
  }
  return latestByNodeId;
}

/**
 * Reconstruct the pending-work queue and the per-parent sibling roster from the
 * latest node records, tracking the deepest depth seen.
 */
function rebuildQueueFromLatestNodes(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): {
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionTestCase[]>;
  maxDepthReached: number;
} {
  const queue: QueueEntry[] = [];
  const siblingsByParent = new Map<string | null, DecompositionTestCase[]>();
  let maxDepthReached = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    if (c.depth > maxDepthReached) maxDepthReached = c.depth;
    const sibArr = siblingsByParent.get(c.parent_node_id) ?? [];
    sibArr.push(c.test_case);
    siblingsByParent.set(c.parent_node_id, sibArr);
    if (c.status === 'pending') {
      const tierHint: DecompositionTier | 'root' = c.depth === 0 ? 'root' : (c.tier ?? 'A');
      queue.push({
        parentRecordId: r.id,
        nodeId: c.node_id,
        parentNodeId: c.parent_node_id,
        rootTestId: c.root_test_id,
        depth: c.depth,
        testCase: c.test_case,
        displayKey: c.display_key,
        tierHint,
        releaseId: c.release_id,
        releaseOrdinal: c.release_ordinal,
        activeConstraints: c.test_case.active_constraints ?? [],
      });
    }
  }
  return { queue, siblingsByParent, maxDepthReached };
}

/**
 * Recover the assumption set from the highest-pass snapshot and derive the next
 * assumption sequence number from the `TS-<n>` ids already minted.
 */
function rebuildAssumptionsFromSnapshots(
  snapshotRecords: GovernedStreamRecord[],
): { allAssumptions: TestAssumptionEntry[]; passNumber: number; assumptionSeq: number } {
  let allAssumptions: TestAssumptionEntry[] = [];
  let passNumber = 0;
  for (const r of snapshotRecords) {
    const c = r.content as unknown as TestAssumptionSetSnapshotContent;
    if (c.pass_number > passNumber) {
      passNumber = c.pass_number;
      allAssumptions = [...c.assumptions];
    }
  }
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^TS-(\d+)$/.exec(a.id);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > assumptionSeq) assumptionSeq = n;
    }
  }
  return { allAssumptions, passNumber, assumptionSeq };
}

function earliestByProducedAt(records: GovernedStreamRecord[]): GovernedStreamRecord {
  return records.reduce((earliest, r) =>
    !earliest || r.produced_at < earliest.produced_at ? r : earliest, records[0]);
}

function latestByProducedAt(records: GovernedStreamRecord[]): GovernedStreamRecord {
  return records.reduce((latest, r) =>
    !latest || r.produced_at > latest.produced_at ? r : latest, records[0]);
}

export function rebuildTestSaturationStateFromStream(
  ctx: PhaseContext,
  config: TestSaturationConfig,
  pipelineId: string,
): ResumeState | null {
  const { engine, workflowRun } = ctx;
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'test_decomposition_node', false,
  );
  if (allNodes.length === 0) return null;

  const latestByNodeId = latestNodeRecordsById(allNodes);
  const { queue, siblingsByParent, maxDepthReached } = rebuildQueueFromLatestNodes(latestByNodeId);

  const snapshotRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'test_assumption_set_snapshot',
  );
  const { allAssumptions, passNumber, assumptionSeq } =
    rebuildAssumptionsFromSnapshots(snapshotRecords);

  const pipelineRecords = engine.writer.getRecordsByType(
    workflowRun.id, 'test_decomposition_pipeline', false,
  ).filter(r => (r.content as unknown as TestDecompositionPipelineContent).pipeline_id === pipelineId);
  if (pipelineRecords.length === 0) return null;
  const pipelineStartRecord = earliestByProducedAt(pipelineRecords);
  const latestPipelineRecord = latestByProducedAt(pipelineRecords);
  const latestContent = latestPipelineRecord.content as unknown as TestDecompositionPipelineContent;

  return {
    queue, allAssumptions, assumptionSeq, siblingsByParent,
    maxDepthReached, passNumber,
    pipelinePasses: latestContent.passes,
    pipelineStartRecord,
    currentPipelineRecordId: latestPipelineRecord.id,
  };
}

/** Coerce a raw test_type value to a known type, defaulting to 'unit'. */
function resolveTestType(raw: unknown): TestDecompositionTestType {
  const tt = typeof raw === 'string' ? raw : 'unit';
  return (TEST_TYPES as readonly string[]).includes(tt)
    ? tt as TestDecompositionTestType : 'unit';
}

/** Read a field of `c` as a string[] (filtering non-strings), or undefined. */
function stringArrField(c: Record<string, unknown>, key: string): string[] | undefined {
  const raw = c[key];
  return Array.isArray(raw)
    ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined;
}

/**
 * The LLM sometimes emits expected_outcome as an array of outcome strings;
 * join (don't drop to undefined, which silently loses the assertion text).
 */
function parseExpectedOutcome(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter((x): x is string => typeof x === 'string').join('; ') || undefined;
  }
  return undefined;
}

/** Parse and normalize the raw `steps[]` of a child test case (drops empty-description steps). */
function parseChildSteps(rawSteps: Array<Record<string, unknown>>): DecompositionTestStep[] {
  const steps: DecompositionTestStep[] = [];
  for (let idx = 0; idx < rawSteps.length; idx++) {
    const s = rawSteps[idx];
    const description = typeof s.description === 'string' ? s.description : '';
    if (description.length === 0) continue;
    const sid = typeof s.id === 'string' && s.id.length > 0
      ? s.id
      : `step-${String(idx + 1).padStart(2, '0')}`;
    const phaseRaw = typeof s.phase === 'string' ? s.phase : undefined;
    const phase: DecompositionTestStep['phase'] = phaseRaw && (STEP_PHASES as readonly string[]).includes(phaseRaw)
      ? phaseRaw as DecompositionTestStep['phase']
      : undefined;
    steps.push({
      id: sid,
      description,
      phase,
      expected_outcome: typeof s.expected_outcome === 'string' ? s.expected_outcome : undefined,
    });
  }
  return steps;
}

function sanitizeChildTestCase(
  c: Record<string, unknown>,
  ctx: { rootId: string; childIndex: number },
): DecompositionTestCase | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : null;
  if (!id || !name) {
    getLogger().warn('workflow', 'Phase 7.1a: dropped malformed child (missing id or name)', ctx);
    return null;
  }
  const test_type = resolveTestType(c.test_type);
  const property_spec = test_type === 'property' ? parsePropertySpec(c.property_spec) : undefined;
  const rawSteps = Array.isArray(c.steps) ? c.steps as Array<Record<string, unknown>> : [];
  const steps = parseChildSteps(rawSteps);
  // A property is invariant-driven, not arrange/act/assert — the LLM may emit
  // no steps. Synthesize one assert step from the invariant so the
  // steps-non-empty contract (and downstream rendering) holds, rather than
  // dropping a valid property child.
  if (steps.length === 0 && property_spec) {
    steps.push({
      id: 'step-01',
      description: `For all inputs in {${property_spec.input_domain}}, assert: ${property_spec.invariant}`,
      phase: 'assert',
      expected_outcome: 'Property holds for every generated input (no counterexample).',
    });
  }
  if (steps.length === 0) {
    getLogger().warn('workflow', 'Phase 7.1a: dropped malformed child (no valid steps)', { ...ctx, childId: id });
    return null;
  }
  if (test_type === 'property' && !property_spec) {
    getLogger().warn('workflow', 'Phase 7.1a: property test missing/invalid property_spec — keeping as example test', { ...ctx, childId: id });
  }
  return {
    id, name, test_type, steps,
    component_ids: stringArrField(c, 'component_ids'),
    acceptance_criterion_ids: stringArrField(c, 'acceptance_criterion_ids'),
    preconditions: stringArrField(c, 'preconditions'),
    expected_outcome: parseExpectedOutcome(c.expected_outcome),
    edge_cases: stringArrField(c, 'edge_cases'),
    test_file_path: typeof c.test_file_path === 'string' ? c.test_file_path : undefined,
    active_constraints: stringArrField(c, 'active_constraints'),
    traces_to: stringArrField(c, 'traces_to'),
    // `property` test_type without a valid spec degrades to an example test
    // (test_type stays 'property' for visibility; executor falls back to steps).
    property_spec,
  };
}

/**
 * Parse a property_spec from raw LLM output. Returns undefined unless the
 * minimal shape (invariant + input_domain) is present, so a malformed spec
 * never silently produces a property test with no rule to check.
 */
function parsePropertySpec(raw: unknown): PropertySpec | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const invariant = typeof r.invariant === 'string' ? r.invariant.trim() : '';
  const input_domain = typeof r.input_domain === 'string' ? r.input_domain.trim() : '';
  if (invariant.length === 0 || input_domain.length === 0) return undefined;
  const kindRaw = typeof r.property_kind === 'string' ? r.property_kind : '';
  const property_kind: PropertySpec['property_kind'] =
    (PROPERTY_KINDS as readonly string[]).includes(kindRaw)
      ? kindRaw as PropertySpec['property_kind']
      : 'invariant';
  const generators = Array.isArray(r.generators)
    ? (r.generators as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined;
  return {
    invariant,
    property_kind,
    input_domain,
    generators: generators && generators.length > 0 ? generators : undefined,
    oracle: typeof r.oracle === 'string' && r.oracle.length > 0 ? r.oracle : undefined,
    metamorphic_relation:
      typeof r.metamorphic_relation === 'string' && r.metamorphic_relation.length > 0
        ? r.metamorphic_relation : undefined,
  };
}

function normalizeChildAcRefs(
  refs: ReadonlyArray<string>,
  child: DecompositionTestCase,
  index: CanonicalAcIndex | undefined,
): string[] {
  const mutable = [...refs];
  if (!index || mutable.length === 0) return mutable;
  const stepText = (child.steps ?? []).map(s => s.description).join(' ');
  const contextText = [child.expected_outcome ?? '', child.name ?? '', stepText]
    .filter(s => typeof s === 'string' && s.length > 0)
    .join(' ');
  const result = resolveAcReferences(mutable, index, { contextText });
  return result.resolvedIds.length > 0 ? result.resolvedIds : mutable;
}

function formatTestCaseForPrompt(t: DecompositionTestCase): string {
  const steps = t.steps.map(s => {
    const phase = s.phase ? ` [${s.phase}]` : '';
    const outcome = s.expected_outcome ? ` → ${s.expected_outcome}` : '';
    return `  - [${s.id}]${phase} ${s.description}${outcome}`;
  }).join('\n');
  const pre = (t.preconditions ?? []).length === 0 ? '(none)'
    : (t.preconditions ?? []).map(p => `  - ${p}`).join('\n');
  const ps = t.property_spec;
  let propertyLine: string | null = null;
  if (ps) {
    const oracle = ps.oracle ? `\n  oracle: ${ps.oracle}` : '';
    const relation = ps.metamorphic_relation ? `\n  relation: ${ps.metamorphic_relation}` : '';
    propertyLine = `Property: [${ps.property_kind}] ${ps.invariant}`
      + `\n  over inputs: ${ps.input_domain}`
      + oracle
      + relation;
  }
  return [
    `Test id: ${t.id}`,
    `Name: ${t.name}`,
    `Type: ${t.test_type}`,
    t.component_ids && t.component_ids.length > 0 ? `Components under test: ${t.component_ids.join(', ')}` : null,
    t.acceptance_criterion_ids && t.acceptance_criterion_ids.length > 0
      ? `Validates ACs: ${t.acceptance_criterion_ids.join(', ')}` : null,
    'Preconditions:',
    pre,
    'Steps:',
    steps,
    t.expected_outcome ? `Expected outcome: ${t.expected_outcome}` : null,
    t.edge_cases && t.edge_cases.length > 0 ? `Edge cases: ${t.edge_cases.join('; ')}` : null,
    propertyLine,
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

/**
 * Scope the `acceptance_criteria_summary` prompt block to ONLY the ACs the
 * parent test case validates — not the entire FR/AC catalog. Saturation
 * partitions the parent's coverage (children may reference only the parent's own
 * ACs; an unmatched behaviour makes the parent `invalid_parent`, never a new
 * AC), so injecting hundreds of unrelated ACs is pure prompt bloat. cal-29 spent
 * 77,093 input tokens saturating a single 1-AC test case because the full
 * catalog was injected (twice). Renders each parent AC as `id: measurable_condition`
 * from the canonical index; falls back to the full summary when the parent
 * carries no AC ids or none resolve (never hand the model an empty AC universe).
 */
export function renderScopedAcSummary(
  acIds: ReadonlyArray<string> | undefined,
  index: CanonicalAcIndex | undefined,
  fullSummaryFallback: string,
): string {
  if (!index || !acIds || acIds.length === 0) return fullSummaryFallback;
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const rawId of acIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry = index.byCanonicalId.get(id);
    if (!entry) continue; // unknown id — skip (never fabricate); fallback below covers all-miss
    const text = (entry.measurable_condition ?? entry.description ?? '').trim();
    lines.push(text ? `${entry.id}: ${text}` : entry.id);
  }
  return lines.length > 0 ? lines.join('\n') : fullSummaryFallback;
}

// ── Run state (threaded by reference through the pass helpers) ──────

type SaturationEngine = PhaseContext['engine'];
type DecompositionCaps = ReturnType<SaturationEngine['configManager']['get']>['decomposition'];
type SaturationTemplate = NonNullable<ReturnType<SaturationEngine['templateLoader']['findTemplate']>>;

/**
 * All shared, resolved-immutable + mutable state for one test-saturation run.
 * Threaded by reference through every pass / entry / post-pass helper so each
 * queue / sibling / counter / cursor write-back lands on the SAME object — the
 * behavior-preserving replacement for the original single-function closure.
 */
interface SaturationRun {
  ctx: PhaseContext;
  engine: SaturationEngine;
  workflowRun: PhaseContext['workflowRun'];
  input: TestSaturationInput;
  config: TestSaturationConfig;
  caps: DecompositionCaps;
  template: SaturationTemplate;
  pipelineId: string;
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
  embeddingClient: EmbeddingClient;
  embeddingCache: Map<string, number[]>;
  dedupThreshold: number;
  dedupEnabled: boolean;
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
  allAssumptions: TestAssumptionEntry[];
  assumptionSeq: number;
  queue: QueueEntry[];
  siblingsByParent: Map<string | null, DecompositionTestCase[]>;
  callsByRoot: Map<string, number>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  parentChain: Map<string, string | null>;
  consecutiveGrowthPasses: number;
  consecutiveDedupOfflinePasses: number;
  dedupOfflineAnnounced: boolean;
  divergingEarlyTerminate: boolean;
}

interface PendingGateChild {
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  testCase: DecompositionTestCase;
  rationale?: string;
}

/** Pass-scoped accumulators — recreated fresh at the top of each pass. */
interface PassState {
  passAssumptions: TestAssumptionEntry[];
  pendingGateByParent: Map<string, PendingGateChild[]>;
  downgradeNotesByParent: Map<string, string>;
}

/** Next `TS-<nnnn>` id — pre-increments the shared sequence (order-preserving). */
function mintAssumptionId(run: SaturationRun): string {
  return `TS-${String(++run.assumptionSeq).padStart(4, '0')}`;
}

// ── Main loop ──────────────────────────────────────────────────────

export async function runTestSaturationLoop(
  ctx: PhaseContext,
  input: TestSaturationInput,
  config: TestSaturationConfig = DEFAULT_CONFIG,
): Promise<void> {
  const run = await prepareSaturationRun(ctx, input, config);
  await runSaturationPasses(run);
  finalizeSaturationRun(run);
}

// ── Setup ──────────────────────────────────────────────────────────

function resolveTemplateOrThrow(
  engine: SaturationEngine,
  config: TestSaturationConfig,
): SaturationTemplate {
  const template = engine.templateLoader.findTemplate('test_design_agent', config.templateSubPhase);
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: test-decomposition template missing — ` +
      `expected agent_role=testing_agent sub_phase=${config.templateSubPhase}.`,
    );
  }
  return template;
}

function resolveDivergenceConfig(): {
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
} {
  return {
    divergeGrowthRatio: Number.parseFloat(process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2'),
    divergeWarnPasses: Number.parseInt(process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10),
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

function seedQueueFromRoots(input: TestSaturationInput): QueueEntry[] {
  return input.rootTestCases.map((t, i) => ({
    parentRecordId: input.rootNodeRecordIds[i],
    nodeId: input.rootLogicalIds[i],
    parentNodeId: null,
    rootTestId: input.rootLogicalIds[i],
    depth: 0,
    testCase: t,
    displayKey: t.id,
    tierHint: 'root' as const,
    releaseId: null,
    releaseOrdinal: null,
    activeConstraints: t.active_constraints ?? [],
  }));
}

function initSiblingsByParent(
  resumed: ResumeState | null,
  input: TestSaturationInput,
): Map<string | null, DecompositionTestCase[]> {
  if (resumed) return resumed.siblingsByParent;
  const siblingsByParent = new Map<string | null, DecompositionTestCase[]>();
  siblingsByParent.set(null, [...input.rootTestCases]);
  return siblingsByParent;
}

function resolvePipelineStartRecord(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
  config: TestSaturationConfig,
  input: TestSaturationInput,
  pipelineId: string,
  resumed: ResumeState | null,
): { pipelineStartRecord: GovernedStreamRecord; currentPipelineRecordId: string } {
  const pipelineStartRecord = resumed?.pipelineStartRecord ?? engine.writer.writeRecord({
    record_type: 'test_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: input.rootNodeRecordIds,
    content: {
      kind: 'test_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_test_id: '*',
      passes: [],
    } satisfies TestDecompositionPipelineContent,
  });
  const currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;
  return { pipelineStartRecord, currentPipelineRecordId };
}

function buildParentChain(
  engine: SaturationEngine,
  workflowRun: PhaseContext['workflowRun'],
): Map<string, string | null> {
  const parentChain = new Map<string, string | null>();
  for (const r of engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node')) {
    const c = r.content as unknown as TestDecompositionNodeContent;
    parentChain.set(c.node_id, c.parent_node_id);
  }
  return parentChain;
}

async function seedDedupCacheFromExistingAssumptions(run: SaturationRun): Promise<void> {
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
  input: TestSaturationInput,
  config: TestSaturationConfig,
): Promise<SaturationRun> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;
  const template = resolveTemplateOrThrow(engine, config);

  const pipelineId = `test-decomp-pipe-${workflowRun.id.slice(0, 8)}`;
  const resumed = rebuildTestSaturationStateFromStream(ctx, config, pipelineId);

  // Order-sensitive: the divergence config has no side effects; the pipeline
  // start record is WRITTEN here (unless resuming); the dedup config only news
  // up the client — matching the original setup ordering.
  const divergence = resolveDivergenceConfig();
  const pipeline = resolvePipelineStartRecord(engine, workflowRun, config, input, pipelineId, resumed);
  const dedup = resolveDedupConfig(engine);

  const run: SaturationRun = {
    ctx,
    engine,
    workflowRun,
    input,
    config,
    caps,
    template,
    pipelineId,
    pipelineStartRecord: pipeline.pipelineStartRecord,
    currentPipelineRecordId: pipeline.currentPipelineRecordId,
    embeddingClient: dedup.embeddingClient,
    embeddingCache: dedup.embeddingCache,
    dedupThreshold: dedup.dedupThreshold,
    dedupEnabled: dedup.dedupEnabled,
    divergeGrowthRatio: divergence.divergeGrowthRatio,
    divergeWarnPasses: divergence.divergeWarnPasses,
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
    // Pure read (test_decomposition_node) — the dedup seed writes no records, so
    // building this before it yields identical results to the original ordering.
    parentChain: buildParentChain(engine, workflowRun),
    consecutiveGrowthPasses: 0,
    consecutiveDedupOfflinePasses: 0,
    dedupOfflineAnnounced: false,
    divergingEarlyTerminate: false,
  };

  await seedDedupCacheFromExistingAssumptions(run);
  return run;
}

async function runSaturationPasses(run: SaturationRun): Promise<void> {
  const { engine, workflowRun } = run;
  while (run.queue.length > 0) {
    run.passNumber++;
    const passStartedAt = new Date().toISOString();
    const nodesProducedAtPassStart = engine.writer.getRecordsByType(
      workflowRun.id, 'test_decomposition_node',
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
      workflowRun.id, 'test_decomposition_node',
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
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { ctx, config, caps } = run;
  if (entry.depth >= caps.test_depth_cap) {
    writeDeferredSupersession(ctx, entry, run.passNumber, 'depth_cap_reached', config);
    return;
  }
  const rootCalls = run.callsByRoot.get(entry.rootTestId) ?? 0;
  if (rootCalls >= caps.test_budget_cap) {
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
 * original single try block (render → LLM → assumptions → children → supersession).
 */
async function decomposeEntry(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
): Promise<void> {
  const { engine, workflowRun, config } = run;

  const variables = buildDecompositionVariables(run, pass, entry);
  const rendered = engine.templateLoader.render(run.template, variables);
  if (rendered.missing_variables.length > 0) {
    throw new Error(`Phase ${config.recordSubPhaseId}: template missing vars [${rendered.missing_variables.join(', ')}]`);
  }

  run.callsByRoot.set(entry.rootTestId, (run.callsByRoot.get(entry.rootTestId) ?? 0) + 1);
  const result = await engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.4,
    traceContext: {
      workflowRunId: workflowRun.id,
      phaseId: '7',
      subPhaseId: config.recordSubPhaseId,
      agentRole: 'test_design_agent',
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
  // Status transition for successful decomposition: parents that produced
  // children need a `decomposed` supersession or they stay labelled `pending`.
  writeDecomposedSupersession(run, entry, emittedChildren.length, parentDowngraded);
}

/** Assemble the template variables (component/sibling scoping + assumptions). */
function buildDecompositionVariables(
  run: SaturationRun,
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

  return {
    active_constraints: activeConstraintsForPrompt,
    parent_test_case: formatTestCaseForPrompt(entry.testCase),
    parent_tier_hint: entry.tierHint,
    sibling_context: formatTestSiblingContext(siblings, entry),
    // Scope component_context to the component(s) THIS test case exercises
    // (PA-2), not the whole ~17-component model. Fallback to the full summary
    // when the test carries no resolvable component_ids.
    component_context: resolveScopedComponentContext(input, entry),
    // Scope the AC block to the parent's OWN validated ACs (saturation
    // partitions the parent's coverage). Falls back to the full catalog only
    // when the parent has no resolvable AC ids.
    acceptance_criteria_summary: renderScopedAcSummary(
      entry.testCase.acceptance_criterion_ids,
      input.canonicalAcIndex,
      input.acceptanceCriteriaSummary,
    ),
    interface_contracts_summary: input.interfaceContractsSummary,
    existing_assumptions: scopedAssumptions.length === 0
      ? '(none yet)'
      : scopedAssumptions.map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
    current_depth: String(entry.depth),
    janumicode_version_sha: engine.janumiCodeVersionSha,
  };
}

/** Walk parent links to the root, guarding against cycles. */
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
 * Render the sibling roster. Scope root-node siblings to component-overlapping
 * test cases (PA-2): at depth 0 `siblingsByParent.get(null)` is EVERY root test
 * case across all areas, bloating the prompt with cross-area TCs. When the test
 * case carries no resolvable component (parentComps empty), the overlap predicate
 * would exclude ALL siblings and falsely render the node as a sole child — so
 * fall back to the full same-parent roster in that case.
 */
function formatTestSiblingContext(
  siblings: DecompositionTestCase[],
  entry: QueueEntry,
): string {
  const isRoot = entry.parentNodeId == null;
  const parentComps = new Set(entry.testCase.component_ids ?? []);
  const sibs = siblings
    .filter(s => s.id !== entry.testCase.id)
    .filter(s => !isRoot || parentComps.size === 0 || (s.component_ids ?? []).some(c => parentComps.has(c)));
  return sibs.length === 0
    ? '(none — sole child under this parent)'
    : sibs.map(s => `- ${s.id}: ${s.name}`).join('\n');
}

/** Scope component_context to the test case's OWN component(s); full-summary fallback. */
function resolveScopedComponentContext(
  input: TestSaturationInput,
  entry: QueueEntry,
): string {
  const scoped = (entry.testCase.component_ids ?? [])
    .map(cid => input.componentSummaryById?.[cid])
    .filter((b): b is string => !!b);
  return scoped.length > 0 ? scoped.join('\n\n') : input.componentSummary;
}

/** Mint TS-ids for the surfaced assumptions, appending to the pass batch. */
function collectSurfacedAssumptions(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  surfacedRaw: Array<Record<string, unknown>>,
): string[] {
  const childAssumptionIds: string[] = [];
  for (const a of surfacedRaw) {
    const text = typeof a.text === 'string' ? a.text : null;
    if (!text) continue;
    const cat = typeof a.category === 'string' ? a.category : 'open_question';
    const validCats: TestAssumptionEntry['category'][] = [
      'preconditions', 'fixture_setup', 'oracle_choice',
      'tooling', 'scope_boundary', 'flake_risk', 'open_question',
    ];
    const category = (validCats as string[]).includes(cat)
      ? cat as TestAssumptionEntry['category'] : 'open_question';
    const citations = Array.isArray(a.citations)
      ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
    const assumption: TestAssumptionEntry = {
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
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  childrenRaw: Array<Record<string, unknown>>,
  childAssumptionIds: string[],
  childDepth: number,
): DecompositionTestCase[] {
  const { engine, workflowRun, config, caps, input } = run;
  const emittedChildren: DecompositionTestCase[] = [];
  const siblingDisplayKeys = new Set<string>();
  let fanoutCount = 0;
  for (const c of childrenRaw) {
    if (++fanoutCount > caps.test_fanout_cap) break;
    const child = sanitizeChildTestCase(c, { rootId: entry.displayKey, childIndex: fanoutCount });
    if (!child) continue;
    const tier = normalizeTier(c.tier);
    const rationale = typeof c.decomposition_rationale === 'string' ? c.decomposition_rationale : undefined;
    const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
    const logicalNodeId = mintLogicalNodeId();
    const displayKey = collisionSafeDisplayKey(child.id, siblingDisplayKeys, logicalNodeId);
    siblingDisplayKeys.add(displayKey);

    const { enrichedChild, childActiveConstraints } = buildEnrichedChild(child, entry, input);

    const childRec = engine.writer.writeRecord({
      record_type: 'test_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'test_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'test_decomposition_node',
        node_id: logicalNodeId,
        parent_node_id: entry.nodeId,
        display_key: displayKey,
        root_test_id: entry.rootTestId,
        depth: childDepth,
        pass_number: run.passNumber,
        status: initialStatus,
        tier,
        test_case: enrichedChild,
        decomposition_rationale: rationale,
        surfaced_assumption_ids: childAssumptionIds,
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies TestDecompositionNodeContent,
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
 * Deterministic child enrichment: inherit active_constraints, and canonicalize
 * the child's AC refs against the FR index before persistence (see
 * phase7/acRefResolver.ts header). Carrying canonical ids through the saturation
 * tree keeps packet synthesis and coverage analysis off the fuzzy-bridge path.
 */
function buildEnrichedChild(
  child: DecompositionTestCase,
  entry: QueueEntry,
  input: TestSaturationInput,
): { enrichedChild: DecompositionTestCase; childActiveConstraints: string[] } {
  const childActiveConstraints = child.active_constraints && child.active_constraints.length > 0
    ? child.active_constraints
    : entry.activeConstraints;
  const canonicalChildAcIds = normalizeChildAcRefs(
    child.acceptance_criterion_ids ?? [],
    child,
    input.canonicalAcIndex,
  );
  const enrichedChild: DecompositionTestCase = {
    ...child,
    acceptance_criterion_ids: canonicalChildAcIds,
    active_constraints: childActiveConstraints,
  };
  return { enrichedChild, childActiveConstraints };
}

/** Route an emitted child by tier: A/C recurse (queue), B waits for the gate. */
function routeChildByTier(
  run: SaturationRun,
  pass: PassState,
  entry: QueueEntry,
  args: {
    tier: DecompositionTier;
    enrichedChild: DecompositionTestCase;
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
      rootTestId: entry.rootTestId, depth: args.childDepth, testCase: args.enrichedChild,
      displayKey: args.displayKey, tierHint: 'A',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
      activeConstraints: args.childActiveConstraints,
    });
  } else if (args.tier === 'B') {
    const batch = pass.pendingGateByParent.get(entry.nodeId) ?? [];
    batch.push({ nodeRecordId: args.childRecordId, logicalNodeId: args.logicalNodeId, displayKey: args.displayKey, testCase: args.enrichedChild, rationale: args.rationale });
    pass.pendingGateByParent.set(entry.nodeId, batch);
  } else if (args.tier === 'C') {
    run.queue.push({
      parentRecordId: args.childRecordId, nodeId: args.logicalNodeId, parentNodeId: entry.nodeId,
      rootTestId: entry.rootTestId, depth: args.childDepth, testCase: args.enrichedChild,
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
  run: SaturationRun,
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
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_test_id: entry.rootTestId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'downgraded',
      test_case: entry.testCase,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, downgradedRec.id,
  );
  if (producedTierBChildren) {
    pass.downgradeNotesByParent.set(
      entry.nodeId,
      `The test scenario '${entry.displayKey}' you accepted earlier turned out to ` +
      `have its own commitment layer underneath. The scenarios below need your review.`,
    );
  }
  return true;
}

/** Supersede a parent that produced children (and wasn't downgraded) as decomposed. */
function writeDecomposedSupersession(
  run: SaturationRun,
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
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: originalSubPhase,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_test_id: entry.rootTestId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'decomposed',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      test_case: entry.testCase,
      surfaced_assumption_ids: [],
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, decomposedRec.id,
  );
}

/** Append this pass to the pipeline record and roll the current-record cursor. */
function recordPipelinePass(
  run: SaturationRun,
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
    record_type: 'test_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'test_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_test_id: '*',
      passes: [...run.pipelinePasses],
    } satisfies TestDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, passUpdate.id);
  run.currentPipelineRecordId = passUpdate.id;
}

/**
 * Flag this pass's assumptions that duplicate a prior (by embedding similarity).
 * Returns true only when the embed itself failed (dedup went offline this pass).
 */
async function applyPassDedup(run: SaturationRun, pass: PassState): Promise<boolean> {
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
  run: SaturationRun,
  pass: PassState,
  semanticDelta: number,
): void {
  const { engine, workflowRun, config } = run;
  run.allAssumptions.push(...pass.passAssumptions);
  engine.writer.writeRecord({
    record_type: 'test_assumption_set_snapshot',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'test_design_agent',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: {
      kind: 'test_assumption_set_snapshot',
      pass_number: run.passNumber,
      root_test_id: '*',
      assumptions: [...run.allAssumptions],
      delta_from_previous_pass: pass.passAssumptions.length,
      semantic_delta: semanticDelta,
    } satisfies TestAssumptionSetSnapshotContent,
  });
}

/** Present the Tier-B mirror gates, then prune human-rejected children / queue the rest. */
async function resolveTierBGates(run: SaturationRun, pass: PassState): Promise<void> {
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
          rootTestId: child.rootTestId,
          depth: child.depth,
          testCase: child.testCase,
          displayKey: child.displayKey,
          tierHint: 'B',
          releaseId: child.releaseId,
          releaseOrdinal: child.releaseOrdinal,
          activeConstraints: child.testCase.active_constraints ?? [],
        });
      }
    }
  }
}

/** A pass where assumption dedup was offline: bump the streak, mark announced at threshold. */
function noteDedupOfflinePass(run: SaturationRun): void {
  run.consecutiveDedupOfflinePasses++;
  if (run.consecutiveDedupOfflinePasses >= run.dedupOfflineWarnPasses && !run.dedupOfflineAnnounced) {
    run.dedupOfflineAnnounced = true;
  }
}

/** A pass where assumption dedup was online: reset the offline streak + announcement. */
function noteDedupOnlinePass(run: SaturationRun): void {
  run.dedupOfflineAnnounced = false;
  run.consecutiveDedupOfflinePasses = 0;
}

/** Divergence rail: warn then EARLY-TERMINATE (defer the queue) on sustained growth. */
function detectAndHandleDivergence(run: SaturationRun, nodesProducedThisPass: number): void {
  const { config } = run;
  const priorPass = run.pipelinePasses.length >= 2 ? run.pipelinePasses.at(-2) : null;
  const growthObserved = priorPass
    && priorPass.nodes_produced > 0
    && nodesProducedThisPass > priorPass.nodes_produced * run.divergeGrowthRatio;
  if (growthObserved) {
    run.consecutiveGrowthPasses++;
    if (run.consecutiveGrowthPasses >= run.divergeWarnPasses) {
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging`, {
        passNumber: run.passNumber, consecutiveGrowthPasses: run.consecutiveGrowthPasses,
      });
    }
    if (run.consecutiveGrowthPasses >= run.divergeTerminatePasses) {
      for (const remaining of run.queue) writeDeferredSupersession(run.ctx, remaining, run.passNumber, 'diverging', config);
      run.queue.length = 0;
      run.divergingEarlyTerminate = true;
    }
  } else {
    run.consecutiveGrowthPasses = 0;
  }
}

// ── Finalization ───────────────────────────────────────────────────

/** Pick the termination reason in the original precedence order. */
function resolveTerminationReason(run: SaturationRun, maxRootCalls: number): DecompositionTerminationReason {
  if (run.divergingEarlyTerminate) return 'diverging';
  if (maxRootCalls >= run.caps.test_budget_cap) return 'budget_cap';
  if (run.maxDepthReached >= run.caps.test_depth_cap) return 'depth_cap';
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
    const c = n.content as unknown as TestDecompositionNodeContent;
    if (c.tier && (c.tier === 'A' || c.tier === 'B' || c.tier === 'C' || c.tier === 'D')) {
      tierDistribution[c.tier]++;
    }
    if (c.status === 'atomic') atomicLeafCount++;
  }
  return { tierDistribution, atomicLeafCount };
}

/** Best-effort workflow_runs telemetry (budget / depth / active pipeline). */
function writeTestDecompositionTelemetry(run: SaturationRun, totalLlmCalls: number): void {
  const { engine, workflowRun, config } = run;
  try {
    engine.db.prepare(`
      UPDATE workflow_runs
      SET test_decomposition_budget_calls_used = ?,
          test_decomposition_max_depth_reached = MAX(test_decomposition_max_depth_reached, ?),
          active_test_pipeline_id = ?
      WHERE id = ?
    `).run(totalLlmCalls, run.maxDepthReached, run.pipelineId, workflowRun.id);
  } catch (err) {
    getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: telemetry write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Write the terminal pipeline record + telemetry once the loop has settled. */
function finalizeSaturationRun(run: SaturationRun): void {
  const { engine, workflowRun, config } = run;
  const totalLlmCalls = [...run.callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = run.callsByRoot.size > 0 ? Math.max(...run.callsByRoot.values()) : 0;
  const terminationReason = resolveTerminationReason(run, maxRootCalls);

  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node');
  const { tierDistribution, atomicLeafCount } = summarizeFinalNodes(finalNodes);

  const finalRec = engine.writer.writeRecord({
    record_type: 'test_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'test_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_test_id: '*',
      passes: run.pipelinePasses.map((p, i) =>
        i === run.pipelinePasses.length - 1 ? { ...p, termination_reason: terminationReason } : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: run.maxDepthReached,
      total_llm_calls: totalLlmCalls,
      tier_distribution: tierDistribution,
    } satisfies TestDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, finalRec.id);

  writeTestDecompositionTelemetry(run, totalLlmCalls);
}

function writeDeferredSupersession(
  ctx: PhaseContext,
  entry: QueueEntry,
  passNumber: number,
  reason: string,
  config: TestSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_test_id: entry.rootTestId,
      depth: entry.depth,
      pass_number: passNumber,
      status: 'deferred',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      test_case: entry.testCase,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(workflowRun.id, entry.nodeId, rec.id);
}

interface PrunedChildItem {
  itemId: string;
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  testCase: DecompositionTestCase;
  rootTestId: string;
  depth: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
}

function writePrunedSupersession(
  ctx: PhaseContext,
  parentNodeId: string,
  child: PrunedChildItem,
  reason: string,
  config: TestSaturationConfig,
): void {
  const { engine, workflowRun } = ctx;
  const rec = engine.writer.writeRecord({
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [child.nodeRecordId],
    content: {
      kind: 'test_decomposition_node',
      node_id: child.logicalNodeId,
      parent_node_id: parentNodeId,
      display_key: child.displayKey,
      root_test_id: child.rootTestId,
      depth: child.depth,
      pass_number: 0,
      status: 'pruned',
      tier: 'B',
      test_case: child.testCase,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: child.releaseId,
      release_ordinal: child.releaseOrdinal,
    } satisfies TestDecompositionNodeContent,
  });
  engine.writer.supersedeTestDecompositionNodeByLogicalId(workflowRun.id, child.logicalNodeId, rec.id);
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
    testCase: DecompositionTestCase;
    rationale?: string;
  }>>,
  downgradeNotes: Map<string, string>,
  config: TestSaturationConfig,
): BundlePlan[] {
  const { engine, workflowRun } = ctx;
  const plans: BundlePlan[] = [];
  const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node');
  const byLogical = new Map<string, TestDecompositionNodeContent>();
  for (const r of allNodes) {
    const c = r.content as unknown as TestDecompositionNodeContent;
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
      testCase: c.testCase,
      rootTestId: parent.root_test_id,
      depth: childDepth,
      releaseId: parent.release_id,
      releaseOrdinal: parent.release_ordinal,
    }));
    const bundleId = `${config.gateSurfacePrefix}${parent.display_key}`;
    const items = childItems.map(c => ({
      item_id: c.itemId,
      title: `${c.testCase.name} (${c.displayKey})`,
      description: c.testCase.steps.map(s => `• ${s.description}`).join('\n'),
      details: {
        test_id: c.testCase.id,
        test_type: c.testCase.test_type,
        component_ids: c.testCase.component_ids ?? [],
        acceptance_criterion_ids: c.testCase.acceptance_criterion_ids ?? [],
        active_constraints: c.testCase.active_constraints ?? [],
      },
    }));
    const bundleContext = note
      ? `${note}\n\nReview each Tier-B sub-scenario below; reject any out-of-scope.`
      : `These are scope commitments under "${parent.display_key}" identified during recursive test decomposition. Accept the ones in scope; reject any out-of-scope.`;
    const bundleRec = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '7',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'decision_bundle',
        bundle_id: bundleId,
        bundle_type: 'mirror_decision',
        title: `Tier-B Test Scenarios under "${parent.display_key}"`,
        context: bundleContext,
        items,
      } as Record<string, unknown>,
    });
    engine.eventBus.emit('mirror:presented', {
      mirrorId: bundleId,
      artifactType: 'test_decomposition_bundle',
    });
    plans.push({ bundleRecordId: bundleRec.id, parentNodeId, childItems });
  }
  return plans;
}
