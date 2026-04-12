/**
 * Narrative Memory Generator — structured Phase summary with inline citations.
 * Based on JanumiCode Spec v2.3, §8.3.
 *
 * Single LLM API call. Synchronous — blocks Phase transition.
 * Produced at every Phase Gate acceptance before next Phase begins.
 *
 * Prompt is loaded from .janumicode/prompts/cross_cutting/narrative_memory.system.md
 */

import { LLMCaller } from '../llm/llmCaller';
import { TemplateLoader } from '../orchestrator/templateLoader';

// ── Types ───────────────────────────────────────────────────────────

export interface NarrativeMemoryInput {
  phaseId: string;
  phaseName: string;
  decisionTraceSummary: string;
  approvedArtifacts: string;
  priorNarrativeMemory?: string;
  unstickingSummaries?: string;
}

export interface NarrativeMemoryOutput {
  phaseId: string;
  phaseName: string;
  continuitySummary: string;
  subPhases: NarrativeSubPhase[];
  unstickingSummary: string | null;
  governingConstraintsEstablished: CitedClaim[];
  complianceDecisions: CitedClaim[];
}

export interface NarrativeSubPhase {
  subPhaseId: string;
  subPhaseName: string;
  whatWasDone: string;
  keyDecisions: { decision: string; rationale: string; sourceRecordId: string }[];
  assumptionsConfirmed: { assumption: string; sourceRecordId: string }[];
  openItemsDeferred: { item: string; sourceRecordId: string }[];
  systemProposedItemsApproved: { item: string; sourceRecordId: string }[];
}

export interface CitedClaim {
  claim: string;
  sourceRecordId: string;
}

export interface NarrativeMemoryConfig {
  provider: string;
  model: string;
  temperature: number;
  janumiCodeVersionSha: string;
}

const TEMPLATE_KEY = 'cross_cutting/narrative_memory.system';

// ── NarrativeMemoryGenerator ────────────────────────────────────────

export class NarrativeMemoryGenerator {
  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly templateLoader: TemplateLoader,
    private readonly config: NarrativeMemoryConfig,
  ) {}

  /**
   * Generate a Narrative Memory for a completed phase.
   */
  async generate(input: NarrativeMemoryInput): Promise<NarrativeMemoryOutput> {
    const template = this.templateLoader.getTemplate(TEMPLATE_KEY);

    if (!template) {
      throw new Error(
        `Narrative Memory prompt template not found: ${TEMPLATE_KEY}`,
      );
    }

    // Build optional sections
    let priorMemory = '';
    if (input.priorNarrativeMemory) {
      priorMemory = `PRIOR PHASE NARRATIVE MEMORY:\n${input.priorNarrativeMemory}`;
    }

    let unsticking = '';
    if (input.unstickingSummaries) {
      unsticking = `UNSTICKING SESSION SUMMARIES:\n${input.unstickingSummaries}`;
    }

    const renderResult = this.templateLoader.render(template, {
      phase_id: input.phaseId,
      phase_name: input.phaseName,
      decision_trace_summary: input.decisionTraceSummary,
      approved_artifacts: input.approvedArtifacts,
      prior_narrative_memory: priorMemory,
      unsticking_summaries: unsticking,
      janumicode_version_sha: this.config.janumiCodeVersionSha,
    });

    const result = await this.llmCaller.call({
      provider: this.config.provider,
      model: this.config.model,
      prompt: renderResult.rendered,
      responseFormat: 'json',
      temperature: this.config.temperature,
    });

    return this.parseResult(result.parsed, input.phaseId, input.phaseName);
  }

  private parseResult(
    parsed: Record<string, unknown> | null,
    phaseId: string,
    phaseName: string,
  ): NarrativeMemoryOutput {
    if (!parsed) {
      return {
        phaseId,
        phaseName,
        continuitySummary: 'Narrative Memory generation failed — LLM did not produce valid JSON.',
        subPhases: [],
        unstickingSummary: null,
        governingConstraintsEstablished: [],
        complianceDecisions: [],
      };
    }

    const subPhases: NarrativeSubPhase[] = [];
    const rawSubPhases = parsed.sub_phases as Record<string, unknown>[] | undefined;

    if (Array.isArray(rawSubPhases)) {
      for (const sp of rawSubPhases) {
        subPhases.push({
          subPhaseId: (sp.sub_phase_id as string) ?? '',
          subPhaseName: (sp.sub_phase_name as string) ?? '',
          whatWasDone: (sp.what_was_done as string) ?? '',
          keyDecisions: this.parseCitedArray(sp.key_decisions, ['decision', 'rationale']),
          assumptionsConfirmed: this.parseCitedArray(sp.assumptions_confirmed, ['assumption']),
          openItemsDeferred: this.parseCitedArray(sp.open_items_deferred, ['item']),
          systemProposedItemsApproved: this.parseCitedArray(sp.system_proposed_items_approved, ['item']),
        });
      }
    }

    return {
      phaseId,
      phaseName,
      continuitySummary: (parsed.continuity_summary as string) ?? '',
      subPhases,
      unstickingSummary: (parsed.unsticking_summary as string) ?? null,
      governingConstraintsEstablished: this.parseCitedClaims(parsed.governing_constraints_established),
      complianceDecisions: this.parseCitedClaims(parsed.compliance_decisions),
    };
  }

  private parseCitedClaims(raw: unknown): CitedClaim[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(item => ({
      claim: ((item as Record<string, unknown>).claim as string) ?? '',
      sourceRecordId: ((item as Record<string, unknown>).source_record_id as string) ?? '',
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCitedArray(raw: unknown, fields: string[]): any[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
      const result: Record<string, string> = {
        sourceRecordId: ((item as Record<string, unknown>).source_record_id as string) ?? '',
      };
      for (const field of fields) {
        result[field] = ((item as Record<string, unknown>)[field] as string) ?? '';
      }
      return result;
    });
  }
}
