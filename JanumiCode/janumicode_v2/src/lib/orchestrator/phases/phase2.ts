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
  Workflow,
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
} from '../../types/records';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import type { DecisionBundleContent, MirrorItem, MirrorItemDecision } from '../../types/decisionBundle';

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

    // Wave 5 — under the product lens, Phase 1 also emits a
    // product_description_handoff record. When present we thread it
    // into the FR/NFR bloom helpers so they can pull journey /
    // entity / workflow / V&V / tech / compliance / vocabulary data
    // directly from it (instead of re-deriving from the thin
    // intent_statement). Null under other lenses — bloom helpers then
    // follow the default-lens path unchanged.
    const allHandoffRecords = engine.writer.getRecordsByType(workflowRun.id, 'product_description_handoff');
    const handoffHit = findProductDescriptionHandoff(allHandoffRecords);
    const handoff = handoffHit
      ? (handoffHit.content as unknown as ProductDescriptionHandoffContent)
      : null;
    const handoffRecordId = handoffHit?.recordId ?? null;

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
      frContent = await this.runFunctionalRequirementsBloom(ctx, intentSummary, dmr21, handoff);
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

    // Wave 6 — emit depth-0 decomposition node records mirroring each
    // root FR. These are the seeds for sub-phase 2.1a recursive
    // decomposition. Skipped on resume (nodes already exist in the stream).
    let rootNodeIds: string[];
    if (resumingFr) {
      rootNodeIds = existingRootNodes.map(r => r.id);
    } else {
      rootNodeIds = [];
      for (const story of frContent.user_stories) {
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
            node_id: story.id,
            parent_node_id: null,
            root_fr_id: story.id,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            user_story: story as DecompositionUserStory,
            surfaced_assumption_ids: [],
          } satisfies RequirementDecompositionNodeContent,
        });
        rootNodeIds.push(node.id);
      }
    }

    // ── 2.1a — Functional Requirements Decomposition (product lens) ──
    // Wave 6 Pass-1 Level-1 decomposition. Skipped on default lens.
    if (handoff) {
      engine.stateMachine.setSubPhase(workflowRun.id, '2.1a');
      await this.runSaturationLoop(
        ctx,
        handoff,
        frContent.user_stories,
        rootNodeIds,
      );
    }

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
      `${s.id} [${s.priority}]: As a ${s.role}, I want ${s.action}, so that ${s.outcome}. ACs: ${s.acceptance_criteria.map(ac => `${ac.id}: ${ac.measurable_condition}`).join('; ')}`,
    ).join('\n');

    let nfrContent: NonFunctionalRequirements;
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
      nfrContent = await this.runNonFunctionalRequirementsBloom(
        ctx, intentSummary, frSummary, dmr22, handoff,
      );
    }

    const nfrDerivedFrom = [
      frRecord.id,
      ...(handoffRecordId ? [handoffRecordId] : []),
    ];
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

    // Wave 6 — emit depth-0 NFR decomposition node records (one per
    // root NFR) and run the NFR saturation loop under sub-phase 2.2a.
    // Skipped on default-lens runs (no handoff). The saturation loop is
    // the same method that drives FR decomposition; it's parameterized
    // on sub-phase id + template id + root_kind.
    if (handoff) {
      let nfrRootNodeIds: string[];
      const nfrAsStories: UserStory[] = nfrContent.requirements.map(adaptNfrToUserStory);
      if (resumingNfr) {
        nfrRootNodeIds = existingNfrRootNodes.map(r => r.id);
      } else {
        nfrRootNodeIds = [];
        for (const story of nfrAsStories) {
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
              node_id: story.id,
              parent_node_id: null,
              root_fr_id: story.id,
              depth: 0,
              pass_number: 0,
              status: 'pending',
              root_kind: 'nfr',
              user_story: story as DecompositionUserStory,
              surfaced_assumption_ids: [],
            } satisfies RequirementDecompositionNodeContent,
          });
          nfrRootNodeIds.push(node.id);
        }
      }

      engine.stateMachine.setSubPhase(workflowRun.id, '2.2a');
      await this.runSaturationLoop(
        ctx,
        handoff,
        nfrAsStories,
        nfrRootNodeIds,
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
    child: { nodeRecordId: string; childNodeId: string },
    reasonCode: string,
    config: SaturationLoopConfig,
  ): void {
    const { engine, workflowRun } = ctx;
    // Retrieve the original child content to carry its user_story
    // forward into the supersession record (supersession records are
    // self-contained — downstream consumers shouldn't have to join back
    // to the superseded record to read the story).
    const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node', false);
    const original = allNodes.find(r => r.id === child.nodeRecordId);
    if (!original) return;
    const originalContent = original.content as unknown as RequirementDecompositionNodeContent;
    engine.writer.writeRecord({
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
        node_id: child.childNodeId,
        parent_node_id: parentNodeId,
        root_fr_id: originalContent.root_fr_id,
        depth: 2,
        pass_number: 2,
        status: 'pruned',
        root_kind: config.rootKind,
        user_story: originalContent.user_story,
        surfaced_assumption_ids: originalContent.surfaced_assumption_ids,
        pruning_reason: reasonCode,
      } satisfies RequirementDecompositionNodeContent,
    });
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
      parentRecordId: string;
      nodeId: string;                 // id carried on the decomposition node (= user_story.id for roots)
      parentNodeId: string | null;
      rootFrId: string;
      depth: number;
      userStory: DecompositionUserStory;
      tierHint: DecompositionTier | 'root';
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
    const queue: QueueEntry[] = resumed?.queue ?? rootStories.map((s, i) => ({
      parentRecordId: rootNodeRecordIds[i],
      nodeId: s.id,
      parentNodeId: null,
      rootFrId: s.id,
      depth: 0,
      userStory: s as DecompositionUserStory,
      tierHint: 'root',
    }));
    const siblingsByParent = resumed?.siblingsByParent ?? new Map<string | null, DecompositionUserStory[]>();
    if (!resumed) {
      siblingsByParent.set(null, rootStories.map(s => s as DecompositionUserStory));
    }

    let llmCallsUsed = resumed?.llmCallsUsed ?? 0;
    let maxDepthReached = resumed?.maxDepthReached ?? 0;
    let passNumber = resumed?.passNumber ?? 0;

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
        llmCallsUsed,
        maxDepthReached,
      });
    }

    while (queue.length > 0) {
      passNumber++;
      const passStartedAt = new Date().toISOString();
      const nodesProducedAtPassStart = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node').length;
      const passEntries = queue.splice(0, queue.length);
      const passAssumptions: AssumptionEntry[] = [];
      const pendingGateByParent = new Map<string, Array<{
        nodeRecordId: string;
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
        parentStory: DecompositionUserStory;
        children: DecompositionUserStory[];
      }> = [];

      for (const entry of passEntries) {
        // Depth cap: freeze without decomposing further.
        if (entry.depth >= caps.depth_cap) {
          getLogger().warn('workflow', 'Phase 2.1a: depth cap reached on branch — freezing as deferred', {
            nodeId: entry.nodeId, depth: entry.depth, cap: caps.depth_cap,
          });
          this.writeDeferredSupersession(ctx, entry, passNumber, 'depth_cap_reached', config);
          continue;
        }
        // Budget cap: defer remaining nodes and exit the loop.
        if (llmCallsUsed >= caps.budget_cap) {
          getLogger().warn('workflow', 'Phase 2.1a: budget cap reached — deferring remaining queue', {
            remaining: passEntries.length, used: llmCallsUsed, cap: caps.budget_cap,
          });
          this.writeDeferredSupersession(ctx, entry, passNumber, 'budget_cap_reached', config);
          continue;
        }

        try {
          const siblings = siblingsByParent.get(entry.parentNodeId) ?? [];
          const variables: Record<string, string> = {
            active_constraints: '(none — wave 6 step 4a minimal)',
            parent_story: formatRootStoryForDecomposition(entry.userStory as UserStory),
            parent_tier_hint: entry.tierHint,
            sibling_context: siblings.length <= 1
              ? '(none — sole child under this parent)'
              : siblings.filter(s => s.id !== entry.nodeId)
                  .map(s => `- ${s.id}: ${s.action} -> ${s.outcome}`).join('\n'),
            handoff_context: handoffSummary,
            existing_assumptions: (allAssumptions.length + passAssumptions.length) === 0
              ? '(none yet)'
              : [...allAssumptions, ...passAssumptions]
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

          llmCallsUsed++;
          const result = await engine.callForRole('requirements_agent', {
            prompt: rendered.rendered,
            responseFormat: 'json',
            temperature: 0.5,
            traceContext: {
              workflowRunId: workflowRun.id,
              phaseId: '2',
              subPhaseId: '2.1a',
              agentRole: 'requirements_agent',
              label: `Phase 2.1a Pass-${passNumber} — decomposition of ${entry.nodeId} (depth ${entry.depth}, hint ${entry.tierHint})`,
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
              nodeId: entry.nodeId, hint: entry.tierHint,
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
          const emittedChildrenWithTier: Array<{ story: DecompositionUserStory; tier: DecompositionTier }> = [];
          let fanoutCount = 0;
          for (const c of childrenRaw) {
            if (++fanoutCount > caps.fanout_cap) {
              getLogger().warn('workflow', 'Phase 2.1a: fanout cap reached — dropping remaining children', {
                parentNodeId: entry.nodeId, cap: caps.fanout_cap, totalOffered: childrenRaw.length,
              });
              break;
            }
            const story = sanitizeChildStory(c, { rootId: entry.nodeId, childIndex: fanoutCount });
            if (!story) continue;
            const tier = normalizeTier(c.tier);
            const rationale = typeof c.decomposition_rationale === 'string'
              ? c.decomposition_rationale : undefined;
            // Tier D nodes ARE leaves — written as atomic immediately.
            // Tier A/B/C nodes start 'pending'; B joins pending-gate batch
            // rather than the next-pass queue.
            const initialStatus: DecompositionNodeStatus = tier === 'D' ? 'atomic' : 'pending';
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
                node_id: story.id,
                parent_node_id: entry.nodeId,
                root_fr_id: entry.rootFrId,
                depth: childDepth,
                pass_number: passNumber,
                status: initialStatus,
                tier,
                root_kind: config.rootKind,
                user_story: story,
                decomposition_rationale: rationale,
                surfaced_assumption_ids: childAssumptionIds,
              } satisfies RequirementDecompositionNodeContent,
            });
            emittedChildren.push(story);
            emittedChildrenWithTier.push({ story, tier });

            if (tier === 'A') {
              queue.push({
                parentRecordId: childRec.id, nodeId: story.id, parentNodeId: entry.nodeId,
                rootFrId: entry.rootFrId, depth: childDepth, userStory: story, tierHint: 'A',
              });
            } else if (tier === 'B') {
              const batch = pendingGateByParent.get(entry.nodeId) ?? [];
              batch.push({ nodeRecordId: childRec.id, story, rationale });
              pendingGateByParent.set(entry.nodeId, batch);
            } else if (tier === 'C') {
              queue.push({
                parentRecordId: childRec.id, nodeId: story.id, parentNodeId: entry.nodeId,
                rootFrId: entry.rootFrId, depth: childDepth, userStory: story, tierHint: 'C',
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
                nodeId: entry.nodeId, reason,
                producedTierB: pendingGateByParent.get(entry.nodeId)?.length ?? 0,
                explicitDisagreement,
              });
              engine.writer.writeRecord({
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
                  root_fr_id: entry.rootFrId,
                  depth: entry.depth,
                  pass_number: passNumber,
                  status: 'downgraded',
                  root_kind: config.rootKind,
                  user_story: entry.userStory,
                  surfaced_assumption_ids: [],
                  pruning_reason: reason,
                } satisfies RequirementDecompositionNodeContent,
              });
              if (producedTierBChildren) {
                downgradeNotesByParent.set(
                  entry.nodeId,
                  `The commitment '${entry.nodeId}' you accepted earlier turned out to ` +
                  `have its own commitment layer underneath. The items below are ` +
                  `sub-commitments within '${entry.nodeId}' that need your review as well.`,
                );
              }
            } else if (emittedChildrenWithTier.length > 0) {
              // Step 4c — clean post-gate decomposition. The parent was
              // hinted 'B' and produced only Tier-C/D children (no 4b
              // mislabel). Queue the children's ACs for structural audit
              // after the pass finishes writing nodes.
              postGateCleanAudits.push({
                parentStory: entry.userStory,
                children: emittedChildrenWithTier.map(x => x.story),
              });
            }
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          getLogger().warn('workflow', `Phase ${config.recordSubPhaseId}: decomposition failed — marking node deferred`, {
            nodeId: entry.nodeId, error: reason,
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

      // Per-pass assumption snapshot. delta = new assumptions THIS pass.
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
        } satisfies AssumptionSetSnapshotContent,
      });

      // Step 4c — structural AC-shape audit on clean post-gate
      // decompositions. Runs only if the config flag is on, since each
      // audit costs one reasoning_review LLM call.
      if (caps.reasoning_review_on_tier_c && postGateCleanAudits.length > 0) {
        for (const audit of postGateCleanAudits) {
          await this.runTierCAcShapeAudit(ctx, audit.parentStory, audit.children, passNumber, config.recordSubPhaseId);
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
                nodeId: child.childNodeId,
                parentNodeId: plan.parentNodeId,
                rootFrId: child.rootFrId,
                depth: child.depth,
                userStory: child.userStory,
                tierHint: 'B',
              });
            }
          }
        }
      }

      // Fixed-point check: pass produced zero new children AND zero new
      // assumptions AND queue is empty → terminate. Queue-empty alone is
      // the real terminator; the other signals just tell us the loop
      // converged cleanly rather than running out of work by accident.
      if (passAssumptions.length === 0 && queue.length === 0) break;
    }

    // Finalize the pipeline container: derive termination reason + final
    // counts. Written as a new supersession record with the same
    // pipeline_id so the webview picks the latest.
    const terminationReason: DecompositionTerminationReason =
      llmCallsUsed >= caps.budget_cap ? 'budget_cap'
      : maxDepthReached >= caps.depth_cap ? 'depth_cap'
      : 'fixed_point';
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
        total_llm_calls: llmCallsUsed,
      } satisfies RequirementDecompositionPipelineContent,
    });
    engine.writer.supersedByRollback(currentPipelineRecordId, pipelineFinalRecord.id);

    // Persist budget telemetry back to the workflow_runs row so operators
    // can see per-run decomposition load without walking the stream.
    try {
      engine.stateMachine.updateDecompositionTelemetry(
        workflowRun.id,
        llmCallsUsed,
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
    parentNodeId: string;
    childItems: Array<{
      itemId: string;
      nodeRecordId: string;
      childNodeId: string;
      userStory: DecompositionUserStory;
      rootFrId: string;
      depth: number;
    }>;
  }> {
    const { engine, workflowRun } = ctx;
    const plans: Array<{
      bundleRecordId: string;
      parentNodeId: string;
      childItems: Array<{
        itemId: string;
        nodeRecordId: string;
        childNodeId: string;
        userStory: DecompositionUserStory;
        rootFrId: string;
        depth: number;
      }>;
    }> = [];
    // Look up each parent node record so we can carry its root_fr_id and
    // depth into the child queue entries on acceptance.
    const allNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const byNodeId = new Map<string, RequirementDecompositionNodeContent>();
    for (const r of allNodes) {
      const c = r.content as unknown as RequirementDecompositionNodeContent;
      byNodeId.set(c.node_id, c);
    }

    for (const [parentNodeId, children] of pendingGateByParent) {
      const parentContent = byNodeId.get(parentNodeId);
      const mirrorItems: MirrorItem[] = children.map((c, idx) => ({
        id: `child-${idx}`,
        text: `${c.story.id} [Tier B commitment]: ${c.story.action} -> ${c.story.outcome}`,
        rationale: c.rationale,
        category: 'scope',
      }));
      const childItems = children.map((c, idx) => {
        const childContent = byNodeId.get(c.story.id);
        return {
          itemId: `child-${idx}`,
          nodeRecordId: c.nodeRecordId,
          childNodeId: c.story.id,
          userStory: c.story,
          rootFrId: childContent?.root_fr_id ?? parentContent?.root_fr_id ?? parentNodeId,
          depth: childContent?.depth ?? ((parentContent?.depth ?? 0) + 1),
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
        surface_id: `${config.gateSurfacePrefix}${parentNodeId}`,
        title: `Scope commitments under ${parentNodeId}`,
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
    },
    passNumber: number,
    reasonCode: string,
    config: SaturationLoopConfig,
  ): void {
    const { engine, workflowRun } = ctx;
    engine.writer.writeRecord({
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
        root_fr_id: entry.rootFrId,
        depth: entry.depth,
        pass_number: passNumber,
        status: 'deferred',
        root_kind: config.rootKind,
        user_story: entry.userStory,
        surfaced_assumption_ids: [],
        pruning_reason: reasonCode,
      } satisfies RequirementDecompositionNodeContent,
    });
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
        parentId: parentStory.id,
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
        parentId: parentStory.id, missing: rendered.missing_variables,
      });
      return;
    }

    try {
      const result = await engine.llmCaller.call({
        provider: routing.primary.provider,
        model: routing.primary.model,
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: routing.temperature,
        traceContext: {
          workflowRunId: workflowRun.id,
          phaseId: '2',
          subPhaseId,
          agentRole: 'reasoning_review',
          label: `Phase ${subPhaseId} Step 4c — AC-shape audit under ${parentStory.id}`,
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
          parentId: parentStory.id,
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
          parent_node_id: parentStory.id,
          pass_number: passNumber,
          children_reviewed: children.map(c => c.id),
          findings,
          summary,
          policy_count: policyCount,
        },
      });
    } catch (err) {
      getLogger().warn('workflow', 'Phase 2.1a/2.2a Step 4c: AC-shape audit call failed — advisory skipped', {
        parentId: parentStory.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Sub-Phase 2.1: Generate Functional Requirements from the Intent Statement.
   */
  private async runFunctionalRequirementsBloom(
    ctx: PhaseContext,
    intentSummary: string,
    dmr: PhaseContextPacketResult,
    handoff: ProductDescriptionHandoffContent | null = null,
  ): Promise<FunctionalRequirements> {
    const { engine } = ctx;
    // Under the product lens (handoff present) we resolve a lens-tagged
    // template that renders the richer handoff sections. Otherwise we
    // keep the default-lens template which reads only intent_statement.
    const lens = handoff ? 'product' : undefined;
    const template = engine.templateLoader.findTemplate(
      'requirements_agent',
      '02_1_functional_requirements',
      lens,
    );

    const fallback: FunctionalRequirements = {
      user_stories: [{
        id: 'US-001',
        role: 'user',
        action: 'use the core functionality',
        outcome: 'achieve the primary goal described in the intent',
        acceptance_criteria: [{
          id: 'AC-001',
          description: 'Core functionality is available',
          measurable_condition: 'System responds within 2 seconds',
        }],
        priority: 'high',
        traces_to: [],
      }],
    };

    if (!template) return fallback;

    const variables: Record<string, string> = {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      compliance_context_summary: '(none)',
      detail_file_path: dmr.detailFilePath,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    };
    if (handoff) {
      Object.assign(variables, {
        product_vision: handoff.productVision ?? '',
        accepted_journeys: formatJourneys(handoff.userJourneys ?? []),
        accepted_entities: formatEntities(handoff.entityProposals ?? []),
        accepted_workflows: formatWorkflows(handoff.workflowProposals ?? []),
        compliance_extracted_items: formatExtractedItems(handoff.complianceExtractedItems ?? []),
        canonical_vocabulary: formatVocabulary(handoff.canonicalVocabulary ?? []),
        open_questions: formatExtractedItems(handoff.openQuestions ?? []),
      });
    }
    const rendered = engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) return fallback;

    // Product-lens path uses callForRole so the env-var routing hooks
    // (JANUMICODE_REQUIREMENTS_AGENT_BACKING / ...) apply. Default path
    // keeps the legacy hardcoded ollama call to avoid regression risk
    // in non-product tests that don't register a requirements_agent route.
    const result = handoff
      ? await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.5,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '2',
            subPhaseId: '2.1',
            agentRole: 'requirements_agent',
            label: 'Phase 2.1 — Functional Requirements Bloom (product lens)',
          },
        })
      : await engine.llmCaller.call({
          provider: 'ollama',
          model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.5,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '2',
            subPhaseId: '2.1',
            agentRole: 'requirements_agent',
            label: 'Phase 2.1 — Functional Requirements Bloom',
          },
        });

    const parsed = result.parsed as Record<string, unknown> | null;
    // The LLM may wrap the output: { functional_requirements: [{ user_stories }] }
    // or return directly: { user_stories }. Handle both.
    const fr = parsed?.functional_requirements;
    const stories = parsed?.user_stories
      ?? (Array.isArray(fr) ? (fr[0] as Record<string, unknown>)?.user_stories : (fr as Record<string, unknown>)?.user_stories);
    if (Array.isArray(stories) && stories.length > 0) {
      return { user_stories: stories as UserStory[] };
    }
    return fallback;
  }

  /**
   * Sub-Phase 2.2: Generate Non-Functional Requirements.
   */
  private async runNonFunctionalRequirementsBloom(
    ctx: PhaseContext,
    intentSummary: string,
    frSummary: string,
    dmr: PhaseContextPacketResult,
    handoff: ProductDescriptionHandoffContent | null = null,
  ): Promise<NonFunctionalRequirements> {
    const { engine } = ctx;
    const lens = handoff ? 'product' : undefined;
    const template = engine.templateLoader.findTemplate(
      'requirements_agent',
      '02_2_nonfunctional_requirements',
      lens,
    );

    const fallback: NonFunctionalRequirements = {
      requirements: [{
        id: 'NFR-001',
        category: 'performance',
        description: 'System response time',
        threshold: 'p95 response time < 500ms',
        measurement_method: 'Load testing with representative workload',
        traces_to: [],
      }],
    };

    if (!template) return fallback;

    const variables: Record<string, string> = {
      active_constraints: dmr.activeConstraintsText,
      intent_statement_summary: intentSummary,
      functional_requirements_summary: frSummary,
      compliance_context_summary: 'No compliance regimes',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    };
    if (handoff) {
      Object.assign(variables, {
        quality_attributes: (handoff.qualityAttributes ?? [])
          .map((q, i) => `- [QA-${i + 1}] ${q}`).join('\n') || '(none)',
        vv_requirements: formatVVRequirements(handoff.vvRequirements ?? []),
        technical_constraints: formatTechnicalConstraints(handoff.technicalConstraints ?? []),
        compliance_extracted_items: formatExtractedItems(handoff.complianceExtractedItems ?? []),
      });
    }
    const rendered = engine.templateLoader.render(template, variables);
    if (rendered.missing_variables.length > 0) return fallback;

    // Same routing pattern as FR bloom: product-lens via callForRole,
    // default-lens via legacy hardcoded path for regression safety.
    const result = handoff
      ? await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.5,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '2',
            subPhaseId: '2.2',
            agentRole: 'requirements_agent',
            label: 'Phase 2.2 — Non-Functional Requirements Bloom (product lens)',
          },
        })
      : await engine.llmCaller.call({
          provider: 'ollama',
          model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.5,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '2',
            subPhaseId: '2.2',
            agentRole: 'requirements_agent',
            label: 'Phase 2.2 — Non-Functional Requirements Bloom',
          },
        });

    const parsed = result.parsed as Record<string, unknown> | null;
    // The LLM may wrap: { non_functional_requirements: [...] }
    // or return directly: { requirements: [...] }. Handle both.
    const nfr = parsed?.non_functional_requirements;
    const reqs = parsed?.requirements
      ?? (Array.isArray(nfr) ? nfr : (nfr as Record<string, unknown>)?.requirements);
    if (Array.isArray(reqs) && reqs.length > 0) {
      const normalized = (reqs as Array<Record<string, unknown>>).map(r => {
        const out = { ...r } as Record<string, unknown>;
        if (Array.isArray(r.applies_to_requirements)) {
          out.applies_to_requirements = (r.applies_to_requirements as unknown[])
            .filter((x): x is string => typeof x === 'string' && x.length > 0);
        }
        return out;
      });
      return { requirements: normalized as unknown as NonFunctionalRequirement[] };
    }
    return fallback;
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
}

// ── Product-lens handoff formatters (wave 5) ───────────────────────
//
// Render handoff sections as compact text blocks for the LLM prompt.
// Keeps each bloom's input ≤ ~5 K tokens even for a Hestami-scale
// handoff by showing ids + key fields rather than full JSON.

function formatJourneys(js: UserJourney[]): string {
  if (!js.length) return '(none)';
  return js.map(j => {
    const acs = (j.acceptanceCriteria ?? []).slice(0, 3).join(' | ');
    return `- ${j.id} [${j.implementationPhase ?? '?'}] (persona ${j.personaId}) ${j.title}: ${j.scenario}` +
           (acs ? `\n  Acceptance: ${acs}` : '');
  }).join('\n');
}

function formatEntities(es: Entity[]): string {
  if (!es.length) return '(none)';
  return es.map(e => `- ${e.id} (${e.businessDomainId}) ${e.name}: ${e.description}`).join('\n');
}

function formatWorkflows(ws: Workflow[]): string {
  if (!ws.length) return '(none)';
  return ws.map(w => `- ${w.id} (${w.businessDomainId}) ${w.name}: ${w.description}`).join('\n');
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
    tierHint: DecompositionTier | 'root';
  }>;
  allAssumptions: AssumptionEntry[];
  assumptionSeq: number;
  siblingsByParent: Map<string | null, DecompositionUserStory[]>;
  llmCallsUsed: number;
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
      tierHint,
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
  // Max depth / LLM calls — walk all latest nodes for this kind.
  let maxDepth = 0;
  for (const r of latestByNodeId.values()) {
    const c = r.content as unknown as RequirementDecompositionNodeContent;
    if (c.depth > maxDepth) maxDepth = c.depth;
  }
  // LLM calls is stored on workflow_runs — best-effort read.
  const run = engine.stateMachine.getWorkflowRun(workflowRun.id);
  const llmCallsUsed = (run as unknown as { decomposition_budget_calls_used?: number })
    ?.decomposition_budget_calls_used ?? pipelinePasses.reduce((a, p) => a + (p.nodes_produced ?? 0), 0);

  return {
    queue,
    allAssumptions,
    assumptionSeq,
    siblingsByParent: siblings,
    llmCallsUsed,
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
As a ${s.role}, I want ${s.action}, so that ${s.outcome}.
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
