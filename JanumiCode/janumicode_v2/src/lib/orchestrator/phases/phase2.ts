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
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, findProductDescriptionHandoff } from './phaseContext';
import type {
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
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { runFrBloomThreePass } from './phase2/frBloomThreePass';
import { runNfrBloomThreePass } from './phase2/nfrBloomThreePass';
import type { NfrSkeleton } from './phase2/verifyNfrCoverage';
import type { DecisionBundleContent, MirrorItem, MirrorItemDecision } from '../../types/decisionBundle';
import { OllamaEmbeddingClient, findNearestAbove, type EmbeddingClient } from '../../llm/embeddings';
import { randomUUID } from 'node:crypto';

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
function assignReleaseToRoot(
  rootStory: DecompositionUserStory | { traces_to?: string[] },
  plan: ReleasePlanContentV2 | null,
): { release_id: string | null; release_ordinal: number | null } {
  if (!plan || !plan.approved) return { release_id: null, release_ordinal: null };
  const traces = rootStory.traces_to ?? [];
  if (traces.length === 0) return { release_id: null, release_ordinal: null };
  // Widened manifest lookup: an FR root's `traces_to[]` can cite any
  // handoff artifact type (journey, workflow, entity, compliance,
  // integration, vocabulary). For each release (ascending ordinal),
  // test whether any of the root's trace ids appear in any of that
  // release's `contains[type]` arrays. First match wins.
  //
  // `cross_cutting` intentionally does NOT anchor a root to a release:
  // a workflow / compliance item / integration / vocab term marked
  // cross-cutting is available in every release, so it gives no
  // release-ordering signal. If a root's only trace is into
  // cross_cutting, it remains backlog (release_id: null). Callers
  // treat that as "spans all releases / not release-scheduled".
  const sortedReleases = [...plan.releases].sort((a, b) => a.ordinal - b.ordinal);
  const traceSet = new Set(traces);
  for (const r of sortedReleases) {
    const c = r.contains;
    const anyMatch =
      c.journeys.some((id: string) => traceSet.has(id)) ||
      c.workflows.some((id: string) => traceSet.has(id)) ||
      c.entities.some((id: string) => traceSet.has(id)) ||
      c.compliance.some((id: string) => traceSet.has(id)) ||
      c.integrations.some((id: string) => traceSet.has(id)) ||
      c.vocabulary.some((id: string) => traceSet.has(id));
    if (anyMatch) return { release_id: r.release_id, release_ordinal: r.ordinal };
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

interface UserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  acceptance_criteria: AcceptanceCriterion[];
  priority: 'critical' | 'high' | 'medium' | 'low';
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
  recordSubPhaseId: '2.1a' | '2.2a';
  templateSubPhase: string;
  rootKind: 'fr' | 'nfr';
  gateSurfacePrefix: string;
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
    engine.stateMachine.setSubPhase(workflowRun.id, '2.1');

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

    let frContent: FunctionalRequirements;
    let frCoverageGaps: CoverageGapContent[] = [];
    if (resumingFr) {
      getLogger().info('workflow', 'Phase 2.1 RESUME: using existing depth-0 FR nodes; skipping bloom', {
        existingRoots: existingRootNodes.length,
      });
      frContent = {
        user_stories: existingRootNodes.map(r =>
          (r.content as unknown as RequirementDecompositionNodeContent).user_story as UserStory,
        ),
      };
    } else {
      // Invoke DMR to assemble cross-cutting context (active constraints,
      // material findings, ingested external files) before the bloom.
      const dmr21 = await buildPhaseContextPacket(ctx, {
        subPhaseId: '2.1',
        requestingAgentRole: 'requirements_agent',
        query: `Functional requirements bloom for: ${intentSummary.slice(0, 400)}`,
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
      frContent = { user_stories: three.userStories as UserStory[] };
      frCoverageGaps = three.coverageGaps;
    }

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
      sub_phase_id: '2.1',
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

    // Wave 8 Pass 3 — persist coverage_gap records from the deterministic
    // verifier. Blocking severity halts the phase; advisory severity logs
    // but proceeds. Only runs on non-resume product-lens paths; resume
    // replays from the stream and does not re-verify.
    if (frCoverageGaps.length > 0) {
      const blockingGaps = frCoverageGaps.filter(g => g.severity === 'blocking');
      const gapRecIds = this.persistCoverageGaps(ctx, frCoverageGaps, [frRecord.id]);
      if (blockingGaps.length > 0) {
        getLogger().warn('workflow', 'Phase 2.1c: blocking coverage gaps detected', {
          workflow_run_id: workflowRun.id,
          gap_count: blockingGaps.length,
          advisory_count: frCoverageGaps.length - blockingGaps.length,
          gap_record_ids: gapRecIds,
        });
        return {
          success: false,
          error: `Phase 2.1c FR coverage verifier: ${blockingGaps.length} blocking gap(s) — ${blockingGaps.map(g => g.check).join(', ')}. Review coverage_gap records and re-run.`,
          artifactIds,
        };
      }
      getLogger().info('workflow', 'Phase 2.1c: advisory-only coverage notes', {
        workflow_run_id: workflowRun.id,
        advisory_count: frCoverageGaps.length,
      });
    }

    // Wave 6 — emit depth-0 decomposition node records mirroring each
    // root FR. These are the seeds for sub-phase 2.1a recursive
    // decomposition. Skipped on resume (nodes already exist in the stream).
    let rootNodeIds: string[];
    let rootLogicalIds: string[];
    if (resumingFr) {
      rootNodeIds = existingRootNodes.map(r => r.id);
      rootLogicalIds = existingRootNodes.map(r => (r.content as unknown as RequirementDecompositionNodeContent).node_id);
    } else {
      rootNodeIds = [];
      rootLogicalIds = [];
      const rootDisplayKeys = new Set<string>();
      // Resolve the approved ReleasePlan once — all FR roots for this
      // run match against the same plan. Null (no pointer on
      // workflow_runs, or default-lens run) → backlog for every root.
      const releasePlan = readActiveReleasePlan(ctx);
      for (const story of frContent.user_stories) {
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
          sub_phase_id: '2.1',
          produced_by_agent_role: 'requirements_agent',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [frRecord.id],
          content: {
            kind: 'requirement_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: displayKey,
            root_fr_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            user_story: story as DecompositionUserStory,
            surfaced_assumption_ids: [],
            release_id,
            release_ordinal,
          } satisfies RequirementDecompositionNodeContent,
        });
        rootNodeIds.push(node.id);
        rootLogicalIds.push(logicalNodeId);
      }
    }

    // ── 2.1a — Functional Requirements Decomposition ──
    // Wave 6 Pass-1 Level-1 decomposition. Handoff always present post-Wave 8.
    engine.stateMachine.setSubPhase(workflowRun.id, '2.1a');
    await this.runSaturationLoop(
      ctx,
      handoff,
      frContent.user_stories,
      rootNodeIds,
      rootLogicalIds,
    );

    // ── 2.2 — Non-Functional Requirements Bloom ───────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.2');

    // Wave 6 resume — same idempotency as FR: if depth-0 NFR nodes
    // already exist, recover from stream rather than re-bloom.
    const existingNfrRootNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node')
      .filter(r => {
        const c = r.content as unknown as RequirementDecompositionNodeContent;
        return c.depth === 0 && c.root_kind === 'nfr';
      });
    const resumingNfr = existingNfrRootNodes.length > 0;

    // Build a rich FR summary for the NFR prompt
    const frSummary = frContent.user_stories.map(s =>
      `${s.id} [${s.priority}]: As a ${s.role}, I want to ${s.action}, so that ${s.outcome}. ACs: ${s.acceptance_criteria.map(ac => `${ac.id}: ${ac.measurable_condition}`).join('; ')}`,
    ).join('\n');

    let nfrContent: NonFunctionalRequirements;
    let nfrCoverageGaps: CoverageGapContent[] = [];
    if (resumingNfr) {
      getLogger().info('workflow', 'Phase 2.2 RESUME: using existing depth-0 NFR nodes; skipping bloom', {
        existingRoots: existingNfrRootNodes.length,
      });
      // Rebuild NFR shape from the user-story-adapted nodes. The
      // saturation loop only uses .id / .user_story for decomposition,
      // so a minimal reconstruction is sufficient. We preserve the
      // stored user_story wholesale.
      nfrContent = {
        requirements: existingNfrRootNodes.map(r => {
          const c = r.content as unknown as RequirementDecompositionNodeContent;
          const s = c.user_story;
          return {
            id: s.id,
            category: 'security' as const,
            description: s.action,
            threshold: s.outcome,
            measurement_method: s.acceptance_criteria[0]?.measurable_condition,
            traces_to: s.traces_to ?? [],
          };
        }),
      };
    } else {
      const dmr22 = await buildPhaseContextPacket(ctx, {
        subPhaseId: '2.2',
        requestingAgentRole: 'requirements_agent',
        query: `Non-functional requirements for: ${intentSummary.slice(0, 200)}; FRs: ${frSummary.slice(0, 200)}`,
        detailFileLabel: 'p2_2_nfr',
        requiredOutputSpec: 'non_functional_requirements JSON — performance, security, reliability, etc.',
      });
      // Wave 8 — product-lens three-pass NFR flow.
      const three = await runNfrBloomThreePass({
        ctx, handoff, dmr: dmr22, intentSummary, frSummary,
        acceptedFrIds: frContent.user_stories.map(s => s.id),
        format: { formatExtractedItems, formatVVRequirements, formatTechnicalConstraints },
      });
      nfrContent = {
        requirements: three.nfrs.map((n: NfrSkeleton) => ({
          id: n.id,
          category: n.category as NonFunctionalRequirement['category'],
          description: n.description,
          threshold: n.threshold ?? '',
          measurement_method: n.measurement_method,
          traces_to: n.traces_to,
          applies_to_requirements: n.applies_to_requirements,
        })),
      };
      nfrCoverageGaps = three.coverageGaps;
    }

    const nfrDerivedFrom = [frRecord.id, handoffRecordId];
    const nfrRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.2',
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

    // Wave 8 Pass 3 — persist NFR coverage_gap records. Blocking halts
    // the phase; advisory logs and proceeds. Only runs on non-resume
    // product-lens paths.
    if (nfrCoverageGaps.length > 0) {
      const blockingGaps = nfrCoverageGaps.filter(g => g.severity === 'blocking');
      const gapRecIds = this.persistCoverageGaps(ctx, nfrCoverageGaps, [nfrRecord.id]);
      if (blockingGaps.length > 0) {
        getLogger().warn('workflow', 'Phase 2.2c: blocking NFR coverage gaps detected', {
          workflow_run_id: workflowRun.id,
          gap_count: blockingGaps.length,
          advisory_count: nfrCoverageGaps.length - blockingGaps.length,
          gap_record_ids: gapRecIds,
        });
        return {
          success: false,
          error: `Phase 2.2c NFR coverage verifier: ${blockingGaps.length} blocking gap(s) — ${blockingGaps.map(g => g.check).join(', ')}. Review coverage_gap records and re-run.`,
          artifactIds,
        };
      }
      getLogger().info('workflow', 'Phase 2.2c: advisory-only NFR coverage notes', {
        workflow_run_id: workflowRun.id,
        advisory_count: nfrCoverageGaps.length,
      });
    }

    // Wave 6 — emit depth-0 NFR decomposition node records (one per
    // root NFR) and run the NFR saturation loop under sub-phase 2.2a.
    // The saturation loop is the same method that drives FR decomposition;
    // it's parameterized on sub-phase id + template id + root_kind.
    {
      let nfrRootNodeIds: string[];
      let nfrRootLogicalIds: string[];
      const nfrAsStories: UserStory[] = nfrContent.requirements.map(adaptNfrToUserStory);
      if (resumingNfr) {
        nfrRootNodeIds = existingNfrRootNodes.map(r => r.id);
        nfrRootLogicalIds = existingNfrRootNodes.map(r => (r.content as unknown as RequirementDecompositionNodeContent).node_id);
      } else {
        nfrRootNodeIds = [];
        nfrRootLogicalIds = [];
        const nfrRootDisplayKeys = new Set<string>();
        const nfrReleasePlan = readActiveReleasePlan(ctx);
        for (const story of nfrAsStories) {
          const logicalNodeId = mintLogicalNodeId();
          const displayKey = collisionSafeDisplayKey(story.id, nfrRootDisplayKeys, logicalNodeId);
          nfrRootDisplayKeys.add(displayKey);
          const { release_id, release_ordinal } = assignReleaseToRoot(
            story as DecompositionUserStory, nfrReleasePlan,
          );
          const node = engine.writer.writeRecord({
            record_type: 'requirement_decomposition_node',
            schema_version: '1.0',
            workflow_run_id: workflowRun.id,
            phase_id: '2',
            sub_phase_id: '2.2',
            produced_by_agent_role: 'requirements_agent',
            janumicode_version_sha: engine.janumiCodeVersionSha,
            derived_from_record_ids: [nfrRecord.id],
            content: {
              kind: 'requirement_decomposition_node',
              node_id: logicalNodeId,
              parent_node_id: null,
              display_key: displayKey,
              root_fr_id: logicalNodeId,
              depth: 0,
              pass_number: 0,
              status: 'pending',
              root_kind: 'nfr',
              user_story: story as DecompositionUserStory,
              surfaced_assumption_ids: [],
              release_id,
              release_ordinal,
            } satisfies RequirementDecompositionNodeContent,
          });
          nfrRootNodeIds.push(node.id);
          nfrRootLogicalIds.push(logicalNodeId);
        }
      }

      engine.stateMachine.setSubPhase(workflowRun.id, '2.2a');
      await this.runSaturationLoop(
        ctx,
        handoff,
        nfrAsStories,
        nfrRootNodeIds,
        nfrRootLogicalIds,
        {
          recordSubPhaseId: '2.2a',
          templateSubPhase: '02_2a_non_functional_requirements_decomposition',
          rootKind: 'nfr',
          gateSurfacePrefix: 'nfr-decomp-gate-',
        },
      );
    }

    // ── 2.3 — Requirements Mirror and Menu ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.3');

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
      sub_phase_id: '2.3',
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

    // ── 2.4 — Requirements Consistency Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.4');

    const consistencyReport = this.runConsistencyCheck(frContent, nfrContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.4',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '2.5');

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
      sub_phase_id: '2.5',
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
        return { success: false, error: 'User rejected domain attestation', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2 attestation failed', { error: String(err) });
      return { success: false, error: 'Domain attestation failed', artifactIds };
    }

    // ── Phase Gate ────────────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '2',
      sub_phase_id: '2.5',
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

    return { success: true, artifactIds };
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
      recordSubPhaseId: '2.1a',
      templateSubPhase: '02_1a_functional_requirements_decomposition',
      rootKind: 'fr',
      gateSurfacePrefix: 'decomp-gate-',
    },
  ): Promise<void> {
    const { engine, workflowRun } = ctx;
    const caps = engine.configManager.get().decomposition;

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

    const handoffSummary = formatHandoffForDecomposition(handoff);

    interface QueueEntry {
      parentRecordId: string;           // governed-stream row UUID of the parent record revision
      nodeId: string;                   // logical UUID (content.node_id) — stable across revisions
      parentNodeId: string | null;      // parent's logical UUID
      rootFrId: string;                 // root's logical UUID
      depth: number;
      userStory: DecompositionUserStory; // carries LLM's raw story.id for display / prompt context
      displayKey: string;                // sibling-unique human label (content.display_key)
      tierHint: DecompositionTier | 'root';
      // Release assignment — inherited from this entry's root. Children
      // of this entry inherit the same (release_id, release_ordinal).
      // Preserved across supersessions (see design doc Q2: preserve).
      releaseId: string | null;
      releaseOrdinal: number | null;
    }

    const pipelineId = `decomp-pipe-${config.rootKind}-${workflowRun.id.slice(0, 8)}`;
    const pipelineRootKey = config.rootKind === 'nfr' ? '*nfr*' : '*';

    // Wave 6 follow-up — resume detection. If decomposition nodes for
    // this root_kind already exist, we're resuming a prior run (e.g. a
    // cal iteration that stalled and is being replayed via
    // --resume-from-db). Rebuild the queue, assumption set, and
    // pipeline-record chain from the stream rather than seeding fresh.
    const resumed = rebuildSaturationStateFromStream(ctx, config, pipelineId, pipelineRootKey);

    const allAssumptions: AssumptionEntry[] = resumed?.allAssumptions ?? [];
    let assumptionSeq = resumed?.assumptionSeq ?? 0;
    const newAssumptionId = (): string => `A-${String(++assumptionSeq).padStart(4, '0')}`;

    // Seed queue: fresh from rootStories, OR resumed from pending stream nodes.
    // Fresh roots pair with rootLogicalIds 1:1 (minted when the depth-0 node
    // was written). On resume the queue comes pre-populated with logical UUIDs
    // reconstructed from governed_stream content by rebuildSaturationStateFromStream
    // — including the release assignment that was persisted to the root.
    const releasePlanForSeed = readActiveReleasePlan(ctx);
    const queue: QueueEntry[] = resumed?.queue ?? rootStories.map((s, i) => {
      const { release_id, release_ordinal } = assignReleaseToRoot(
        s as DecompositionUserStory, releasePlanForSeed,
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
    // siblingsByParent is keyed by logical parent UUID (or null for roots).
    const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionUserStory[]>();
    if (!resumed) {
      siblingsByParent.set(null, rootStories.map(s => s as DecompositionUserStory));
    }

    // Per-root LLM-call budget. `budget_cap` applies PER ROOT within
    // this root_kind (matches the docstring on configManager.decomposition).
    // Counters are in-memory only — a fresh resume session gets a fresh
    // budget per root. The telemetry write at loop end records the sum
    // in the kind-specific workflow_runs column so operators can inspect
    // aggregate load without walking the stream.
    const callsByRoot = new Map<string, number>();
    let maxDepthReached = resumed?.maxDepthReached ?? 0;
    let passNumber = resumed?.passNumber ?? 0;

    // ── Divergence + dedup-offline tracking (Wave 6 safety) ─────────
    //
    // The saturation loop is supposed to peak then decline — each
    // pass's `nodes_produced` crossing the previous pass's value
    // once, then shrinking until `semantic_delta === 0`. When the
    // decomposer instead doubles output every pass, it's diverging
    // (common cause: dedup silently failed, so every paraphrased
    // assumption counts as net-new, and `semantic_delta` never drops).
    // These counters let us WARN at 3 consecutive growth/failure
    // passes and hard-terminate at 4+ with an explicit termination
    // reason — instead of letting the loop burn to budget_cap and
    // leaving the operator guessing. `growthThreshold` and
    // `divergeTerminatePasses` are env-tunable for experiments.
    const divergeGrowthRatio = Number.parseFloat(
      process.env.JANUMICODE_DIVERGE_GROWTH_RATIO ?? '1.2');
    const divergeWarnPasses = Number.parseInt(
      process.env.JANUMICODE_DIVERGE_WARN_PASSES ?? '3', 10);
    const divergeTerminatePasses = Number.parseInt(
      process.env.JANUMICODE_DIVERGE_TERMINATE_PASSES ?? '4', 10);
    const dedupOfflineWarnPasses = Number.parseInt(
      process.env.JANUMICODE_DEDUP_OFFLINE_WARN_PASSES ?? '3', 10);
    let consecutiveGrowthPasses = 0;
    let consecutiveDedupOfflinePasses = 0;
    let dedupOfflineAnnounced = false;
    let divergingEarlyTerminate = false;

    const pipelinePasses: DecompositionPassEntry[] = resumed?.pipelinePasses ?? [];
    // The pipeline container: either carry forward the resumed one, or
    // write a fresh start record. One per root_kind per run.
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
    let currentPipelineRecordId = resumed?.currentPipelineRecordId ?? pipelineStartRecord.id;

    if (resumed) {
      getLogger().info('workflow', `Phase ${config.recordSubPhaseId} RESUME: reconstructed state from stream`, {
        queueSize: queue.length,
        assumptions: allAssumptions.length,
        passNumber,
        // Per-root LLM-call counters do NOT persist across resumes —
        // each resume session starts with a fresh per-root budget.
        maxDepthReached,
      });
    }

    // Wave 6 dedup — embedding cache for flag-but-don't-merge. On
    // resume we batch-embed the existing assumption set to rebuild the
    // cache; on fresh run it starts empty. Failures degrade gracefully:
    // we log and continue with no dedup (raw delta is the fallback
    // termination signal). Threshold intentionally conservative (0.92)
    // to minimize false-merge risk; tunable via env.
    const embeddingClient: EmbeddingClient = engine.getEmbeddingClientOverride() ?? new OllamaEmbeddingClient();
    const embeddingCache = new Map<string, number[]>();
    const dedupThreshold = Number.parseFloat(
      process.env.JANUMICODE_ASSUMPTION_DEDUP_THRESHOLD ?? '0.92');
    // Dedup is on by default wherever it can reach ollama. The embedding
    // client has short connect + idle timeouts so environments without
    // ollama degrade gracefully to no-dedup (raw delta remains as the
    // fallback termination signal). Set JANUMICODE_ASSUMPTION_DEDUP_DISABLED=1
    // to turn it off explicitly.
    const dedupEnabled = Number.isFinite(dedupThreshold)
      && dedupThreshold > 0
      && (process.env.JANUMICODE_ASSUMPTION_DEDUP_DISABLED ?? '') !== '1';
    if (dedupEnabled && allAssumptions.length > 0) {
      try {
        const vecs = await embeddingClient.embed(
          allAssumptions.map(a => a.text),
          { signal: engine.getSessionAbortSignal() },
        );
        allAssumptions.forEach((a, i) => {
          if (vecs[i]) embeddingCache.set(a.id, vecs[i]);
        });
        getLogger().info('workflow', `Phase ${config.recordSubPhaseId}: dedup cache seeded from existing assumptions`, {
          cached: embeddingCache.size, total: allAssumptions.length,
        });
      } catch (err) {
        getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup seed failed — continuing without dedup`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Node parent-chain map — logical-UUID → logical-parent-UUID. Used
    // for scoped-assumption injection so each decomposer call sees only
    // assumptions surfaced at nodes in its own ancestor chain. The map
    // is seeded from the governed_stream (picks up both the fresh roots
    // just written and any prior-pass nodes on resume), then kept in
    // sync as new children are written during the loop.
    const parentChain = new Map<string, string | null>();
    {
      const existingNodes = engine.writer.getRecordsByType(
        workflowRun.id, 'requirement_decomposition_node',
      );
      for (const r of existingNodes) {
        const c = r.content as unknown as RequirementDecompositionNodeContent;
        if ((c.root_kind ?? 'fr') !== config.rootKind) continue;
        parentChain.set(c.node_id, c.parent_node_id);
      }
    }

    while (queue.length > 0) {
      passNumber++;
      const passStartedAt = new Date().toISOString();
      const nodesProducedAtPassStart = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node').length;
      const passEntries = queue.splice(0, queue.length);
      const passAssumptions: AssumptionEntry[] = [];
      const pendingGateByParent = new Map<string, Array<{
        nodeRecordId: string;
        logicalNodeId: string;
        displayKey: string;
        story: DecompositionUserStory;
        rationale?: string;
      }>>();
      // Step 4b — parents whose tierHint was 'B' but whose decomposition
      // produced commitment-level (Tier B) children anyway. The human
      // effectively accepted scope they hadn't yet been asked about; we
      // write a 'downgraded' supersession record on the parent and
      // prepend a context note to the follow-up gate bundle so the human
      // sees why additional commitments are being surfaced.
      const downgradeNotesByParent = new Map<string, string>();
      // Step 4c — post-gate Tier-B parents whose decomposition produced
      // only Tier-C/D children (no 4b mislabel signal). These are the
      // candidates for the structural AC-shape audit: the decomposer
      // produced implementation-shaped output, but the ACs themselves
      // may still encode un-made policy choices.
      const postGateCleanAudits: Array<{
        parentLogicalNodeId: string;
        parentDisplayKey: string;
        parentStory: DecompositionUserStory;
        children: DecompositionUserStory[];
      }> = [];

      for (const entry of passEntries) {
        // Depth cap: freeze without decomposing further.
        if (entry.depth >= caps.depth_cap) {
          getLogger().warn('workflow', 'Phase 2.1a: depth cap reached on branch — freezing as deferred', {
            nodeId: entry.nodeId, displayKey: entry.displayKey, depth: entry.depth, cap: caps.depth_cap,
          });
          this.writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
          continue;
        }
        // Budget cap (per-root): defer this entry if its root has hit the
        // per-root LLM-call budget. Other roots continue until each hits
        // its own cap. Matches the docstring intent of "max LLM calls
        // across all passes for one root FR".
        const rootCalls = callsByRoot.get(entry.rootFrId) ?? 0;
        if (rootCalls >= caps.budget_cap) {
          getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: per-root budget cap reached — deferring`, {
            rootFrId: entry.rootFrId, rootCalls, cap: caps.budget_cap,
          });
          this.writeDeferredSupersession(ctx, entry, passNumber, 'budget_cap_reached', config);
          continue;
        }

        try {
          const siblings = siblingsByParent.get(entry.parentNodeId) ?? [];
          // Scoped assumption injection — restrict the existing-set passed
          // to this decomposer call to assumptions surfaced at nodes in
          // this entry's ancestor chain (including itself) + assumptions
          // with no surfaced_at_node (global / seed). Rationale: sibling
          // branches' assumptions are often not relevant here and feeding
          // them in encourages the decomposer to re-surface / rephrase
          // them, driving duplicate growth. Bounds prompt size regardless
          // of total assumption count.
          const ancestorIds = new Set<string | null>();
          ancestorIds.add(entry.nodeId);
          let cursor: string | null | undefined = entry.parentNodeId;
          while (cursor) {
            if (ancestorIds.has(cursor)) break; // cycle guard
            ancestorIds.add(cursor);
            cursor = parentChain.get(cursor) ?? null;
          }
          const scopedAssumptions = [...allAssumptions, ...passAssumptions]
            .filter(a => !a.duplicate_of) // never inject flagged duplicates
            .filter(a => a.surfaced_at_node == null || ancestorIds.has(a.surfaced_at_node));
          const variables: Record<string, string> = {
            active_constraints: '(none — wave 6 step 4a minimal)',
            parent_story: formatRootStoryForDecomposition(entry.userStory as UserStory),
            parent_tier_hint: entry.tierHint,
            // Sibling context uses the LLM's raw `story.id` strings — the
            // decomposer prompt speaks the LLM's own ID vocabulary, not
            // our canonical UUIDs.
            sibling_context: siblings.length <= 1
              ? '(none — sole child under this parent)'
              : siblings.filter(s => s.id !== entry.userStory.id)
                  .map(s => `- ${s.id}: ${s.action} -> ${s.outcome}`).join('\n'),
            handoff_context: handoffSummary,
            existing_assumptions: scopedAssumptions.length === 0
              ? '(none yet)'
              : scopedAssumptions
                  .map(a => `- [${a.id}] (${a.category}) ${a.text}`).join('\n'),
            current_depth: String(entry.depth),
            janumicode_version_sha: engine.janumiCodeVersionSha,
          };
          const rendered = engine.templateLoader.render(template, variables);
          if (rendered.missing_variables.length > 0) {
            throw new Error(
              `Phase 2.1a: decomposition template has unfilled variables ` +
              `[${rendered.missing_variables.join(', ')}].`,
            );
          }

          // Increment this root's per-root counter BEFORE dispatching
          // the decomposer call. Matches the sequential cap-check above
          // so a second pass that starts at N and makes a call goes to
          // N+1 before checking the cap again.
          callsByRoot.set(entry.rootFrId, (callsByRoot.get(entry.rootFrId) ?? 0) + 1);
          const result = await engine.callForRole('requirements_agent', {
            prompt: rendered.rendered,
            responseFormat: 'json',
            temperature: 0.5,
            traceContext: {
              workflowRunId: workflowRun.id,
              phaseId: '2',
              // Route trace context by the configured sub-phase id so NFR
              // decomposer calls land under 2.2a rather than masquerading
              // as 2.1a in the invocation log + agent_invocation records.
              subPhaseId: config.recordSubPhaseId,
              agentRole: 'requirements_agent',
              label: `Phase ${config.recordSubPhaseId} Pass-${passNumber} — decomposition of ${entry.displayKey} (depth ${entry.depth}, hint ${entry.tierHint})`,
            },
          });

          const parsed = result.parsed as Record<string, unknown> | null;
          const childrenRaw = Array.isArray(parsed?.children)
            ? parsed.children as Array<Record<string, unknown>> : [];
          const surfacedRaw = Array.isArray(parsed?.surfaced_assumptions)
            ? parsed.surfaced_assumptions as Array<Record<string, unknown>> : [];
          const tierAssessment = parsed?.parent_tier_assessment as Record<string, unknown> | undefined;
          if (tierAssessment && tierAssessment.agrees_with_hint === false) {
            // Log disagreement for Step 4b; no action in 4a.
            getLogger().warn('workflow', 'Phase 2.1a: decomposer disagrees with tier hint', {
              nodeId: entry.nodeId, displayKey: entry.displayKey, hint: entry.tierHint,
              assessed: tierAssessment.tier, rationale: tierAssessment.rationale,
            });
          }

          // Collect surfaced assumptions for this pass.
          const childAssumptionIds: string[] = [];
          for (const a of surfacedRaw) {
            const text = typeof a.text === 'string' ? a.text : null;
            if (!text) continue;
            const category = typeof a.category === 'string'
              ? a.category as AssumptionCategory : 'scope';
            const citations = Array.isArray(a.citations)
              ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
            const assumption: AssumptionEntry = {
              id: newAssumptionId(),
              text,
              source: 'decomposition' satisfies DecompositionAssumptionSource,
              surfaced_at_node: entry.nodeId,
              surfaced_at_pass: passNumber,
              category,
              citations,
            };
            passAssumptions.push(assumption);
            childAssumptionIds.push(assumption.id);
          }

          // Write children. Route by tier.
          const childDepth = entry.depth + 1;
          maxDepthReached = Math.max(maxDepthReached, childDepth);
          const emittedChildren: DecompositionUserStory[] = [];
          const emittedChildrenWithTier: Array<{ story: DecompositionUserStory; tier: DecompositionTier; logicalNodeId: string; displayKey: string }> = [];
          // Track display-key collisions within THIS sibling batch so the
          // LLM's repeated use of e.g. `FR-ACCT-1.1` for multiple children
          // under the same parent resolves to distinct display labels.
          const siblingDisplayKeys = new Set<string>();
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
            const tier = normalizeTier(c.tier);
            const rationale = typeof c.decomposition_rationale === 'string'
              ? c.decomposition_rationale : undefined;
            // Tier D nodes ARE leaves — written as atomic immediately.
            // Tier A/B/C nodes start 'pending'; B joins pending-gate batch
            // rather than the next-pass queue.
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
                pass_number: passNumber,
                status: initialStatus,
                tier,
                root_kind: config.rootKind,
                user_story: story,
                decomposition_rationale: rationale,
                surfaced_assumption_ids: childAssumptionIds,
                // Inherit release assignment from parent. Preserved
                // across revisions (Q2 = preserve in the design doc).
                release_id: entry.releaseId,
                release_ordinal: entry.releaseOrdinal,
              } satisfies RequirementDecompositionNodeContent,
            });
            emittedChildren.push(story);
            emittedChildrenWithTier.push({ story, tier, logicalNodeId, displayKey });
            // Keep parentChain current for scoped-assumption lookups
            // within this same pass (subsequent entries processed this
            // pass may need to resolve ancestors through newly-written
            // nodes). Keyed by logical UUID so ancestor walks match.
            parentChain.set(logicalNodeId, entry.nodeId);

            if (tier === 'A') {
              queue.push({
                parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
                rootFrId: entry.rootFrId, depth: childDepth, userStory: story,
                displayKey, tierHint: 'A',
                releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              });
            } else if (tier === 'B') {
              const batch = pendingGateByParent.get(entry.nodeId) ?? [];
              batch.push({ nodeRecordId: childRec.id, logicalNodeId, displayKey, story, rationale });
              pendingGateByParent.set(entry.nodeId, batch);
            } else if (tier === 'C') {
              queue.push({
                parentRecordId: childRec.id, nodeId: logicalNodeId, parentNodeId: entry.nodeId,
                rootFrId: entry.rootFrId, depth: childDepth, userStory: story,
                displayKey, tierHint: 'C',
                releaseId: entry.releaseId, releaseOrdinal: entry.releaseOrdinal,
              });
            }
            // Tier D: already frozen atomic — no queue insertion.
          }
          if (emittedChildren.length > 0) {
            siblingsByParent.set(entry.nodeId, emittedChildren);
          }

          // Step 4b — mislabel detection on previously-accepted Tier-B parents.
          // Two signals trigger a downgrade:
          //   1. Explicit: decomposer's parent_tier_assessment disagrees with
          //      the 'B' hint and says the parent is still Tier A.
          //   2. Implicit: this pass produced Tier-B children under the parent
          //      (pendingGateByParent now holds them). Any accepted Tier-B
          //      parent that produces further Tier-B children is effectively
          //      still a functional sub-area whose commitments are one level
          //      deeper than the human saw at the original gate.
          if (entry.tierHint === 'B') {
            const explicitDisagreement = tierAssessment
              && tierAssessment.agrees_with_hint === false
              && typeof tierAssessment.tier === 'string'
              && (tierAssessment.tier === 'A' || tierAssessment.tier === 'B');
            const producedTierBChildren = (pendingGateByParent.get(entry.nodeId)?.length ?? 0) > 0;
            if (explicitDisagreement || producedTierBChildren) {
              const reason = explicitDisagreement
                ? `tier_downgrade: decomposer_assessed_${tierAssessment?.tier}_not_B`
                : 'tier_downgrade: post_gate_children_still_tier_B';
              getLogger().warn('workflow', `Phase ${config.recordSubPhaseId} Step 4b: downgrading previously-accepted Tier-B parent`, {
                nodeId: entry.nodeId, displayKey: entry.displayKey, reason,
                producedTierB: pendingGateByParent.get(entry.nodeId)?.length ?? 0,
                explicitDisagreement,
              });
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
                  pass_number: passNumber,
                  status: 'downgraded',
                  root_kind: config.rootKind,
                  user_story: entry.userStory,
                  surfaced_assumption_ids: [],
                  pruning_reason: reason,
                  release_id: entry.releaseId,
                  release_ordinal: entry.releaseOrdinal,
                } satisfies RequirementDecompositionNodeContent,
              });
              // Retire the prior pending version of this logical node so
              // only the downgraded row remains is_current_version=1.
              engine.writer.supersedeDecompositionNodeByLogicalId(
                workflowRun.id, entry.nodeId, downgradedRec.id,
              );
              if (producedTierBChildren) {
                downgradeNotesByParent.set(
                  entry.nodeId,
                  `The commitment '${entry.displayKey}' you accepted earlier turned out to ` +
                  `have its own commitment layer underneath. The items below are ` +
                  `sub-commitments within '${entry.displayKey}' that need your review as well.`,
                );
              }
            } else if (emittedChildrenWithTier.length > 0) {
              // Step 4c — clean post-gate decomposition. The parent was
              // hinted 'B' and produced only Tier-C/D children (no 4b
              // mislabel). Queue the children's ACs for structural audit
              // after the pass finishes writing nodes.
              postGateCleanAudits.push({
                parentLogicalNodeId: entry.nodeId,
                parentDisplayKey: entry.displayKey,
                parentStory: entry.userStory,
                children: emittedChildrenWithTier.map(x => x.story),
              });
            }
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking node deferred`, {
            nodeId: entry.nodeId, displayKey: entry.displayKey, error: reason,
          });
          this.writeDeferredSupersession(ctx, entry, passNumber, `decomposition_failed: ${reason}`, config);
        }
      }

      // Append an incremental pass entry to the pipeline container. We
      // rewrite the container record here (supersession — is_current_version
      // flips the earlier version) so the webview's pipeline card always
      // reflects the latest state without replaying the full stream.
      const nodesProducedThisPass = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node').length - nodesProducedAtPassStart;
      pipelinePasses.push({
        pass_number: passNumber,
        status: 'completed',
        started_at: passStartedAt,
        completed_at: new Date().toISOString(),
        nodes_produced: nodesProducedThisPass,
        assumption_delta: passAssumptions.length,
      });
      const passUpdateRecord = engine.writer.writeRecord({
        record_type: 'requirement_decomposition_pipeline',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '2',
        sub_phase_id: config.recordSubPhaseId,
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [pipelineStartRecord.id],
        content: {
          kind: 'requirement_decomposition_pipeline',
          pipeline_id: pipelineId,
          root_fr_id: pipelineRootKey,
          passes: [...pipelinePasses],
        } satisfies RequirementDecompositionPipelineContent,
      });
      engine.writer.supersedByRollback(currentPipelineRecordId, passUpdateRecord.id);
      currentPipelineRecordId = passUpdateRecord.id;

      // Wave 6 dedup pass — compute embeddings for the new assumptions,
      // compare against the cached prior-set + any already-flagged
      // pass-local ones, and flag near-dupes in place. We NEVER remove
      // entries (flag-but-don't-merge); `duplicate_of` is just an
      // annotation so the downstream semantic_delta can exclude flagged
      // rows. Any failure in the embedding call degrades gracefully:
      // raw delta remains as the fallback termination signal.
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
              getLogger().info('workflow', `Phase ${config.recordSubPhaseId}: assumption flagged as duplicate`, {
                id: a.id, of: match.id, similarity: Number(match.similarity.toFixed(3)),
              });
            }
            // Cache regardless — whether canonical or duplicate, future
            // passes should be able to match against this embedding.
            embeddingCache.set(a.id, v);
          }
        } catch (err) {
          dedupFailedThisPass = true;
          getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: dedup embed failed this pass — flags skipped`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const semanticDelta = passAssumptions.filter(a => !a.duplicate_of).length;

      // Per-pass assumption snapshot. delta = raw count added; semantic_delta
      // = count minus flagged duplicates (what gates saturation termination).
      allAssumptions.push(...passAssumptions);
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
          pass_number: passNumber,
          root_fr_id: config.rootKind === 'nfr' ? '*nfr*' : '*',
          assumptions: [...allAssumptions],
          delta_from_previous_pass: passAssumptions.length,
          semantic_delta: semanticDelta,
        } satisfies AssumptionSetSnapshotContent,
      });

      // Step 4c — structural AC-shape audit on clean post-gate
      // decompositions. Runs only if the config flag is on, since each
      // audit costs one reasoning_review LLM call.
      if (caps.reasoning_review_on_tier_c && postGateCleanAudits.length > 0) {
        for (const audit of postGateCleanAudits) {
          await this.runTierCAcShapeAudit(
            ctx,
            audit.parentLogicalNodeId,
            audit.parentDisplayKey,
            audit.parentStory,
            audit.children,
            passNumber,
            config.recordSubPhaseId,
          );
        }
      }

      // Fire mirror gates for Tier-B batches produced in this pass.
      if (pendingGateByParent.size > 0) {
        const bundlePlans = this.emitDepth2GateBundles(
          ctx, pendingGateByParent, passAssumptions, downgradeNotesByParent, config,
        );
        const resolutions = await Promise.all(
          bundlePlans.map(p => engine.pauseForDecision(workflowRun.id, p.bundleRecordId, 'decision_bundle')),
        );
        // Apply resolutions. Rejected children → pruned supersession.
        // Accepted children → queued for their own decomposition pass
        // (tier hint = B so prompt knows to produce Tier-C commitments).
        for (let i = 0; i < bundlePlans.length; i++) {
          const plan = bundlePlans[i];
          const resolution = resolutions[i];
          const payload = (resolution as unknown as { payload?: { mirror_decisions?: MirrorItemDecision[] } }).payload;
          const decisions = Array.isArray(payload?.mirror_decisions) ? payload.mirror_decisions : [];
          const rejectedIds = new Set(decisions.filter(d => d.action === 'rejected').map(d => d.item_id));
          for (const child of plan.childItems) {
            if (rejectedIds.has(child.itemId)) {
              this.writePrunedSupersession(ctx, plan.parentNodeId, child, 'human-rejected', config);
            } else {
              queue.push({
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
      }

      // ── Dedup-offline detection ────────────────────────────────
      // If the embed client keeps timing out (single-GPU slot swapping,
      // ollama not running, etc.), semantic_delta collapses to raw
      // delta and the saturation gate can never fire. Track consecutive
      // failures; WARN after `dedupOfflineWarnPasses` so the operator
      // sees the signal. Advisory only — does NOT early-terminate on
      // its own (budget_cap / depth_cap / diverging are the hard
      // rails). On a successful dedup pass the counter resets.
      if (dedupFailedThisPass) {
        consecutiveDedupOfflinePasses++;
        if (consecutiveDedupOfflinePasses >= dedupOfflineWarnPasses && !dedupOfflineAnnounced) {
          getLogger().warn('workflow',
            `Phase ${config.recordSubPhaseId}: assumption dedup has been offline for ${consecutiveDedupOfflinePasses} consecutive passes — semantic_delta equals raw delta; saturation termination is likely unreachable. Check JANUMICODE_EMBEDDING_URL reachability + timeouts.`,
            { consecutiveDedupOfflinePasses, passNumber });
          dedupOfflineAnnounced = true;
        }
      } else {
        if (dedupOfflineAnnounced) {
          getLogger().info('workflow',
            `Phase ${config.recordSubPhaseId}: assumption dedup is back online after ${consecutiveDedupOfflinePasses} offline passes`,
            { passNumber });
          dedupOfflineAnnounced = false;
        }
        consecutiveDedupOfflinePasses = 0;
      }

      // ── Divergence detection ───────────────────────────────────
      // Healthy Wave 6 saturation peaks mid-run and declines to
      // fixed-point. Every pass growing by ≥ `divergeGrowthRatio`
      // over the prior pass means the decomposer is expanding, not
      // converging — usually a downstream signal that dedup is dead
      // or the prompt is over-eagerly splitting. After N consecutive
      // growth passes WARN; at N+1 (divergeTerminatePasses) hard
      // terminate with a named reason and defer the queue.
      const priorPass = pipelinePasses.length >= 2
        ? pipelinePasses[pipelinePasses.length - 2]
        : null;
      const growthObserved = priorPass
        && priorPass.nodes_produced > 0
        && nodesProducedThisPass > priorPass.nodes_produced * divergeGrowthRatio;
      if (growthObserved) {
        consecutiveGrowthPasses++;
        if (consecutiveGrowthPasses >= divergeWarnPasses) {
          const ratios = pipelinePasses.slice(-divergeWarnPasses - 1)
            .map((p, i, arr) => i === 0 ? null : (p.nodes_produced / (arr[i - 1].nodes_produced || 1)))
            .slice(1).map(r => r?.toFixed(2));
          getLogger().warn('workflow',
            `Phase ${config.recordSubPhaseId}: saturation loop appears to be diverging — ${consecutiveGrowthPasses} consecutive passes with > ${divergeGrowthRatio}× node growth`,
            {
              passNumber,
              consecutiveGrowthPasses,
              recent_ratios: ratios,
              recent_nodes_produced: pipelinePasses.slice(-5).map(p => p.nodes_produced),
              dedupOffline: consecutiveDedupOfflinePasses > 0,
            });
        }
        if (consecutiveGrowthPasses >= divergeTerminatePasses) {
          getLogger().warn('workflow',
            `Phase ${config.recordSubPhaseId}: EARLY TERMINATE — diverging loop after ${consecutiveGrowthPasses} consecutive growth passes. Marking remaining queue as deferred with reason='diverging'.`,
            { passNumber, remainingQueueSize: queue.length });
          for (const remaining of queue) {
            this.writeDeferredSupersession(ctx, remaining, passNumber, 'diverging', config);
          }
          queue.length = 0;
          divergingEarlyTerminate = true;
        }
      } else {
        consecutiveGrowthPasses = 0;
      }

      // Fixed-point check: pass produced zero new children AND zero new
      // assumptions AND queue is empty → terminate. Queue-empty alone is
      // the real terminator; the other signals just tell us the loop
      // converged cleanly rather than running out of work by accident.
      // Saturation termination — gated on semantic_delta (new ideas) not
      // raw delta (new rows). With dedup flagging in place, a pass that
      // only surfaces duplicates has semantic_delta === 0 and fires
      // termination correctly even though delta_from_previous_pass > 0.
      if (divergingEarlyTerminate) break;
      if (semanticDelta === 0 && queue.length === 0) break;
    }

    // Finalize the pipeline container: derive termination reason + final
    // counts. Written as a new supersession record with the same
    // pipeline_id so the webview picks the latest.
    const totalLlmCalls = [...callsByRoot.values()].reduce((a, b) => a + b, 0);
    const maxRootCalls = callsByRoot.size > 0 ? Math.max(...callsByRoot.values()) : 0;
    // Termination reason priority (matches detection order inside the
    // loop): diverging-early-terminate > budget_cap > depth_cap >
    // dedup_offline (if chronic but loop still exited for another
    // reason) > fixed_point.
    let terminationReason: DecompositionTerminationReason;
    if (divergingEarlyTerminate) terminationReason = 'diverging';
    else if (maxRootCalls >= caps.budget_cap) terminationReason = 'budget_cap';
    else if (maxDepthReached >= caps.depth_cap) terminationReason = 'depth_cap';
    else if (dedupOfflineAnnounced) terminationReason = 'dedup_offline';
    else terminationReason = 'fixed_point';
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
      derived_from_record_ids: [pipelineStartRecord.id],
      content: {
        kind: 'requirement_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_fr_id: pipelineRootKey,
        passes: pipelinePasses.map((p, i) =>
          i === pipelinePasses.length - 1
            ? { ...p, termination_reason: terminationReason }
            : p,
        ),
        final_leaf_count: atomicLeafCount,
        final_max_depth: maxDepthReached,
        total_llm_calls: totalLlmCalls,
      } satisfies RequirementDecompositionPipelineContent,
    });
    engine.writer.supersedByRollback(currentPipelineRecordId, pipelineFinalRecord.id);

    // Persist budget telemetry back to the workflow_runs row so operators
    // can see per-run decomposition load without walking the stream.
    // Per-kind column so a completed FR loop doesn't clobber NFR's
    // baseline (the resume path reads per-kind, not the aggregate).
    try {
      engine.stateMachine.updateDecompositionTelemetry(
        workflowRun.id,
        config.rootKind,
        totalLlmCalls,
        maxDepthReached,
      );
    } catch {
      // Telemetry is best-effort — never block phase completion on it.
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
      recordSubPhaseId: '2.1a',
      templateSubPhase: '02_1a_functional_requirements_decomposition',
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
        summaryLines.push(`[Scope expansion] ${downgradeNote}`);
        summaryLines.push('');
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
    subPhaseId: '2.1a' | '2.2a' = '2.1a',
  ): Promise<void> {
    const { engine, workflowRun } = ctx;
    const template = engine.templateLoader.findTemplate(
      'reasoning_review',
      'cross_cutting_tier_c_ac_shape_audit',
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
    if (typeof item === 'string') {
      if (item.length > 0) out.push(item);
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const text = (o.description ?? o.text ?? o.title ?? o.criterion) as string | undefined;
      if (typeof text === 'string' && text.length > 0) out.push(text);
    }
  }
  return out;
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
    const tech = t.technology ? ` [${t.technology}${t.version ? '@' + t.version : ''}]` : '';
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

  // Latest record per node_id (by produced_at).
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of kindMatch) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    const prior = latestByNodeId.get(c.node_id);
    if (!prior || r.produced_at > prior.produced_at) {
      latestByNodeId.set(c.node_id, r);
    }
  }
  // Parent → children map (for siblingsByParent + pending detection).
  const childrenByParent = new Map<string, Set<string>>();
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.parent_node_id) {
      const set = childrenByParent.get(c.parent_node_id) ?? new Set<string>();
      set.add(c.node_id);
      childrenByParent.set(c.parent_node_id, set);
    }
  }

  // Rebuild queue: pending nodes whose children haven't been written.
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

  // Rebuild siblingsByParent from the latest-per-node map.
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

  // Rebuild assumption state from the latest snapshot for this root_kind.
  const snapshots = engine.writer.getRecordsByType(workflowRun.id, 'assumption_set_snapshot', false);
  const kindMarker = pipelineRootKey;
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
    if (m) assumptionSeq = Math.max(assumptionSeq, parseInt(m[1], 10));
  }

  // Rebuild pipeline container state: find the latest current-version record
  // with matching pipeline_id and root_fr_id. If that isn't current, fall
  // back to the newest by produced_at.
  const allPipelines = engine.writer.getRecordsByType(
    workflowRun.id, 'requirement_decomposition_pipeline', false,
  );
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
  // Max depth — walk all latest nodes for this kind. Per-root LLM-call
  // counters intentionally do NOT resume; each resume session starts
  // with a fresh per-root budget (see runSaturationLoop).
  let maxDepth = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.depth > maxDepth) maxDepth = c.depth;
  }

  return {
    queue,
    allAssumptions,
    assumptionSeq,
    siblingsByParent: siblings,
    maxDepthReached: maxDepth,
    passNumber,
    pipelinePasses,
    pipelineStartRecord: startRecord,
    currentPipelineRecordId: latestRecord.id,
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
    ? c.priority as 'critical' | 'high' | 'medium' | 'low'
    : 'medium';
  const traces = Array.isArray(c.traces_to)
    ? (c.traces_to as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return { id, role, action, outcome, acceptance_criteria: acs, priority, traces_to: traces };
}
