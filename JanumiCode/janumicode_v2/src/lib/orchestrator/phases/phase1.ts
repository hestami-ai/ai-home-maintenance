/**
 * Phase 1 — Intent Capture and Convergence.
 * Based on JanumiCode Spec v2.3, §4 Phase 1.
 *
 * Sub-phases:
 *   1.0  — Intent Quality Check (Orchestrator LLM call)
 *   1.1b — Scope Bounding and Compliance Context (deterministic placeholder)
 *   1.2  — Intent Domain Bloom (Domain Interpreter Agent — real LLM call)
 *   1.3  — Intent Mirror and Menu (human prune via webview)
 *   1.4  — Intent Statement Synthesis (Domain Interpreter Agent — real LLM call)
 *   1.5  — Intent Statement Approval (human approval via webview)
 *
 * Wave 5: Implements the full flow end-to-end. Awaits human decisions via
 * `engine.pauseForDecision`. Phase handlers are idempotent on re-entry —
 * record ids are derived deterministically from the run id where possible.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord, PhaseId } from '../../types/records';
import type {
  DecisionBundleContent,
  MirrorItem,
  MenuOption,
  MirrorItemDecision,
  MenuOptionSelection,
} from '../../types/decisionBundle';
import { getLogger } from '../../logging';
import { parseJsonWithRecovery } from '../../llm/jsonRecovery';

/** An assumption may be a plain string or a {statement, basis} object from the LLM. */
type AssumptionEntry = string | { statement?: string; inference?: string; basis?: string };

function assumptionText(a: AssumptionEntry): string {
  if (typeof a === 'string') return a;
  return a.statement ?? a.inference ?? JSON.stringify(a);
}

interface BloomCandidate {
  id: string;
  name: string;
  description: string;
  who_it_serves: string;
  problem_it_solves: string;
  assumptions: AssumptionEntry[];
  constraints: string[];
  open_questions: string[];
}

interface BloomContent {
  candidate_product_concepts: BloomCandidate[];
}

interface IntentStatementContent {
  product_concept: {
    name: string;
    description: string;
    who_it_serves: string;
    problem_it_solves: string;
  };
  confirmed_assumptions: string[];
  confirmed_constraints: string[];
  out_of_scope: string[];
}

export class Phase1Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '1';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Sub-Phase 1.0 — Intent Quality Check ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.0');

    const rawIntentRecords = engine.writer.getRecordsByType(workflowRun.id, 'raw_intent_received');
    if (rawIntentRecords.length === 0) {
      return {
        success: false,
        error: 'No Raw Intent found. Use startWorkflowRun or record a raw_intent_received first.',
        artifactIds,
      };
    }

    const rawIntent = rawIntentRecords[0];
    const rawIntentText = (rawIntent.content.text as string) ?? JSON.stringify(rawIntent.content);

    const qualityReport = await this.runIntentQualityCheck(ctx, rawIntentText);

    const qualityRecord = engine.writer.writeRecord({
      record_type: 'intent_quality_report',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.0',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      content: qualityReport,
    });
    artifactIds.push(qualityRecord.id);
    engine.ingestionPipeline.ingest(qualityRecord);

    if (qualityReport.overall_status === 'blocking') {
      engine.eventBus.emit('error:occurred', {
        message: 'Intent Quality Check found blocking issues',
        context: JSON.stringify(qualityReport),
      });
      return {
        success: false,
        error: 'Intent Quality Check found blocking contradictions — must be resolved before bloom',
        artifactIds,
      };
    }

    // ── Sub-Phase 1.1b — Scope Bounding ───────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.1b');

    const scopeRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: {
        kind: 'scope_classification',
        breadth: 'single_product',
        depth: 'production_grade',
      },
    });
    artifactIds.push(scopeRecord.id);
    engine.ingestionPipeline.ingest(scopeRecord);

    const complianceRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'compliance_context', regimes: [] },
    });
    artifactIds.push(complianceRecord.id);
    engine.ingestionPipeline.ingest(complianceRecord);

    // ── Sub-Phase 1.2 — Intent Domain Bloom (real) ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.2');

    // Invoke DMR to build a Context Packet for the bloom. DMR retrieves
    // ingested external files (from Phase 0.1b + 0.2), prior decisions
    // (brownfield), and the raw intent itself — giving the Domain
    // Interpreter actual file content to reason from.
    const ingestedFiles = await this.collectIngestedFileContent(ctx);
    const contextPacket = await this.runDMR(ctx, rawIntentText);

    const bloomContent = await this.runIntentDomainBloom(
      ctx, rawIntentText, ingestedFiles, contextPacket,
    );

    const bloomRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.2',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [rawIntent.id],
      // Stamp `kind` so the harness oracle can match this record against
      // the PHASE1_CONTRACT entry for `intent_bloom`. Every other
      // artifact_produced record in the pipeline carries `content.kind`
      // as the discriminator; this one was missing it, which made the
      // oracle treat the bloom as a missing artifact.
      content: { kind: 'intent_bloom', ...bloomContent } as unknown as Record<string, unknown>,
    });
    artifactIds.push(bloomRecord.id);
    engine.ingestionPipeline.ingest(bloomRecord);

    // ── Sub-Phase 1.3 — Intent Mirror & Menu (human prune) ────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.3');

    // Extract assumption rows from each bloom candidate so the MirrorCard
    // can render v1-style per-row Accept / Reject / Defer / Edit surfaces.
    const assumptionItems: import('../../types/records').AssumptionItem[] = [];
    for (const candidate of bloomContent.candidate_product_concepts) {
      for (let i = 0; i < candidate.assumptions.length; i++) {
        const entry = candidate.assumptions[i];
        assumptionItems.push({
          id: `${candidate.id}-assumption-${i}`,
          text: assumptionText(entry),
          category: candidate.name,
          source: 'ai_proposed',
          status: 'pending',
          rationale: typeof entry === 'object' ? entry.basis : undefined,
        });
      }
      // Surface each candidate's open questions as assumptions too (they're
      // ambiguities the user should consciously accept or reject).
      for (let i = 0; i < candidate.open_questions.length; i++) {
        assumptionItems.push({
          id: `${candidate.id}-openq-${i}`,
          text: `Open question: ${candidate.open_questions[i]}`,
          category: candidate.name,
          source: 'ai_proposed',
          status: 'pending',
        });
      }
    }

    const assumptionMirror = engine.mirrorGenerator.generateAssumptionMirror({
      artifactId: bloomRecord.id,
      artifactType: 'intent_bloom',
      assumptions: assumptionItems,
      steelMan: bloomContent.candidate_product_concepts.length > 0
        ? `I identified ${bloomContent.candidate_product_concepts.length} candidate interpretation(s) of your intent. Review the assumptions and open questions below, then approve, reject, defer, or edit each one.`
        : undefined,
    });

    // Emit ONE composite decision_bundle_presented instead of a separate
    // mirror + menu pair. The bundle carries both sections atomically, so
    // the user can't resolve the Mirror and accidentally bypass the Menu
    // (the bug the composite surface exists to prevent).
    const mirrorItems: MirrorItem[] = assumptionMirror.assumptions.map(a => ({
      id: a.id,
      text: a.text,
      rationale: a.rationale,
    }));
    const hasMenu = bloomContent.candidate_product_concepts.length > 1;
    const menuOptions: MenuOption[] = hasMenu
      ? bloomContent.candidate_product_concepts.map((c, i) => ({
          id: c.id,
          label: c.name,
          description: c.description,
          recommended: i === 0,
          tradeoffs: c.open_questions.length > 0
            ? `${c.open_questions.length} open question(s): ${c.open_questions[0]}`
            : undefined,
        }))
      : [];
    const bundleContent: DecisionBundleContent = {
      surface_id: `phase1-bloom-prune-${bloomRecord.id}`,
      title: 'Confirm bloom assumptions' + (hasMenu ? ' and prune candidates' : ''),
      summary: assumptionMirror.steelMan,
      mirror: {
        kind: 'assumption_mirror',
        items: mirrorItems,
      },
      ...(hasMenu ? {
        menu: {
          question: 'Select the candidate interpretations to keep for synthesis:',
          context: `${bloomContent.candidate_product_concepts.length} candidates were generated from your intent. Keep the ones that best match what you want to build.`,
          multi_select: true,
          allow_free_text: false,
          options: menuOptions,
        },
      } : {}),
    };

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.3',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id],
      content: bundleContent as unknown as Record<string, unknown>,
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: assumptionMirror.mirrorId,
      artifactType: 'intent_bloom',
    });
    if (hasMenu) {
      engine.eventBus.emit('menu:presented', {
        menuId: mirrorRecord.id,
        options: bloomContent.candidate_product_concepts.map(c => c.id),
      });
    }

    // Await exactly one bundle resolution. DecisionRouter.routeBundle
    // translates the webview submit into the decision_bundle_resolved
    // record and resolves this promise with the full payload.
    let bundleResolution: {
      type: string;
      payload?: {
        mirror_decisions?: MirrorItemDecision[];
        menu_selections?: MenuOptionSelection[];
      };
    };
    try {
      bundleResolution = await engine.pauseForDecision(
        workflowRun.id,
        mirrorRecord.id,
        'decision_bundle',
      ) as typeof bundleResolution;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 1 prune decision failed', { error: String(err) });
      return { success: false, error: 'Prune decisions failed', artifactIds };
    }

    // Determine kept candidates from the menu selections (or all candidates
    // when the surface had no menu section). Mirror per-row decisions flow
    // on the resolution for audit; downstream phases can read them from
    // the decision_bundle_resolved record.
    const menuSelections = bundleResolution.payload?.menu_selections ?? [];
    let keptCandidates: BloomCandidate[];
    if (hasMenu && menuSelections.length > 0) {
      const selected = new Set(menuSelections.map(s => s.option_id));
      keptCandidates = bloomContent.candidate_product_concepts.filter(c => selected.has(c.id));
      if (keptCandidates.length === 0) keptCandidates = bloomContent.candidate_product_concepts.slice(0, 1);
    } else {
      keptCandidates = bloomContent.candidate_product_concepts;
    }

    // ── Sub-Phase 1.4 — Intent Statement Synthesis ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.4');

    const intentStatement = await this.runIntentStatementSynthesis(
      ctx,
      keptCandidates,
      rawIntentText,
    );

    const statementRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [bloomRecord.id, ...keptCandidates.map(() => mirrorRecord.id)],
      content: {
        kind: 'intent_statement',
        ...intentStatement,
      },
    });
    artifactIds.push(statementRecord.id);
    engine.ingestionPipeline.ingest(statementRecord);

    // ── Sub-Phase 1.5 — Intent Statement Approval ─────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '1.5');

    const approvalMirror = engine.mirrorGenerator.generate({
      artifactId: statementRecord.id,
      artifactType: 'intent_statement',
      content: intentStatement as unknown as Record<string, unknown>,
    });

    const approvalMirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [statementRecord.id],
      content: {
        kind: 'intent_statement_mirror',
        mirror_id: approvalMirror.mirrorId,
        artifact_id: statementRecord.id,
        artifact_type: 'intent_statement',
        fields: approvalMirror.fields,
        intent_statement: intentStatement,
      },
    });
    artifactIds.push(approvalMirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: approvalMirror.mirrorId,
      artifactType: 'intent_statement',
    });

    let approvalResolution: { type: string; payload?: Record<string, unknown> };
    try {
      approvalResolution = await engine.pauseForDecision(
        workflowRun.id,
        approvalMirrorRecord.id,
        'mirror',
      );
    } catch (err) {
      return {
        success: false,
        error: `Statement approval failed: ${String(err)}`,
        artifactIds,
      };
    }

    if (approvalResolution.type === 'mirror_rejection') {
      return { success: false, error: 'User rejected the intent statement', artifactIds };
    }

    // ── Phase Gate Surface ────────────────────────────────────
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '1',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [statementRecord.id, approvalMirrorRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '1',
        intent_statement_record_id: statementRecord.id,
        has_unresolved_warnings: false,
        has_unapproved_proposals: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '1' });

    // The DecisionRouter resolves the gate via engine.advanceToNextPhase + executeCurrentPhase.
    // Phase 1 itself reports success here; the next phase runs in a separate invocation.
    return { success: true, artifactIds };
  }

  // ── LLM helpers ────────────────────────────────────────────────

  private async runIntentQualityCheck(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<Record<string, unknown>> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('orchestrator', '01_0_intent_quality_check');
    const defaultReport = {
      completeness_findings: [],
      consistency_findings: [],
      coherence_findings: [],
      overall_status: 'pass',
    };
    if (!template) return defaultReport;

    const rendered = engine.templateLoader.render(template, {
      raw_intent_text: rawIntentText,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return defaultReport;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.3,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.0',
          agentRole: 'orchestrator',
          label: 'Phase 1.0 — Intent Quality Check',
        },
      });
      return result.parsed ?? defaultReport;
    } catch {
      return defaultReport;
    }
  }

  /**
   * Invoke Deep Memory Research to build a Context Packet for Phase 1.2.
   * Returns null on failure — the bloom degrades gracefully without it.
   */
  private async runDMR(
    ctx: PhaseContext,
    rawIntentText: string,
  ): Promise<import('../../agents/deepMemoryResearch').ContextPacket | null> {
    const { workflowRun, engine } = ctx;
    try {
      return await engine.deepMemoryResearch.research({
        requestingAgentRole: 'domain_interpreter',
        scopeTier: 'current_run', // Phase 1.2 only needs current-run context
        query: `Intent bloom context for: ${rawIntentText.slice(0, 500)}`,
        knownRelevantRecordIds: [],
        workflowRunId: workflowRun.id,
        phaseId: '1',
        subPhaseId: '1.2',
      });
    } catch (err) {
      getLogger().warn('workflow', 'DMR invocation failed in Phase 1.2', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Collect external_file_ingested artifacts from Phase 0. These carry the
   * actual content of files the human referenced in the raw intent (and,
   * for brownfield, ingested workspace files).
   */
  private async collectIngestedFileContent(
    ctx: PhaseContext,
  ): Promise<Array<{ relativePath: string; content: string; type: string; truncated: boolean }>> {
    const { workflowRun, engine } = ctx;
    const artifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');

    const ingested: Array<{ relativePath: string; content: string; type: string; truncated: boolean }> = [];
    for (const rec of artifacts) {
      const content = rec.content as Record<string, unknown>;
      if (content.kind !== 'external_file_ingested') continue;
      // Only use explicitly-referenced files in the bloom prompt — workspace
      // scan results are too noisy. Phase 2+ agents can retrieve them via DMR.
      if (content.ingested_via !== 'explicit_reference') continue;

      ingested.push({
        relativePath: String(content.relative_path ?? ''),
        content: String(content.content ?? ''),
        type: String(content.file_type ?? 'other'),
        truncated: Boolean(content.truncated),
      });
    }
    return ingested;
  }

  private async runIntentDomainBloom(
    ctx: PhaseContext,
    rawIntentText: string,
    ingestedFiles: Array<{ relativePath: string; content: string; type: string; truncated: boolean }> = [],
    contextPacket: import('../../agents/deepMemoryResearch').ContextPacket | null = null,
  ): Promise<BloomContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_2_intent_domain_bloom');

    const fallback: BloomContent = {
      candidate_product_concepts: [
        {
          id: 'c1',
          name: 'Primary interpretation',
          description: rawIntentText,
          who_it_serves: '(to be determined through bloom)',
          problem_it_solves: '(to be determined through bloom)',
          assumptions: [],
          constraints: [],
          open_questions: [],
        },
      ],
    };

    if (!template) {
      getLogger().warn('workflow', 'Intent bloom template not found; using fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
      });
      return fallback;
    }

    // Assemble an enriched raw_intent_text that embeds resolved file
    // references inline. This is the Channel 1 (stdin) path for LLM-backed
    // agents — they can't read files from disk, so we inline content here.
    const enrichedIntent = this.buildEnrichedIntentText(rawIntentText, ingestedFiles);

    // Write a detail file via ContextBuilder for audit/Phase 9 readiness.
    const detailFilePath = await this.writeDetailFile(ctx, enrichedIntent, contextPacket);

    // Build active_constraints summary from the Context Packet (authority 6+).
    const activeConstraintsText = contextPacket && contextPacket.activeConstraints.length > 0
      ? contextPacket.activeConstraints
          .map((c, i) => `${i + 1}. ${c.statement} (Authority ${c.authorityLevel}, source: ${c.sourceRecordIds[0] ?? 'unknown'})`)
          .join('\n')
      : '(none)';

    const rendered = engine.templateLoader.render(template, {
      active_constraints: activeConstraintsText,
      scope_classification_summary: 'single_product, production_grade',
      compliance_context_summary: 'No compliance regimes',
      collision_risk_aliases: 'None',
      raw_intent_text: enrichedIntent,
      detail_file_path: detailFilePath ?? '(not available)',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) {
      getLogger().warn('workflow', 'Intent bloom template render missing variables; using fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
        missing_variables: rendered.missing_variables,
      });
      return fallback;
    }

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.6,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.2',
          agentRole: 'domain_interpreter',
          label: 'Phase 1.2 — Intent Domain Bloom',
        },
      });
      let parsed = result.parsed as Record<string, unknown> | null;
      if (!parsed && typeof result.text === 'string' && result.text.trim().length > 0) {
        const recovered = parseJsonWithRecovery(result.text);
        parsed = recovered.parsed;
        if (recovered.recovered) {
          getLogger().warn('workflow', 'Recovered malformed bloom JSON from raw model text', {
            workflow_run_id: ctx.workflowRun.id,
            sub_phase_id: '1.2',
            provider: result.provider,
            model: result.model,
          });
        } else if (!recovered.parsed) {
          getLogger().warn('workflow', 'Bloom raw model text could not be parsed as JSON', {
            workflow_run_id: ctx.workflowRun.id,
            sub_phase_id: '1.2',
            provider: result.provider,
            model: result.model,
            error: recovered.error ?? 'unknown',
          });
        }
      }
      // LLM may wrap response in a top-level key like "intent_bloom"
      const unwrapped = (parsed?.intent_bloom ?? parsed?.bloom ?? parsed) as Partial<BloomContent> | null;
      if (unwrapped?.candidate_product_concepts && Array.isArray(unwrapped.candidate_product_concepts) && unwrapped.candidate_product_concepts.length > 0) {
        return { candidate_product_concepts: unwrapped.candidate_product_concepts };
      }
      getLogger().warn('workflow', 'Bloom parsed JSON did not contain candidate_product_concepts; using fallback', {
        workflow_run_id: ctx.workflowRun.id,
        sub_phase_id: '1.2',
        provider: result.provider,
        model: result.model,
        parsed_top_level_keys: parsed ? Object.keys(parsed).slice(0, 20) : [],
      });
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Bloom LLM call failed', { error: String(err) });
      return fallback;
    }
  }

  private async runIntentStatementSynthesis(
    ctx: PhaseContext,
    keptCandidates: BloomCandidate[],
    rawIntentText: string,
  ): Promise<IntentStatementContent> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('domain_interpreter', '01_4_intent_statement_synthesis');

    const primary = keptCandidates[0];
    const fallback: IntentStatementContent = {
      product_concept: {
        name: primary?.name ?? 'Untitled product',
        description: primary?.description ?? rawIntentText,
        who_it_serves: primary?.who_it_serves ?? 'unspecified',
        problem_it_solves: primary?.problem_it_solves ?? 'unspecified',
      },
      confirmed_assumptions: keptCandidates.flatMap(c => c.assumptions.map(assumptionText)),
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints),
      out_of_scope: [],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: '(none)',
      prune_decisions_summary: keptCandidates.map(c => `Kept: ${c.name}`).join('\n'),
      selected_product_concept: JSON.stringify(primary, null, 2),
      confirmed_assumptions: keptCandidates.flatMap(c => c.assumptions.map(assumptionText)).join('; '),
      confirmed_constraints: keptCandidates.flatMap(c => c.constraints).join('; '),
      out_of_scope_items: '',
      scope_classification_ref: '',
      compliance_context_ref: '',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama',
        model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.4,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '1',
          subPhaseId: '1.4',
          agentRole: 'domain_interpreter',
          label: 'Phase 1.4 — Intent Statement Synthesis',
        },
      });
      const parsed = result.parsed as Record<string, unknown> | null;
      // LLM may wrap response in a top-level key like "intent_statement"
      const unwrapped = (parsed?.intent_statement ?? parsed?.statement ?? parsed) as Partial<IntentStatementContent> | null;
      if (unwrapped?.product_concept) {
        return {
          product_concept: unwrapped.product_concept,
          confirmed_assumptions: unwrapped.confirmed_assumptions ?? fallback.confirmed_assumptions,
          confirmed_constraints: unwrapped.confirmed_constraints ?? fallback.confirmed_constraints,
          out_of_scope: unwrapped.out_of_scope ?? [],
        };
      }
      return fallback;
    } catch (err) {
      getLogger().warn('workflow', 'Synthesis LLM call failed', { error: String(err) });
      return fallback;
    }
  }

  /**
   * Build an enriched intent text that embeds resolved file references.
   * For LLM-backed agents (no filesystem access), this is the stdin path —
   * the file content IS the context. Each file is wrapped in clear
   * delimiters so the agent can distinguish intent text from reference
   * content.
   */
  private buildEnrichedIntentText(
    rawIntentText: string,
    ingestedFiles: Array<{ relativePath: string; content: string; type: string; truncated: boolean }>,
  ): string {
    if (ingestedFiles.length === 0) return rawIntentText;

    const parts: string[] = [rawIntentText.trim(), ''];
    parts.push('--- REFERENCED FILES (resolved from intent) ---', '');
    for (const file of ingestedFiles) {
      const header = `### File: ${file.relativePath} [${file.type}${file.truncated ? ', truncated' : ''}]`;
      parts.push(header, '', '```', file.content, '```', '');
    }
    parts.push('--- END REFERENCED FILES ---');
    return parts.join('\n');
  }

  /**
   * Write a Context Payload detail file under .janumicode/context/ so the
   * full assembled context is auditable (and, in future, readable by CLI
   * agents directly from disk without re-inlining). Returns the path or
   * null on failure.
   */
  private async writeDetailFile(
    ctx: PhaseContext,
    enrichedIntent: string,
    contextPacket: import('../../agents/deepMemoryResearch').ContextPacket | null,
  ): Promise<string | null> {
    const { workflowRun, engine } = ctx;
    try {
      const invocationId = `bloom-${workflowRun.id.slice(0, 8)}`;
      const constraintsText = contextPacket?.activeConstraints
        .map(c => `- ${c.statement} (Authority ${c.authorityLevel})`)
        .join('\n') ?? '';

      const payload = engine.contextBuilder.buildContextPayload(
        '1.2',
        invocationId,
        {
          governingConstraints: constraintsText,
          requiredOutputSpec: 'intent_bloom JSON — candidate_product_concepts, assumptions, open_questions',
          summaryContext: contextPacket
            ? `DMR completeness: ${contextPacket.completenessStatus}. ${contextPacket.completenessNarrative}`
            : '(no DMR context packet available)',
          detailFileReference: '',
        },
        {
          contextPacket: contextPacket ? JSON.stringify(contextPacket, null, 2) : '',
          narrativeMemories: [],
          decisionTraces: '',
          technicalSpecs: [],
          complianceContext: '',
          unstickingResolutions: '',
        },
      );
      // Augment the detail file on disk with the enriched intent so a
      // human auditor (or future CLI agent) can see exactly what the
      // agent was reasoning from.
      if (payload.detailFile?.path) {
        try {
          const fs = await import('node:fs');
          const existing = fs.readFileSync(payload.detailFile.path, 'utf-8');
          fs.writeFileSync(
            payload.detailFile.path,
            existing + '\n\n## Enriched Intent (with resolved references)\n\n' + enrichedIntent,
          );
        } catch { /* non-fatal */ }
      }
      return payload.detailFile?.path ?? null;
    } catch (err) {
      getLogger().debug('workflow', 'Failed to write Phase 1.2 detail file', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
