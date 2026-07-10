/**
 * Phase 2 — Requirements Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 2.
 *
 * Sub-phases:
 *   2.1 — Functional Requirements Bloom (Requirements Agent LLM call)
 *   2.2 — Non-Functional Requirements Bloom (Requirements Agent LLM call)
 *   2.3 — Requirements Mirror and Menu (human review via webview)
 *   2.4 — Requirements Consistency Check (deterministic + LLM)
 *   2.5 — Requirements Approval with Domain Attestation (phase gate)
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, findProductDescriptionHandoff } from './phaseContext';
import type {
  PhaseId,
  ProductDescriptionHandoffContent,
  UserJourney,
  Entity,
  WorkflowV2,
  TechnicalConstraint,
  VVRequirement,
  VocabularyTerm,
  ExtractedItem,
  RequirementDecompositionNodeContent,
  AssumptionSetSnapshotContent,
  AssumptionEntry,
  DecompositionUserStory,
  DecompositionAssumptionSource,
  AssumptionCategory,
  DecompositionTier,
  DecompositionNodeStatus,
  RequirementDecompositionPipelineContent,
  DecompositionPassEntry,
  DecompositionTerminationReason,
  GovernedStreamRecord,
  ReleasePlanContentV2,
  CoverageGapContent,
} from '../../types/records';
import { buildPhaseContextPacket } from './dmrContext';
import { runFrBloomThreePass } from './phase2/frBloomThreePass';
import { runNfrBloomThreePass } from './phase2/nfrBloomThreePass';
import { mintCompositeAcIds, type AcStoryLike } from './phase2/acIdNormalizer';
import { runDownstreamScopeGatekeeper } from './downstreamGatekeeper';
import type { NfrSkeleton } from './phase2/verifyNfrCoverage';
import type { DecisionBundleContent, MirrorItem, MirrorItemDecision } from '../../types/decisionBundle';
import { createEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { randomUUID } from 'node:crypto';
import { emit as aoddEmit } from '../../aodd';

// ── Logical-identity helpers ───────────────────────────────────────

/**
 * Mint a fresh canonical UUID for the logical identity of a new
 * decomposition node. The `node_id` / `parent_node_id` / `root_fr_id`
 * fields on RequirementDecompositionNodeContent ALL store UUIDs minted
 * this way — never LLM-emitted `story.id` values, which collide
 * across unrelated subtrees (e.g., the LLM names different children
 * `FR-ACCT-1.1` at many parents). LLM IDs live in `display_key` and
 * `user_story.id` for presentation only.
 */
function mintLogicalNodeId(): string {
  return randomUUID();
}

/**
 * Compute a sibling-unique display label from the LLM's raw `story.id`.
 * If no sibling already uses the same bare label, return as-is. On
 * collision, append a short hex suffix (`#ab12`) derived from the new
 * node's logical UUID so repeated collisions of the same bare label
 * get distinct suffixes. Purely presentational — never used for joins
 * or supersession.
 */
function collisionSafeDisplayKey(
  rawStoryId: string,
  siblingDisplayKeys: Set<string>,
  logicalNodeId: string,
): string {
  if (!siblingDisplayKeys.has(rawStoryId)) return rawStoryId;
  return `${rawStoryId}#${logicalNodeId.slice(0, 4)}`;
}

/**
 * A parent display key that sits in the canonical `US-NNN` / `NFR-NNN`
 * lineage that packet_synthesis joins on — including already-nested
 * descendants (`US-001-1`, `NFR-002-001`, `US-004-D1-2`). Only children
 * under such a parent are id-normalized (see nestChildStoryId); generic
 * decomposition trees with other root namespaces are left untouched.
 */
const CANONICAL_LINEAGE_KEY_RE = /^(?:US|NFR)-\d+(?:-D?\d+)*$/;

/**
 * Normalize a saturation child's `user_story.id` so it nests under its
 * parent's display key — guaranteeing a pure-string path from any leaf
 * back to its canonical root (`US-001` → `US-001-1` → `US-001-1-1`).
 *
 * The decomposer LLM usually emits a nested id (`US-004` → `US-004-1`),
 * but sometimes drifts to an unrelated namespace (parent `US-001` →
 * child `FR-URL-SHORTEN-1.1`). That drift severs the string path that
 * packet_synthesis walks to match a leaf to its canonical user story /
 * NFRs, so those packets fill `nfrs`/`evaluation_criteria`/`compliance`
 * at 0%. The authoritative UUID linkage (`node_id` / `parent_node_id` /
 * `root_fr_id`) is unaffected either way; this only repairs the
 * presentational id, which is what actually flows downstream into joins.
 *
 * Scope: ONLY repairs children whose parent sits in the `US-`/`NFR-`
 * canonical lineage (the namespace packet_synthesis joins on). Parents
 * in any other namespace pass their children through verbatim, so
 * generic decomposition trees are unaffected.
 *
 * Conforming ids (already prefixed by `${parent}-`) pass through
 * unchanged. Non-conforming ids are rewritten to `${parent}-${index}`.
 * The result is de-duplicated against sibling ids already assigned this
 * batch so a derived id can never collide with a kept LLM id.
 */
export function nestChildStoryId(
  rawId: string,
  parentDisplayKey: string,
  childIndex: number,
  takenSiblingIds: Set<string>,
): string {
  // Only normalize within the canonical US/NFR lineage joined downstream.
  if (!CANONICAL_LINEAGE_KEY_RE.test(parentDisplayKey)) {
    takenSiblingIds.add(rawId);
    return rawId;
  }
  let id = rawId;
  if (!rawId.startsWith(`${parentDisplayKey}-`)) {
    id = `${parentDisplayKey}-${childIndex}`;
  }
  if (takenSiblingIds.has(id)) {
    let n = childIndex + 1;
    while (takenSiblingIds.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  takenSiblingIds.add(id);
  return id;
}

// ── Release-plan propagation (Wave 6 — release prioritization) ─────

/**
 * Resolve a root decomposition node's `(release_id, release_ordinal)`
 * by matching its `user_story.traces_to` against the approved
 * ReleasePlan. Rules:
 *
 *   - Pick the lowest-ordinal release whose `traces_to_journeys`
 *     intersects the root story's `traces_to`. Ties go to the earliest
 *     release.
 *   - If no release matches (no journey overlap): backlog — return
 *     both fields null. Downstream phases treat backlog as "lowest
 *     priority, surface for re-planning".
 *   - If no ReleasePlan is passed (null — e.g. a mock-mode run that
 *     skipped Phase 1.8, or a default-lens run with no release plan):
 *     backlog for every root.
 *
 * Children inherit from their parent; this helper is only called at
 * depth-0 root writes.
 */
export function assignReleaseToRoot(
  rootStory: DecompositionUserStory | { traces_to?: string[] },
  plan: ReleasePlanContentV2 | null,
): { release_id: string | null; release_ordinal: number | null } {
  if (!plan?.approved) return { release_id: null, release_ordinal: null };
  const traces = rootStory.traces_to ?? [];
  if (traces.length === 0) return { release_id: null, release_ordinal: null };
  // Widened manifest lookup: an FR root's `traces_to[]` can cite any
  // handoff artifact type (journey, workflow, entity, compliance,
  // integration, vocabulary). For each release (ascending ordinal),
  // test whether any of the root's trace ids appear in any of that
  // release's `contains[type]` arrays. First match wins.
  //
  // Two-pass match:
  //   Pass 1 — look for a release-specific match in `contains[type]`.
  //            First (lowest-ordinal) hit wins.
  //   Pass 2 — if no release matched but at least one trace id resolves
  //            into `cross_cutting[type]`, anchor the root to the FIRST
  //            release. Rationale: NFR roots typically trace exclusively
  //            to product-wide VV-* / QA-N / TECH-* / vocab items that
  //            live in cross_cutting by default (see buildReleaseManifest).
  //            Without this fallback every such root falls to Backlog,
  //            which is the ts-13 cascade. Release-1 is the right anchor
  //            because cross-cutting items, by definition, ship in (and
  //            apply to) every release — so the earliest one is the
  //            ordering-correct choice for a cross-cutting-only root.
  //   Otherwise — backlog (release_id: null).
  const sortedReleases = [...plan.releases].sort((a, b) => a.ordinal - b.ordinal);
  const traceSet = new Set(traces);
  // Pass 0 (journey-precedence, cal-38 US-014) — a functional root's PRIMARY intent
  // is the user journey it delivers. A shared foundational entity/workflow that ships
  // in an EARLIER release must not drag the root forward: US-014 traced journey
  // UJ-SCHEDULING-BOOKING + workflow WF-BOOKING-FINALIZE + 2 entities (all Release 2),
  // but ENT-SERVICE-CALL (Release 1) matched first in the widened scan below and
  // pulled the whole FR into Release 1 — where its appointment entity and booking
  // workflow don't yet exist (undeliverable). So if the root traces any accepted
  // journey, the lowest-ordinal release containing one of those journeys wins
  // outright, before the widened any-artifact match. Roots with no journey trace
  // (NFRs, entity/workflow-only FRs) fall through to the widened match unchanged.
  for (const r of sortedReleases) {
    if (r.contains.journeys.some((id: string) => traceSet.has(id))) {
      return { release_id: r.release_id, release_ordinal: r.ordinal };
    }
  }
  for (const r of sortedReleases) {
    const c = r.contains;
    const anyMatch =
      c.journeys.some((id: string) => traceSet.has(id)) ||
      c.workflows.some((id: string) => traceSet.has(id)) ||
      c.entities.some((id: string) => traceSet.has(id)) ||
      c.compliance.some((id: string) => traceSet.has(id)) ||
      c.integrations.some((id: string) => traceSet.has(id)) ||
      c.vocabulary.some((id: string) => traceSet.has(id)) ||
      // VV / QA / TECH slots added after the ts-13 backlog cascade — these
      // are usually empty in `contains` (cross_cutting is the default)
      // but a future trigger rule may promote specific ids into a
      // release's contains, at which point this scan picks them up.
      (c.vv_requirements ?? []).some((id: string) => traceSet.has(id)) ||
      (c.quality_attributes ?? []).some((id: string) => traceSet.has(id)) ||
      (c.technical_constraints ?? []).some((id: string) => traceSet.has(id));
    if (anyMatch) return { release_id: r.release_id, release_ordinal: r.ordinal };
  }
  // Pass 2 — cross-cutting fallback to Release 1.
  const cc = plan.cross_cutting;
  const ccHit =
    cc.workflows.some((id: string) => traceSet.has(id)) ||
    cc.compliance.some((id: string) => traceSet.has(id)) ||
    cc.integrations.some((id: string) => traceSet.has(id)) ||
    cc.vocabulary.some((id: string) => traceSet.has(id)) ||
    (cc.vv_requirements ?? []).some((id: string) => traceSet.has(id)) ||
    (cc.quality_attributes ?? []).some((id: string) => traceSet.has(id)) ||
    (cc.technical_constraints ?? []).some((id: string) => traceSet.has(id));
  if (ccHit && sortedReleases.length > 0) {
    const first = sortedReleases[0];
    return { release_id: first.release_id, release_ordinal: first.ordinal };
  }
  return { release_id: null, release_ordinal: null };
}

/**
 * Read the approved ReleasePlan (v2 widened manifest) for a run from
 * the governed stream. Returns null when the pointer is unset
 * (default-lens runs; or runs that haven't reached Phase 1.8 yet —
 * e.g. unit tests that seed the minimum fixtures). Callers treat null
 * as "assign every root to backlog".
 *
 * Accepts only schemaVersion '2.0' records. Legacy v1.0 plans are
 * treated as absent (null) — the caller will fall back to
 * backlog-for-every-root, which is identical to what the legacy flow
 * did when `plan.releases[].traces_to_journeys` didn't match. No old
 * calibration workspaces need to survive this transition (per design).
 */
function readActiveReleasePlan(ctx: PhaseContext): ReleasePlanContentV2 | null {
  const { engine, workflowRun } = ctx;
  const ptr = engine.stateMachine.getWorkflowRun(workflowRun.id)?.active_release_plan_record_id;
  if (!ptr) return null;
  const rec = engine.writer.getRecord(ptr);
  if (!rec) return null;
  const c = rec.content as unknown as ReleasePlanContentV2;
  if (c?.kind !== 'release_plan' || c.schemaVersion !== '2.0' || !c.approved) return null;
  return c;
}

// ── Artifact shape interfaces ──────────────────────────────────────

interface AcceptanceCriterion {
  id: string;
  description: string;
  measurable_condition: string;
}

type UserStoryPriority = 'critical' | 'high' | 'medium' | 'low';

interface UserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  acceptance_criteria: AcceptanceCriterion[];
  priority: UserStoryPriority;
  /**
   * Traceability spine (wave 5) — ids of handoff items this user story
   * derives from. Under the product lens these will typically be
   * journey ids (`UJ-*`), entity ids (`ENT-*`), workflow ids (`WF-*`),
   * compliance items (`COMP-*`), or canonical-vocab terms (`VOC-*`).
   * Empty array in default-lens flows where no handoff exists yet.
   */
  traces_to?: string[];
}

interface FunctionalRequirements {
  user_stories: UserStory[];
}

interface NonFunctionalRequirement {
  id: string;
  // Widened in wave 5 to accommodate V&V and compliance categories that
  // the product-lens flow surfaces from the handoff.
  category:
    | 'performance'
    | 'security'
    | 'reliability'
    | 'scalability'
    | 'accessibility'
    | 'maintainability'
    | 'availability'
    | 'durability'
    | 'auditability'
    | 'observability'
    | 'compliance';
  description: string;
  /**
   * NFR priority — emitted by the Pass-1 producer (NfrSkeleton.priority)
   * and carried through the Pass-2 enrichment merge. Required in the
   * final artifact so downstream consumers (NFR decomposition, eval
   * threshold weighting) can rank NFRs.
   */
  priority: UserStoryPriority;
  threshold: string;
  measurement_method?: string;
  /**
   * Traceability spine (wave 5) — ids of handoff items that seeded this
   * NFR. Under the product lens these will typically be vvRequirement
   * ids (`VV-*`), qualityAttributes (indexed reference), technical
   * constraint ids (`TECH-*`), or compliance item ids (`COMP-*`).
   */
  traces_to?: string[];
  /**
   * FR user_story ids this NFR governs (wave 5 trace-id fix). Distinct
   * from `traces_to[]`: that points at handoff seeds; this points at
   * sibling FRs. Optional — present when the NFR scopes specific FRs
   * (e.g. an auditability NFR over journal-posting FRs).
   */
  applies_to_requirements?: string[];
}

interface NonFunctionalRequirements {
  requirements: NonFunctionalRequirement[];
}

interface ConsistencyFinding {
  severity: 'critical' | 'warning';
  description: string;
  artifact_ids_involved: string[];
  recommended_action: string;
}

interface ConsistencyReport {
  overall_pass: boolean;
  traceability_results: Array<{
    assertion: string;
    pass: boolean;
    failures: Array<{ item_id: string; explanation: string }>;
  }>;
  semantic_findings: ConsistencyFinding[];
  internal_findings: ConsistencyFinding[];
  blocking_failures: string[];
  warnings: string[];
}

// ── Handler ────────────────────────────────────────────────────────

/**
 * Parameterizes runSaturationLoop so the same body drives FR (2.1a) and
 * NFR (2.2a) decomposition with kind-specific template, record sub_phase_id,
 * gate surface prefix, and root_kind tag on written nodes.
 */
interface SaturationLoopConfig {
  recordSubPhaseId: 'fr_saturation' | 'nfr_saturation';
  templateSubPhase: string;
  rootKind: 'fr' | 'nfr';
  gateSurfacePrefix: string;
  /**
   * For NFR saturation, the FR/user-story summary so children can
   * ground `applies_to_requirements: [US-*]` references. The NFR
   * saturation prompt's hard rules permit this, but without the
   * roster the model fabricates US-* ids that pass the
   * `sanitizeChildStory` filter unchallenged. FR runs leave this
   * null — FR children don't reference FRs by id.
   */
  applicableFrSummary?: string | null;
}

/**
 * Map a functional user story to the gatekeeper's prune-item shape.
 * Extracted from Phase2Handler.execute so the label + ternary formatting
 * live outside the phase body (behavior-preserving).
 */
function toFrGateItem(s: UserStory) {
  return {
    id: s.id,
    label: `${s.id}: As a ${s.role}, I want to ${s.action}, so that ${s.outcome}`,
    description: (s.acceptance_criteria ?? []).map(ac => `${ac.id}: ${ac.measurable_condition ?? ac.description}`).join('; '),
    tradeoffs: Array.isArray(s.traces_to) ? `traces_to: ${s.traces_to.join(', ')}` : undefined,
  };
}

/**
 * Map a non-functional requirement to the gatekeeper's prune-item shape.
 * Extracted from Phase2Handler.execute (behavior-preserving).
 */
function toNfrGateItem(n: NonFunctionalRequirement) {
  return {
    id: n.id,
    label: `${n.id} [${n.category}]: ${n.description}`,
    description: n.threshold ? `threshold: ${n.threshold}` : undefined,
    tradeoffs: Array.isArray(n.applies_to_requirements)
      ? `applies_to: ${n.applies_to_requirements.join(', ')}`
      : undefined,
  };
}

// ── Saturation-loop run state (Wave 6 Step 4a) ─────────────────────
//
// The FR/NFR saturation decomposer was a single ~900-line method whose
// cognitive complexity made it unreviewable. It is now decomposed into a
// setup builder (prepareFrSaturationRun), a per-pass runner
// (runFrSaturationPasses), per-entry / gate / divergence helpers, and a
// finalizer — all threading ONE mutable run-state object BY REFERENCE so
// every queue / sibling / counter / cursor write-back lands on the same
// object. Behavior (persisted-record order, telemetry, LLM-call order) is
// identical to the original single-function form.

type SaturationEngine = PhaseContext['engine'];
type SaturationWorkflowRun = PhaseContext['workflowRun'];
type FrDecompositionCaps = ReturnType<SaturationEngine['configManager']['get']>['decomposition'];
type FrSaturationTemplate = NonNullable<ReturnType<SaturationEngine['templateLoader']['findTemplate']>>;

/** One not-yet-decomposed node awaiting a decomposer pass. */
interface SaturationQueueEntry {
  parentRecordId: string;            // governed-stream row UUID of the parent record revision
  nodeId: string;                    // logical UUID (content.node_id) — stable across revisions
  parentNodeId: string | null;       // parent's logical UUID
  rootFrId: string;                  // root's logical UUID
  depth: number;
  userStory: DecompositionUserStory; // carries LLM's raw story.id for display / prompt context
  displayKey: string;                // sibling-unique human label (content.display_key)
  tierHint: DecompositionTier | 'root';
  // Release assignment — inherited from this entry's root and preserved
  // across supersessions (see design doc Q2: preserve).
  releaseId: string | null;
  releaseOrdinal: number | null;
}

/** A Tier-B child waiting on its parent's mirror gate. */
interface FrPendingGateChild {
  nodeRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  story: DecompositionUserStory;
  rationale?: string;
}

/** A clean post-gate Tier-B parent whose children queue a shape audit. */
interface FrPostGateCleanAudit {
  parentLogicalNodeId: string;
  parentDisplayKey: string;
  parentStory: DecompositionUserStory;
  children: DecompositionUserStory[];
}

/** One emitted mirror-gate bundle plan (return element of emitDepth2GateBundles). */
interface FrGateBundlePlan {
  bundleRecordId: string;
  parentNodeId: string;              // parent's logical UUID
  childItems: Array<{
    itemId: string;                  // bundle-local id (`child-${idx}`)
    nodeRecordId: string;            // governed-stream row UUID of the child decomposition node
    logicalNodeId: string;           // child's logical UUID (content.node_id)
    displayKey: string;              // sibling-unique human label (content.display_key)
    userStory: DecompositionUserStory;
    rootFrId: string;
    depth: number;
    releaseId: string | null;
    releaseOrdinal: number | null;
  }>;
}

/**
 * All shared, resolved-immutable + mutable state for one FR/NFR saturation
 * run. Threaded by reference through every pass / entry / post-pass helper so
 * each queue / sibling / counter / cursor write-back lands on the SAME object.
 */
interface FrSaturationRun {
  ctx: PhaseContext;
  engine: SaturationEngine;
  workflowRun: SaturationWorkflowRun;
  config: SaturationLoopConfig;
  caps: FrDecompositionCaps;
  template: FrSaturationTemplate;
  handoffSummary: string;
  pipelineId: string;
  pipelineRootKey: string;
  embeddingClient: EmbeddingClient;
  embeddingCache: Map<string, number[]>;
  dedupThreshold: number;
  dedupEnabled: boolean;
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
  allAssumptions: AssumptionEntry[];
  assumptionSeq: number;
  queue: SaturationQueueEntry[];
  siblingsByParent: Map<string | null, DecompositionUserStory[]>;
  callsByRoot: Map<string, number>;
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
  parentChain: Map<string, string | null>;
  consecutiveGrowthPasses: number;
  consecutiveDedupOfflinePasses: number;
  dedupOfflineAnnounced: boolean;
  divergingEarlyTerminate: boolean;
}

/** Pass-scoped accumulators — recreated fresh at the top of each pass. */
interface FrPassState {
  passAssumptions: AssumptionEntry[];
  pendingGateByParent: Map<string, FrPendingGateChild[]>;
  downgradeNotesByParent: Map<string, string>;
  postGateCleanAudits: FrPostGateCleanAudit[];
}

export class Phase2Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '2';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const intentSummary = prior.intentStatement?.summary ?? 'No intent statement available';

    // Phase 1 (post-Wave 8) hard-fails on any non-product lens, so every
    // run that reaches Phase 2 MUST carry a product_description_handoff.
    // If one is missing, the pipeline is in a broken state — hard-fail
    // rather than fall back to a legacy lens-neutral path that produces
    // lossy output without coverage contracts.
    const allHandoffRecords = engine.writer.getRecordsByType(workflowRun.id, 'product_description_handoff');
    const handoffHit = findProductDescriptionHandoff(allHandoffRecords);
    if (!handoffHit) {
      return {
        success: false,
        error: 'Phase 2 requires a product_description_handoff from Phase 1. None found — the pipeline should have hard-failed at Phase 1 lens dispatch if a non-product lens was classified. This indicates an upstream orchestration bug.',
        artifactIds,
      };
    }
    const handoff = handoffHit.content as unknown as ProductDescriptionHandoffContent;
    const handoffRecordId = handoffHit.recordId;

    // ── 2.1 — Functional Requirements Bloom ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'fr_bloom_skeleton');

    // Wave 6 resume — if depth-0 FR decomposition nodes already exist
    // for this run, we're resuming a partial/stalled prior run. Skip
    // the bloom (don't overwrite with possibly-different output) and
    // recover rootStories + rootNodeIds from the stream. The FR
    // artifact_produced record is re-emitted from the recovered stories
    // so downstream phases see it idempotently.
    const existingRootNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node')
      .filter(r => {
        const c = r.content as unknown as RequirementDecompositionNodeContent;
        return c.depth === 0 && (c.root_kind ?? 'fr') === 'fr';
      });
    const resumingFr = existingRootNodes.length > 0;

    const frBuild = await this.buildFrRequirements(
      ctx, prior, handoff, handoffRecordId, intentSummary, resumingFr, existingRootNodes,
    );
    let frContent = frBuild.frContent;
    const frCoverageGaps = frBuild.frCoverageGaps;

    // Phase-exit correction: mint workflow-globally-unique composite AC
    // ids (`AC-US{nnn}-{mmm}`) so downstream consumers can join via
    // exact-string membership instead of carrying parallel story scope.
    // Idempotent — preserves existing composite ids and extends the
    // per-story counter for new ACs (matters for enrichment/replay).
    this.mintAndLogFrAcIds(frContent);

    let frRecord = this.writeFrArtifact(ctx, prior, handoffRecordId, frContent, artifactIds);

    // Phase-exit scope gatekeeper. Cross-checks each user story against
    // the Phase 1 accepted sets (journeys/workflows/entities) + the
    // intent's Out-of-Scope statements. A story whose action describes
    // spec-marked OOS behavior is dropped even when its `traces_to`
    // cites a valid journey id — that's the case the deterministic
    // contract checks cannot catch.
    const frPrune = await runDownstreamScopeGatekeeper(ctx, {
      phaseId: '2',
      subPhaseId: 'fr_bloom_skeleton',
      bloomDescription: 'functional user stories',
      items: frContent.user_stories.map(toFrGateItem),
      originalArtifactId: frRecord.id,
      overlay: 'Each user story should describe a user-facing FUNCTIONAL behavior the product genuinely needs. DROP stories whose action describes spec-marked Out-of-Scope behavior (e.g., bulk submission, user accounts, custom slugs when explicitly excluded) even when their `traces_to` cites a valid journey id — the journey id alone is not enough to justify the story. ALSO DROP stories whose CORE PURPOSE is a non-functional quality/operational concern — monitoring/observing uptime, alerting on failure, ensuring latency/availability/reliability, health-checking, metric publishing, encryption-as-a-property — rather than a user-facing product behavior. Those are Non-Functional Requirements (Sub-Phase 2.2) and cross-cutting constraints folded into the functional components, NOT functional user stories. (The underlying NFR is still captured in the NFR roster.)',
    });
    const frPruned = this.resolvePrunedFr(ctx, frPrune, frContent, frRecord, artifactIds);
    frContent = frPruned.frContent;
    frRecord = frPruned.frRecord;

    // Wave 8 Pass 3 — persist coverage_gap records from the deterministic
    // verifier. Blocking severity halts the phase; advisory severity logs
    // but proceeds. Only runs on non-resume product-lens paths.
    const frGapFailure = this.handleCoverageGaps(ctx, frCoverageGaps, [frRecord.id], artifactIds, {
      verifierLabel: 'Phase 2.1c FR coverage verifier',
      blockingLogMessage: 'Phase 2.1c: blocking coverage gaps detected',
      advisoryLogMessage: 'Phase 2.1c: advisory-only coverage notes',
    });
    if (frGapFailure) return frGapFailure;

    // ── 2.1a — Functional Requirements Decomposition ──
    // Wave 6 — emit depth-0 decomposition node records mirroring each
    // root FR (skipped on resume), then run the Pass-1 tier-based
    // saturation loop. Handoff always present post-Wave 8.
    await this.runFrDecomposition(ctx, handoff, frContent, frRecord, resumingFr, existingRootNodes);

    // ── 2.2 — Non-Functional Requirements Bloom ───────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'nfr_bloom_skeleton');

    // Wave 6 resume — same idempotency as FR: if depth-0 NFR nodes
    // already exist, recover from stream rather than re-bloom.
    const existingNfrRootNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node')
      .filter(r => {
        const c = r.content as unknown as RequirementDecompositionNodeContent;
        return c.depth === 0 && c.root_kind === 'nfr';
      });
    const resumingNfr = existingNfrRootNodes.length > 0;

    // Build a rich FR summary for the NFR prompt
    const frSummary = frContent.user_stories.map(s => {
      const acs = s.acceptance_criteria.map(ac => `${ac.id}: ${ac.measurable_condition}`).join('; ');
      return `${s.id} [${s.priority}]: As a ${s.role}, I want to ${s.action}, so that ${s.outcome}. ACs: ${acs}`;
    }).join('\n');

    const nfrBuild = await this.buildNfrRequirements(ctx, {
      prior, handoff, handoffRecordId, intentSummary, frContent, frRecord, frSummary,
      resumingNfr, existingNfrRootNodes,
    });
    let nfrContent = nfrBuild.nfrContent;
    const nfrCoverageGaps = nfrBuild.nfrCoverageGaps;

    let nfrRecord = this.writeNfrArtifact(ctx, frRecord, handoffRecordId, nfrContent, artifactIds);

    // Phase-exit scope gatekeeper. ts-109 surfaced LLM-fabricated NFR
    // thresholds that contradict spec (50ms vs spec's 100ms; 99.95%
    // monthly vs 99.9%; rate-limit specifics when rate-limiting is
    // explicitly Out of Scope). The gatekeeper sees the V&V upstream
    // and the spec's positive constraints and drops NFRs that
    // contradict or fabricate beyond them.
    const nfrPrune = await runDownstreamScopeGatekeeper(ctx, {
      phaseId: '2',
      subPhaseId: 'nfr_bloom_skeleton',
      bloomDescription: 'non-functional requirements',
      items: nfrContent.requirements.map(toNfrGateItem),
      originalArtifactId: nfrRecord.id,
      overlay: 'NFR thresholds must NOT contradict upstream V&V Requirements or Intent Constraints. DROP NFRs whose threshold tightens, loosens, or fabricates a number the spec did not state (e.g., asserting 50ms when the spec says 100ms; 99.95% when the spec says 99.9%). DROP NFRs whose category names a feature the Intent Constraints mark Out-of-Scope (e.g., a rate-limiting NFR when rate-limiting is explicitly excluded).',
    });
    const nfrPruned = this.resolvePrunedNfr(ctx, nfrPrune, nfrContent, nfrRecord, artifactIds);
    nfrContent = nfrPruned.nfrContent;
    nfrRecord = nfrPruned.nfrRecord;

    // Wave 8 Pass 3 — persist NFR coverage_gap records. Blocking halts
    // the phase; advisory logs and proceeds. Only runs on non-resume
    // product-lens paths.
    const nfrGapFailure = this.handleCoverageGaps(ctx, nfrCoverageGaps, [nfrRecord.id], artifactIds, {
      verifierLabel: 'Phase 2.2c NFR coverage verifier',
      blockingLogMessage: 'Phase 2.2c: blocking NFR coverage gaps detected',
      advisoryLogMessage: 'Phase 2.2c: advisory-only NFR coverage notes',
    });
    if (nfrGapFailure) return nfrGapFailure;

    // ── 2.2a — Non-Functional Requirements Decomposition ──
    // Wave 6 — emit depth-0 NFR decomposition node records and run the
    // NFR saturation loop (same method that drives FR decomposition,
    // parameterized on sub-phase id + template id + root_kind).
    await this.runNfrDecomposition(ctx, handoff, nfrContent, nfrRecord, frSummary, resumingNfr, existingNfrRootNodes);

    // ── 2.3 — Requirements Mirror and Menu ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'requirement_set_finalize');

    const mirrorFailure = await this.presentRequirementsMirror(ctx, frRecord, nfrRecord, frContent, nfrContent, artifactIds);
    if (mirrorFailure) return mirrorFailure;

    // ── 2.4 — Requirements Consistency Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'requirement_set_review_prep');

    const consistencyReport = this.runConsistencyCheck(frContent, nfrContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'requirement_set_review_prep',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id],
      content: {
        kind: 'consistency_report',
        ...consistencyReport,
      },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    if (!consistencyReport.overall_pass) {
      engine.eventBus.emit('error:occurred', {
        message: 'Requirements consistency check found blocking failures',
        context: JSON.stringify(consistencyReport.blocking_failures),
      });
      // Don't fail the phase — surface through the gate instead
    }

    // ── 2.5 — Approval with Domain Attestation ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'requirements_gate');

    const attestation = await this.presentDomainAttestation(ctx, consistencyRecord, consistencyReport, artifactIds);
    if (attestation.failure) return attestation.failure;
    const attestationRecord = attestation.attestationRecord;

    // ── Phase Gate ────────────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'requirements_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id, consistencyRecord.id, attestationRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '2',
        functional_requirements_record_id: frRecord.id,
        non_functional_requirements_record_id: nfrRecord.id,
        consistency_report_record_id: consistencyRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        domain_attestation_confirmed: true,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '2' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── Phase 2 sub-step helpers (extracted from execute; behavior-preserving) ──

  /**
   * Sub-Phase 2.1 — assemble the functional-requirements artifact content.
   * On resume, reconstruct it from the existing depth-0 FR nodes; otherwise
   * invoke DMR + the product-lens three-pass bloom. Behavior-preserving
   * extraction from execute.
   */
  private async buildFrRequirements(
    ctx: PhaseContext,
    prior: ReturnType<typeof extractPriorPhaseContext>,
    handoff: ProductDescriptionHandoffContent,
    handoffRecordId: string,
    intentSummary: string,
    resumingFr: boolean,
    existingRootNodes: GovernedStreamRecord[],
  ): Promise<{ frContent: FunctionalRequirements; frCoverageGaps: CoverageGapContent[] }> {
    if (resumingFr) {
      getLogger().info('workflow', 'Phase 2.1 RESUME: using existing depth-0 FR nodes; skipping bloom', {
        existingRoots: existingRootNodes.length,
      });
      return {
        frContent: {
          user_stories: existingRootNodes.map(r =>
            (r.content as unknown as RequirementDecompositionNodeContent).user_story as UserStory,
          ),
        },
        frCoverageGaps: [],
      };
    }
    // Invoke DMR to assemble cross-cutting context (active constraints,
    // material findings, ingested external files) before the bloom.
    const dmr21Seeds = [
      ...(prior.intentStatement ? [prior.intentStatement.recordId] : []),
      ...(handoffRecordId ? [handoffRecordId] : []),
    ];
    const dmr21 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'fr_bloom_skeleton',
      requestingAgentRole: 'requirements_agent',
      query: `Functional requirements bloom grounded in product_description_handoff ${handoffRecordId ?? 'unknown'} and intent_statement ${prior.intentStatement?.recordId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr21Seeds,
      detailFileLabel: 'p2_1_func_req',
      requiredOutputSpec: 'functional_requirements JSON — user_stories with acceptance_criteria',
    });
    // Wave 8 — product-lens three-pass flow (skeleton → self-heal →
    // AC enrichment → verifier). Handoff presence is guaranteed by
    // the Phase 2 entry check above.
    const three = await runFrBloomThreePass({
      ctx, handoff, dmr: dmr21, intentSummary,
      format: { formatJourneys, formatEntities, formatWorkflows, formatExtractedItems, formatVocabulary },
    });
    return {
      frContent: { user_stories: three.userStories as UserStory[] },
      frCoverageGaps: three.coverageGaps,
    };
  }

  /**
   * Phase-exit correction: mint workflow-globally-unique composite AC ids
   * and log when any were minted/skipped. Mutates `frContent.user_stories`
   * in place (same as the original inline call). Behavior-preserving.
   */
  private mintAndLogFrAcIds(frContent: FunctionalRequirements): void {
    const acMint = mintCompositeAcIds(frContent.user_stories);
    if (acMint.minted > 0 || acMint.skippedStoryIds.length > 0) {
      getLogger().info('workflow', 'Phase 2.1 AC id normalizer applied', {
        minted: acMint.minted,
        preserved: acMint.preserved,
        skippedStoryIds: acMint.skippedStoryIds,
      });
    }
  }

  /**
   * Write the functional_requirements artifact_produced record, register it
   * in artifactIds, and ingest it. Returns the written record.
   */
  private writeFrArtifact(
    ctx: PhaseContext,
    prior: ReturnType<typeof extractPriorPhaseContext>,
    handoffRecordId: string,
    frContent: FunctionalRequirements,
    artifactIds: string[],
  ): GovernedStreamRecord {
    const { engine, workflowRun } = ctx;
    // Include both the intent_statement id AND (when available) the
    // product_description_handoff id in the derived_from chain — that
    // way the traceability spine `handoff → FR → …` is walkable from
    // the governed stream without needing to re-query by record_type.
    const frDerivedFrom = [
      ...(prior.intentStatement ? [prior.intentStatement.recordId] : []),
      ...(handoffRecordId ? [handoffRecordId] : []),
    ];
    const frRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'fr_bloom_skeleton',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: frDerivedFrom,
      content: {
        kind: 'functional_requirements',
        ...frContent,
      },
    });
    artifactIds.push(frRecord.id);
    engine.ingestionPipeline.ingest(frRecord);
    return frRecord;
  }

  /**
   * Apply the FR scope-gatekeeper outcome: when the gatekeeper dropped
   * stories, write a pruned superseding record and return the pruned
   * content/record; otherwise pass through unchanged. Behavior-preserving.
   */
  private resolvePrunedFr(
    ctx: PhaseContext,
    frPrune: Awaited<ReturnType<typeof runDownstreamScopeGatekeeper>>,
    frContent: FunctionalRequirements,
    frRecord: GovernedStreamRecord,
    artifactIds: string[],
  ): { frContent: FunctionalRequirements; frRecord: GovernedStreamRecord } {
    if (frPrune.skipped || frPrune.dropped.length === 0) {
      return { frContent, frRecord };
    }
    const { engine, workflowRun } = ctx;
    const keptSet = new Set(frPrune.kept_ids);
    const prunedStories = frContent.user_stories.filter(s => keptSet.has(s.id));
    const prunedFrContent = { user_stories: prunedStories };
    const prunedRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'fr_bloom_skeleton',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id],
      content: { kind: 'functional_requirements', ...prunedFrContent },
    });
    engine.writer.supersedByRollback(frRecord.id, prunedRecord.id);
    engine.ingestionPipeline.ingest(prunedRecord);
    frContent = prunedFrContent;
    frRecord = prunedRecord;
    artifactIds.push(prunedRecord.id);
    return { frContent, frRecord };
  }

  /**
   * Sub-Phase 2.1a — emit depth-0 decomposition nodes then run the
   * tier-based saturation loop for the functional requirements.
   * Behavior-preserving extraction from execute.
   */
  private async runFrDecomposition(
    ctx: PhaseContext,
    handoff: ProductDescriptionHandoffContent,
    frContent: FunctionalRequirements,
    frRecord: GovernedStreamRecord,
    resumingFr: boolean,
    existingRootNodes: GovernedStreamRecord[],
  ): Promise<void> {
    const { engine, workflowRun } = ctx;
    const { rootNodeIds, rootLogicalIds } = this.emitRootDecompositionNodes(
      ctx, frContent.user_stories, frRecord.id, 'fr_bloom_skeleton', 'fr', resumingFr, existingRootNodes,
    );
    engine.stateMachine.setSubPhase(workflowRun.id, 'fr_saturation');
    const frRootCap = engine.configManager.get().decomposition.max_root_count_fr;
    const frRoots = frRootCap > 0 ? frContent.user_stories.slice(0, frRootCap) : frContent.user_stories;
    const frRootNodeIds = frRootCap > 0 ? rootNodeIds.slice(0, frRootCap) : rootNodeIds;
    const frRootLogicalIds = frRootCap > 0 ? rootLogicalIds.slice(0, frRootCap) : rootLogicalIds;
    if (frRootCap > 0 && frContent.user_stories.length > frRootCap) {
      getLogger().info('workflow', 'Phase 2.1a: max_root_count_fr cap applied', {
        cap: frRootCap, totalRoots: frContent.user_stories.length, saturatedRoots: frRoots.length,
      });
    }
    await this.runSaturationLoop(ctx, handoff, frRoots, frRootNodeIds, frRootLogicalIds);
  }

  /**
   * Sub-Phase 2.2 — assemble the non-functional-requirements artifact
   * content. On resume, reconstruct from existing depth-0 NFR nodes;
   * otherwise invoke DMR + the product-lens three-pass NFR bloom.
   * Behavior-preserving extraction from execute.
   */
  private async buildNfrRequirements(
    ctx: PhaseContext,
    opts: {
      prior: ReturnType<typeof extractPriorPhaseContext>;
      handoff: ProductDescriptionHandoffContent;
      handoffRecordId: string;
      intentSummary: string;
      frContent: FunctionalRequirements;
      frRecord: GovernedStreamRecord;
      frSummary: string;
      resumingNfr: boolean;
      existingNfrRootNodes: GovernedStreamRecord[];
    },
  ): Promise<{ nfrContent: NonFunctionalRequirements; nfrCoverageGaps: CoverageGapContent[] }> {
    const {
      prior, handoff, handoffRecordId, intentSummary, frContent, frRecord,
      frSummary, resumingNfr, existingNfrRootNodes,
    } = opts;
    if (resumingNfr) {
      getLogger().info('workflow', 'Phase 2.2 RESUME: using existing depth-0 NFR nodes; skipping bloom', {
        existingRoots: existingNfrRootNodes.length,
      });
      // Rebuild NFR shape from the user-story-adapted nodes. The
      // saturation loop only uses .id / .user_story for decomposition,
      // so a minimal reconstruction is sufficient. We preserve the
      // stored user_story wholesale.
      return {
        nfrContent: {
          requirements: existingNfrRootNodes.map(r => {
            const c = r.content as unknown as RequirementDecompositionNodeContent;
            const s = c.user_story;
            return {
              id: s.id,
              category: 'security' as const,
              description: s.action,
              // Resume path has no priority field on the stored user_story
              // shape (the adapter dropped it pre-priority). Default to
              // 'medium' rather than fail; saturation only uses id +
              // user_story.
              priority: (s as { priority?: UserStoryPriority }).priority ?? 'medium',
              threshold: s.outcome,
              measurement_method: s.acceptance_criteria[0]?.measurable_condition,
              traces_to: s.traces_to ?? [],
            };
          }),
        },
        nfrCoverageGaps: [],
      };
    }
    const frIds = frContent.user_stories.map(s => s.id);
    const dmr22Seeds = [
      frRecord.id,
      ...(handoffRecordId ? [handoffRecordId] : []),
      ...(prior.intentStatement ? [prior.intentStatement.recordId] : []),
    ];
    const dmr22 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'nfr_bloom_skeleton',
      requestingAgentRole: 'requirements_agent',
      query: `Non-functional requirements covering FRs ${frIds.join(', ')} (artifact ${frRecord.id}) under product_description_handoff ${handoffRecordId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr22Seeds,
      detailFileLabel: 'p2_2_nfr',
      requiredOutputSpec: 'non_functional_requirements JSON — performance, security, reliability, etc.',
    });
    // Wave 8 — product-lens three-pass NFR flow.
    const three = await runNfrBloomThreePass({
      ctx, handoff, dmr: dmr22, intentSummary, frSummary,
      acceptedFrIds: frContent.user_stories.map(s => s.id),
      format: { formatExtractedItems, formatVVRequirements, formatTechnicalConstraints, formatJourneys },
    });
    return {
      nfrContent: {
        requirements: three.nfrs.map((n: NfrSkeleton) => ({
          id: n.id,
          category: n.category as NonFunctionalRequirement['category'],
          description: n.description,
          // Preserve priority from Pass-1 through the Pass-2 enrichment.
          // The earlier mapping omitted it, which caused the artifact to
          // ship priority-less NFRs even though both passes populate it
          // — surfaced in the ts-13 quality assessment.
          priority: n.priority,
          threshold: n.threshold ?? '',
          measurement_method: n.measurement_method,
          traces_to: n.traces_to,
          applies_to_requirements: n.applies_to_requirements,
        })),
      },
      nfrCoverageGaps: three.coverageGaps,
    };
  }

  /**
   * Write the non_functional_requirements artifact_produced record,
   * register it in artifactIds, and ingest it. Returns the written record.
   */
  private writeNfrArtifact(
    ctx: PhaseContext,
    frRecord: GovernedStreamRecord,
    handoffRecordId: string,
    nfrContent: NonFunctionalRequirements,
    artifactIds: string[],
  ): GovernedStreamRecord {
    const { engine, workflowRun } = ctx;
    const nfrDerivedFrom = [frRecord.id, handoffRecordId];
    const nfrRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'nfr_bloom_skeleton',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: nfrDerivedFrom,
      content: {
        kind: 'non_functional_requirements',
        ...nfrContent,
      },
    });
    artifactIds.push(nfrRecord.id);
    engine.ingestionPipeline.ingest(nfrRecord);
    return nfrRecord;
  }

  /**
   * Apply the NFR scope-gatekeeper outcome (mirror of resolvePrunedFr).
   * Behavior-preserving.
   */
  private resolvePrunedNfr(
    ctx: PhaseContext,
    nfrPrune: Awaited<ReturnType<typeof runDownstreamScopeGatekeeper>>,
    nfrContent: NonFunctionalRequirements,
    nfrRecord: GovernedStreamRecord,
    artifactIds: string[],
  ): { nfrContent: NonFunctionalRequirements; nfrRecord: GovernedStreamRecord } {
    if (nfrPrune.skipped || nfrPrune.dropped.length === 0) {
      return { nfrContent, nfrRecord };
    }
    const { engine, workflowRun } = ctx;
    const keptNfrSet = new Set(nfrPrune.kept_ids);
    const prunedNfrs = nfrContent.requirements.filter(n => keptNfrSet.has(n.id));
    const prunedNfrContent = { requirements: prunedNfrs };
    const prunedNfrRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'nfr_bloom_skeleton',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [nfrRecord.id],
      content: { kind: 'non_functional_requirements', ...prunedNfrContent },
    });
    engine.writer.supersedByRollback(nfrRecord.id, prunedNfrRecord.id);
    engine.ingestionPipeline.ingest(prunedNfrRecord);
    nfrContent = prunedNfrContent;
    nfrRecord = prunedNfrRecord;
    artifactIds.push(prunedNfrRecord.id);
    return { nfrContent, nfrRecord };
  }

  /**
   * Sub-Phase 2.2a — adapt NFRs into user-story stubs, emit depth-0 NFR
   * decomposition nodes, then run the saturation loop parameterized for
   * NFR. Behavior-preserving extraction from execute.
   */
  private async runNfrDecomposition(
    ctx: PhaseContext,
    handoff: ProductDescriptionHandoffContent,
    nfrContent: NonFunctionalRequirements,
    nfrRecord: GovernedStreamRecord,
    frSummary: string,
    resumingNfr: boolean,
    existingNfrRootNodes: GovernedStreamRecord[],
  ): Promise<void> {
    const { engine, workflowRun } = ctx;
    const nfrAsStories: UserStory[] = nfrContent.requirements.map(adaptNfrToUserStory);
    // Phase-exit correction: mint composite AC ids on the NFR-derived
    // stubs (otherwise every stub carries the hard-coded `AC-001` from
    // `adaptNfrToUserStory`, producing one collision per NFR). Anchored
    // on the stub's NFR id, e.g. `AC-NFR-001-001`.
    mintCompositeAcIds(nfrAsStories as unknown as AcStoryLike[]);
    const { rootNodeIds: nfrRootNodeIds, rootLogicalIds: nfrRootLogicalIds } =
      this.emitRootDecompositionNodes(
        ctx, nfrAsStories, nfrRecord.id, 'nfr_bloom_skeleton', 'nfr', resumingNfr, existingNfrRootNodes,
      );

    engine.stateMachine.setSubPhase(workflowRun.id, 'nfr_saturation');
    const nfrRootCap = engine.configManager.get().decomposition.max_root_count_nfr;
    const nfrRoots = nfrRootCap > 0 ? nfrAsStories.slice(0, nfrRootCap) : nfrAsStories;
    const nfrRootNodeIdsCapped = nfrRootCap > 0 ? nfrRootNodeIds.slice(0, nfrRootCap) : nfrRootNodeIds;
    const nfrRootLogicalIdsCapped = nfrRootCap > 0 ? nfrRootLogicalIds.slice(0, nfrRootCap) : nfrRootLogicalIds;
    if (nfrRootCap > 0 && nfrAsStories.length > nfrRootCap) {
      getLogger().info('workflow', 'Phase 2.2a: max_root_count_nfr cap applied', {
        cap: nfrRootCap, totalRoots: nfrAsStories.length, saturatedRoots: nfrRoots.length,
      });
    }
    await this.runSaturationLoop(
      ctx,
      handoff,
      nfrRoots,
      nfrRootNodeIdsCapped,
      nfrRootLogicalIdsCapped,
      {
        recordSubPhaseId: 'nfr_saturation',
        templateSubPhase: 'nfr_saturation',
        rootKind: 'nfr',
        gateSurfacePrefix: 'nfr-decomp-gate-',
        // Pass the FR roster so NFR saturation children can ground
        // `applies_to_requirements: [US-*]` references. Identical
        // pattern to the Phase 8 grounding fix.
        applicableFrSummary: frSummary,
      },
    );
  }

  /**
   * Emit depth-0 requirement_decomposition_node records for a set of root
   * stories (FR or NFR). On resume, recover ids from the existing nodes
   * rather than re-writing. `rootKind='nfr'` tags the written nodes with
   * `root_kind:'nfr'`; FR nodes omit the field (matching the original).
   * Behavior-preserving extraction from execute.
   */
  private emitRootDecompositionNodes(
    ctx: PhaseContext,
    stories: UserStory[],
    sourceRecordId: string,
    subPhaseId: string,
    rootKind: 'fr' | 'nfr',
    resuming: boolean,
    existingNodes: GovernedStreamRecord[],
  ): { rootNodeIds: string[]; rootLogicalIds: string[] } {
    const { engine, workflowRun } = ctx;
    if (resuming) {
      return {
        rootNodeIds: existingNodes.map(r => r.id),
        rootLogicalIds: existingNodes.map(r =>
          (r.content as unknown as RequirementDecompositionNodeContent).node_id,
        ),
      };
    }
    const rootNodeIds: string[] = [];
    const rootLogicalIds: string[] = [];
    const rootDisplayKeys = new Set<string>();
    // Resolve the approved ReleasePlan once — all roots for this run match
    // against the same plan. Null (no pointer on workflow_runs, or
    // default-lens run) → backlog for every root.
    const releasePlan = readActiveReleasePlan(ctx);
    for (const story of stories) {
      const logicalNodeId = mintLogicalNodeId();
      const displayKey = collisionSafeDisplayKey(story.id, rootDisplayKeys, logicalNodeId);
      rootDisplayKeys.add(displayKey);
      const { release_id, release_ordinal } = assignReleaseToRoot(
        story as DecompositionUserStory, releasePlan,
      );
      const node = engine.writer.writeRecord({
        record_type: 'requirement_decomposition_node',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '2',
        sub_phase_id: subPhaseId,
        produced_by_agent_role: 'requirements_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [sourceRecordId],
        content: {
          kind: 'requirement_decomposition_node',
          node_id: logicalNodeId,
          parent_node_id: null,
          display_key: displayKey,
          root_fr_id: logicalNodeId,
          depth: 0,
          pass_number: 0,
          status: 'pending',
          ...(rootKind === 'nfr' ? { root_kind: 'nfr' as const } : {}),
          user_story: story as DecompositionUserStory,
          surfaced_assumption_ids: [],
          release_id,
          release_ordinal,
        } satisfies RequirementDecompositionNodeContent,
      });
      rootNodeIds.push(node.id);
      rootLogicalIds.push(logicalNodeId);
    }
    return { rootNodeIds, rootLogicalIds };
  }

  /**
   * Persist coverage_gap records from a Pass-3 verifier and decide whether
   * the phase must halt. Returns a failure PhaseResult when a blocking gap
   * is present (caller returns it); returns null when there are no gaps or
   * only advisory ones. Behavior-preserving extraction shared by FR/NFR.
   */
  private handleCoverageGaps(
    ctx: PhaseContext,
    gaps: CoverageGapContent[],
    derivedFrom: string[],
    artifactIds: string[],
    labels: { verifierLabel: string; blockingLogMessage: string; advisoryLogMessage: string },
  ): PhaseResult | null {
    if (gaps.length === 0) return null;
    const { workflowRun } = ctx;
    const blockingGaps = gaps.filter(g => g.severity === 'blocking');
    const gapRecIds = this.persistCoverageGaps(ctx, gaps, derivedFrom);
    if (blockingGaps.length > 0) {
      getLogger().warn('workflow', labels.blockingLogMessage, {
        workflow_run_id: workflowRun.id,
        gap_count: blockingGaps.length,
        advisory_count: gaps.length - blockingGaps.length,
        gap_record_ids: gapRecIds,
      });
      return {
        success: false,
        error: `${labels.verifierLabel}: ${blockingGaps.length} blocking gap(s) — ${blockingGaps.map(g => g.check).join(', ')}. Review coverage_gap records and re-run.`,
        artifactIds,
      };
    }
    getLogger().info('workflow', labels.advisoryLogMessage, {
      workflow_run_id: workflowRun.id,
      advisory_count: gaps.length,
    });
    return null;
  }

  /**
   * Sub-Phase 2.3 — generate + present the requirements mirror and pause
   * for human review. Returns a failure PhaseResult when the user rejects
   * or the review throws; returns null to proceed. Behavior-preserving.
   */
  private async presentRequirementsMirror(
    ctx: PhaseContext,
    frRecord: GovernedStreamRecord,
    nfrRecord: GovernedStreamRecord,
    frContent: FunctionalRequirements,
    nfrContent: NonFunctionalRequirements,
    artifactIds: string[],
  ): Promise<PhaseResult | null> {
    const { engine, workflowRun } = ctx;
    const frMirror = engine.mirrorGenerator.generate({
      artifactId: frRecord.id,
      artifactType: 'functional_requirements',
      content: frContent as unknown as Record<string, unknown>,
    });

    const frMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'requirement_set_finalize',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [frRecord.id, nfrRecord.id],
      content: {
        kind: 'requirements_mirror',
        mirror_id: frMirror.mirrorId,
        artifact_id: frRecord.id,
        artifact_type: 'functional_requirements',
        fields: frMirror.fields,
        user_story_count: frContent.user_stories.length,
        nfr_count: nfrContent.requirements.length,
      },
    });
    artifactIds.push(frMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: frMirror.mirrorId,
      artifactType: 'functional_requirements',
    });

    // Pause for human review of requirements
    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id,
        frMirrorRecord.id,
        'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected the requirements', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2 requirements review failed', { error: String(err) });
      return { success: false, error: 'Requirements review failed', artifactIds };
    }
    return null;
  }

  /**
   * Sub-Phase 2.5 — generate + present the domain-attestation mirror and
   * pause for approval. Always returns the written attestation record (the
   * gate needs its id); `failure` is set when the user rejects or the
   * review throws. Behavior-preserving extraction from execute.
   */
  private async presentDomainAttestation(
    ctx: PhaseContext,
    consistencyRecord: GovernedStreamRecord,
    consistencyReport: ConsistencyReport,
    artifactIds: string[],
  ): Promise<{ attestationRecord: GovernedStreamRecord; failure: PhaseResult | null }> {
    const { engine, workflowRun } = ctx;
    const attestationMirror = engine.mirrorGenerator.generate({
      artifactId: consistencyRecord.id,
      artifactType: 'consistency_report',
      content: consistencyReport as unknown as Record<string, unknown>,
    });

    const attestationRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: 'requirements_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id],
      content: {
        kind: 'domain_attestation_mirror',
        mirror_id: attestationMirror.mirrorId,
        artifact_id: consistencyRecord.id,
        artifact_type: 'consistency_report',
        fields: attestationMirror.fields,
        consistency_pass: consistencyReport.overall_pass,
        blocking_failures: consistencyReport.blocking_failures.length,
        warnings: consistencyReport.warnings.length,
      },
    });
    artifactIds.push(attestationRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: attestationMirror.mirrorId,
      artifactType: 'consistency_report',
    });

    // Pause for domain attestation approval
    try {
      const attestationResolution = await engine.pauseForDecision(
        workflowRun.id,
        attestationRecord.id,
        'mirror',
      );
      if (attestationResolution.type === 'mirror_rejection') {
        return { attestationRecord, failure: { success: false, error: 'User rejected domain attestation', artifactIds } };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2 attestation failed', { error: String(err) });
      return { attestationRecord, failure: { success: false, error: 'Domain attestation failed', artifactIds } };
    }
    return { attestationRecord, failure: null };
  }

  // ── LLM call helpers ──────────────────────────────────────────

  /**
   * Emit a supersession record flipping a depth-2 child node to
   * status='pruned'. Extracted from the rejection loop so the intent
   * is obvious at the call site.
   */
  private writePrunedSupersession(
    ctx: PhaseContext,
    parentNodeId: string,
    child: { nodeRecordId: string; logicalNodeId: string; displayKey: string },
    reasonCode: string,
    config: SaturationLoopConfig,
  ): void {
    const { engine, workflowRun } = ctx;
    // Retrieve the original child content to carry its user_story +
    // root_fr_id forward into the supersession record (supersession
    // records are self-contained — downstream consumers shouldn't have
    // to join back to the superseded record to read the story).
    const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node', false);
    const original = allNodes.find(r => r.id === child.nodeRecordId);
    if (!original) return;
    const originalContent = original.content as unknown as RequirementDecompositionNodeContent;
    const prunedRec = engine.writer.writeRecord({
      record_type: 'requirement_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [child.nodeRecordId],
      content: {
        kind: 'requirement_decomposition_node',
        node_id: child.logicalNodeId,
        parent_node_id: parentNodeId,
        display_key: child.displayKey,
        root_fr_id: originalContent.root_fr_id,
        depth: originalContent.depth,
        pass_number: originalContent.pass_number,
        status: 'pruned',
        root_kind: config.rootKind,
        user_story: originalContent.user_story,
        surfaced_assumption_ids: originalContent.surfaced_assumption_ids,
        pruning_reason: reasonCode,
        // Preserve release assignment across the supersession (Q2 from
        // the design doc — release is a commitment, not a derivation).
        release_id: originalContent.release_id ?? null,
        release_ordinal: originalContent.release_ordinal ?? null,
      } satisfies RequirementDecompositionNodeContent,
    });
    // Retire the prior version of this logical node so only the 'pruned'
    // row remains is_current_version=1.
    engine.writer.supersedeDecompositionNodeByLogicalId(
      workflowRun.id, child.logicalNodeId, prunedRec.id,
    );
  }

  /**
   * Sub-Phase 2.1a — Wave 6 Step 4a unified tier-based saturation loop.
   *
   * Replaces the two older Level-1 / Level-2 methods. The loop maintains
   * a work queue of (not-yet-decomposed) nodes and drives each through
   * the tier-aware decomposer. Produced children are routed by their
   * self-assigned tier:
   *
   *   Tier A (functional sub-area) → queued for next-pass decomposition.
   *   Tier B (scope commitment)   → added to the pending-gate batch for
   *                                  their parent; bundles emitted at the
   *                                  end of each pass and resolved via
   *                                  Promise.all (Option B). On accept,
   *                                  the B node re-enters the queue so
   *                                  its own children get decomposed.
   *                                  On reject, writePrunedSupersession.
   *   Tier C (implementation)     → queued for next-pass decomposition
   *                                  until a Tier-D leaf emerges or
   *                                  caps trip.
   *   Tier D (leaf operation)     → written with status='atomic'; terminal.
   *
   * Termination:
   *   - Fixed point: a pass produces zero new children AND zero new
   *     assumptions AND the queue is empty.
   *   - Depth cap: nodes at depth_cap are frozen as deferred with reason
   *     'depth_cap_reached'.
   *   - Budget cap: when llm_calls_used >= budget_cap, remaining queue
   *     nodes are frozen as deferred with reason 'budget_cap_reached'.
   *
   * Step 4a scope: tier-driven routing + mirror gate per Tier-B batch +
   * fixed-point termination + hard caps. Step 4b adds mislabel detection
   * via per-branch assumption-delta spike after gate resolution. Step 4c
   * adds a Reasoning Review hook on post-gate Tier-C passes.
   */
  private async runSaturationLoop(
    ctx: PhaseContext,
    handoff: ProductDescriptionHandoffContent,
    rootStories: UserStory[],
    rootNodeRecordIds: string[],
    rootLogicalIds: string[],
    config: SaturationLoopConfig = {
      recordSubPhaseId: 'fr_saturation',
      templateSubPhase: 'fr_saturation',
      rootKind: 'fr',
      gateSurfacePrefix: 'decomp-gate-',
    },
  ): Promise<void> {
    const run = await prepareFrSaturationRun(ctx, handoff, rootStories, rootNodeRecordIds, rootLogicalIds, config);
    await this.runFrSaturationPasses(run);
    finalizeFrSaturationRun(run);
  }

  /**
   * Drive the saturation passes until the queue drains, fixed-point is
   * reached, or divergence early-terminates. One pass = drain the whole
   * queue, record the pipeline pass, dedup + snapshot assumptions, run the
   * Tier-C audits + Tier-B gates, then update divergence tracking.
   */
  private async runFrSaturationPasses(run: FrSaturationRun): Promise<void> {
    const { engine, workflowRun } = run;
    while (run.queue.length > 0) {
      run.passNumber++;
      const passStartedAt = new Date().toISOString();
      const nodesProducedAtPassStart = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node').length;
      const passEntries = run.queue.splice(0, run.queue.length);
      const pass: FrPassState = {
        passAssumptions: [],
        pendingGateByParent: new Map<string, FrPendingGateChild[]>(),
        downgradeNotesByParent: new Map<string, string>(),
        postGateCleanAudits: [],
      };

      for (const entry of passEntries) {
        await this.processFrPassEntry(run, pass, entry);
      }

      const nodesProducedThisPass = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node').length - nodesProducedAtPassStart;
      recordFrPipelinePass(run, pass, passStartedAt, nodesProducedThisPass);

      const dedupFailedThisPass = await applyFrPassDedup(run, pass);
      const semanticDelta = pass.passAssumptions.filter(a => !a.duplicate_of).length;
      appendAndSnapshotFrAssumptions(run, pass, semanticDelta);

      await this.runFrTierCAudits(run, pass);
      await this.resolveFrTierBGates(run, pass);

      if (dedupFailedThisPass) noteFrDedupOfflinePass(run);
      else noteFrDedupOnlinePass(run);
      this.detectFrDivergence(run, nodesProducedThisPass);

      if (run.divergingEarlyTerminate) break;
      if (semanticDelta === 0 && run.queue.length === 0) break;
    }
  }

  /** One queue entry: depth/budget cap gates, then decompose (deferred on any throw). */
  private async processFrPassEntry(
    run: FrSaturationRun,
    pass: FrPassState,
    entry: SaturationQueueEntry,
  ): Promise<void> {
    const { ctx, config, caps } = run;
    // Depth cap: freeze without decomposing further.
    if (entry.depth >= caps.depth_cap) {
      getLogger().warn('workflow', 'Phase 2.1a: depth cap reached on branch — freezing as deferred', {
        nodeId: entry.nodeId, displayKey: entry.displayKey, depth: entry.depth, cap: caps.depth_cap,
      });
      this.writeDeferredSupersession(ctx, entry, run.passNumber, 'depth_cap_reached', config);
      return;
    }
    // Budget cap (per-root): defer this entry if its root has hit the
    // per-root LLM-call budget. Other roots continue until each hits its own.
    const rootCalls = run.callsByRoot.get(entry.rootFrId) ?? 0;
    if (rootCalls >= caps.budget_cap) {
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: per-root budget cap reached — deferring`, {
        rootFrId: entry.rootFrId, rootCalls, cap: caps.budget_cap,
      });
      this.writeDeferredSupersession(ctx, entry, run.passNumber, 'budget_cap_reached', config);
      return;
    }
    try {
      await decomposeFrEntry(run, pass, entry);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking node deferred`, {
        nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
      });
      this.writeDeferredSupersession(ctx, entry, run.passNumber, `decomposition_failed: ${reason}`, config);
    }
  }

  /**
   * Step 4c — structural AC-shape audit on clean post-gate decompositions.
   * Runs only if the config flag is on, since each audit costs one
   * reasoning_review LLM call.
   */
  private async runFrTierCAudits(run: FrSaturationRun, pass: FrPassState): Promise<void> {
    const { ctx, caps, config } = run;
    if (caps.reasoning_review_on_tier_c && pass.postGateCleanAudits.length > 0) {
      for (const audit of pass.postGateCleanAudits) {
        await this.runTierCAcShapeAudit(
          ctx,
          audit.parentLogicalNodeId,
          audit.parentDisplayKey,
          audit.parentStory,
          audit.children,
          run.passNumber,
          config.recordSubPhaseId,
        );
      }
    }
  }

  /**
   * Fire mirror gates for the Tier-B batches produced this pass, then apply
   * each resolution: rejected children → pruned supersession, accepted →
   * re-queued (tier hint 'B') for their own decomposition.
   */
  private async resolveFrTierBGates(run: FrSaturationRun, pass: FrPassState): Promise<void> {
    if (pass.pendingGateByParent.size === 0) return;
    const { ctx, engine, workflowRun, config } = run;
    const bundlePlans = this.emitDepth2GateBundles(
      ctx, pass.pendingGateByParent, pass.passAssumptions, pass.downgradeNotesByParent, config,
    );
    const resolutions = await Promise.all(
      bundlePlans.map(p => engine.pauseForDecision(workflowRun.id, p.bundleRecordId, 'decision_bundle')),
    );
    for (let i = 0; i < bundlePlans.length; i++) {
      this.applyFrGateResolution(run, bundlePlans[i], resolutions[i]);
    }
  }

  /** Apply one gate bundle's human resolution to its child nodes. */
  private applyFrGateResolution(
    run: FrSaturationRun,
    plan: FrGateBundlePlan,
    resolution: unknown,
  ): void {
    const { ctx, config } = run;
    const payload = (resolution as { payload?: { mirror_decisions?: MirrorItemDecision[] } }).payload;
    const decisions = Array.isArray(payload?.mirror_decisions) ? payload.mirror_decisions : [];
    const rejectedIds = new Set(decisions.filter(d => d.action === 'rejected').map(d => d.item_id));
    for (const child of plan.childItems) {
      if (rejectedIds.has(child.itemId)) {
        this.writePrunedSupersession(ctx, plan.parentNodeId, child, 'human-rejected', config);
      } else {
        run.queue.push({
          parentRecordId: child.nodeRecordId,
          nodeId: child.logicalNodeId,
          parentNodeId: plan.parentNodeId,
          rootFrId: child.rootFrId,
          depth: child.depth,
          userStory: child.userStory,
          displayKey: child.displayKey,
          tierHint: 'B',
          releaseId: child.releaseId,
          releaseOrdinal: child.releaseOrdinal,
        });
      }
    }
  }

  /**
   * Divergence detection. Healthy saturation peaks then declines; N
   * consecutive passes with > divergeGrowthRatio node growth WARN, and at
   * divergeTerminatePasses the remaining queue is deferred ('diverging').
   */
  private detectFrDivergence(run: FrSaturationRun, nodesProducedThisPass: number): void {
    const { ctx, config } = run;
    const priorPass = run.pipelinePasses.length >= 2
      ? run.pipelinePasses.at(-2)
      : null;
    const growthObserved = priorPass
      && priorPass.nodes_produced > 0
      && nodesProducedThisPass > priorPass.nodes_produced * run.divergeGrowthRatio;
    if (!growthObserved) {
      run.consecutiveGrowthPasses = 0;
      return;
    }
    run.consecutiveGrowthPasses++;
    if (run.consecutiveGrowthPasses >= run.divergeWarnPasses) {
      getLogger().warn('workflow',
        `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging — ${run.consecutiveGrowthPasses} consecutive passes with > ${run.divergeGrowthRatio}× node growth`,
        {
          passNumber: run.passNumber,
          consecutiveGrowthPasses: run.consecutiveGrowthPasses,
          recent_ratios: formatFrDivergenceRatios(run.pipelinePasses, run.divergeWarnPasses),
          recent_nodes_produced: run.pipelinePasses.slice(-5).map(p => p.nodes_produced),
          dedupOffline: run.consecutiveDedupOfflinePasses > 0,
        });
    }
    if (run.consecutiveGrowthPasses >= run.divergeTerminatePasses) {
      getLogger().warn('workflow',
        `Phase ${config.recordSubPhaseId}: EARLY TERMINATE — diverging loop after ${run.consecutiveGrowthPasses} consecutive growth passes. Marking remaining queue as deferred with reason='diverging'.`,
        { passNumber: run.passNumber, remainingQueueSize: run.queue.length });
      for (const remaining of run.queue) {
        this.writeDeferredSupersession(ctx, remaining, run.passNumber, 'diverging', config);
      }
      run.queue.length = 0;
      run.divergingEarlyTerminate = true;
    }
  }

  /**
   * Emit one decision_bundle_presented per parent that accumulated
   * Tier-B children this pass. Returns the plan for each bundle so the
   * saturation loop can match resolutions back to child records.
   */
  private emitDepth2GateBundles(
    ctx: PhaseContext,
    pendingGateByParent: Map<string, Array<{
      nodeRecordId: string;
      logicalNodeId: string;
      displayKey: string;
      story: DecompositionUserStory;
      rationale?: string;
    }>>,
    passAssumptions: AssumptionEntry[],
    downgradeNotesByParent: Map<string, string> = new Map(),
    config: SaturationLoopConfig = {
      recordSubPhaseId: 'fr_saturation',
      templateSubPhase: 'fr_saturation',
      rootKind: 'fr',
      gateSurfacePrefix: 'decomp-gate-',
    },
  ): Array<{
    bundleRecordId: string;
    parentNodeId: string;              // parent's logical UUID
    childItems: Array<{
      itemId: string;                  // bundle-local id (`child-${idx}`)
      nodeRecordId: string;            // governed-stream row UUID of the child decomposition node
      logicalNodeId: string;           // child's logical UUID (content.node_id)
      displayKey: string;              // sibling-unique human label (content.display_key)
      userStory: DecompositionUserStory;
      rootFrId: string;
      depth: number;
      releaseId: string | null;
      releaseOrdinal: number | null;
    }>;
  }> {
    const { engine, workflowRun } = ctx;
    const plans: Array<{
      bundleRecordId: string;
      parentNodeId: string;
      childItems: Array<{
        itemId: string;
        nodeRecordId: string;
        logicalNodeId: string;
        displayKey: string;
        userStory: DecompositionUserStory;
        rootFrId: string;
        depth: number;
        releaseId: string | null;
        releaseOrdinal: number | null;
      }>;
    }> = [];
    // Look up each parent node record so we can carry its root_fr_id,
    // depth, and display_key into the gate presentation layer.
    const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const byLogicalId = new Map<string, RequirementDecompositionNodeContent>();
    for (const r of allNodes) {
      const c = r.content as unknown as RequirementDecompositionNodeContent;
      byLogicalId.set(c.node_id, c);
    }

    for (const [parentNodeId, children] of pendingGateByParent) {
      const parentContent = byLogicalId.get(parentNodeId);
      const parentDisplayKey = parentContent?.display_key ?? parentNodeId;
      const mirrorItems: MirrorItem[] = children.map((c, idx) => ({
        id: `child-${idx}`,
        text: `${c.displayKey} [Tier B commitment]: ${c.story.action} -> ${c.story.outcome}`,
        rationale: c.rationale,
        category: 'scope',
      }));
      const childItems = children.map((c, idx) => {
        const childContent = byLogicalId.get(c.logicalNodeId);
        return {
          itemId: `child-${idx}`,
          nodeRecordId: c.nodeRecordId,
          logicalNodeId: c.logicalNodeId,
          displayKey: c.displayKey,
          userStory: c.story,
          rootFrId: childContent?.root_fr_id ?? parentContent?.root_fr_id ?? parentNodeId,
          depth: childContent?.depth ?? ((parentContent?.depth ?? 0) + 1),
          // Release was stamped onto the child when it was written;
          // read it back here so the queue push for accepted children
          // carries the inheritance forward.
          releaseId: childContent?.release_id ?? parentContent?.release_id ?? null,
          releaseOrdinal: childContent?.release_ordinal ?? parentContent?.release_ordinal ?? null,
        };
      });

      const parentAssumptions = passAssumptions.filter(a => a.surfaced_at_node === parentNodeId);
      const summaryLines: string[] = [];
      // Step 4b context note: if this parent was downgraded this pass
      // (the human's earlier Tier-B acceptance turned out to still have
      // commitment layers), prepend the explanation so the follow-up
      // gate is not mistaken for a duplicate of the original one.
      const downgradeNote = downgradeNotesByParent.get(parentNodeId);
      if (downgradeNote) {
        summaryLines.push(`[Scope expansion] ${downgradeNote}`, '');
      }
      if (parentAssumptions.length > 0) {
        summaryLines.push('Assumptions this decomposition surfaces:');
        for (const a of parentAssumptions) summaryLines.push(`- (${a.category}) ${a.text}`);
      }
      const bundleContent: DecisionBundleContent = {
        // surface_id uses the parent's logical UUID so repeated gates for
        // the same parent (e.g., after a 4b downgrade) collapse cleanly
        // on any deduping surface-id store.
        surface_id: `${config.gateSurfacePrefix}${parentNodeId}`,
        title: `Scope commitments under ${parentDisplayKey}`,
        summary: summaryLines.length > 0 ? summaryLines.join('\n') : undefined,
        mirror: { kind: 'assumption_mirror', items: mirrorItems },
      };
      const bundleRecord = engine.writer.writeRecord({
        record_type: 'decision_bundle_presented',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '2',
        sub_phase_id: config.recordSubPhaseId,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: children.map(c => c.nodeRecordId),
        content: bundleContent as unknown as Record<string, unknown>,
      });
      plans.push({ bundleRecordId: bundleRecord.id, parentNodeId, childItems });
      engine.eventBus.emit('mirror:presented', {
        mirrorId: bundleRecord.id,
        artifactType: config.rootKind === 'nfr' ? 'decomposition_nfr_gate' : 'decomposition_depth2_gate',
      });
    }
    return plans;
  }

  /**
   * Write a supersession record flipping a queued node to status='deferred'.
   * Used for cap-trip (depth_cap / budget_cap) and per-node decomposition
   * failures. Keeps the tree self-describing — every gap in the tree is
   * marked with a reason rather than being silently absent.
   */
  private writeDeferredSupersession(
    ctx: PhaseContext,
    entry: {
      parentRecordId: string;
      nodeId: string;
      parentNodeId: string | null;
      rootFrId: string;
      depth: number;
      userStory: DecompositionUserStory;
      displayKey: string;
      releaseId: string | null;
      releaseOrdinal: number | null;
    },
    passNumber: number,
    reasonCode: string,
    config: SaturationLoopConfig,
  ): void {
    const { engine, workflowRun } = ctx;
    const deferredRec = engine.writer.writeRecord({
      record_type: 'requirement_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'requirement_decomposition_node',
        node_id: entry.nodeId,
        parent_node_id: entry.parentNodeId,
        display_key: entry.displayKey,
        root_fr_id: entry.rootFrId,
        depth: entry.depth,
        pass_number: passNumber,
        status: 'deferred',
        root_kind: config.rootKind,
        user_story: entry.userStory,
        surfaced_assumption_ids: [],
        pruning_reason: reasonCode,
        // Preserve release assignment across the supersession (Q2).
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies RequirementDecompositionNodeContent,
    });
    // Retire the prior pending version of this logical node.
    engine.writer.supersedeDecompositionNodeByLogicalId(
      workflowRun.id, entry.nodeId, deferredRec.id,
    );
  }

  /**
   * Step 4c — structural AC-shape audit. For a clean post-gate Tier-B
   * decomposition (parent hinted 'B', children all Tier-C/D), ask the
   * reasoning_review model whether each child's ACs are verification-
   * shaped or policy-shaped. Policy-shaped ACs mean the accepted Tier-B
   * parent is still hiding un-made scope decisions — the residual
   * failure mode Step 4b's tier-distribution signal cannot catch.
   *
   * Advisory only: findings land in a reasoning_review_record for audit
   * and gap-report consumption. No automatic tree changes in Step 4c.
   * Errors in the audit call are non-fatal (don't block the saturation
   * loop) but logged.
   */
  private async runTierCAcShapeAudit(
    ctx: PhaseContext,
    parentLogicalNodeId: string,
    parentDisplayKey: string,
    parentStory: DecompositionUserStory,
    children: DecompositionUserStory[],
    passNumber: number,
    subPhaseId: 'fr_saturation' | 'nfr_saturation' = 'fr_saturation',
  ): Promise<void> {
    const { engine, workflowRun } = ctx;
    const template = engine.templateLoader.findTemplate(
      'reasoning_review',
      'tier_c_ac_shape_audit',
    );
    if (!template) {
      getLogger().warn('workflow', 'Phase 2.1a/2.2a Step 4c: AC-shape audit template missing — skipping', {
        parentLogicalNodeId, parentDisplayKey,
      });
      return;
    }
    const routing = engine.configManager.getLLMRouting().reasoning_review;
    const variables: Record<string, string> = {
      parent_node: formatRootStoryForDecomposition(parentStory as UserStory),
      children: children.map(c => formatRootStoryForDecomposition(c as UserStory)).join('\n\n'),
    };
    const rendered = engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('workflow', 'Phase 2.1a/2.2a Step 4c: audit template has unfilled variables', {
        parentLogicalNodeId, parentDisplayKey, missing: rendered.missing_variables,
      });
      return;
    }

    try {
      const result = await engine.llmCaller.call({
        provider: routing.primary.provider,
        model: routing.primary.model,
        baseUrl: routing.primary.base_url,
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: routing.temperature,
        traceContext: {
          workflowRunId: workflowRun.id,
          phaseId: '2',
          subPhaseId,
          agentRole: 'reasoning_review',
          label: `Phase ${subPhaseId} Step 4c — AC-shape audit under ${parentDisplayKey}`,
        },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      const findingsRaw = Array.isArray(parsed?.findings)
        ? parsed.findings as Array<Record<string, unknown>> : [];
      const findings = findingsRaw.map(f => ({
        child_id: typeof f.child_id === 'string' ? f.child_id : '?',
        verdict: typeof f.verdict === 'string'
          && ['verification', 'policy', 'ambiguous'].includes(f.verdict)
          ? f.verdict as 'verification' | 'policy' | 'ambiguous'
          : 'ambiguous' as const,
        rationale: typeof f.rationale === 'string' ? f.rationale : '',
      }));
      const policyCount = findings.filter(f => f.verdict === 'policy').length;
      const summary = typeof parsed?.summary === 'string'
        ? parsed.summary
        : `${policyCount} of ${findings.length} children have policy-shaped ACs.`;

      if (policyCount > 0) {
        getLogger().warn('workflow', 'Phase 2.1a/2.2a Step 4c: policy-shaped ACs detected under Tier-B parent', {
          parentLogicalNodeId, parentDisplayKey,
          policyCount,
          totalChildren: findings.length,
          summary,
        });
      }

      engine.writer.writeRecord({
        record_type: 'reasoning_review_record',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '2',
        sub_phase_id: subPhaseId,
        produced_by_agent_role: 'reasoning_review',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [],
        content: {
          kind: 'tier_c_ac_shape_audit',
          parent_node_id: parentLogicalNodeId,
          parent_display_key: parentDisplayKey,
          pass_number: passNumber,
          children_reviewed: children.map(c => c.id),
          findings,
          summary,
          policy_count: policyCount,
        },
      });
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2.1a/2.2a Step 4c: AC-shape audit call failed — advisory skipped', {
        parentLogicalNodeId, parentDisplayKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  /**
   * Sub-Phase 2.4: Deterministic consistency check across FR and NFR artifacts.
   * Checks traceability (every user story has measurable ACs) and internal
   * consistency (no duplicate IDs, no conflicting requirements).
   */
  private runConsistencyCheck(
    fr: FunctionalRequirements,
    nfr: NonFunctionalRequirements,
  ): ConsistencyReport {
    const traceability: ConsistencyReport['traceability_results'] = [];
    const semanticFindings: ConsistencyFinding[] = [];
    const blockingFailures: string[] = [];
    const warnings: string[] = [];

    // Check: Every user story has at least one acceptance criterion with measurable_condition
    const acCheck = this.buildAcMeasurableCheck(fr);
    traceability.push(acCheck);
    if (!acCheck.pass) blockingFailures.push('ac-measurable-condition');

    // Check: No duplicate user story IDs
    const storyIds = fr.user_stories.map(s => s.id);
    const dupIds = storyIds.filter((id, i) => storyIds.indexOf(id) !== i);
    if (dupIds.length > 0) {
      semanticFindings.push({
        severity: 'warning',
        description: `Duplicate user story IDs: ${dupIds.join(', ')}`,
        artifact_ids_involved: [],
        recommended_action: 'Rename duplicate IDs to be unique',
      });
      warnings.push('duplicate-story-ids');
    }

    // Check: NFRs have measurable thresholds
    const nfrThresholdCheck = {
      assertion: 'Every NFR has a measurable threshold',
      pass: true,
      failures: [] as Array<{ item_id: string; explanation: string }>,
    };

    for (const req of nfr.requirements) {
      if (!req.threshold || req.threshold.trim().length === 0) {
        nfrThresholdCheck.pass = false;
        nfrThresholdCheck.failures.push({
          item_id: req.id,
          explanation: `NFR ${req.id} has no threshold`,
        });
      }
    }
    traceability.push(nfrThresholdCheck);
    if (!nfrThresholdCheck.pass) warnings.push('nfr-missing-threshold');

    // Check: All NFR categories are covered
    const categories = new Set<string>(nfr.requirements.map(r => r.category));
    const requiredCategories = ['performance', 'security', 'reliability'];
    for (const cat of requiredCategories) {
      if (!categories.has(cat)) {
        semanticFindings.push({
          severity: 'warning',
          description: `NFR category '${cat}' is not covered`,
          artifact_ids_involved: [],
          recommended_action: `Add at least one ${cat} requirement`,
        });
        warnings.push(`missing-category-${cat}`);
      }
    }

    return {
      overall_pass: blockingFailures.length === 0,
      traceability_results: traceability,
      semantic_findings: semanticFindings,
      internal_findings: [],
      blocking_failures: blockingFailures,
      warnings,
    };
  }

  /**
   * Sub-Phase 2.4 helper — build the "every user story has at least one
   * acceptance criterion with a measurable_condition" traceability
   * check. Extracted from runConsistencyCheck to keep that method's
   * cognitive complexity within the SonarQube threshold; behavior is
   * identical.
   */
  private buildAcMeasurableCheck(fr: FunctionalRequirements) {
    const acCheck = {
      assertion: 'Every user story has at least one acceptance criterion with measurable_condition',
      pass: true,
      failures: [] as Array<{ item_id: string; explanation: string }>,
    };

    for (const story of fr.user_stories) {
      if (!story.acceptance_criteria || story.acceptance_criteria.length === 0) {
        acCheck.pass = false;
        acCheck.failures.push({
          item_id: story.id,
          explanation: `User story ${story.id} has no acceptance criteria`,
        });
      } else {
        const hasMeasurable = story.acceptance_criteria.some(ac => ac.measurable_condition);
        if (!hasMeasurable) {
          acCheck.pass = false;
          acCheck.failures.push({
            item_id: story.id,
            explanation: `User story ${story.id} has acceptance criteria but none with measurable_condition`,
          });
        }
      }
    }
    return acCheck;
  }

  /**
   * Write one `coverage_gap` governed-stream record per gap returned by
   * a deterministic Phase-2 verifier (2.1c or 2.2c). Returns the
   * written record ids so the caller can include them in derived_from
   * chains. Mirrors Phase1Handler.persistCoverageGaps.
   */
  private persistCoverageGaps(
    ctx: PhaseContext,
    gaps: CoverageGapContent[],
    derivedFrom: string[],
  ): string[] {
    const ids: string[] = [];
    for (const gap of gaps) {
      const rec = ctx.engine.writer.writeRecord({
        record_type: 'coverage_gap',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRun.id,
        phase_id: '2',
        sub_phase_id: gap.sub_phase_id,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: ctx.engine.janumiCodeVersionSha,
        derived_from_record_ids: derivedFrom,
        content: gap as unknown as Record<string, unknown>,
      });
      ctx.engine.ingestionPipeline.ingest(rec);
      ids.push(rec.id);
    }
    return ids;
  }
}

// ── Saturation-loop helpers (extracted from runSaturationLoop) ─────

function resolveFrSaturationTemplate(
  engine: SaturationEngine,
  config: SaturationLoopConfig,
): FrSaturationTemplate {
  const template = engine.templateLoader.findTemplate(
    'requirements_agent',
    config.templateSubPhase,
    'product',
  );
  if (!template) {
    throw new Error(
      `Phase ${config.recordSubPhaseId}: decomposition product-lens template missing — ` +
      `expected agent_role=requirements_agent sub_phase=${config.templateSubPhase} lens=product. ` +
      `This is a configuration error; Wave 6 cannot proceed without the template.`,
    );
  }
  return template;
}

function seedFrQueueFromRoots(
  rootStories: UserStory[],
  rootNodeRecordIds: string[],
  rootLogicalIds: string[],
  releasePlan: ReleasePlanContentV2 | null,
): SaturationQueueEntry[] {
  return rootStories.map((s, i) => {
    const { release_id, release_ordinal } = assignReleaseToRoot(
      s as DecompositionUserStory, releasePlan,
    );
    return {
      parentRecordId: rootNodeRecordIds[i],
      nodeId: rootLogicalIds[i],
      parentNodeId: null,
      rootFrId: rootLogicalIds[i],
      depth: 0,
      userStory: s as DecompositionUserStory,
      displayKey: s.id,
      tierHint: 'root',
      releaseId: release_id,
      releaseOrdinal: release_ordinal,
    };
  });
}

function initFrSiblingsByParent(
  resumed: SaturationResumeState | null,
  rootStories: UserStory[],
): Map<string | null, DecompositionUserStory[]> {
  if (resumed) return resumed.siblingsByParent;
  const siblingsByParent = new Map<string | null, DecompositionUserStory[]>();
  siblingsByParent.set(null, rootStories.map(s => s as DecompositionUserStory));
  return siblingsByParent;
}

function resolveFrDivergenceConfig(): {
  divergeGrowthRatio: number;
  divergeWarnPasses: number;
  divergeTerminatePasses: number;
  dedupOfflineWarnPasses: number;
} {
  return {
    divergeGrowthRatio: Number.parseFloat(
      process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2'),
    divergeWarnPasses: Number.parseInt(
      process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10),
    divergeTerminatePasses: Number.parseInt(
      process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10),
    dedupOfflineWarnPasses: Number.parseInt(
      process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10),
  };
}

function resolveFrDedupConfig(engine: SaturationEngine): {
  embeddingClient: EmbeddingClient;
  embeddingCache: Map<string, number[]>;
  dedupThreshold: number;
  dedupEnabled: boolean;
} {
  const embeddingClient: EmbeddingClient = engine.getEmbeddingClientOverride() ?? createEmbeddingClient();
  const embeddingCache = new Map<string, number[]>();
  const dedupThreshold = Number.parseFloat(
    process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
  const dedupEnabled = Number.isFinite(dedupThreshold)
    && dedupThreshold > 0
    && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';
  return { embeddingClient, embeddingCache, dedupThreshold, dedupEnabled };
}

function resolveFrPipelineStartRecord(
  engine: SaturationEngine,
  workflowRun: SaturationWorkflowRun,
  config: SaturationLoopConfig,
  pipelineId: string,
  rootNodeRecordIds: string[],
  resumed: SaturationResumeState | null,
): { pipelineStartRecord: GovernedStreamRecord; currentPipelineRecordId: string } {
  const pipelineRootKey = config.rootKind === 'nfr' ? '*nfr*' : '*';
  const pipelineStartRecord = resumed?.pipelineStartRecord ?? engine.writer.writeRecord({
    record_type: 'requirement_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: rootNodeRecordIds,
    content: {
      kind: 'requirement_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_fr_id: pipelineRootKey,
      passes: [],
    } satisfies RequirementDecompositionPipelineContent,
  });
  const currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;
  return { pipelineStartRecord, currentPipelineRecordId };
}

function buildFrParentChain(
  engine: SaturationEngine,
  workflowRun: SaturationWorkflowRun,
  config: SaturationLoopConfig,
): Map<string, string | null> {
  const parentChain = new Map<string, string | null>();
  const existingNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'requirement_decomposition_node',
  );
  for (const r of existingNodes) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if ((c.root_kind ?? 'fr') !== config.rootKind) continue;
    parentChain.set(c.node_id, c.parent_node_id);
  }
  return parentChain;
}

async function seedFrDedupCache(run: FrSaturationRun): Promise<void> {
  if (!(run.dedupEnabled && run.allAssumptions.length > 0)) return;
  try {
    const vecs = await run.embeddingClient.embed(
      run.allAssumptions.map(a => a.text),
      { signal: run.engine.getSessionAbortSignal() },
    );
    run.allAssumptions.forEach((a, i) => {
      if (vecs[i]) run.embeddingCache.set(a.id, vecs[i]);
    });
    getLogger().info('workflow', `Phase ${run.config.recordSubPhaseId}: dedup cache seeded from existing assumptions`, {
      cached: run.embeddingCache.size, total: run.allAssumptions.length,
    });
  } catch (err) {
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup seed failed — continuing without dedup`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function prepareFrSaturationRun(
  ctx: PhaseContext,
  handoff: ProductDescriptionHandoffContent,
  rootStories: UserStory[],
  rootNodeRecordIds: string[],
  rootLogicalIds: string[],
  config: SaturationLoopConfig,
): Promise<FrSaturationRun> {
  const { engine, workflowRun } = ctx;
  const caps = engine.configManager.get().decomposition;
  const template = resolveFrSaturationTemplate(engine, config);
  const handoffSummary = formatHandoffForDecomposition(handoff);
  const pipelineId = `decomp-pipe-${config.rootKind}-${workflowRun.id.slice(0, 8)}`;
  const pipelineRootKey = config.rootKind === 'nfr' ? '*nfr*' : '*';

  // Wave 6 follow-up — resume detection. Rebuild queue / assumption set /
  // pipeline-record chain from the stream rather than seeding fresh.
  const resumed = rebuildSaturationStateFromStream(ctx, config, pipelineId, pipelineRootKey);

  const releasePlanForSeed = readActiveReleasePlan(ctx);
  const queue = resumed?.queue ?? seedFrQueueFromRoots(rootStories, rootNodeRecordIds, rootLogicalIds, releasePlanForSeed);
  const siblingsByParent = initFrSiblingsByParent(resumed, rootStories);

  // Order-sensitive: divergence env parsing has no side effects; the pipeline
  // start record is WRITTEN here (unless resuming); the dedup config only news
  // up the embedding client — matching the original setup ordering.
  const divergence = resolveFrDivergenceConfig();
  const pipeline = resolveFrPipelineStartRecord(engine, workflowRun, config, pipelineId, rootNodeRecordIds, resumed);
  const dedup = resolveFrDedupConfig(engine);

  const run: FrSaturationRun = {
    ctx,
    engine,
    workflowRun,
    config,
    caps,
    template,
    handoffSummary,
    pipelineId,
    pipelineRootKey,
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
    queue,
    siblingsByParent,
    callsByRoot: new Map<string, number>(),
    maxDepthReached: resumed?.maxDepthReached ?? 0,
    passNumber: resumed?.passNumber ?? 0,
    pipelinePasses: resumed?.pipelinePasses ?? [],
    pipelineStartRecord: pipeline.pipelineStartRecord,
    currentPipelineRecordId: pipeline.currentPipelineRecordId,
    // Pure read (requirement_decomposition_node) — the dedup seed writes no
    // records, so building this before it yields identical results.
    parentChain: buildFrParentChain(engine, workflowRun, config),
    consecutiveGrowthPasses: 0,
    consecutiveDedupOfflinePasses: 0,
    dedupOfflineAnnounced: false,
    divergingEarlyTerminate: false,
  };

  if (resumed) {
    getLogger().info('workflow', `Phase ${config.recordSubPhaseId} RESUME: reconstructed state from stream`, {
      queueSize: run.queue.length,
      assumptions: run.allAssumptions.length,
      passNumber: run.passNumber,
      maxDepthReached: run.maxDepthReached,
    });
  }

  await seedFrDedupCache(run);
  return run;
}

/** Next `A-<nnnn>` id — pre-increments the shared sequence (order-preserving). */
function mintFrAssumptionId(run: FrSaturationRun): string {
  return `A-${String(++run.assumptionSeq).padStart(4, '0')}`;
}

/** Walk parent links to the root, guarding against cycles. */
function collectFrAncestorNodeIds(
  entry: SaturationQueueEntry,
  parentChain: Map<string, string | null>,
): Set<string | null> {
  const ancestorIds = new Set<string | null>();
  ancestorIds.add(entry.nodeId);
  let cursor: string | null | undefined = entry.parentNodeId;
  while (cursor) {
    if (ancestorIds.has(cursor)) break; // cycle guard
    ancestorIds.add(cursor);
    cursor = parentChain.get(cursor) ?? null;
  }
  return ancestorIds;
}

/**
 * Render the sibling roster. Uses the LLM's raw `story.id` strings — the
 * decomposer prompt speaks the LLM's own ID vocabulary, not our UUIDs.
 */
function formatFrSiblingContext(
  siblings: DecompositionUserStory[],
  entry: SaturationQueueEntry,
): string {
  return siblings.length <= 1
    ? '(none — sole child under this parent)'
    : siblings.filter(s => s.id !== entry.userStory.id)
        .map(s => `- ${s.id}: ${s.action} -> ${s.outcome}`).join('\n');
}

/** Assemble the decomposer template variables (sibling + scoped-assumption scoping). */
function buildFrDecompositionVariables(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
): Record<string, string> {
  const { engine, config } = run;
  const siblings = run.siblingsByParent.get(entry.parentNodeId) ?? [];
  // Scoped assumption injection — restrict to assumptions surfaced at nodes in
  // this entry's ancestor chain (including itself) + global/seed ones.
  const ancestorIds = collectFrAncestorNodeIds(entry, run.parentChain);
  const scopedAssumptions = [...run.allAssumptions, ...pass.passAssumptions]
    .filter(a => !a.duplicate_of) // never inject flagged duplicates
    .filter(a => a.surfaced_at_node == null || ancestorIds.has(a.surfaced_at_node));
  return {
    active_constraints: '(none — wave 6 step 4a minimal)',
    parent_story: formatRootStoryForDecomposition(entry.userStory as UserStory),
    parent_tier_hint: entry.tierHint,
    sibling_context: formatFrSiblingContext(siblings, entry),
    handoff_context: run.handoffSummary,
    // Only the NFR saturation template uses this; FR runs ignore.
    functional_requirements_summary: config.applicableFrSummary
      ?? '(not applicable — FR saturation does not cite FR ids)',
    existing_assumptions: scopedAssumptions.length === 0
      ? '(none yet)'
      : scopedAssumptions
          .map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
    current_depth: String(entry.depth),
    janumicode_version_sha: engine.janumiCodeVersionSha,
  };
}

/** Mint A-ids for the surfaced assumptions, appending to the pass batch. */
function collectFrSurfacedAssumptions(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
  surfacedRaw: Array<Record<string, unknown>>,
): string[] {
  const childAssumptionIds: string[] = [];
  for (const a of surfacedRaw) {
    const text = typeof a.text === 'string' ? a.text : null;
    if (!text) continue;
    const category = typeof a.category === 'string'
      ? a.category as AssumptionCategory : 'scope';
    const citations = Array.isArray(a.citations)
      ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
    const assumption: AssumptionEntry = {
      id: mintFrAssumptionId(run),
      text,
      source: 'decomposition' satisfies DecompositionAssumptionSource,
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

interface FrRoutedChild {
  tier: DecompositionTier;
  story: DecompositionUserStory;
  childRecordId: string;
  logicalNodeId: string;
  displayKey: string;
  childDepth: number;
  rationale: string | undefined;
}

/** Route an emitted child by tier: A/C recurse (queue), B waits for the gate, D is terminal. */
function routeFrChildByTier(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
  child: FrRoutedChild,
): void {
  if (child.tier === 'A') {
    run.queue.push({
      parentRecordId: child.childRecordId, nodeId: child.logicalNodeId, parentNodeId: entry.nodeId,
      rootFrId: entry.rootFrId, depth: child.childDepth, userStory: child.story,
      displayKey: child.displayKey, tierHint: 'A',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
    });
  } else if (child.tier === 'B') {
    const batch = pass.pendingGateByParent.get(entry.nodeId) ?? [];
    batch.push({ nodeRecordId: child.childRecordId, logicalNodeId: child.logicalNodeId, displayKey: child.displayKey, story: child.story, rationale: child.rationale });
    pass.pendingGateByParent.set(entry.nodeId, batch);
  } else if (child.tier === 'C') {
    run.queue.push({
      parentRecordId: child.childRecordId, nodeId: child.logicalNodeId, parentNodeId: entry.nodeId,
      rootFrId: entry.rootFrId, depth: child.childDepth, userStory: child.story,
      displayKey: child.displayKey, tierHint: 'C',
      releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
    });
  }
  // Tier D: already frozen atomic — no queue insertion.
}

/** Sanitize, enrich, persist and route each child. */
function emitFrChildNodes(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
  childrenRaw: Array<Record<string, unknown>>,
  childAssumptionIds: string[],
  childDepth: number,
): {
  emittedChildren: DecompositionUserStory[];
  emittedChildrenWithTier: Array<{ story: DecompositionUserStory; tier: DecompositionTier; logicalNodeId: string; displayKey: string }>;
} {
  const { engine, workflowRun, config, caps } = run;
  const emittedChildren: DecompositionUserStory[] = [];
  const emittedChildrenWithTier: Array<{ story: DecompositionUserStory; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
  // Track display-key collisions within THIS sibling batch so the LLM's
  // repeated use of e.g. `FR-ACCT-1.1` resolves to distinct labels.
  const siblingDisplayKeys = new Set<string>();
  // Track the canonical-nested `user_story.id` assigned to each sibling so a
  // drift-repaired id can never collide with a kept LLM id (see nestChildStoryId).
  const siblingStoryIds = new Set<string>();
  let fanoutCount = 0;
  for (const c of childrenRaw) {
    if (++fanoutCount > caps.fanout_cap) {
      getLogger().warn('workflow', 'Phase 2.1a: fanout cap reached — dropping remaining children', {
        parentNodeId: entry.nodeId, parentDisplayKey: entry.displayKey,
        cap: caps.fanout_cap, totalOffered: childrenRaw.length,
      });
      break;
    }
    const story = sanitizeChildStory(c, { rootId: entry.displayKey, childIndex: fanoutCount });
    if (!story) continue;
    // Drift repair: force the leaf id to nest under its parent (parent `US-001`
    // → child `US-001-1`). Runs BEFORE AC minting + display-key so both anchor
    // on the corrected id. See nestChildStoryId.
    story.id = nestChildStoryId(story.id, entry.displayKey, fanoutCount, siblingStoryIds);
    // Phase-exit correction: mint composite AC ids anchored on the leaf's own
    // story.id (`AC-{story.id}-NNN`). See phase2/acIdNormalizer.ts.
    mintCompositeAcIds([story as unknown as AcStoryLike]);
    const tier = normalizeTier(c.tier);
    const rationale = typeof c.decomposition_rationale === 'string'
      ? c.decomposition_rationale : undefined;
    // Tier D nodes ARE leaves — written as atomic immediately.
    const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
    const logicalNodeId = mintLogicalNodeId();
    const displayKey = collisionSafeDisplayKey(story.id, siblingDisplayKeys, logicalNodeId);
    siblingDisplayKeys.add(displayKey);
    const childRec = engine.writer.writeRecord({
      record_type: 'requirement_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: config.recordSubPhaseId,
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [entry.parentRecordId],
      content: {
        kind: 'requirement_decomposition_node',
        node_id: logicalNodeId,
        parent_node_id: entry.nodeId,
        display_key: displayKey,
        root_fr_id: entry.rootFrId,
        depth: childDepth,
        pass_number: run.passNumber,
        status: initialStatus,
        tier,
        root_kind: config.rootKind,
        user_story: story,
        decomposition_rationale: rationale,
        surfaced_assumption_ids: childAssumptionIds,
        // Inherit release assignment from parent. Preserved across revisions.
        release_id: entry.releaseId,
        release_ordinal: entry.releaseOrdinal,
      } satisfies RequirementDecompositionNodeContent,
    });
    emittedChildren.push(story);
    emittedChildrenWithTier.push({ story, tier, logicalNodeId, displayKey });
    // Keep parentChain current for scoped-assumption lookups within this pass.
    run.parentChain.set(logicalNodeId, entry.nodeId);
    routeFrChildByTier(run, pass, entry, {
      tier, story, childRecordId: childRec.id, logicalNodeId, displayKey, childDepth, rationale,
    });
  }
  return { emittedChildren, emittedChildrenWithTier };
}

/** Write the 'downgraded' supersession for a mislabeled Tier-B parent. */
function writeFrDowngradedSupersession(
  run: FrSaturationRun,
  entry: SaturationQueueEntry,
  reason: string,
): void {
  const { engine, workflowRun, config } = run;
  const downgradedRec = engine.writer.writeRecord({
    record_type: 'requirement_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'requirement_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_fr_id: entry.rootFrId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'downgraded',
      root_kind: config.rootKind,
      user_story: entry.userStory,
      surfaced_assumption_ids: [],
      pruning_reason: reason,
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies RequirementDecompositionNodeContent,
  });
  // Retire the prior pending version so only the downgraded row remains current.
  engine.writer.supersedeDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, downgradedRec.id,
  );
}

/**
 * Step 4b — mislabel detection on previously-accepted Tier-B parents.
 * Returns true when the parent was downgraded (which suppresses the
 * `decomposed` supersession). Clean Tier-B parents queue a shape audit.
 */
function applyFrTierBDowngradeIfNeeded(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
  tierAssessment: Record<string, unknown> | undefined,
  emittedChildrenWithTier: Array<{ story: DecompositionUserStory; tier: DecompositionTier; logicalNodeId: string; displayKey: string }>,
): boolean {
  if (entry.tierHint !== 'B') return false;
  const { config } = run;
  const explicitDisagreement = tierAssessment?.agrees_with_hint === false
    && typeof tierAssessment.tier === 'string'
    && (tierAssessment.tier === 'A' || tierAssessment.tier === 'B');
  const producedTierBChildren = (pass.pendingGateByParent.get(entry.nodeId)?.length ?? 0) > 0;
  if (!(explicitDisagreement || producedTierBChildren)) {
    // Step 4c — clean post-gate decomposition (parent hinted 'B', only
    // Tier-C/D children). Queue the children's ACs for structural audit.
    if (emittedChildrenWithTier.length > 0) {
      pass.postGateCleanAudits.push({
        parentLogicalNodeId: entry.nodeId,
        parentDisplayKey: entry.displayKey,
        parentStory: entry.userStory,
        children: emittedChildrenWithTier.map(x => x.story),
      });
    }
    return false;
  }
  const reason = explicitDisagreement
    ? `tier_downgrade: decomposer_assessed_${tierAssessment?.tier}_not_B`
    : 'tier_downgrade: post_gate_children_still_tier_B';
  getLogger().warn('workflow', `Phase ${config.recordSubPhaseId} Step 4b: downgrading previously-accepted Tier-B parent`, {
    nodeId: entry.nodeId, displayKey: entry.displayKey, reason,
    producedTierB: pass.pendingGateByParent.get(entry.nodeId)?.length ?? 0,
    explicitDisagreement,
  });
  writeFrDowngradedSupersession(run, entry, reason);
  if (producedTierBChildren) {
    pass.downgradeNotesByParent.set(
      entry.nodeId,
      `The commitment '${entry.displayKey}' you accepted earlier turned out to ` +
      `have its own commitment layer underneath. The items below are ` +
      `sub-commitments within '${entry.displayKey}' that need your review as well.`,
    );
  }
  return true;
}

/**
 * Status transition for successful decomposition. A parent that produced
 * children is marked `decomposed`, preserving its original creation sub_phase.
 */
function writeFrDecomposedSupersession(
  run: FrSaturationRun,
  entry: SaturationQueueEntry,
): void {
  const { engine, workflowRun, config } = run;
  // Preserve creation provenance: keep the sub_phase_id where the node was
  // first emitted, not the sub_phase that updated its status.
  const originalRec = engine.writer.getRecord(entry.parentRecordId);
  const originalSubPhase = originalRec?.sub_phase_id ?? config.recordSubPhaseId;
  const decomposedRec = engine.writer.writeRecord({
    record_type: 'requirement_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: originalSubPhase,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [entry.parentRecordId],
    content: {
      kind: 'requirement_decomposition_node',
      node_id: entry.nodeId,
      parent_node_id: entry.parentNodeId,
      display_key: entry.displayKey,
      root_fr_id: entry.rootFrId,
      depth: entry.depth,
      pass_number: run.passNumber,
      status: 'decomposed',
      tier: entry.tierHint === 'root' ? undefined : (entry.tierHint as DecompositionTier),
      root_kind: config.rootKind,
      user_story: entry.userStory,
      surfaced_assumption_ids: [],
      release_id: entry.releaseId,
      release_ordinal: entry.releaseOrdinal,
    } satisfies RequirementDecompositionNodeContent,
  });
  engine.writer.supersedeDecompositionNodeByLogicalId(
    workflowRun.id, entry.nodeId, decomposedRec.id,
  );
}

/**
 * The decomposer call + child emission for one entry. Runs inside the
 * caller's try/catch, so any throw defers the node — matching the original
 * single try block (siblings → render → LLM → children → supersession).
 */
async function decomposeFrEntry(
  run: FrSaturationRun,
  pass: FrPassState,
  entry: SaturationQueueEntry,
): Promise<void> {
  const { engine, workflowRun, config } = run;

  const variables = buildFrDecompositionVariables(run, pass, entry);
  const rendered = engine.templateLoader.render(run.template, variables);
  if (rendered.missing_variables.length > 0) {
    throw new Error(
      `Phase 2.1a: decomposition template has unfilled variables ` +
      `[${rendered.missing_variables.join(', ')}].`,
    );
  }

  // Increment this root's per-root counter BEFORE dispatching the call.
  run.callsByRoot.set(entry.rootFrId, (run.callsByRoot.get(entry.rootFrId) ?? 0) + 1);
  const result = await engine.callForRole('requirements_agent', {
    prompt: rendered.rendered,
    responseFormat: 'json',
    temperature: 0.5,
    traceContext: {
      workflowRunId: workflowRun.id,
      phaseId: '2',
      // Route trace context by the configured sub-phase id so NFR decomposer
      // calls land under 2.2a rather than masquerading as 2.1a.
      subPhaseId: config.recordSubPhaseId,
      agentRole: 'requirements_agent',
      label: `Phase ${config.recordSubPhaseId} Pass-${run.passNumber} — decomposition of ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
    },
  });

  const parsed = result.parsed as Record<string, unknown> | null;
  const childrenRaw = Array.isArray(parsed?.children)
    ? parsed.children as Array<Record<string, unknown>> : [];
  const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
    ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
  const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;
  if (tierAssessment?.agrees_with_hint === false) {
    // Log disagreement for Step 4b; no action in 4a.
    getLogger().warn('workflow', 'Phase 2.1a: decomposer disagrees with tier hint', {
      nodeId: entry.nodeId, displayKey: entry.displayKey, hint: entry.tierHint,
      assessed: tierAssessment.tier, rationale: tierAssessment.rationale,
    });
  }

  const childAssumptionIds = collectFrSurfacedAssumptions(run, pass, entry, surfacedRaw);

  const childDepth = entry.depth + 1;
  run.maxDepthReached = Math.max(run.maxDepthReached, childDepth);
  const { emittedChildren, emittedChildrenWithTier } = emitFrChildNodes(
    run, pass, entry, childrenRaw, childAssumptionIds, childDepth,
  );
  if (emittedChildren.length > 0) {
    run.siblingsByParent.set(entry.nodeId, emittedChildren);
  }

  const parentDowngraded = applyFrTierBDowngradeIfNeeded(run, pass, entry, tierAssessment, emittedChildrenWithTier);
  // Status transition for successful decomposition — only when not already
  // terminal-superseded by Step 4b.
  if (emittedChildren.length > 0 && !parentDowngraded) {
    writeFrDecomposedSupersession(run, entry);
  }
}

/** Append this pass to the pipeline container (supersession) so the card stays fresh. */
function recordFrPipelinePass(
  run: FrSaturationRun,
  pass: FrPassState,
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
  const passUpdateRecord = engine.writer.writeRecord({
    record_type: 'requirement_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'requirement_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_fr_id: run.pipelineRootKey,
      passes: [...run.pipelinePasses],
    } satisfies RequirementDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, passUpdateRecord.id);
  run.currentPipelineRecordId = passUpdateRecord.id;
}

/**
 * Wave 6 dedup pass — flag near-dupe assumptions in place (never remove).
 * Returns true when the embed call failed this pass (dedup went offline).
 */
async function applyFrPassDedup(run: FrSaturationRun, pass: FrPassState): Promise<boolean> {
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
        getLogger().info('workflow', `Phase ${run.config.recordSubPhaseId}: assumption flagged as duplicate`, {
          id: a.id, of: match.id, similarity: Number(match.similarity.toFixed(3)),
        });
      }
      // Cache regardless — whether canonical or duplicate.
      run.embeddingCache.set(a.id, v);
    }
  } catch (err) {
    getLogger().warn('workflow', `Phase ${run.config.recordSubPhaseId}: dedup embed failed this pass — flags skipped`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
  return false;
}

/** Append the pass's assumptions and write the per-pass snapshot record. */
function appendAndSnapshotFrAssumptions(
  run: FrSaturationRun,
  pass: FrPassState,
  semanticDelta: number,
): void {
  const { engine, workflowRun, config } = run;
  run.allAssumptions.push(...pass.passAssumptions);
  engine.writer.writeRecord({
    record_type: 'assumption_set_snapshot',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'requirements_agent',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: {
      kind: 'assumption_set_snapshot',
      pass_number: run.passNumber,
      root_fr_id: config.rootKind === 'nfr' ? '*nfr*' : '*',
      assumptions: [...run.allAssumptions],
      delta_from_previous_pass: pass.passAssumptions.length,
      semantic_delta: semanticDelta,
    } satisfies AssumptionSetSnapshotContent,
  });
}

/** Advance the dedup-offline counter and WARN once the threshold is crossed. */
function noteFrDedupOfflinePass(run: FrSaturationRun): void {
  run.consecutiveDedupOfflinePasses++;
  if (run.consecutiveDedupOfflinePasses >= run.dedupOfflineWarnPasses && !run.dedupOfflineAnnounced) {
    getLogger().warn('workflow',
      `Phase ${run.config.recordSubPhaseId}: assumption dedup has been offline for ${run.consecutiveDedupOfflinePasses} consecutive passes — semantic_delta equals raw delta; saturation termination is likely unreachable. Check JANUMICODE_EMBEDDING_URL reachability + timeouts.`,
      { consecutiveDedupOfflinePasses: run.consecutiveDedupOfflinePasses, passNumber: run.passNumber });
    run.dedupOfflineAnnounced = true;
  }
}

/** Reset the dedup-offline counter (announcing recovery if it was offline). */
function noteFrDedupOnlinePass(run: FrSaturationRun): void {
  if (run.dedupOfflineAnnounced) {
    getLogger().info('workflow',
      `Phase ${run.config.recordSubPhaseId}: assumption dedup is back online after ${run.consecutiveDedupOfflinePasses} offline passes`,
      { passNumber: run.passNumber });
    run.dedupOfflineAnnounced = false;
  }
  run.consecutiveDedupOfflinePasses = 0;
}

/** Recent pass-over-pass node-growth ratios (for the divergence WARN payload). */
function formatFrDivergenceRatios(
  pipelinePasses: DecompositionPassEntry[],
  divergeWarnPasses: number,
): Array<string | undefined> {
  return pipelinePasses.slice(-divergeWarnPasses - 1)
    .map((p, i, arr) => i === 0 ? null : (p.nodes_produced / (arr[i - 1].nodes_produced || 1)))
    .slice(1).map(r => r?.toFixed(2));
}

/**
 * Termination reason priority (matches detection order inside the loop):
 * diverging > budget_cap > depth_cap > dedup_offline > fixed_point.
 */
function resolveFrTerminationReason(
  run: FrSaturationRun,
  maxRootCalls: number,
): DecompositionTerminationReason {
  if (run.divergingEarlyTerminate) return 'diverging';
  if (maxRootCalls >= run.caps.budget_cap) return 'budget_cap';
  if (run.maxDepthReached >= run.caps.depth_cap) return 'depth_cap';
  if (run.dedupOfflineAnnounced) return 'dedup_offline';
  return 'fixed_point';
}

/** Finalize the pipeline container (termination reason + counts) and persist telemetry. */
function finalizeFrSaturationRun(run: FrSaturationRun): void {
  const { engine, workflowRun, config } = run;
  const totalLlmCalls = [...run.callsByRoot.values()].reduce((a, b) => a + b, 0);
  const maxRootCalls = run.callsByRoot.size > 0 ? Math.max(...run.callsByRoot.values()) : 0;
  const terminationReason = resolveFrTerminationReason(run, maxRootCalls);
  const finalNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
  const atomicLeafCount = finalNodes
    .filter(n => {
      const c = n.content as { root_kind?: string; status?: string };
      return (c.root_kind ?? 'fr') === config.rootKind && c.status === 'atomic';
    }).length;
  const pipelineFinalRecord = engine.writer.writeRecord({
    record_type: 'requirement_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '2',
    sub_phase_id: config.recordSubPhaseId,
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [run.pipelineStartRecord.id],
    content: {
      kind: 'requirement_decomposition_pipeline',
      pipeline_id: run.pipelineId,
      root_fr_id: run.pipelineRootKey,
      passes: run.pipelinePasses.map((p, i) =>
        i === run.pipelinePasses.length - 1
          ? { ...p, termination_reason: terminationReason }
          : p,
      ),
      final_leaf_count: atomicLeafCount,
      final_max_depth: run.maxDepthReached,
      total_llm_calls: totalLlmCalls,
    } satisfies RequirementDecompositionPipelineContent,
  });
  engine.writer.supersedByRollback(run.currentPipelineRecordId, pipelineFinalRecord.id);

  // Persist budget telemetry back to the workflow_runs row (per-kind column).
  try {
    engine.stateMachine.updateDecompositionTelemetry(
      workflowRun.id,
      config.rootKind,
      totalLlmCalls,
      run.maxDepthReached,
    );
  } catch {
    // Telemetry is best-effort — never block phase completion on it.
  }
}

// ── Product-lens handoff formatters (wave 5) ───────────────────────
//
// Render handoff sections as compact text blocks for the LLM prompt.
// Keeps each bloom's input ≤ ~5 K tokens even for a Hestami-scale
// handoff by showing ids + key fields rather than full JSON.

function formatJourneys(js: UserJourney[]): string {
  if (!js.length) return '(none)';
  return js.map(j => {
    // cal-22 surfaced an LLM shape divergence: `acceptanceCriteria`
    // arrives as a bare string ("Property record exists…") rather
    // than a string[]. Normalize so .slice/.join doesn't crash.
    const acs = coerceAcceptanceCriteria(j.acceptanceCriteria).slice(0, 3).join(' | ');
    return `- ${j.id} [${j.implementationPhase ?? '?'}] (persona ${j.personaId}) ${j.title}: ${j.scenario}` +
           (acs ? `\n  Acceptance: ${acs}` : '');
  }).join('\n');
}

/**
 * Coerce a journey's `acceptanceCriteria` field to string[] no matter
 * which shape the LLM emitted:
 *   - undefined/null         → []
 *   - "single string"        → ["single string"]
 *   - ["a", "b"]             → ["a", "b"]
 *   - [{description: "a"}…]  → ["a", …]  (extracts description/text/title)
 *   - mixed array            → string entries kept, objects extracted, others dropped
 *
 * Defensive because the LLM doesn't reliably honor the typed
 * UserJourney.acceptanceCriteria: string[] contract. cal-22 had it
 * as a string; future runs may emit objects when the model
 * "improves" with measurable conditions.
 */
function coerceAcceptanceCriteria(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return v.length > 0 ? [v] : [];
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const text = coerceAcceptanceCriterionItem(item);
    if (text !== null) out.push(text);
  }
  return out;
}

/**
 * Coerce a single acceptance-criterion array entry to a non-empty
 * string, or null when the entry contributes nothing:
 *   - non-empty string                            → the string
 *   - {description|text|title|criterion} object    → that field (if a non-empty string)
 *   - anything else / empty                        → null
 * Extracted from coerceAcceptanceCriteria to keep its cognitive
 * complexity within the SonarQube threshold; behavior is identical.
 */
function coerceAcceptanceCriterionItem(item: unknown): string | null {
  if (typeof item === 'string') {
    return item.length > 0 ? item : null;
  }
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const text = (o.description ?? o.text ?? o.title ?? o.criterion) as string | undefined;
    if (typeof text === 'string' && text.length > 0) return text;
  }
  return null;
}

function formatEntities(es: Entity[]): string {
  if (!es.length) return '(none)';
  return es.map(e => `- ${e.id} (${e.businessDomainId}) ${e.name}: ${e.description}`).join('\n');
}

function formatWorkflows(ws: WorkflowV2[]): string {
  if (!ws.length) return '(none)';
  return ws.map(w => {
    const triggers = w.triggers.map(t => {
      if (t.kind === 'journey_step') return `journey_step(${t.journey_id}#${t.step_number})`;
      if (t.kind === 'schedule') return `schedule(${t.cadence})`;
      if (t.kind === 'event') return `event(${t.event_type})`;
      if (t.kind === 'compliance') return `compliance(${t.regime_id}:${t.rule})`;
      return `integration(${t.integration_id}:${t.event})`;
    }).join(', ');
    return `- ${w.id} (${w.businessDomainId}) ${w.name}: ${w.description}\n  triggers: ${triggers}`;
  }).join('\n');
}

function formatExtractedItems(items: ExtractedItem[]): string {
  if (!items.length) return '(none)';
  return items.map(i => `- ${i.id} [${i.type}] ${i.text}`).join('\n');
}

function formatVocabulary(terms: VocabularyTerm[]): string {
  if (!terms.length) return '(none)';
  return terms.map(t => {
    const syn = (t.synonyms ?? []).length > 0 ? ` (synonyms: ${t.synonyms.join(', ')})` : '';
    return `- ${t.id} ${t.term}${syn}: ${t.definition}`;
  }).join('\n');
}

function formatVVRequirements(vvs: VVRequirement[]): string {
  if (!vvs.length) return '(none)';
  return vvs.map(v => {
    const threshold = v.threshold ? ` threshold='${v.threshold}'` : '';
    return `- ${v.id} [${v.category}] target='${v.target}' measurement='${v.measurement}'${threshold}`;
  }).join('\n');
}

function formatTechnicalConstraints(tcs: TechnicalConstraint[]): string {
  if (!tcs.length) return '(none)';
  return tcs.map(t => {
    const versionSuffix = t.version ? '@' + t.version : '';
    const tech = t.technology ? ` [${t.technology}${versionSuffix}]` : '';
    return `- ${t.id} (${t.category})${tech} ${t.text}`;
  }).join('\n');
}

/**
 * Wave 6 NFR adapter — cast a Non-Functional Requirement into the
 * DecompositionUserStory shape expected by runSaturationLoop. The
 * action field encodes the NFR's concern (category + description); the
 * outcome encodes the threshold; the single synthetic AC carries the
 * measurable_condition formed from threshold + measurement_method.
 * Decomposer children are standard user-story-shaped with tier labels.
 */
/**
 * Wave 6 resume helper — reconstruct runSaturationLoop's in-memory
 * state from governed_stream records when we're re-entering a
 * previously-partial decomposition. Returns null when no prior state
 * exists (normal / fresh-run case). Returns a fully-populated state
 * object when the stream already has decomposition nodes for the given
 * root_kind — the caller seeds its loop from these values instead of
 * the fresh-seed path.
 *
 * The queue is rebuilt from "pending" nodes that haven't yet produced
 * children in the stream. Tier hint is derived from each node's own
 * tier label: B → 'B' (accepted commitment re-entering for Tier-C
 * decomposition), C → 'C', A → 'A', absent → 'root'. Atomic (D) and
 * non-pending statuses are NOT re-queued.
 *
 * Known limitations documented for the operator:
 *   - If a mirror gate bundle was presented before the stall but not
 *     resolved, resume does not re-present it. Operator must resolve
 *     the stale bundle from the webview OR delete the DB and restart.
 *   - If Phase 2.1 bloom produced different root FRs on the resuming
 *     run than the prior run, the reconstructed tree uses the PRIOR
 *     roots (from the stream). Phase 2.1's new bloom output is
 *     discarded for the saturation loop.
 */
interface SaturationResumeState {
  queue: Array<{
    parentRecordId: string;
    nodeId: string;
    parentNodeId: string | null;
    rootFrId: string;
    depth: number;
    userStory: DecompositionUserStory;
    displayKey: string;
    tierHint: DecompositionTier | 'root';
    releaseId: string | null;
    releaseOrdinal: number | null;
  }>;
  allAssumptions: AssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionUserStory[]>;
  // Per-root LLM-call counters do NOT resume — each resume session
  // gets a fresh per-root budget. Operators who want a strict global
  // cap across all sessions can track it via the workflow_runs
  // per-kind columns, which do persist.
  maxDepthReached: number;
  passNumber: number;
  pipelinePasses: DecompositionPassEntry[];
  pipelineStartRecord: GovernedStreamRecord;
  currentPipelineRecordId: string;
}

/**
 * Build the latest-record-per-node_id view for one root_kind's slice of
 * the decomposition stream. Fetches ALL versions (superseded included)
 * so the caller can walk the newest revision of each logical node.
 */
function buildLatestNodeByIdForKind(
  kindMatch: GovernedStreamRecord[],
): Map<string, GovernedStreamRecord> {
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of kindMatch) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) {
      latestByNodeId.set(c.node_id, r);
    }
  }
  return latestByNodeId;
}

/** Parent node_id → set of child node_ids, from the latest-per-node map. */
function buildChildrenByParentMap(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): Map<string, Set<string>> {
  const childrenByParent = new Map<string, Set<string>>();
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.parent_node_id) {
      const set = childrenByParent.get(c.parent_node_id) ?? new Set<string>();
      set.add(c.node_id);
      childrenByParent.set(c.parent_node_id, set);
    }
  }
  return childrenByParent;
}

/**
 * Rebuild the resume queue: pending nodes whose children haven't been
 * written yet. Tier hint is derived from the node's own tier ('root' at
 * depth 0); release assignment + display_key are reused from the stream.
 */
function buildResumeQueue(
  latestByNodeId: Map<string, GovernedStreamRecord>,
  childrenByParent: Map<string, Set<string>>,
): SaturationResumeState['queue'] {
  const queue: SaturationResumeState['queue'] = [];
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.status !== 'pending') continue;
    if (childrenByParent.get(c.node_id)?.size) continue;
    // Derive tier hint from the node's own tier. Depth-0 roots have no
    // tier → use 'root'. Depth 1+ nodes with a tier use it directly.
    const tierHint: DecompositionTier | 'root' = c.tier ?? 'root';
    queue.push({
      parentRecordId: r.id,
      nodeId: c.node_id,
      parentNodeId: c.parent_node_id,
      rootFrId: c.root_fr_id,
      depth: c.depth,
      userStory: c.user_story,
      // Reuse persisted display_key (post-fix runs). Fall back to the
      // raw user_story.id for nodes persisted before display_key was
      // introduced — those pre-fix rows won't exist in fresh cal runs,
      // but the fallback keeps the resume path robust to hand-edited DBs.
      displayKey: c.display_key ?? c.user_story?.id ?? c.node_id,
      tierHint,
      // Release assignment persists — reuse from the stream so
      // downstream children of this node inherit the same release.
      releaseId: c.release_id ?? null,
      releaseOrdinal: c.release_ordinal ?? null,
    });
  }
  return queue;
}

/**
 * Rebuild siblingsByParent from the latest-per-node map. Depth-0 nodes
 * form the null-keyed root list; deeper nodes group under their parent.
 */
function buildSiblingsByParentMap(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): Map<string | null, DecompositionUserStory[]> {
  const siblings = new Map<string | null, DecompositionUserStory[]>();
  // null-parent (root list) — depth-0 nodes of this kind.
  const rootList: DecompositionUserStory[] = [];
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.depth === 0) rootList.push(c.user_story);
    else {
      const parentKey = c.parent_node_id ?? null;
      const arr = siblings.get(parentKey) ?? [];
      arr.push(c.user_story);
      siblings.set(parentKey, arr);
    }
  }
  siblings.set(null, rootList);
  return siblings;
}

interface ResumeAssumptionState {
  allAssumptions: AssumptionEntry[];
  assumptionSeq: number;
  passNumber: number;
}

/**
 * Rebuild assumption state from the latest snapshot matching `kindMarker`
 * (the pipeline root key). assumptionSeq is recovered by parsing the
 * "A-NNNN" ids so the loop keeps minting non-colliding assumption ids.
 */
function rebuildResumeAssumptionState(
  snapshots: GovernedStreamRecord[],
  kindMarker: string,
): ResumeAssumptionState {
  const latestSnapshot = snapshots
    .filter(r => ((r.content as unknown as AssumptionSetSnapshotContent).root_fr_id ?? '*') === kindMarker)
    .reduce<GovernedStreamRecord | null>((acc, r) =>
      !acc || r.produced_at > acc.produced_at ? r : acc, null);
  let allAssumptions: AssumptionEntry[] = [];
  let passNumber = 0;
  if (latestSnapshot) {
    const snap = latestSnapshot.content as unknown as AssumptionSetSnapshotContent;
    allAssumptions = [...snap.assumptions];
    passNumber = snap.pass_number;
  }
  // Max assumption id → parse "A-NNNN" format to rebuild the sequence counter.
  let assumptionSeq = 0;
  for (const a of allAssumptions) {
    const m = /^A-(\d+)$/.exec(a.id);
    if (m) assumptionSeq = Math.max(assumptionSeq, Number.parseInt(m[1], 10));
  }
  return { allAssumptions, assumptionSeq, passNumber };
}

interface ResumePipelineState {
  startRecord: GovernedStreamRecord;
  latestRecord: GovernedStreamRecord;
  pipelinePasses: DecompositionPassEntry[];
}

/**
 * Rebuild pipeline container state: the earliest matching record (start)
 * and the newest by produced_at (current), plus the current pass list.
 * Returns null when no pipeline matches — the caller treats that as a
 * fresh (non-resume) start.
 */
function rebuildResumePipelineState(
  allPipelines: GovernedStreamRecord[],
  pipelineId: string,
  pipelineRootKey: string,
): ResumePipelineState | null {
  const matchingPipelines = allPipelines.filter(r => {
    const c = r.content as unknown as RequirementDecompositionPipelineContent;
    return c.pipeline_id === pipelineId && c.root_fr_id === pipelineRootKey;
  });
  if (matchingPipelines.length === 0) return null; // No pipeline → treat as fresh
  const startRecord = matchingPipelines
    .reduce((acc, r) => acc && acc.produced_at < r.produced_at ? acc : r);
  const latestRecord = matchingPipelines
    .reduce((acc, r) => !acc || r.produced_at > acc.produced_at ? r : acc);
  const pipelinePasses = [...(latestRecord.content as unknown as RequirementDecompositionPipelineContent).passes];
  return { startRecord, latestRecord, pipelinePasses };
}

/**
 * Max depth across all latest nodes for this kind. Per-root LLM-call
 * counters intentionally do NOT resume; each resume session starts with
 * a fresh per-root budget (see runSaturationLoop).
 */
function computeMaxDepthFromNodes(
  latestByNodeId: Map<string, GovernedStreamRecord>,
): number {
  let maxDepth = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.depth > maxDepth) maxDepth = c.depth;
  }
  return maxDepth;
}

export function rebuildSaturationStateFromStream(
  ctx: PhaseContext,
  config: SaturationLoopConfig,
  pipelineId: string,
  pipelineRootKey: string,
): SaturationResumeState | null {
  const { engine, workflowRun } = ctx;
  // Fetch ALL versions (including superseded) so we can rebuild the
  // latest-per-node_id view ourselves. `is_current_version` filtering
  // would miss edits we want to walk through.
  const allNodes = engine.writer.getRecordsByType(
    workflowRun.id, 'requirement_decomposition_node', false,
  );
  const kindMatch = allNodes.filter(r => {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    return (c.root_kind ?? 'fr') === config.rootKind;
  });
  if (kindMatch.length === 0) return null;

  const latestByNodeId = buildLatestNodeByIdForKind(kindMatch);
  const childrenByParent = buildChildrenByParentMap(latestByNodeId);
  const queue = buildResumeQueue(latestByNodeId, childrenByParent);
  const siblings = buildSiblingsByParentMap(latestByNodeId);

  // Rebuild assumption state from the latest snapshot for this root_kind.
  const snapshots = engine.writer.getRecordsByType(workflowRun.id, 'assumption_set_snapshot', false);
  const { allAssumptions, assumptionSeq, passNumber } = rebuildResumeAssumptionState(snapshots, pipelineRootKey);

  // Rebuild pipeline container state: find the latest current-version record
  // with matching pipeline_id and root_fr_id. If that isn't current, fall
  // back to the newest by produced_at.
  const allPipelines = engine.writer.getRecordsByType(
    workflowRun.id, 'requirement_decomposition_pipeline', false,
  );
  const pipeline = rebuildResumePipelineState(allPipelines, pipelineId, pipelineRootKey);
  if (!pipeline) return null; // No pipeline → treat as fresh

  const maxDepth = computeMaxDepthFromNodes(latestByNodeId);

  return {
    queue,
    allAssumptions,
    assumptionSeq,
    siblingsByParent: siblings,
    maxDepthReached: maxDepth,
    passNumber,
    pipelinePasses: pipeline.pipelinePasses,
    pipelineStartRecord: pipeline.startRecord,
    currentPipelineRecordId: pipeline.latestRecord.id,
  };
}

function adaptNfrToUserStory(nfr: NonFunctionalRequirement): UserStory {
  const methodSuffix = nfr.measurement_method ? ` (measured via ${nfr.measurement_method})` : '';
  return {
    id: nfr.id,
    role: 'system',
    action: `satisfy the ${nfr.category} requirement: ${nfr.description}`,
    outcome: nfr.threshold,
    acceptance_criteria: [
      {
        id: 'AC-001',
        description: nfr.description,
        measurable_condition: `${nfr.threshold}${methodSuffix}`,
      },
    ],
    priority: 'high',
    traces_to: nfr.traces_to ?? [],
  };
}

// ── Wave 6 — Level-1 decomposition formatting + parsing helpers ─────

function formatRootStoryForDecomposition(s: UserStory): string {
  const acs = s.acceptance_criteria
    .map(ac => `  - ${ac.id}: ${ac.description} (${ac.measurable_condition})`)
    .join('\n');
  const traces = (s.traces_to ?? []).join(', ') || '(none)';
  return `${s.id} [${s.priority}]
As a ${s.role}, I want to ${s.action}, so that ${s.outcome}.
Acceptance criteria:
${acs}
Traces to: ${traces}`;
}

function formatHandoffForDecomposition(h: ProductDescriptionHandoffContent): string {
  const lines: string[] = [];
  if (h.userJourneys?.length) lines.push('User journeys:', formatJourneys(h.userJourneys));
  if (h.entityProposals?.length) lines.push('Entities:', formatEntities(h.entityProposals));
  if (h.workflowProposals?.length) lines.push('Workflows:', formatWorkflows(h.workflowProposals));
  // QA-# quality attributes — both saturation templates list QA-# as a
  // valid `traces_to` prefix. Without this roster the model fabricates
  // QA-# ids and `sanitizeChildStory` passes them through unvalidated.
  if (h.qualityAttributes?.length) {
    lines.push(
      'Quality attributes:',
      h.qualityAttributes.map((q, i) => `- [QA-${i + 1}] ${q}`).join('\n'),
    );
  }
  if (h.technicalConstraints?.length) lines.push('Technical constraints:', formatTechnicalConstraints(h.technicalConstraints));
  if (h.vvRequirements?.length) lines.push('V&V requirements:', formatVVRequirements(h.vvRequirements));
  if (h.complianceExtractedItems?.length) lines.push('Compliance items:', formatExtractedItems(h.complianceExtractedItems));
  if (h.canonicalVocabulary?.length) lines.push('Canonical vocabulary:', formatVocabulary(h.canonicalVocabulary));
  return lines.length === 0 ? '(empty handoff)' : lines.join('\n');
}

/**
 * Coerce the decomposer's `tier` output to a valid DecompositionTier.
 * Defaults to 'A' when absent or unrecognized — which means the node
 * will keep recursing (safe default), not get promoted to commitment
 * or frozen as a leaf. Mislabels surface through later Tier-B batching
 * pattern rather than by silent promotion.
 */
function normalizeTier(raw: unknown): DecompositionTier {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  return 'A';
}

/**
 * Coerce a parsed JSON child into a DecompositionUserStory. Returns
 * null if required fields (id, role, action, outcome, at least one AC)
 * are missing — that child is dropped rather than silently faked.
 * Every drop is logged with the reason so that malformed model output
 * is visible in the workflow trace (not a silent tree gap).
 */
function sanitizeChildStory(
  c: Record<string, unknown>,
  logContext: { rootId: string; childIndex: number },
): DecompositionUserStory | null {
  const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : null;
  const role = typeof c.role === 'string' ? c.role : null;
  const action = typeof c.action === 'string' ? c.action : null;
  const outcome = typeof c.outcome === 'string' ? c.outcome : null;
  if (!id || !role || !action || !outcome) {
    getLogger().warn('workflow', 'Phase 2.1a: dropped malformed child (missing required fields)', {
      ...logContext,
      missing: { id: !id, role: !role, action: !action, outcome: !outcome },
      rawIdAttempt: typeof c.id === 'string' ? c.id : '(non-string)',
    });
    return null;
  }
  const acsRaw = Array.isArray(c.acceptance_criteria) ? c.acceptance_criteria as Array<Record<string, unknown>> : [];
  const acs = acsRaw
    .map((ac, idx) => ({
      id: typeof ac.id === 'string' ? ac.id : `AC-${String(idx + 1).padStart(3, '0')}`,
      description: typeof ac.description === 'string' ? ac.description : '',
      measurable_condition: typeof ac.measurable_condition === 'string' ? ac.measurable_condition : '',
    }))
    .filter(ac => ac.description.length > 0 && ac.measurable_condition.length > 0);
  if (acs.length === 0) {
    getLogger().warn('workflow', 'Phase 2.1a: dropped malformed child (no valid acceptance criteria)', {
      ...logContext,
      childId: id,
      rawAcCount: acsRaw.length,
    });
    return null;
  }
  const priority = (['critical', 'high', 'medium', 'low'] as const).includes(c.priority as 'critical')
    ? c.priority as UserStoryPriority
    : 'medium';
  const traces = Array.isArray(c.traces_to)
    ? (c.traces_to as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return { id, role, action, outcome, acceptance_criteria: acs, priority, traces_to: traces };
}
