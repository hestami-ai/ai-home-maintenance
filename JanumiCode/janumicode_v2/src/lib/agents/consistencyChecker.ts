/**
 * Consistency Checker Agent — cross-artifact traceability and semantic consistency.
 * Based on JanumiCode Spec v2.3, §8.2.
 *
 * Three check types:
 *   1. Mechanical traceability — deterministic assertion verification
 *   2. Semantic consistency — LLM-powered free reasoning across artifacts
 *   3. Internal consistency — within each artifact, self-contradiction check
 *
 * Produces a consistency_report with blocking_failures and warnings.
 */

import { LLMCaller } from '../llm/llmCaller';
import { TemplateLoader } from '../orchestrator/templateLoader';

const SEMANTIC_TEMPLATE_KEY = 'cross_cutting/consistency_checker_semantic.system';

// ── Types ───────────────────────────────────────────────────────────

export interface ConsistencyCheckInput {
  /** Artifacts to check (serialized JSON) */
  artifacts: { id: string; type: string; content: Record<string, unknown> }[];
  /** Traceability assertions from Phase Gate Criteria */
  traceabilityAssertions: TraceabilityAssertion[];
  /** Phase ID */
  phaseId: string;
  /** Compliance context (if applicable) */
  complianceContext?: string;
}

export interface TraceabilityAssertion {
  id: string;
  description: string;
  /** Source field path (e.g., "functional_requirements.user_stories[*].id") */
  sourceField: string;
  /** Target field path (e.g., "system_requirements.items[*].source_requirement_ids") */
  targetField: string;
  /** Source artifact type */
  sourceArtifactType: string;
  /** Target artifact type */
  targetArtifactType: string;
}

export interface ConsistencyReport {
  overallPass: boolean;
  traceabilityResults: TraceabilityResult[];
  semanticFindings: ConsistencyFinding[];
  internalFindings: ConsistencyFinding[];
  complianceFindings: ConsistencyFinding[];
  blockingFailures: string[];
  warnings: string[];
}

export interface TraceabilityResult {
  assertionId: string;
  assertion: string;
  pass: boolean;
  failures: { itemId: string; explanation: string }[];
}

export interface ConsistencyFinding {
  severity: 'critical' | 'warning';
  description: string;
  artifactIdsInvolved: string[];
  recommendedAction: string;
}

// ── ConsistencyChecker ──────────────────────────────────────────────

export class ConsistencyChecker {
  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly templateLoader?: TemplateLoader,
  ) {}

  /**
   * Run all three check types.
   */
  async check(input: ConsistencyCheckInput): Promise<ConsistencyReport> {
    // 1. Mechanical traceability (deterministic)
    const traceabilityResults = this.checkTraceability(input);

    // 2. Semantic consistency (LLM — simplified for now)
    const semanticFindings = await this.checkSemanticConsistency(input);

    // 3. Internal consistency (deterministic scan for obvious contradictions)
    const internalFindings = this.checkInternalConsistency(input);

    // Aggregate
    const blockingFailures: string[] = [];
    const warnings: string[] = [];

    for (const tr of traceabilityResults) {
      if (!tr.pass) blockingFailures.push(tr.assertionId);
    }

    for (const f of [...semanticFindings, ...internalFindings]) {
      if (f.severity === 'critical') blockingFailures.push(f.description);
      else warnings.push(f.description);
    }

    return {
      overallPass: blockingFailures.length === 0,
      traceabilityResults,
      semanticFindings,
      internalFindings,
      complianceFindings: [],
      blockingFailures,
      warnings,
    };
  }

  /**
   * Mechanical traceability — deterministic assertion verification.
   * Checks that every source value has a corresponding target reference.
   */
  checkTraceability(input: ConsistencyCheckInput): TraceabilityResult[] {
    const results: TraceabilityResult[] = [];

    for (const assertion of input.traceabilityAssertions) {
      const sourceArtifact = input.artifacts.find(a => a.type === assertion.sourceArtifactType);
      const targetArtifact = input.artifacts.find(a => a.type === assertion.targetArtifactType);

      if (!sourceArtifact || !targetArtifact) {
        results.push({
          assertionId: assertion.id,
          assertion: assertion.description,
          pass: false,
          failures: [{
            itemId: 'N/A',
            explanation: `Missing artifact: ${!sourceArtifact ? assertion.sourceArtifactType : assertion.targetArtifactType}`,
          }],
        });
        continue;
      }

      const sourceValues = this.extractValues(sourceArtifact.content, assertion.sourceField);
      const targetValues = this.extractValues(targetArtifact.content, assertion.targetField);
      const targetSet = new Set(targetValues.map(String));

      const failures: { itemId: string; explanation: string }[] = [];

      for (const sv of sourceValues) {
        if (!targetSet.has(String(sv))) {
          failures.push({
            itemId: String(sv),
            explanation: `Source value "${sv}" from ${assertion.sourceArtifactType}.${assertion.sourceField} has no match in ${assertion.targetArtifactType}.${assertion.targetField}`,
          });
        }
      }

      results.push({
        assertionId: assertion.id,
        assertion: assertion.description,
        pass: failures.length === 0,
        failures,
      });
    }

    return results;
  }

  /**
   * Semantic consistency — LLM-powered reasoning.
   * Prompt loaded from .janumicode/prompts/cross_cutting/consistency_checker_semantic.system.md
   */
  private async checkSemanticConsistency(
    input: ConsistencyCheckInput,
  ): Promise<ConsistencyFinding[]> {
    if (input.artifacts.length < 2) return [];
    if (!this.templateLoader) return [];

    const template = this.templateLoader.getTemplate(SEMANTIC_TEMPLATE_KEY);
    if (!template) return [];

    const artifactSummaries = input.artifacts.map(a =>
      `[${a.type}] (id: ${a.id}):\n${JSON.stringify(a.content, null, 2).slice(0, 2000)}`
    ).join('\n\n---\n\n');

    // LLM throws propagate — a failed semantic consistency check
    // leaves the pipeline unable to say whether artifacts contradict
    // each other, which is the whole point of the check. Halt rather
    // than silently report "no findings" on a broken backing.
    const renderResult = this.templateLoader.render(template, {
      artifact_summaries: artifactSummaries,
      janumicode_version_sha: 'dev',
    });

    const result = await this.llmCaller.call({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: renderResult.rendered,
      responseFormat: 'json',
      temperature: 0.2,
    });

    if (result.parsed && Array.isArray(result.parsed.findings)) {
      return (result.parsed.findings as Record<string, unknown>[]).map(f => ({
        severity: (f.severity as 'critical' | 'warning') ?? 'warning',
        description: (f.description as string) ?? '',
        artifactIdsInvolved: (f.artifact_ids as string[]) ?? [],
        recommendedAction: (f.recommended_action as string) ?? '',
      }));
    }

    return [];
  }

  /**
   * Internal consistency — scan for obvious self-contradictions.
   */
  private checkInternalConsistency(
    _input: ConsistencyCheckInput,
  ): ConsistencyFinding[] {
    // Deterministic checks for common internal inconsistencies
    // This is a placeholder — real implementation would check specific patterns
    return [];
  }

  /**
   * Extract values from a nested object using a dot-separated path with [*] wildcards.
   */
  private extractValues(obj: Record<string, unknown>, path: string): unknown[] {
    const segments = path.split('.');
    return this.resolveSegments(obj, segments);
  }

  private resolveSegments(obj: unknown, segments: string[]): unknown[] {
    if (segments.length === 0) return [obj];
    if (obj === null || obj === undefined) return [];

    const [head, ...tail] = segments;

    if (head.endsWith('[*]')) {
      const fieldName = head.slice(0, -3);
      const arr = (obj as Record<string, unknown>)[fieldName];
      if (!Array.isArray(arr)) return [];
      const results: unknown[] = [];
      for (const item of arr) {
        results.push(...this.resolveSegments(item, tail));
      }
      return results;
    }

    const value = (obj as Record<string, unknown>)[head];
    if (value === undefined) return [];
    return this.resolveSegments(value, tail);
  }
}
